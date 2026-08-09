"use client";

import { useCallback, useEffect, useState } from "react";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  orderId: string | null;
  source: string;
  domain: string | null;
  reviewedName: string | null;
  reviewerEmail: string | null;
  reviewerFirstName: string | null;
  reviewerLastName: string | null;
};

type MarketplaceGroup = {
  marketplaceName: string;
  avgRating: number | null;
  ratingCount: number;
  reviews: (Review & { reviewerId: string })[];
};

function fmtDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function reviewerLabel(r: { reviewerFirstName: string | null; reviewerLastName: string | null; reviewerEmail: string | null }): string {
  const name = [r.reviewerFirstName, r.reviewerLastName].filter(Boolean).join(" ");
  return name || r.reviewerEmail || "Unknown";
}

function Stars({ n }: { n: number }) {
  return <span style={{ color: "#f59e0b", fontSize: 13 }}>{[1, 2, 3, 4, 5].map((i) => (i <= n ? "★" : "☆")).join("")}</span>;
}

function SourceBadge({ source }: { source: string }) {
  if (source !== "admin") return null;
  return (
    <span style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "#ede9fe", color: "#5b21b6", letterSpacing: 0.2 }}>
      Admin
    </span>
  );
}

const TABS = [
  { id: "latest", label: "Latest reviews" },
  { id: "marketplaces", label: "By marketplace" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<TabId>("latest");

  return (
    <div style={{ padding: "28px 36px", maxWidth: 1300, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Reviews</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
          Buyer-submitted ratings across all orders, plus admin-added marketplace reviews
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #e8eaed" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "9px 16px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13.5, fontWeight: 700, color: tab === t.id ? "#111827" : "#9ca3af",
              borderBottom: tab === t.id ? "2px solid #dc2626" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "latest" ? <LatestReviewsTab /> : <MarketplacesTab />}
    </div>
  );
}

// ── Tab 1: Latest reviews ───────────────────────────────────────────────────

function LatestReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/reviews?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load reviews");
      setReviews(data.reviews ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("[LatestReviewsTab load]", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this review permanently? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete review");
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete review");
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by domain, marketplace/vendor, or reviewer email…"
          style={{
            width: 420, maxWidth: "100%", padding: "9px 12px", borderRadius: 8,
            border: "1px solid #e8eaed", fontSize: 13, fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafbfd", borderBottom: "1px solid #e8eaed" }}>
              {["Domain", "Reviewed", "Rating", "Comment", "Reviewer", "Date", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.3 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Loading…</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No reviews yet.</td></tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 600, color: "#111827" }}>{r.domain ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#374151" }}>{r.reviewedName ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}><Stars n={r.rating} /></td>
                  <td style={{ padding: "10px 14px", color: "#374151", maxWidth: 320 }}>
                    {r.comment ? <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.comment}>{r.comment}</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#374151" }}>
                    {reviewerLabel(r)}
                    <SourceBadge source={r.source} />
                  </td>
                  <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      style={{
                        padding: "5px 11px", borderRadius: 7, border: "1px solid #fecaca",
                        background: "#fff", color: "#b91c1c", fontSize: 12, fontWeight: 600,
                        cursor: deletingId === r.id ? "default" : "pointer", opacity: deletingId === r.id ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {deletingId === r.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.5 : 1, fontSize: 12.5 }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 12.5, color: "#6b7280" }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.5 : 1, fontSize: 12.5 }}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}

// ── Tab 2: Grouped by marketplace, with admin add/update-review form ───────

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 1, lineHeight: 0, fontSize: 18, color: (hover || value) >= n ? "#f59e0b" : "#d1d5db" }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function MarketplaceCard({ group, adminUserId, onSaved }: { group: MarketplaceGroup; adminUserId: string | null; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const myReview = adminUserId ? group.reviews.find((r) => r.source === "admin" && r.reviewerId === adminUserId) : undefined;
  const [draftRating, setDraftRating] = useState(myReview?.rating ?? 0);
  const [comment, setComment] = useState(myReview?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!draftRating || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reviews/marketplaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplaceName: group.marketplaceName, rating: draftRating, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save review");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{group.marketplaceName}</span>
          {group.ratingCount > 0 ? (
            <>
              <Stars n={Math.round(group.avgRating ?? 0)} />
              <span style={{ fontSize: 12, color: "#6b7280" }}>{group.avgRating?.toFixed(1)} · {group.ratingCount} review{group.ratingCount === 1 ? "" : "s"}</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>No reviews yet</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{expanded ? "▲ Hide" : "▼ Details"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
          {group.reviews.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {group.reviews.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5 }}>
                  <Stars n={r.rating} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: "#111827" }}>{reviewerLabel(r)}</span>
                    <SourceBadge source={r.source} />
                    <span style={{ color: "#9ca3af", marginLeft: 8 }}>{fmtDate(r.createdAt)}</span>
                    {r.comment && <div style={{ color: "#374151", marginTop: 2 }}>{r.comment}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: "12px 14px", background: "#fafbfd", border: "1px dashed #e8eaed", borderRadius: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>
              {myReview ? "Update your admin review" : "Add your admin review"}
            </div>
            <StarInput value={draftRating} onChange={setDraftRating} />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional comment…"
              rows={2}
              style={{ width: "100%", marginTop: 8, padding: "7px 9px", borderRadius: 7, border: "1px solid #e8eaed", fontSize: 12.5, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }}
            />
            {error && <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{error}</div>}
            <button
              onClick={submit}
              disabled={!draftRating || saving}
              style={{
                marginTop: 8, padding: "6px 14px", borderRadius: 7, border: "none",
                background: draftRating ? "#dc2626" : "#e8eaed", color: draftRating ? "#fff" : "#9ca3af",
                fontWeight: 700, fontSize: 12, cursor: draftRating ? "pointer" : "default",
              }}
            >
              {saving ? "Saving…" : myReview ? "Update review" : "Submit review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketplacesTab() {
  const [groups, setGroups] = useState<MarketplaceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reviews/marketplaces");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load marketplaces");
      setGroups(data.marketplaces ?? []);
    } catch (err) {
      console.error("[MarketplacesTab load]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((d) => setAdminUserId(d.id ?? null))
      .catch(() => {});
  }, [load]);

  const filtered = search.trim()
    ? groups.filter((g) => g.marketplaceName.toLowerCase().includes(search.trim().toLowerCase()))
    : groups;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search marketplaces…"
          style={{
            width: 420, maxWidth: "100%", padding: "9px 12px", borderRadius: 8,
            border: "1px solid #e8eaed", fontSize: 13, fontFamily: "inherit",
          }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No marketplaces found.</div>
      ) : (
        filtered.map((g) => (
          <MarketplaceCard key={g.marketplaceName} group={g} adminUserId={adminUserId} onSaved={load} />
        ))
      )}
    </>
  );
}
