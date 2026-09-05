// Reads the x-api-key header and the niche query param on every call, so this
// is request-time work by construction — declared explicitly rather than left
// to inference, matching the other authenticated routes under /api/developers.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse, after } from "next/server";
import { createHash } from "crypto";
import { domainToASCII, domainToUnicode } from "url";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getUsdRates } from "@/lib/currency";
import {
  ACCEPTED_NICHE_VALUES,
  aggregatePricing,
  resolveNiche,
  type RawOffer,
} from "@/lib/public-api/pricing";

// ─── helpers ───────────────────────────────────────────────────────────────

function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

/**
 * Every spelling of one host that the catalogue might have stored it under.
 *
 * An internationalized domain has two equally valid wire forms — the unicode
 * one a person types ("lübeck.nu") and the punycode one most HTTP clients
 * silently convert it to ("xn--lbeck-kva.nu") — and `domains` contains BOTH as
 * separate rows, with separate offers. 1,042 sites are stored twice this way,
 * 987 of them with live offers, and on a 200-site sample 167 (83%) carried a
 * DIFFERENT cheapest price under the two spellings.
 *
 * So the price a customer got depended on which form their HTTP library
 * happened to send — the same defect as the case-variant duplicates this route
 * already pools over, in a second dimension. Matching every form and pooling
 * the offers makes the answer the same either way.
 *
 * Returns a de-duplicated list; for a plain ASCII domain that is just the one
 * value, so the common path is unchanged.
 */
function domainForms(domain: string): string[] {
  const forms = new Set<string>([domain]);
  try {
    const ascii = domainToASCII(domain);
    if (ascii) forms.add(ascii.toLowerCase());
  } catch { /* not a convertible host — the literal is all we have */ }
  try {
    const unicode = domainToUnicode(domain);
    if (unicode) forms.add(unicode.toLowerCase());
  } catch { /* as above */ }
  return [...forms];
}

/** A country name, or null — never the scraper's "-"/""/"n/a" placeholders. */
function normalizeCountry(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = raw.trim();
  if (!v || v === "-" || v === "--" || v.toLowerCase() === "n/a" || v.toLowerCase() === "unknown") return null;
  return v;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Per-key, per-plan responses: never storable by a shared cache, and never
// reusable across callers. Applied to success and error alike so a 429 can't
// be replayed from a proxy after the limit has reset either.
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

// Standard rate-limit headers. Without them a client has no way to pace itself
// except by walking into a 429 — it cannot see how much of its monthly quota
// is left until the moment the quota is gone. The counters are already read by
// the auth statement, so surfacing them costs nothing.
function rateLimitHeaders(
  monthLimit: number,
  monthUsed: number | null,
  minuteLimit: number,
  minuteUsed: number | null,
  resetEpoch: number
): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(monthLimit),
    "X-RateLimit-Reset": String(resetEpoch),
    "X-RateLimit-Limit-Minute": String(minuteLimit),
  };
  if (monthUsed != null) h["X-RateLimit-Remaining"] = String(Math.max(0, monthLimit - monthUsed));
  if (minuteUsed != null) h["X-RateLimit-Remaining-Minute"] = String(Math.max(0, minuteLimit - minuteUsed));
  return h;
}

function jsonOk(body: unknown, extra?: Record<string, string>) {
  return NextResponse.json(body, { headers: { ...NO_STORE, ...extra } });
}

function jsonError(code: string, message: string, status: number, extra?: Record<string, string>) {
  return NextResponse.json(
    { error: code, message, status },
    { status, headers: { ...NO_STORE, ...extra } }
  );
}

// The monthly quota resets on the 1st at 00:00 UTC, which is what
// /developers/docs promises — so Retry-After has to be the time to *that*
// instant, not a flat guess.
function secondsUntilNextMonthUtc(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0);
  return Math.max(1, Math.round((next - now.getTime()) / 1000));
}

