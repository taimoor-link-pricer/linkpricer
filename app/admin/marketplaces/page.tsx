"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Link from "next/link";

type DomainSummary = {
  domain: string;
  dr: number | null;
  marketCount: number;
  bestPrice: string | null;
  currency: string;
  lastSynced: string | null;
};

type MarketListing = {
  marketplaceName: string;
  marketplaceUrl: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  currency: string;
  lastFetchedAt: string | null;
  available: boolean;
  linkType: string | null;
  wordCount: string | null;
  publicationType: string | null;
  gamblingMinPrice: string | null;
  adultMinPrice: string | null;
  cbdMinPrice: string | null;
  loanMinPrice: string | null;
  datingMinPrice: string | null;
  cryptoMinPrice: string | null;
};

function fmtDate(ts: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtPrice(price: string | null, currency: string) {
  if (!price) return "—";
  const n = parseFloat(price);
  if (isNaN(n)) return "—";
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function drBadge(dr: number | null) {
  if (dr === null) return { bg: "#f3f4f6", color: "#6b7280" };
  if (dr >= 70) return { bg: "#dcfce7", color: "#16a34a" };
  if (dr >= 40) return { bg: "#dbeafe", color: "#1d4ed8" };
  if (dr >= 20) return { bg: "#fef9c3", color: "#ca8a04" };
  return { bg: "#f3f4f6", color: "#6b7280" };
}

function buildPages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) add(p);
  if (current < total - 2) pages.push("…");
  add(total);
  return pages;
}

function nicheCount(m: MarketListing) {
  return [
    m.gamblingMinPrice,
    m.adultMinPrice,
    m.cbdMinPrice,
    m.loanMinPrice,
    m.datingMinPrice,
    m.cryptoMinPrice,
  ].filter(Boolean).length;
}

