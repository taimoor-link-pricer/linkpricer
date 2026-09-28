/**
 * Order placement and status for the order API.
 *
 * Idempotency is by construction, not by lookup. The order's primary key is
 * derived from (account, client_reference), so a retry after a crash computes
 * the same id, the insert conflicts, and the existing order comes back — two
 * requests racing each other cannot both win, and no new column or migration
 * is needed. The same derivation is how GET ?client_reference= finds an order.
 *
 * Test mode never touches Postgres: sandbox orders live in Firestore
 * (order_api_sandbox_orders), keyed the same way, so the robot's
 * "same reference twice → one order" and "look it up by reference" tests run
 * against real behaviour without a fake row ever reaching the admin order
 * list or the team's inbox.
 */

import { createHash } from "crypto";
import { z } from "zod";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, users } from "@/lib/db/schema";
import { adminDb } from "@/lib/firebase/admin";
import { getUsdRates } from "@/lib/currency";
import { urlProblem, urlProblemMessage } from "@/lib/validate-url";
import { recordOrderEvent, getOrderEvents, ORDER_EVENT_TYPES, type OrderStatusChangedMeta } from "@/lib/orders/events";
import { withOrderMetaExt } from "@/lib/orders/metadata";
import { mirrorOrderToFirestore } from "@/lib/orders/firestore-mirror";
import { notifyNewOrders } from "@/lib/orders/notify";
import { notifyOrdersPlaced } from "@/lib/notifications/orders";
import type { PriceType } from "@/lib/orders/types";
import type { NicheId } from "@/lib/public-api/pricing";
import { apiError, apiOk, type OrderApiCaller } from "./http";
import { findListing, parseRobotNiche, ROBOT_NICHES, ROBOT_NICHE_CODES } from "./listings";

type OrderRow = typeof orders.$inferSelect;

const SANDBOX = "order_api_sandbox_orders";

// ─── ids ────────────────────────────────────────────────────────────────────

const CLIENT_REFERENCE = /^[A-Za-z0-9._:-]{1,100}$/;