function monthWindow(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Every price column either offer table can carry, read into RawOffer.prices.
// Kept as one list so the SELECT, the row mapper and lib/public-api/pricing's
// NICHES map cannot drift apart.
const PRICE_COLUMNS = [
  "min_price",
  "max_price",
  "gambling_min_price",
  "gambling_max_price",
  "adult_min_price",
  "adult_max_price",
  "cbd_min_price",
  "cbd_max_price",
  "loan_min_price",
  "loan_max_price",
  "dating_min_price",
  "dating_max_price",
  "crypto_min_price",
  "crypto_max_price",
  "trading_forex_min_price",
  "trading_forex_max_price",
  "link_insertion_min_price",
  "link_insertion_max_price",
] as const;

function toOffer(row: Record<string, unknown>): RawOffer {
  const prices: Record<string, number | null> = {};
  for (const col of PRICE_COLUMNS) {
    const v = row[col];
    prices[col] = v == null ? null : Number(v);
  }
  return {
    currency: (row.currency as string) ?? "USD",
    prices,
    trusted: row.trusted === true,
  };
}

// ─── route ─────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const startMs = Date.now();

  // 1. Require API key header
  const rawKey = req.headers.get("x-api-key");
  if (!rawKey) {
    return jsonError("missing_api_key", "Provide your API key in the x-api-key header.", 401);
  }

  const keyHash = hashKey(rawKey);
  const now = new Date();
  const minuteBucket = Math.floor(now.getTime() / 60000);
  const month = monthWindow(now);
  // Unix seconds at the next monthly reset — the value X-RateLimit-Reset carries.
  const monthResetEpoch = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0) / 1000
  );

  // 2. Authenticate the key and claim quota in a single statement.
  //
  // This used to be four sequential round trips (SELECT the key, UPDATE the
  // minute counter, UPDATE the daily counter, INSERT a placeholder log row)
  // before any pricing work started. Against Neon that is four full network
  // latencies a paying customer waits through on every call, for work that
  // touches exactly one row.
  //
  // The `k` CTE snapshots the key as it was *before* the update, which is
  // what makes the collapse possible: `bumped` returns no row both when the
  // key is invalid and when a limit is hit, and the snapshot is what tells
  // those apart — and tells apart *which* limit was hit, so the right
  // Retry-After goes back. The conditional UPDATE itself is unchanged in
  // spirit: Postgres's row lock serializes concurrent requests for the same
  // key, so there is no read-then-write race on the counters.
  const auth = await db.execute(sql`
    WITH k AS (
      SELECT id, user_id, is_active, per_minute_limit,
             COALESCE(monthly_limit, daily_limit * 30) AS month_limit,
             minute_window, minute_count, month_window, month_count
      FROM api_keys
      WHERE key_hash = ${keyHash}
      LIMIT 1
    ),
    bumped AS (
      UPDATE api_keys a
      SET minute_count  = CASE WHEN a.minute_window = ${minuteBucket} THEN a.minute_count + 1 ELSE 1 END,
          minute_window = ${minuteBucket},
          month_count   = CASE WHEN a.month_window = ${month} THEN a.month_count + 1 ELSE 1 END,
          month_window  = ${month},
          last_used_at  = NOW()
      FROM k
      WHERE a.id = k.id
        AND k.is_active
        AND (a.minute_window IS DISTINCT FROM ${minuteBucket} OR a.minute_count < a.per_minute_limit)
        AND (a.month_window  IS DISTINCT FROM ${month}        OR a.month_count  < COALESCE(a.monthly_limit, a.daily_limit * 30))
      RETURNING a.id, a.month_count, a.minute_count
    )
    SELECT
      k.id,
      k.user_id,
      k.is_active,
      k.month_limit,
      k.per_minute_limit,
      (SELECT month_count FROM bumped)                                         AS month_used,
      (SELECT minute_count FROM bumped)                                        AS minute_used,
      (SELECT COUNT(*) FROM bumped) > 0                                        AS allowed,
      (k.minute_window = ${minuteBucket} AND k.minute_count >= k.per_minute_limit) AS minute_blocked,
      (k.month_window  = ${month}        AND k.month_count  >= k.month_limit)      AS month_blocked
    FROM k
  `);

  const k = auth.rows[0] as
    | {
        id: string;
        user_id: string;
        is_active: boolean;
        month_limit: number;
        per_minute_limit: number;
        month_used: number | null;
        minute_used: number | null;
        allowed: boolean;
        minute_blocked: boolean;
        month_blocked: boolean;
      }
    | undefined;

  if (!k || !k.is_active) {
    return jsonError("invalid_api_key", "API key is invalid or inactive.", 401);
  }

  if (!k.allowed) {
    if (k.minute_blocked) {
      return jsonError(
        "rate_limit_exceeded",
        "Per-minute rate limit exceeded. See Retry-After header.",
        429,
        { "Retry-After": "60", ...rateLimitHeaders(k.month_limit, k.month_used, k.per_minute_limit, k.minute_used, monthResetEpoch) }
      );
    }
    if (k.month_blocked) {
      return jsonError(
        "quota_exceeded",
        `Monthly quota of ${k.month_limit} requests reached. Resets on the 1st at 00:00 UTC.`,
        429,
        { "Retry-After": String(secondsUntilNextMonthUtc(now)), ...rateLimitHeaders(k.month_limit, k.month_used, k.per_minute_limit, k.minute_used, monthResetEpoch) }
      );
    }
    // Neither snapshot flag is set, so the key was deactivated between the
    // snapshot and the update rather than being over quota.
    return jsonError("invalid_api_key", "API key is invalid or inactive.", 401);
  }

  // 3. Normalize domain
  //
  // decodeURIComponent throws URIError on a malformed percent-escape (e.g.
  // "%E0%A4%A"). Next's router rejects most of those before this handler is
  // reached, but not all encodings on every platform, and an uncaught throw
  // here happens AFTER quota has been claimed — the customer pays for a crash.
  // An undecodable path is just a malformed domain, so treat it as one.
  const { domain: rawDomain } = await params;
  let domain: string;
  try {
    domain = normalizeDomain(decodeURIComponent(rawDomain));
  } catch {
    domain = "";
  }

  let httpStatus = 200;

  // Quota has to be claimed before the request is understood — the claim is
  // what makes the limit un-raceable, and it happens in the same statement
  // that authenticates the key. That is right for a lookup that returns 404
  // (we searched, we just found nothing) but wrong for a request we rejected
  // without looking anything up: a customer whose client has a bug emitting
  // malformed domains would silently burn a paid month's quota on requests
  // that never touched the catalog. Those get the claim handed back.
  //
  // Only ever called on the 422 paths, so the extra round trip is off the
  // success path entirely. Guarded against underflow because month_count is
  // reset to 1 by any request that rolls the window over.
  const refundQuota = async () => {
    await db
      .execute(sql`
        UPDATE api_keys
        SET month_count  = GREATEST(month_count - 1, 0),
            minute_count = GREATEST(minute_count - 1, 0)
        WHERE id = ${k.id}
          AND month_window = ${month}
          AND minute_window = ${minuteBucket}
      `)
      .catch((err) => console.error("[/api/v1/public/domains/pricing] quota refund failed", err));
  };

  const finish = (res: NextResponse) => {
    // The usage log is history, not enforcement — quota was already claimed
    // atomically in step 2, before any pricing work — so the customer should
    // not wait a database round trip for it. `after` runs the write once the
    // response is on the wire while keeping the serverless execution context
    // alive, which a bare fire-and-forget promise does not: that context can
    // be frozen the instant the response is returned, silently dropping the
    // write. (The row also used to be *reserved* before the pricing work and
    // updated afterwards, so a COUNT-based per-minute limiter could see it.
    // That limiter is gone — the counters on api_keys are the limit now — so
    // the reservation bought nothing and cost a second round trip.)
    const latencyMs = Date.now() - startMs;
    after(async () => {
      try {
        await db.execute(sql`
          INSERT INTO api_request_logs (api_key_id, user_id, domain, http_status, latency_ms)
          VALUES (${k.id}, ${k.user_id}, ${domain}, ${httpStatus}, ${latencyMs})
        `);
      } catch (err) {
        console.error("[/api/v1/public/domains/pricing] log write failed", err);
      }
    });
    return res;
  };

  // A hostname is a narrow character set. Anything outside it cannot match a
  // catalog row, so rejecting it here costs nothing — and one class of input
  // is actively dangerous: a NUL byte is not representable in Postgres text
  // and made the driver throw, which surfaced as a 500 that had ALREADY
  // consumed the caller's quota. A client bug emitting control characters
  // could burn a paid month on errors that were our fault, not theirs.
  // Letters (including non-ASCII, for internationalized domains), digits,
  // dot and hyphen are the whole legal alphabet here.
  const HOSTNAME_SAFE = /^[\p{L}\p{N}.-]+$/u;

  if (!domain || domain.length < 3 || domain.length > 253 || !domain.includes(".") || !HOSTNAME_SAFE.test(domain)) {
    httpStatus = 422;
    await refundQuota();
    return finish(jsonError("invalid_domain", "Domain parameter is missing or malformed.", 422));
  }

  // 4. Optional niche filter — accepts both the API's canonical ids and the
  //    dashboard's spellings for the same niches (see lib/public-api/pricing).
  // `?niche=` and `?niche=%20` mean the same thing as omitting it — an empty
  // value is a caller whose variable was blank, not a request for a niche
  // called "". Rejecting one and accepting the other made the two spellings of
  // "no filter" behave differently for no reason.
  const nicheParam = (req.nextUrl.searchParams.get("niche") ?? "").trim();
  const nicheFilter = resolveNiche(nicheParam);
  if (nicheParam && !nicheFilter) {
    httpStatus = 422;
    await refundQuota();
    return finish(
      jsonError(
        "invalid_niche",
        `Invalid niche. Valid values are: ${ACCEPTED_NICHE_VALUES.join(", ")}`,
        422
      )
    );
  }

  try {
    // 5. Offers, metrics and price freshness in one round trip, running
    //    alongside the currency rates rather than after them.
    //
    //    Three changes of substance from the previous version:
    //
    //    a) `lower(d.domain) = domain`, not `d.domain = domain`. The input is
    //       lowercased on the way in, but 7,049 rows in `domains` are stored
    //       with capitals ("Huliq.com", "GFXMaker.com"). Every one of them
    //       404'd here while resolving fine on the Analyze page, which matches
    //       case-insensitively. There is an index on lower(domain) for this.
    //
    //    b) supplier_offers is included. Analyze prices marketplace *and*
    //       vendor offers; this endpoint only ever read marketplace ones, so a
    //       vendor undercutting every marketplace was invisible and the API
    //       quoted a higher "best price" than the dashboard for the same
    //       domain. (No vendor offer is active today — this is the gap closing
    //       before it opens, not a live discrepancy.)
    //
    //    c) The trusted flag comes along per offer, so recommended_price can
    //       be computed without a second lookup.
    // A bound JS array is NOT a Postgres array in a Drizzle sql template —
    // `= ANY(${array})` fails at runtime with "op ANY/ALL (array) requires
    // array on right side". An explicit IN list of individually-bound values
    // is the form that works and stays parameterised.
    const forms = domainForms(domain);
    const domainList = sql.join(forms.map((f) => sql`${f}`), sql`, `);

    const [rates, result] = await Promise.all([
      getUsdRates(),
      db.execute(sql`
        WITH d AS (
          -- Every domains row for this host, not one of them.
          --
          -- domains_domain_unique is case-SENSITIVE, so the catalog carries
          -- 6,951 groups of rows that are the same site spelled differently
          -- ("huliq.com" and "Huliq.com" are two rows, with two separate sets
          -- of offers and two different DR values). A LIMIT 1 here returned
          -- whichever row Postgres happened to hand back first — for
          -- huliq.com that is either 22 offers at DR 58 or 3 offers at DR 0,
          -- with nothing in the query to decide which, so the same request
          -- could legitimately return either. Pricing has to be deterministic,
          -- so offers are pooled across every matching row below.
          SELECT id, domain, domain_rating, org_traffic, ref_domains, country_main_traffic
          FROM domains
          WHERE lower(domain) IN (${domainList})
        ),
        best_domain AS (
          -- The row the metrics are read from. Duplicates are rarely equally
          -- populated (the canonical row has the real DR/traffic and the
          -- stray one is usually zeroed), so prefer the row that actually
          -- knows something, and order fully so the choice never depends on
          -- storage order.
          SELECT * FROM d
          ORDER BY
            (domain_rating IS NOT NULL AND domain_rating > 0) DESC,
            COALESCE(org_traffic, 0) DESC,
            COALESCE(ref_domains, 0) DESC,
            domain ASC
          LIMIT 1
        ),
        offers AS (
          SELECT * FROM (
          -- DISTINCT ON collapses a marketplace back to ONE offer.
          --
          -- Pooling across every matching domains row is what makes a duplicated host
          -- complete, but marketplace_offers is unique on (domain_id,
          -- marketplace_name) — per row, not per host — so when the SAME
          -- marketplace has scraped two spellings of one site it contributes
          -- two rows. Those were both counted, which inflated offer_count and
          -- dragged average_price toward a single source's second quote.
          -- 1,463 hosts are affected and their two quotes genuinely differ
          -- (abbynews.com: one marketplace at both $780 and $889).
          --
          -- The docs sell offer_count as "how many independent sources back
          -- these figures", so counting one source twice makes that claim
          -- false. Cheapest quote per source wins, which keeps this consistent
          -- with how best_price is chosen.
          SELECT DISTINCT ON (lower(o.marketplace_name))
            o.currency,
            o.min_price, o.max_price,
            o.gambling_min_price, o.gambling_max_price,
            o.adult_min_price, o.adult_max_price,
            o.cbd_min_price, o.cbd_max_price,
            o.loan_min_price, o.loan_max_price,
            o.dating_min_price, o.dating_max_price,
            o.crypto_min_price, o.crypto_max_price,
            o.trading_forex_min_price, o.trading_forex_max_price,
            o.link_insertion_min_price, o.link_insertion_max_price,
            COALESCE(m.trusted, false) AS trusted,
            GREATEST(o.updated_at::timestamp, o.last_fetched_at) AS freshness
          FROM marketplace_offers o
          JOIN d ON d.id = o.domain_id
          LEFT JOIN marketplaces m ON lower(m.name) = lower(o.marketplace_name)
          WHERE o.available = true
          ORDER BY lower(o.marketplace_name), o.min_price::float ASC NULLS LAST
          ) mo

          UNION ALL

          SELECT
            s.currency,
            s.min_price, s.max_price,
            s.gambling_min_price, s.gambling_max_price,
            s.adult_min_price, s.adult_max_price,
            s.cbd_min_price, s.cbd_max_price,
            s.loan_min_price, s.loan_max_price,
            s.dating_min_price, s.dating_max_price,
            s.crypto_min_price, s.crypto_max_price,
            s.trading_forex_min_price, s.trading_forex_max_price,
            s.link_insertion_min_price, s.link_insertion_max_price,
            -- A vendor is not a marketplace, so there is no marketplaces row
            -- to carry a trust decision. Vendor offers are therefore never
            -- "recommended" until trust is modelled for them explicitly.
            false AS trusted,
            s.updated_at AS freshness
          FROM supplier_offers s
          -- Matched on the normalized host directly rather than joined to the
          -- domain CTE: it can hold several rows for the same host (see its
          -- comment above), and
          -- joining would multiply every vendor offer by that row count,
          -- double-counting it in the average and the offer count.
          WHERE lower(s.domain) IN (${domainList})
            AND s.status = 'active' AND s.is_active = true
        )
        SELECT
          (SELECT row_to_json(best_domain) FROM best_domain)          AS domain_row,
          (SELECT json_agg(offers) FROM offers)                       AS offers,
          (SELECT MAX(freshness) FROM offers)                         AS last_updated
      `),
    ]);

    const row = result.rows[0] as
      | {
          domain_row: Record<string, unknown> | null;
          offers: Record<string, unknown>[] | null;
          last_updated: string | null;
        }
      | undefined;

    const domainRow = row?.domain_row ?? null;
    const offers = (row?.offers ?? []).map(toOffer);

    if (!domainRow) {
      httpStatus = 404;
      return finish(jsonError("domain_not_found", "No data found for this domain.", 404));
    }

    const pricing = aggregatePricing(offers, rates, nicheFilter);
    const found = Object.keys(pricing).length > 0;

    return finish(
      jsonOk({
        domain,
        found,
        pricing,
        metrics: {
          domain_rating:
            domainRow.domain_rating != null ? Number(domainRow.domain_rating) : null,
          organic_traffic: domainRow.org_traffic != null ? Number(domainRow.org_traffic) : null,
          ref_domains: domainRow.ref_domains != null ? Number(domainRow.ref_domains) : null,
          // "-" is a scraper placeholder for "unknown", stored on 23,263
          // domains. Returned verbatim it breaks the documented contract: the
          // docs promise a country name or null, and a client rendering
          // country ?? "Unknown" prints a bare dash instead.
          country: normalizeCountry(domainRow.country_main_traffic as string | null),
        },
        // The real age of the underlying prices. This was `new Date()` — it
        // reported today's date on every call regardless of when the offer was
        // last scraped, which made the field actively misleading: a price two
        // years stale looked as fresh as one pulled this morning.
        // Null whenever `pricing` is empty, including when a niche filter
        // emptied it — the field describes the prices in this response, and a
        // date sitting next to `pricing: {}` reads as "these prices are from
        // yesterday" when there are no prices at all.
        last_updated:
          found && row?.last_updated
            ? new Date(row.last_updated).toISOString().slice(0, 10)
            : null,
      }, rateLimitHeaders(k.month_limit, k.month_used, k.per_minute_limit, k.minute_used, monthResetEpoch))
    );
  } catch (err) {
    console.error("[/api/v1/public/domains/pricing]", err);
    httpStatus = 500;
    return finish(jsonError("internal_error", "An internal error occurred. Please retry.", 500));
  }
}
