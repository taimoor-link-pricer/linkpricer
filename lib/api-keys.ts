import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { plain: string; hash: string } {
  const plain = "lp_live_" + randomBytes(20).toString("hex");
  const hash = createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}
