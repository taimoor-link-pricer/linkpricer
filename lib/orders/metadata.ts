// `orders.snapshotOfferMetadata` (jsonb) was originally used only for the
// snapshot-at-purchase-time offer details (deliveryTime, qualityScore, requirements,
// minPrice, maxPrice). We reuse the same column for a few mutable, current-state
// order fields that don't have a dedicated column (no migration was run for this
// feature — see the "Revised approach" section of the orders plan). Those live
// under the `ext` key so they stay visually separate from the immutable snapshot.
export type OrderMetaExt = {
  draftUrl?: string | null;
  pendingPriceAmount?: number | null;
  pendingPriceReason?: string | null;
  contentNiche?: string | null;
  contentTone?: string | null;
  cancelledReason?: string | null;
};

export type SnapshotOfferMetadata = {
  deliveryTime?: number | null;
  qualityScore?: number | null;
  requirements?: string | null;
  minPrice?: string | number | null;
  maxPrice?: string | number | null;
  ext?: OrderMetaExt;
  [key: string]: unknown;
};

export function getOrderMetaExt(snapshotOfferMetadata: unknown): OrderMetaExt {
  if (!snapshotOfferMetadata || typeof snapshotOfferMetadata !== "object") return {};
  const ext = (snapshotOfferMetadata as SnapshotOfferMetadata).ext;
  return ext && typeof ext === "object" ? ext : {};
}

export function withOrderMetaExt(
  snapshotOfferMetadata: unknown,
  patch: Partial<OrderMetaExt>
): SnapshotOfferMetadata {
  const base: SnapshotOfferMetadata =
    snapshotOfferMetadata && typeof snapshotOfferMetadata === "object"
      ? (snapshotOfferMetadata as SnapshotOfferMetadata)
      : {};
  return {
    ...base,
    ext: {
      ...getOrderMetaExt(snapshotOfferMetadata),
      ...patch,
    },
  };
}
