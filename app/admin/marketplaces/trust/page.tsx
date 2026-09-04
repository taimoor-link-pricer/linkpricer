"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  name: string;
  display_name: string | null;
  enabled: boolean;
  trusted: boolean;
  has_affiliate: boolean;
  offer_count: number;
};

export default function MarketplaceTrustPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/marketplaces");
      // Same reasoning as the domains list: a 401/403 means the session is
      // gone server-side, and an empty table would read as "no marketplaces"
      // rather than "you are logged out".
      if (res.status === 401 || res.status === 403) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) throw new Error("Couldn't load marketplaces. Try again.");
      const data = await res.json();
      setRows(data.marketplaces ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load marketplaces.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setTrusted(row: Row, trusted: boolean) {
    setSaving(row.id);
    // Optimistic, with an explicit rollback: the toggle is the whole
    // interaction, so waiting a round trip before it moves makes it feel
    // broken — but silently keeping a flipped switch that never saved would
    // be worse, since this flag decides what the paid API recommends.
    const before = rows;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, trusted } : r)));
    try {
      const res = await fetch("/api/admin/marketplaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, trusted }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setRows(before);
      setError(`Couldn't update ${row.name}. Try again.`);
    } finally {
      setSaving(null);
    }
  }

  const visible = rows.filter((r) =>
    filter ? r.name.toLowerCase().includes(filter.toLowerCase()) : true
  );
  const trustedCount = rows.filter((r) => r.trusted).length;
  const trustedOffers = rows.reduce((n, r) => n + (r.trusted ? r.offer_count : 0), 0);
  const totalOffers = rows.reduce((n, r) => n + r.offer_count, 0);
  const coverage = totalOffers ? Math.round((trustedOffers / totalOffers) * 100) : 0;

  return (
    <>
      <style>{`
        .tr-page { padding: 32px; max-width: 1100px; }
        .tr-tabs { display: flex; gap: 4px; margin-bottom: 20px; }
        .tr-tab {
          padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 600;
          text-decoration: none; color: #6b7280; border: 1px solid transparent;
        }
        .tr-tab:hover { background: #f3f4f6; color: #374151; }
        .tr-tab.active { background: #111827; color: #fff; }
        .tr-title { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 6px; }
        .tr-sub { font-size: 13px; color: #6b7280; margin: 0 0 20px; line-height: 1.6; max-width: 780px; }
        .tr-stats { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
        .tr-stat { background: #fff; border: 1px solid #e8eaed; border-radius: 8px; padding: 12px 16px; min-width: 150px; }
        .tr-stat-n { font-size: 20px; font-weight: 700; color: #111827; }
        .tr-stat-l { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
        .tr-search {
          width: 100%; max-width: 320px; padding: 8px 10px; border: 1px solid #e8eaed;
          border-radius: 6px; font-size: 13px; margin-bottom: 14px; outline: none; box-sizing: border-box;
        }
        .tr-search:focus { border-color: #9ca3af; }
        .tr-wrap { background: #fff; border: 1px solid #e8eaed; border-radius: 8px; overflow: hidden; }
        .tr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tr-table th {
          background: #f9fafb; padding: 10px 14px; text-align: left; font-weight: 600;
          color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;
          border-bottom: 1px solid #e8eaed; white-space: nowrap;
        }
        .tr-table td { padding: 11px 14px; border-bottom: 1px solid #f3f4f6; color: #374151; }
        .tr-table tr:last-child > td { border-bottom: none; }
        .tr-table tr:hover td { background: #f9fafb; }
        .tr-name { font-family: monospace; font-weight: 500; color: #111827; }
        .tr-tag {
          border: 1px solid #e8eaed; background: #fff; border-radius: 999px;
          padding: 3px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
          transition: all 0.15s; min-width: 78px;
        }
        .tr-tag:disabled { opacity: 0.5; cursor: wait; }
        .tr-tag.yes { background: #dcfce7; border-color: #86efac; color: #15803d; }
        .tr-tag.no { background: #f3f4f6; border-color: #e5e7eb; color: #6b7280; }
        .tr-muted { color: #6b7280; font-size: 12px; }
        .tr-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }
      `}</style>

      <div className="tr-page">
        <div className="tr-tabs">
          <Link href="/admin/marketplaces" className="tr-tab">Domains</Link>
          <Link href="/admin/marketplaces/trust" className="tr-tab active">Trust</Link>
        </div>

        <h1 className="tr-title">Marketplace trust</h1>
        <p className="tr-sub">
          The developer API never tells a buyer which marketplace a price came from, so it can&apos;t
          let them judge the source themselves. <strong>Recommended price</strong> is our answer to
          that: for every domain, the API returns the cheapest offer from marketplaces marked
          trusted here — and returns <code>null</code> when no trusted marketplace carries that
          domain, rather than recommending one nobody has vetted. Nothing else in the product reads
          this flag; the dashboard&apos;s own prices are unaffected.
        </p>

        {error && <div className="tr-error">{error}</div>}

        <div className="tr-stats">
          <div className="tr-stat">
            <div className="tr-stat-n">{trustedCount} / {rows.length}</div>
            <div className="tr-stat-l">Marketplaces trusted</div>
          </div>
          <div className="tr-stat">
            <div className="tr-stat-n">{coverage}%</div>
            <div className="tr-stat-l">Of live offers covered</div>
          </div>
          <div className="tr-stat">
            <div className="tr-stat-n">{trustedOffers.toLocaleString()}</div>
            <div className="tr-stat-l">Trusted offers</div>
          </div>
        </div>

        <input
          className="tr-search"
          placeholder="Filter marketplaces…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div className="tr-wrap">
          <table className="tr-table">
            <thead>
              <tr>
                <th>Marketplace</th>
                <th>Live offers</th>
                <th>Affiliate</th>
                <th>Trusted</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="tr-muted">Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={4} className="tr-muted">No marketplaces match.</td></tr>
              ) : (
                visible.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="tr-name">{r.display_name || r.name}</span>
                      {!r.enabled && <span className="tr-muted"> · disabled</span>}
                    </td>
                    <td>{r.offer_count.toLocaleString()}</td>
                    <td className="tr-muted">{r.has_affiliate ? "yes" : "—"}</td>
                    <td>
                      <button
                        className={`tr-tag ${r.trusted ? "yes" : "no"}`}
                        disabled={saving === r.id}
                        onClick={() => setTrusted(r, !r.trusted)}
                      >
                        {r.trusted ? "Trusted" : "No"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
