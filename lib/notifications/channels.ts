// Raw senders. Neither one throws: a notification that fails must never take
// down the request that triggered it (an order must still be placed even when
// SendGrid is down). Both return a delivery result instead, which notify()
// writes to the notification log so support can answer "I never got the email".

export type DeliveryResult = { ok: true } | { ok: false; error: string };

// Replies to a client email go to a human, not into the void. Rule 6 of the
// notification spec — the From address stays noreply because SendGrid's
// verified sender is on that domain.
export const SUPPORT_REPLY_TO = process.env.SUPPORT_EMAIL ?? "support@linkpricer.com";

const FROM = { email: "noreply@linkpricer.com", name: "LinkPricer" };

export async function sendEmail(params: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<DeliveryResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn(`[notifications] SENDGRID_API_KEY not set — dropping email "${params.subject}"`);
    return { ok: false, error: "SENDGRID_API_KEY not set" };
  }

  const content: Array<{ type: string; value: string }> = [{ type: "text/plain", value: params.text }];
  // SendGrid requires text/plain before text/html, and sending both keeps the
  // email readable in clients that strip HTML.
  if (params.html) content.push({ type: "text/html", value: params.html });

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: params.to.map((email) => ({ email })) }],
        from: FROM,
        reply_to: { email: params.replyTo ?? SUPPORT_REPLY_TO },
        subject: params.subject,
        content,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 500);
      console.error(`[notifications] SendGrid HTTP ${res.status}: ${body}`);
      return { ok: false, error: `SendGrid HTTP ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[notifications] email send failed", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// One admin group/channel (spec rule 5). Both env vars must be set or Telegram
// silently stays off — which is the right default for local dev, where nobody
// wants the team group pinged by test orders.
export async function sendTelegram(text: string): Promise<DeliveryResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[notifications] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — dropping Telegram alert");
    return { ok: false, error: "Telegram not configured" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // Plain text on purpose: order titles, anchor texts and client names are
        // arbitrary user input, and Telegram rejects the whole message when its
        // Markdown/HTML parser hits an unbalanced `*` or `<` in one of them.
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 500);
      console.error(`[notifications] Telegram HTTP ${res.status}: ${body}`);
      return { ok: false, error: `Telegram HTTP ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[notifications] telegram send failed", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
