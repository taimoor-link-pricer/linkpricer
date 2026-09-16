import type { orders } from "@/lib/db/schema";

type OrderRow = typeof orders.$inferSelect;

export const NEW_ORDER_RECIPIENTS = [
  "karolis@lo-k.com",
  "andi@linkpricer.com",
  "taimour@linkpricer.com",
];

// TEAM_NOTIFICATION_EMAILS (comma-separated) replaces the list above. Local dev
// shares the production database, so a real-looking test run would otherwise
// email the whole team.
export function teamRecipients(): string[] {
  const override = process.env.TEAM_NOTIFICATION_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean);
  return override?.length ? override : NEW_ORDER_RECIPIENTS;
}

// "test" as its own token: test, tests, test1, my-test-site.com, /test/page.
// A plain substring match would also hit "latest", "contest", "fastest" and
// "A/B testing" — real orders with those in the title or anchor would then
// silently never reach the team, which is the expensive way for this to fail.
const TEST_TOKEN = /(^|[^a-z])tests?\d*([^a-z]|$)/i;

// The email is the one field where a substring is the right rule: test
// accounts look like taimourtest@gmail.com or test+3@linkpricer.com.
export function isTestOrder(order: Pick<OrderRow, "email" | "articleTitle" | "targetUrl" | "anchorText" | "requirements" | "articleUrl" | "originalFileName" | "additionalLinks">): boolean {
  if (order.email?.toLowerCase().includes("test")) return true;

  const links = Array.isArray(order.additionalLinks)
    ? (order.additionalLinks as Array<{ targetUrl?: string; anchorText?: string }>)
    : [];
  const values = [
    order.articleTitle,
    order.targetUrl,
    order.anchorText,
    order.requirements,
    order.articleUrl,
    order.originalFileName,
    ...links.flatMap((l) => [l.targetUrl, l.anchorText]),
  ];
  return values.some((v) => typeof v === "string" && TEST_TOKEN.test(v));
}

function describeOrder(order: OrderRow, origin: string): string {
  const lines = [
    `Order ID: ${order.id}`,
    `Domain: ${order.snapshotDomain ?? "-"}`,
    `Marketplace: ${order.snapshotMarketplaceName ?? "-"}`,
    `Order type: ${order.orderType ?? "-"}`,
    `Total: ${order.totalAmount ?? "-"} ${order.snapshotCurrency ?? ""}`.trim(),
    `Customer: ${order.email ?? "-"}`,
    `Target URL: ${order.targetUrl}`,
    `Anchor text: ${order.anchorText ?? "-"}`,
    `Content: ${order.contentOption ?? "-"}${order.wordCount ? ` (${order.wordCount} words)` : ""}`,
  ];
  if (order.articleTitle) lines.push(`Article title: ${order.articleTitle}`);
  lines.push(`Admin: ${origin}/admin/orders`);
  return lines.join("\n");
}

// Emails the team about newly placed real orders. Test orders are dropped;
// if every order in the batch is a test, nothing is sent. Never throws — a
// notification failure must not surface as a failed checkout.
export async function notifyNewOrders(created: OrderRow[], origin: string): Promise<void> {
  const real = created.filter((o) => !isTestOrder(o));
  if (real.length === 0) return;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn(`[notifyNewOrders] SENDGRID_API_KEY not set — skipping new-order email for ${real.map((o) => o.id).join(", ")}`);
    return;
  }

  const first = real[0];
  const subject = real.length === 1
    ? `New order: ${first.snapshotDomain ?? "unknown domain"} (${first.email ?? "unknown customer"})`
    : `${real.length} new orders (${first.email ?? "unknown customer"})`;
  const body = real.map((o) => describeOrder(o, origin)).join("\n\n----------\n\n");

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: teamRecipients().map((email) => ({ email })) }],
        from: { email: "noreply@linkpricer.com", name: "Linkpricer Orders" },
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[notifyNewOrders] SendGrid HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }
  } catch (err) {
    console.error("[notifyNewOrders] failed to send new-order email", err);
  }
}