/** A UUID (v5 layout) derived from the account and the caller's reference. */
export function orderIdFor(userId: string, clientReference: string, test: boolean): string {
  const h = createHash("sha1")
    .update(`linkpricer-order-api:${test ? "test" : "live"}:${userId}:${clientReference}`)
    .digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ─── status ─────────────────────────────────────────────────────────────────

export type ApiStatus = "placed" | "in_progress" | "published" | "completed" | "cancelled" | "refunded" | "failed";

/**
 * Our internal statuses → the fixed vocabulary in the robot's spec. Everything
 * between "we received it" and "it is live" is in_progress; the raw status is
 * returned beside it as `linkpricer_status` for debugging, never to branch on.
 * Anything unrecognized (legacy statuses from the old app) is in_progress
 * rather than a guess at a terminal state.
 */
export function apiStatus(status: string): ApiStatus {
  switch (status) {
    case "confirming_with_marketplace":
      return "placed";
    case "published":
      return "published";
    case "complete":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    default:
      return "in_progress";
  }
}

export interface ApiOrder {
  order_id: string;
  client_reference: string | null;
  status: ApiStatus;
  linkpricer_status: string;
  domain: string | null;
  listing_id: string | null;
  niche: string | null;
  published_url: string | null;
  published_at: string | null;
  price: string;
  currency: string;
  failure_reason: null;
  created_at: string | null;
  updated_at: string | null;
  test: boolean;
}

function iso(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw);
  const d = new Date(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(s) ? s : `${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface OrderApiMeta {
  clientReference: string;
  listingId: string;
  niche: string;
  keyName: string;
  articleMode: "buyer_doc" | "vendor_writes";
}

function orderApiMeta(order: OrderRow): Partial<OrderApiMeta> {
  const m = order.snapshotOfferMetadata as { orderApi?: OrderApiMeta } | null;
  return m?.orderApi ?? {};
}

async function toApiOrder(order: OrderRow): Promise<ApiOrder> {
  const meta = orderApiMeta(order);
  const events = await getOrderEvents(order.id, ORDER_EVENT_TYPES.statusChanged);
  const last = events[events.length - 1];
  const publishedEvent = [...events].reverse().find(
    (e) => (e.metadata as OrderStatusChangedMeta | null)?.toStatus === "published"
  );
  const status = apiStatus(order.status);
  const published = status === "published" || status === "completed";
  return {
    order_id: order.id,
    client_reference: meta.clientReference ?? null,
    status,
    linkpricer_status: order.status,
    domain: order.snapshotDomain,
    listing_id: meta.listingId ?? null,
    niche: meta.niche ?? null,
    published_url: published ? order.liveUrl ?? null : null,
    published_at: published ? iso(publishedEvent?.timestamp) : null,
    price: Number(order.totalAmount).toFixed(2),
    currency: order.snapshotCurrency ?? "USD",
    failure_reason: null,
    created_at: iso(order.createdAt),
    updated_at: iso(last?.timestamp) ?? iso(order.createdAt),
    test: false,
  };
}

// ─── placement ──────────────────────────────────────────────────────────────

const url = z.string().superRefine((value, ctx) => {
  const problem = urlProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: `This ${urlProblemMessage(problem)}` });
});

const money = z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, "must be a decimal string such as \"240.00\"");

export const placeOrderSchema = z.object({
  client_reference: z.string().regex(CLIENT_REFERENCE, "1-100 characters: letters, digits, . _ : -"),
  listing_id: z.string().min(1),
  niche: z.string(),
  expected_price: money,
  currency: z.literal("USD"),
  target_url: url,
  anchor: z.string().trim().min(1).max(500),
  article: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("buyer_doc"), url }),
    z.object({ mode: z.literal("vendor_writes"), brief: z.string().trim().min(1).max(10000) }),
  ]),
});

export type PlaceOrderBody = z.infer<typeof placeOrderSchema>;

/** Our priceType for a niche id — the two lists name standard/base differently. */
function priceTypeFor(niche: NicheId): PriceType {
  return niche === "standard" ? "base" : (niche as PriceType);
}

async function findExisting(caller: OrderApiCaller, orderId: string): Promise<ApiOrder | null> {
  if (caller.test) {
    const snap = await adminDb.collection(SANDBOX).doc(orderId).get();
    if (!snap.exists) return null;
    const order = snap.data() as ApiOrder & { key_name?: string };
    delete order.key_name;
    return order;
  }
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!row || row.userId !== caller.key.userId) return null;
  return toApiOrder(row);
}

export async function placeOrder(caller: OrderApiCaller, rawBody: unknown, origin: string) {
  const parsed = placeOrderSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("invalid_request", "The request body is not valid.", 400, {
      details: { issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
    });
  }
  const body = parsed.data;
  const niche = parseRobotNiche(body.niche);
  if (!niche) {
    return apiError("invalid_request", `niche must be one of: ${ROBOT_NICHE_CODES.join(", ")}`, 400);
  }

  const orderId = orderIdFor(caller.key.userId, body.client_reference, caller.test);

  // A reference we have already seen returns that order as it stands, before
  // any price or availability check: the robot is retrying something that
  // already succeeded, and must get the same answer even if the price has
  // moved since.
  const existing = await findExisting(caller, orderId);
  if (existing) return apiOk(existing, 200);

  const rates = await getUsdRates();
  const found = await findListing(body.listing_id, niche, rates);
  if (!found) {
    return apiError(
      "listing_unavailable",
      "This listing is gone, paused, or has no price for that niche. Look the domain up again.",
      409
    );
  }
  const { listing, marketplacePriceUsd, domain } = found;

  if (Number(body.expected_price).toFixed(2) !== listing.price) {
    return apiError("price_changed", "The price has changed since you looked it up. Nothing was ordered.", 409, {
      details: { current_price: listing.price, currency: listing.currency },
    });
  }

  const now = new Date().toISOString();

  if (caller.test) {
    const order: ApiOrder = {
      order_id: orderId,
      client_reference: body.client_reference,
      status: "placed",
      linkpricer_status: "confirming_with_marketplace",
      domain,
      listing_id: listing.listing_id,
      niche,
      published_url: null,
      published_at: null,
      price: listing.price,
      currency: listing.currency,
      failure_reason: null,
      created_at: now,
      updated_at: now,
      test: true,
    };
    try {
      await adminDb.collection(SANDBOX).doc(orderId).create({ ...order, key_name: caller.key.name });
    } catch (err) {
      // ALREADY_EXISTS: a concurrent retry of the same reference won the race.
      if ((err as { code?: number }).code === 6) {
        const again = await findExisting(caller, orderId);
        if (again) return apiOk(again, 200);
      }
      throw err;
    }
    return apiOk(order, 201);
  }

  const [user] = await db.select().from(users).where(eq(users.id, caller.key.userId)).limit(1);
  if (!user?.email) {
    console.error(`[order-api] key "${caller.key.name}" points at user ${caller.key.userId}, which has no email`);
    return apiError("server_error", "This API key's account is not set up to order. Contact LinkPricer.", 500);
  }

  const [offerKind, offerId] = [listing.listing_id.slice(0, 1), listing.listing_id.slice(2)];
  const meta: OrderApiMeta = {
    clientReference: body.client_reference,
    listingId: listing.listing_id,
    niche,
    keyName: caller.key.name,
    articleMode: body.article.mode,
  };

  const [inserted] = await db
    .insert(orders)
    .values({
      id: orderId,
      userId: user.id,
      companyId: user.companyId ?? undefined,
      offerId,
      status: "confirming_with_marketplace",
      orderType: "managed",
      totalAmount: listing.price,
      snapshotDomain: domain,
      snapshotMarketplaceName: offerKind === "V" ? "Vendor" : listing.vendor_id,
      snapshotCurrency: "USD",
      snapshotOfferMetadata: {
        ...withOrderMetaExt({ deliveryTime: listing.turnaround_days }, { contentNiche: niche }),
        orderApi: meta,
      },
      priceCapturedAt: now,
      // The price the robot saw is the whole charge — listing price, fee
      // included, nothing added for content — so it matches the pricing API
      // to the cent. The article is either the buyer's own document or
      // written by the site, never by LinkPricer. "site_writes" is its own
      // value (not "provided", which admin shows as "We Write") so the team
      // is never told to write an article nobody paid for.
      contentOption: body.article.mode === "buyer_doc" ? "url" : "site_writes",
      wordCount: null,
      contentPrice: "0.00",
      articleUrl: body.article.mode === "buyer_doc" ? body.article.url : undefined,
      email: user.email,
      targetUrl: body.target_url,
      anchorText: body.anchor,
      requirements:
        body.article.mode === "vendor_writes"
          ? `[Order API] Site writes the article. Brief: ${body.article.brief}`
          : "[Order API] Buyer supplies the article (see article URL).",
      priceType: priceTypeFor(ROBOT_NICHES[niche]),
      selectedPrice: marketplacePriceUsd.toFixed(2),
    })
    .onConflictDoNothing({ target: orders.id })
    .returning();

  if (!inserted) {
    // A concurrent retry of the same reference inserted first.
    const again = await findExisting(caller, orderId);
    if (again) return apiOk(again, 200);
    return apiError("duplicate_reference", "This client_reference is already in use.", 409, {
      details: { order_id: orderId },
    });
  }

  await recordOrderEvent(db, {
    orderOwnerUserId: user.id,
    eventType: ORDER_EVENT_TYPES.statusChanged,
    metadata: {
      orderId: inserted.id,
      fromStatus: null,
      toStatus: "confirming_with_marketplace",
      actorId: user.id,
      actorRole: "system",
      note: `Order created via order API (${caller.key.name}, ref ${body.client_reference})`,
    } satisfies OrderStatusChangedMeta,
  });

  mirrorOrderToFirestore(inserted.id, {
    userId: inserted.userId,
    companyId: inserted.companyId,
    domain: inserted.snapshotDomain,
    title: inserted.articleTitle,
  });

  // Same team email + Telegram ping + client receipt as a website order.
  after(() => notifyNewOrders([inserted], origin));
  after(() => notifyOrdersPlaced([inserted], origin));

  return apiOk(await toApiOrder(inserted), 201);
}

// ─── status lookup ──────────────────────────────────────────────────────────

export async function getOrder(caller: OrderApiCaller, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return apiError("not_found", "No such order.", 404);
  const order = await findExisting(caller, orderId.toLowerCase());
  return order ? apiOk(order) : apiError("not_found", "No such order.", 404);
}

export async function getOrderByReference(caller: OrderApiCaller, clientReference: string) {
  if (!CLIENT_REFERENCE.test(clientReference)) {
    return apiError("invalid_request", "client_reference is not valid.", 400);
  }
  const order = await findExisting(caller, orderIdFor(caller.key.userId, clientReference, caller.test));
  // A list, so the call answers "have I placed this yet?" without a 404 to
  // tell apart from a wrong URL.
  return apiOk({ orders: order ? [order] : [] });
}
