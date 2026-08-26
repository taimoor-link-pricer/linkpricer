"use client";

// Marketplace offer card, ported from `MarketplaceCardI` in
// v1-interactive/v1-app.jsx (the "with currency support" variant used by
// the interactive app and, here, the homepage demo).

import { Icon } from "@/lib/design-v1/icons";
import { RatingBadge } from "@/lib/design-v1/icons";
import { fmt, priceFmt } from "@/lib/design-v1/format";
import type { BuyHandler, Currency, Domain, Offer } from "@/lib/design-v1/types";
import { Pill, InfoTip, btn, priceCell, priceLbl, priceVal, editRow, editLbl, editVal } from "./primitives";

export function MarketplaceCard({
  o,
  bestPrice,
  yourPrice,
  currency,
  onBuy,
  d,
}: {
  o: Offer;
  bestPrice: number;
  yourPrice?: number | null;
  currency: Currency;
  onBuy?: BuyHandler;
  d: Domain;
}) {
  const ourPriceUsd = fmt.withFee(o.minPrice);
  const isBest = o.minPrice === bestPrice;
  const linkGood = o.link === "Dofollow";
  const cmp = (() => {
    if (yourPrice == null || ourPriceUsd == null) return null;
    const diff = ((ourPriceUsd - yourPrice) / yourPrice) * 100;
    const dAbs = Math.round(Math.abs(diff));
    if (dAbs < 1) return { color: "ink" as const, label: "Same price" };
    if (diff < 0) return { color: "green" as const, label: `${dAbs}% cheaper` };
    return { color: "red" as const, label: `${dAbs}% more expensive` };
  })();
  const typeIcon = { API: "plug", DB: "db", Vendor: "user" }[o.type] as "plug" | "db" | "user";

  const niche = o.niche || (o.gambling || o.crypto ? { ...(o.gambling ? { Gambling: o.gambling } : {}), ...(o.crypto ? { Crypto: o.crypto } : {}) } : null);
  const nicheRows = niche ? Object.entries(niche) : [];

  return (
    <div
      style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid " + (isBest ? "var(--lp-accent)" : "var(--lp-line)"),
        boxShadow: isBest ? "0 0 0 2px var(--lp-accent-50)" : "none",
        padding: 16, position: "relative", display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      {isBest && (
        <span
          style={{
            position: "absolute", top: -10, left: 14, background: "var(--lp-accent)",
            color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px",
            borderRadius: 999, letterSpacing: 0.4, textTransform: "uppercase",
          }}
        >
          Best price
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: o.type === "Vendor" ? "#fdf2dd" : o.type === "API" ? "#e9f1fe" : "#eef0f4",
              color: o.type === "Vendor" ? "#a35d00" : o.type === "API" ? "#1d4ed8" : "#374151",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name={typeIcon} size={14} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--lp-ink)" }}>{o.name}</div>
            <div style={{ fontSize: 11, color: "var(--lp-mute)" }}>Updated {o.updated}</div>
          </div>
        </div>
        <RatingBadge score={o.quality} count={o.ratingCount} hasEnoughData={o.hasEnoughRatings} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: yourPrice ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
          gap: 1, background: "var(--lp-line-2)", border: "1px solid var(--lp-line-2)",
          borderRadius: 10, overflow: "hidden",
        }}
      >
        <div style={priceCell}>
          <div style={priceLbl}>Marketplace price <InfoTip text="The vendor's own list price for this placement, before our fee. This is the price shown on the marketplace this domain is sourced from." /></div>
          <div style={priceVal}>
            {priceFmt(o.minPrice, currency)}{o.maxPrice && o.maxPrice !== o.minPrice ? ` – ${priceFmt(o.maxPrice, currency)}` : ""}
          </div>
        </div>
        <div style={{ ...priceCell, background: "var(--lp-accent-50)" }}>
          <div style={priceLbl}>Our price <InfoTip text="What you pay if Linkpricer handles the order for you end to end — the marketplace price plus our flat 15% service fee. We manage briefing, placement and delivery." /></div>
          <div style={{ ...priceVal, color: "var(--lp-accent-700)" }}>{priceFmt(ourPriceUsd, currency)}</div>
        </div>
        {yourPrice != null && (
          <div style={priceCell}>
            <div style={priceLbl}>Your price</div>
            <div style={priceVal}>{priceFmt(yourPrice, currency)}</div>
            {cmp && <div style={{ marginTop: 4 }}><Pill color={cmp.color}>{cmp.label}</Pill></div>}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
        {/* "Delivery guarantee" removed — duplicated "Avg. TAT" (both
        communicate turnaround time); Avg. TAT is the clearer label and
        stays, same fix already applied to the dashboard's ExpandedPanel
        in components/dashboard/results-shared.tsx. */}
        <div style={editRow}>
          <span style={editLbl}>Avg. TAT <InfoTip text="Average turnaround time — how long this supplier has actually taken to publish, based on our previous orders with them." /></span>
          <span style={editVal}>{o.tat} days</span>
        </div>
        <div style={editRow}>
          <span style={editLbl}>Link type <InfoTip text="What kind of link you get (dofollow or nofollow) and how many links to your site are allowed within the article." /></span>
          <span style={editVal}>
            <Pill color={linkGood ? "green" : "amber"}>
              <Icon name={linkGood ? "check" : "x"} size={10} /> {o.link}{o.links ? `, ${o.links} link${o.links > 1 ? "s" : ""}` : ""}
            </Pill>
          </span>
        </div>
        <div style={editRow}>
          <span style={editLbl}>Source <InfoTip text="Where this backlink comes from — it may be a marketplace, a direct vendor, or a freelancer. 'Live API' and 'Synced' pull prices automatically; 'Vendor' is sourced directly." /></span>
          <span style={editVal}>
            <Pill color="ink">{o.type === "API" ? "Live API" : o.type === "DB" ? "Synced" : "Vendor"}</Pill>
          </span>
        </div>
      </div>

      {o.example ? (
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: 10,
            border: "1px dashed var(--lp-line)", borderRadius: 8, textDecoration: "none",
            color: "var(--lp-ink-2)", background: "#fbfcfe",
          }}
        >
          <div style={{ width: 32, height: 24 }} className="lp-imgph" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--lp-mute)", fontWeight: 600 }}>Published example <InfoTip text="A real article previously published by this supplier, so you can judge the quality and style before ordering. This URL comes from the supplier." /></div>
            <div className="lp-mono" style={{ fontSize: 11.5, color: "var(--lp-ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {o.example.replace(/^https?:\/\//, "")}
            </div>
          </div>
          <Icon name="external" size={14} color="var(--lp-accent)" />
        </a>
      ) : null}

      {o.conditions && o.conditions.length > 0 && (
        <div style={{ borderTop: "1px solid var(--lp-line-2)", paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--lp-mute)", letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }}>Conditions &amp; requirements</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {o.conditions.map((c, ci) => (
              <li key={ci} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--lp-ink-2)", lineHeight: 1.4 }}>
                <span style={{ color: "var(--lp-accent)", marginTop: 1, flexShrink: 0, display: "inline-flex" }}><Icon name="check" size={12} /></span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nicheRows.length > 0 && (
        <details style={{ borderTop: "1px solid var(--lp-line-2)", paddingTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 10, color: "var(--lp-mute)", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="chevronDown" size={12} /> Niche pricing table
          </summary>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <tbody>
              {nicheRows.map(([label, range], ri) => (
                <tr key={ri} style={{ borderBottom: ri < nicheRows.length - 1 ? "1px dashed var(--lp-line-2)" : "none" }}>
                  <td style={{ padding: "6px 0", fontSize: 12, color: "var(--lp-ink-2)", fontWeight: 500 }}>{label}</td>
                  <td className="lp-mono" style={{ padding: "6px 0", fontSize: 12, color: "var(--lp-ink)", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {priceFmt(range[0], currency)}{range[1] && range[1] !== range[0] ? ` – ${priceFmt(range[1], currency)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button style={{ ...btn("primary", "sm"), cursor: "pointer" }} onClick={() => onBuy?.(d, o)}>
          <Icon name="shield" size={13} /> Buy now
        </button>
        <button
          style={{ ...btn("ghost", "sm"), cursor: "pointer" }}
          onClick={() => window.alert(`Buy direct → ${o.name}\n\nWould redirect to vendor with referral.`)}
        >
          Buy direct <Icon name="external" size={12} />
        </button>
      </div>
    </div>
  );
}
