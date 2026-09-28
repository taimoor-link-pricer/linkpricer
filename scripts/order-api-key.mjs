// Issues an order API key (lib/order-api/http.ts).
//
//   node scripts/order-api-key.mjs <userId> <live|test> "<name>"
//
// Prints the plaintext key ONCE — hand it over out of band, never by email —
// and the JSON entry to add to ORDER_API_KEYS. Only the hash is ever stored.
import { createHash, randomBytes } from "crypto";

const [userId, mode, name] = process.argv.slice(2);
if (!userId || (mode !== "live" && mode !== "test") || !name) {
  console.error('usage: node scripts/order-api-key.mjs <userId> <live|test> "<name>"');
  process.exit(1);
}
const plain = `lp_order_${mode}_${randomBytes(24).toString("hex")}`;
const hash = createHash("sha256").update(plain).digest("hex");
console.log(`\nKey (shown once): ${plain}\n`);
console.log("ORDER_API_KEYS entry:");
console.log(JSON.stringify({ name, hash, userId, mode }));
