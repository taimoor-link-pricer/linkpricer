import { adminDb } from "@/lib/firebase/admin";

export interface OrderMirrorFields {
  userId: string | null;
  companyId: string | null;
  domain: string | null;
  title: string | null;
}

// Firestore only ever needs enough about an order to authorize chat access
// (owner uid) and to label the thread in a UI — Postgres remains the single
// source of truth for the order itself. This mirror doc is written
// server-side via the Admin SDK, which bypasses Firestore security rules;
// clients can never create/overwrite it (see firestore.rules).
//
// Fire-and-forget by design: a Firestore hiccup must never fail an order
// creation or a chat-open request. Chat simply stays unavailable until the
// next successful mirror write (order creation, or the next ensure-chat call).
export function mirrorOrderToFirestore(orderId: string, fields: OrderMirrorFields) {
  adminDb
    .collection("orders")
    .doc(orderId)
    .set(
      {
        userId: fields.userId,
        companyId: fields.companyId,
        domain: fields.domain,
        title: fields.title,
      },
      { merge: true }
    )
    .catch((err) => console.error("[mirrorOrderToFirestore]", orderId, err));
}
