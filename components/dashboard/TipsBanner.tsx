"use client";

import { useState, useEffect } from "react";

const TIPS = [
  { text: "Add Forbes.com at $150 (your supplier's price) and see how it compares to your own pricing.", link: null },
  { text: "Our bestie is Rankup.com — use code LINKPRICER for a free month.", link: "https://rankup.com" },
  { text: "Browse related sites by category and country to find the best place to buy.", link: null },
  { text: "Add a site to Favorites and we'll ping vendors to source it for you specifically.", link: null },
  { text: "Fun fact: eSports brands spend ~$20k/month on backlinks 🍻", link: null },
  { text: "Compare supplier prices side-by-side before you commit.", link: null },
  { text: "Turn on alerts to get notified when a watched site drops in price.", link: null },
];

export function TipsBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Linkpricer tips"
      style={{
        height: 40,
        background: "linear-gradient(90deg, #f0f7ff 0%, #e6f2ff 100%)",
        borderBottom: "1px solid #d1d5db",
        display: "flex",
        alignItems: "center",
        fontSize: 13,
        fontFamily: "inherit",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <style>{`
        @keyframes lp-scroll-tips {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lp-tips-track {
          display: flex;
          gap: 200px;
          white-space: nowrap;
          animation: ${reducedMotion ? "none" : "lp-scroll-tips 56.25s linear infinite"};
          padding-right: 40px;
        }
        .lp-tips-track:hover { animation-play-state: paused; }
        .lp-tip-link {
          color: #0052cc;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }
        .lp-tip-link:hover { border-bottom-color: #0052cc; }
        @media (prefers-reduced-motion: reduce) {
          .lp-tips-track { animation: none; overflow-x: auto; }
        }
        @media (max-width: 640px) {
          .lp-tips-label { display: none; }
          .lp-tips-track { gap: 48px; }
        }
      `}</style>

      {/* Label */}
      <div className="lp-tips-label" style={{
        flexShrink: 0,
        paddingLeft: 16,
        paddingRight: 20,
        fontWeight: 600,
        color: "#0052cc",
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderRight: "1px solid #d1d5db",
        height: "100%",
        fontSize: 12,
        letterSpacing: 0.2,
      }}>
        Linkpricer · Tips
      </div>

      {/* Scrolling track */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div className="lp-tips-track">
          {[...TIPS, ...TIPS].map((tip, idx) => (
            <span key={idx} style={{ flexShrink: 0, color: "#374151", display: "inline-flex", alignItems: "center" }}>
              {tip.link ? (
                <a href={tip.link} target="_blank" rel="noopener noreferrer" className="lp-tip-link">
                  {tip.text}
                </a>
              ) : (
                tip.text
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss tips banner"
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "none",
          color: "#9ca3af",
          fontSize: 18,
          fontWeight: 700,
          cursor: "pointer",
          padding: "0 14px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          lineHeight: 1,
          transition: "color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "#374151")}
        onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
      >
        ×
      </button>
    </div>
  );
}