export default function MarketplacesPage() {
  const [rows, setRows] = useState<DomainSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<MarketListing[] | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/domains?${params}`);
      // A 401/403 here means the session cookie is no longer valid server-side
      // even though the client still thinks it's logged in (e.g. it expired,
      // or got revoked) -- AuthProvider only catches this on its own
      // onAuthStateChanged firing, which doesn't happen just because one API
      // call got rejected. Send them to log in again rather than silently
      // showing an empty table that looks like "there's just no data".
      if (res.status === 401 || res.status === 403) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) {
        throw new Error(
          res.status === 504
            ? "This page timed out loading. Try again in a moment."
            : "Couldn't load domains. Try again."
        );
      }
      const data = await res.json();
      setRows(data.domains ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load domains. Try again.");
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(val.trim());
      setExpandedDomain(null);
      setExpandedData(null);
    }, 350);
  }

  async function toggleExpand(domain: string) {
    if (expandedDomain === domain) {
      setExpandedDomain(null);
      setExpandedData(null);
      return;
    }
    setExpandedDomain(domain);
    setExpandedData(null);
    setExpandLoading(true);
    try {
      const res = await fetch(`/api/admin/domains/${encodeURIComponent(domain)}`);
      const data = await res.json();
      setExpandedData(data.markets ?? []);
    } finally {
      setExpandLoading(false);
    }
  }

  function handleExport() {
    setExporting(true);
    const params = new URLSearchParams({ export: "csv" });
    if (search) params.set("search", search);
    window.location.href = `/api/admin/domains?${params}`;
    setTimeout(() => setExporting(false), 2000);
  }

  const startItem = total === 0 ? 0 : (page - 1) * 25 + 1;
  const endItem = Math.min(page * 25, total);

  return (
    <>
      <style>{`
        .mp-page { padding: 32px; max-width: 1400px; }
        .mp-tabs { display: flex; gap: 4px; margin-bottom: 20px; }
        .mp-tab {
          padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 600;
          text-decoration: none; color: #6b7280; border: 1px solid transparent;
        }
        .mp-tab:hover { background: #f3f4f6; color: #374151; }
        .mp-tab.active { background: #111827; color: #fff; }
        .mp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .mp-title { font-size: 22px; font-weight: 700; color: #111827; margin: 0; }
        .mp-export-btn {
          display: flex; align-items: center; gap: 6px;
          background: #111827; color: #fff; border: none; border-radius: 6px;
          padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s;
        }
        .mp-export-btn:hover { background: #374151; }
        .mp-export-btn:disabled { background: #9ca3af; cursor: not-allowed; }
        .mp-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
        .mp-search-wrap { position: relative; flex: 1; max-width: 420px; }
        .mp-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 15px; }
        .mp-search {
          width: 100%; padding: 8px 10px 8px 32px; border: 1px solid #e8eaed;
          border-radius: 6px; font-size: 13px; color: #111827; background: #fff;
          outline: none; box-sizing: border-box;
        }
        .mp-search:focus { border-color: #9ca3af; }
        .mp-count { font-size: 13px; color: #6b7280; white-space: nowrap; }
        .mp-table-wrap { background: #fff; border: 1px solid #e8eaed; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
        .mp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .mp-table th {
          background: #f9fafb; padding: 10px 14px; text-align: left;
          font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase;
          letter-spacing: 0.04em; border-bottom: 1px solid #e8eaed; white-space: nowrap;
        }
        .mp-table td { padding: 11px 14px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
        .mp-table tr:last-child > td { border-bottom: none; }
        .mp-table tr.domain-row:hover td { background: #f9fafb; }
        .mp-domain { font-family: monospace; font-size: 13px; color: #111827; font-weight: 500; }
        .mp-dr-badge {
          display: inline-block; padding: 2px 8px; border-radius: 12px;
          font-size: 11px; font-weight: 700;
        }
        .mp-markets-badge {
          display: inline-flex; align-items: center; justify-content: center;
          background: #f3f4f6; color: #374151; border-radius: 12px;
          font-size: 12px; font-weight: 600; padding: 2px 10px; min-width: 28px;
        }
        .mp-price { font-weight: 600; color: #111827; }
        .mp-date { color: #6b7280; font-size: 12px; }
        .mp-expand-btn {
          background: none; border: 1px solid #e8eaed; border-radius: 4px;
          padding: 3px 8px; cursor: pointer; font-size: 12px; color: #6b7280;
          transition: all 0.15s; white-space: nowrap;
        }
        .mp-expand-btn:hover { border-color: #9ca3af; color: #374151; }
        .mp-expand-btn.active { background: #f9fafb; border-color: #374151; color: #111827; }
        .mp-sub-wrap { background: #f9fafb; }
        .mp-sub-inner { padding: 0 14px 14px 40px; }
        .mp-sub-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 0 8px; }
        .mp-sub-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .mp-sub-table th {
          text-align: left; padding: 6px 12px; color: #6b7280; font-weight: 600;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
          border-bottom: 1px solid #e8eaed; background: #fff;
        }
        .mp-sub-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
        .mp-sub-table tr:last-child td { border-bottom: none; }
        .mp-sub-table tr:hover td { background: #f3f4f6; }
        .mp-mkt-name { font-weight: 600; color: #111827; }
        .mp-mkt-link { color: #2563eb; text-decoration: none; }
        .mp-mkt-link:hover { text-decoration: underline; }
        .mp-niche-count { font-size: 11px; color: #6b7280; }
        .mp-avail { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
        .mp-avail.yes { background: #16a34a; }
        .mp-avail.no { background: #dc2626; }
        .mp-loading-row td { text-align: center; padding: 48px; color: #9ca3af; font-size: 14px; }
        .mp-spinner {
          display: inline-block; width: 18px; height: 18px; border: 2px solid #e8eaed;
          border-top-color: #374151; border-radius: 50%; animation: spin 0.7s linear infinite;
          vertical-align: middle; margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .mp-empty td { text-align: center; padding: 56px; color: #9ca3af; font-size: 14px; }
        .mp-pagination { display: flex; align-items: center; justify-content: center; gap: 4px; }
        .mp-page-btn {
          min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid #e8eaed;
          border-radius: 5px; background: #fff; color: #374151; font-size: 13px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.12s;
        }
        .mp-page-btn:hover:not(:disabled):not(.active) { border-color: #9ca3af; background: #f9fafb; }
        .mp-page-btn.active { background: #111827; color: #fff; border-color: #111827; font-weight: 600; }
        .mp-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .mp-page-gap { color: #9ca3af; padding: 0 2px; font-size: 13px; }
        .mp-sub-loading { text-align: center; padding: 20px; color: #9ca3af; font-size: 13px; }
        .mp-type-tag {
          display: inline-block; padding: 1px 7px; border-radius: 4px;
          background: #f3f4f6; color: #374151; font-size: 11px;
        }
        @media (max-width: 768px) {
          .mp-page { padding: 16px; }
          .mp-table th:nth-child(4), .mp-table td:nth-child(4) { display: none; }
        }
      `}</style>

      <div className="mp-page">
        {/* The marketplace *registry* (and its trust flags) lives on its own
            page — this one is a per-domain lookup. Linked as a tab so the two
            marketplace views are reachable from each other rather than only
            from the sidebar. */}
        <div className="mp-tabs">
          <Link href="/admin/marketplaces" className="mp-tab active">Domains</Link>
          <Link href="/admin/marketplaces/trust" className="mp-tab">Trust</Link>
        </div>
        <div className="mp-header">
          <h1 className="mp-title">Domain Marketplace Lookup</h1>
          <button
            className="mp-export-btn"
            onClick={handleExport}
            disabled={exporting || total === 0}
          >
            {exporting ? <span className="mp-spinner" style={{ width: 14, height: 14 }} /> : "↓"}
            {exporting ? "Preparing…" : "Export CSV"}
          </button>
        </div>

        <div className="mp-toolbar">
          <div className="mp-search-wrap">
            <span className="mp-search-icon">🔍</span>
            <input
              className="mp-search"
              type="text"
              placeholder="Search domains…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          {!loading && !loadError && (
            <span className="mp-count">
              {total === 0
                ? "No domains found"
                : `Showing ${startItem}–${endItem} of ${total.toLocaleString()} domains`}
            </span>
          )}
        </div>

        <div className="mp-table-wrap">
          <table className="mp-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>DR</th>
                <th>Markets</th>
                <th>Best Price</th>
                <th>Last Synced</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="mp-loading-row">
                  <td colSpan={6}>
                    <span className="mp-spinner" />
                    Loading domains…
                  </td>
                </tr>
              ) : loadError ? (
                <tr className="mp-empty">
                  <td colSpan={6}>
                    <div style={{ color: "#dc2626", fontWeight: 600, marginBottom: 10 }}>{loadError}</div>
                    <button className="mp-expand-btn" onClick={() => load()}>↻ Retry</button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="mp-empty">
                  <td colSpan={6}>No domains found{search ? ` for "${search}"` : ""}</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isExpanded = expandedDomain === row.domain;
                  const badge = drBadge(row.dr);
                  return (
                    <Fragment key={row.domain}>
                      <tr
                        className="domain-row"
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleExpand(row.domain)}
                      >
                        <td>
                          <span className="mp-domain">{row.domain}</span>
                        </td>
                        <td>
                          <span
                            className="mp-dr-badge"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {row.dr ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span className="mp-markets-badge">{row.marketCount}</span>
                        </td>
                        <td>
                          <span className="mp-price">
                            {fmtPrice(row.bestPrice, row.currency)}
                          </span>
                        </td>
                        <td>
                          <span className="mp-date">{fmtDate(row.lastSynced)}</span>
                        </td>
                        <td onClick={(e) => { e.stopPropagation(); toggleExpand(row.domain); }}>
                          <button className={`mp-expand-btn${isExpanded ? " active" : ""}`}>
                            {isExpanded ? "↑ Hide" : "↓ Show"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, borderBottom: "1px solid #e8eaed" }}>
                            <div className="mp-sub-wrap">
                              <div className="mp-sub-inner">
                                <div className="mp-sub-title">
                                  Marketplace listings for {row.domain}
                                </div>
                                {expandLoading && expandedData === null ? (
                                  <div className="mp-sub-loading">
                                    <span className="mp-spinner" />
                                    Loading…
                                  </div>
                                ) : expandedData && expandedData.length === 0 ? (
                                  <div className="mp-sub-loading">No marketplace data found.</div>
                                ) : expandedData ? (
                                  <table className="mp-sub-table">
                                    <thead>
                                      <tr>
                                        <th>Marketplace</th>
                                        <th>Min Price</th>
                                        <th>Max Price</th>
                                        <th>Currency</th>
                                        <th>Type</th>
                                        <th>Niches</th>
                                        <th>Last Updated</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expandedData.map((m) => (
                                        <tr key={m.marketplaceName}>
                                          <td>
                                            {m.marketplaceUrl ? (
                                              <a
                                                className="mp-mkt-link"
                                                href={m.marketplaceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <span className="mp-mkt-name">{m.marketplaceName}</span>
                                              </a>
                                            ) : (
                                              <span className="mp-mkt-name">{m.marketplaceName}</span>
                                            )}
                                          </td>
                                          <td style={{ fontWeight: 600 }}>
                                            {fmtPrice(m.minPrice, m.currency)}
                                          </td>
                                          <td style={{ color: "#6b7280" }}>
                                            {fmtPrice(m.maxPrice, m.currency)}
                                          </td>
                                          <td>{m.currency}</td>
                                          <td>
                                            {m.publicationType ? (
                                              <span className="mp-type-tag">{m.publicationType}</span>
                                            ) : m.linkType ? (
                                              <span className="mp-type-tag">{m.linkType}</span>
                                            ) : (
                                              <span style={{ color: "#9ca3af" }}>—</span>
                                            )}
                                          </td>
                                          <td>
                                            <span className="mp-niche-count">
                                              {nicheCount(m) > 0 ? `${nicheCount(m)} niches` : "—"}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="mp-date">{fmtDate(m.lastFetchedAt)}</span>
                                          </td>
                                          <td>
                                            <span
                                              className={`mp-avail ${m.available ? "yes" : "no"}`}
                                              title={m.available ? "Available" : "Unavailable"}
                                            />
                                            {" "}
                                            <span style={{ fontSize: 11, color: "#6b7280" }}>
                                              {m.available ? "Live" : "Inactive"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mp-pagination">
            <button
              className="mp-page-btn"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ←
            </button>
            {buildPages(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="mp-page-gap">…</span>
              ) : (
                <button
                  key={p}
                  className={`mp-page-btn${page === p ? " active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
            <button
              className="mp-page-btn"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
