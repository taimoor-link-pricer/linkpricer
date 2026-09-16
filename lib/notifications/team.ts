import { teamRecipients } from "@/lib/orders/notify";
import { notify } from "./index";

// Internal alerts go to both places the team watches: the team inbox and the
// Telegram group. Each channel gets its own dedupeKey — wasRecentlySent() does
// not look at the channel, so a shared key would let the email suppress the
// Telegram message (or the other way round).
//
// userId must be set for deduplication to work at all: the log row that
// wasRecentlySent() reads is only written when there is a user to file it
// under (see recordNotification).
export async function notifyTeam(params: {
  event: string;
  dedupeKey: string;
  dedupeWindowMs?: number;
  // Email subject, and the first line of the Telegram message.
  subject: string;
  lines: Array<string | null | undefined | false>;
  userId: string | null;
  orderId?: string | null;
}): Promise<boolean> {
  const body = params.lines.filter((l): l is string => typeof l === "string" && l.length > 0).join("\n");
  const common = {
    event: params.event,
    dedupeWindowMs: params.dedupeWindowMs,
    userId: params.userId,
    orderId: params.orderId ?? null,
  };

  // True when at least one channel actually sent.
  const results = await Promise.all([
    notify({
      ...common,
      channel: "email",
      dedupeKey: `${params.dedupeKey}:email`,
      to: teamRecipients(),
      subject: params.subject,
      text: body,
    }),
    notify({
      ...common,
      channel: "telegram",
      dedupeKey: `${params.dedupeKey}:telegram`,
      text: `${params.subject}\n${body}`,
    }),
  ]);
  return results.some(Boolean);
}
