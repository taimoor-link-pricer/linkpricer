"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

const STATIC_ROWS = [
  { id: "F0", domain: "forbes.com", refs: "1.8M", price: "$1,380", grade: "A+", score: 92, gradeClass: "hp-grade-a", country: "🇺🇸", countryCode: "US", dr: 94, traffic: "71M", keywords: "8.4M" },
  { id: "H1", domain: "healthline.com", refs: "92K", price: "$1,265", grade: "A+", score: 88, gradeClass: "hp-grade-a", country: "🇺🇸", countryCode: "US", dr: 91, traffic: "184M", keywords: "4.8M" },
  { id: "T2", domain: "techcrunch.com", refs: "184K", price: "$977", grade: "A", score: 78, gradeClass: "hp-grade-a", country: "🇺🇸", countryCode: "US", dr: 92, traffic: "14M", keywords: "1.8M" },
  { id: "O3", domain: "oneangrygamer.net", refs: "2.1K", price: "$230", grade: "A", score: 71, gradeClass: "hp-grade-a", country: "🇺🇸", countryCode: "US", dr: 58, traffic: "410K", keywords: "38K" },
  { id: "B4", domain: "betimate.com", refs: "980", price: "$212", grade: "B+", score: 58, gradeClass: "hp-grade-b", country: "🇬🇧", countryCode: "GB", dr: 41, traffic: "320K", keywords: "25K" },
  { id: "M5", domain: "medium.com", refs: "456K", price: "$1,820", grade: "A+", score: 92, gradeClass: "hp-grade-a", country: "🇺🇸", countryCode: "US", dr: 87, traffic: "1.2M", keywords: "3.2M" },
];

const DOMAIN_DATA: Record<string, typeof STATIC_ROWS[0]> = {
  "forbes.com": STATIC_ROWS[0],
  "healthline.com": STATIC_ROWS[1],
  "techcrunch.com": STATIC_ROWS[2],
  "oneangrygamer.net": STATIC_ROWS[3],
  "betimate.com": STATIC_ROWS[4],
  "medium.com": STATIC_ROWS[5],
};

const HOW_STEPS = [
  { num: "1", title: "Paste your domain list", body: "Bulk-paste domains with or without your known prices. We normalize and match them across marketplaces." },
  { num: "2", title: "Compare & favorite", body: "See where each domain is available and the lowest purchase price. Add domains to Favorites to build your shortlist." },
  { num: "3", title: "Order in one go", body: 'Checkout directly via Linkpricer or leave order details to us. You get an "Order received" email instantly.' },
  { num: "4", title: "Track in your dashboard", body: "All communication continues by email. Progress is mirrored in your dashboard for full visibility." },
  { num: "5", title: "Invoice after confirmation", body: "When the marketplace confirms your order, we email the invoice. Pay first, then delivery continues." },
  { num: "6", title: "Content handling", body: "Upload your own article or ask us to write it — either way, you see every step until publication." },
];

const VALUE_CARDS = [
  { icon: "💰", title: "True market pricing", body: "Stop guessing. See price differences across marketplaces in seconds." },
  { icon: "📧", title: "One order, not 50 emails", body: "Centralize purchasing — let your dashboard and inbox reflect the status." },
  { icon: "✅", title: "Fewer surprises", body: "Acceptance rules and requirements surfaced up front. Choose viable domains only." },
  { icon: "🎁", title: "Always free to compare", body: "Build lists, favorite targets, and compare prices without paying a cent." },
];

const FEATURE_CARDS = [
  { title: "📊 Bulk search", body: "Paste hundreds of domains at once for instant availability & best-price matching." },
  { title: "🔄 Marketplace comparison", body: "We unify listings from multiple marketplaces and show the best place to purchase." },
  { title: "❤️ Favorites list", body: "Shortlist domains you like and come back later or order in one go." },
  { title: "🛒 Direct ordering", body: "Checkout via Linkpricer or delegate ordering to us with your instructions." },
  { title: "📧 Email-first workflow", body: 'Automatic "Order received" email. Ongoing communication continues by email.' },
  { title: "📋 Dashboard tracking", body: "Mirror of your email thread: see order status, confirmations, content, and publication." },
  { title: "✍️ Content options", body: "Upload your article or let us write it for you. Status visible end-to-end." },
  { title: "🔒 Privacy & security", body: "GDPR-friendly data handling, role-based access, and exportable records." },
  { title: "💵 Zero cost to compare", body: "Comparisons are free. You only pay when you place an order." },
];

const PRICE_CARDS = [
  { title: "No paywall for research", body: "Paste, compare, and favorite domains without entering a card." },
  { title: "Transparent checkout", body: "Before you pay, you see exactly what is being ordered and the total due." },
  { title: "Invoices by email", body: "Once a marketplace confirms your order via API, we email the invoice so you can pay and continue." },
];

const FAQS = [
  { q: "Do I need a credit card to compare prices?", a: "No. Linkpricer is free for research: paste lists, compare, and favorite domains without payment. No credit card required, no trial period." },
  { q: "What happens after I place an order?", a: 'You receive an "Order received" email immediately. Communication continues by email, and the same status appears in your dashboard. We keep you updated every step of the way.' },
  { q: "When do I pay?", a: "When the marketplace confirms your order via API, we email the invoice. Pay first, then we proceed with content and publication. No surprises." },
  { q: "Can I upload my own article?", a: "Yes. You can upload your article or ask us to write it. You will see progress end-to-end in your dashboard." },
  { q: "What integrations do you support?", a: "We connect to 40+ marketplaces to confirm availability and orders. More sources are added over time. Check our Marketplaces page for the full list." },
  { q: "Is my data secure?", a: "We follow GDPR-friendly practices, provide exports, and limit access by role. Your data is encrypted in transit and at rest." },
];

const BLOG_CARDS = [
  { emoji: "📚", title: "The Complete Guide to Guest Posting", body: "Learn the fundamentals of guest posting and how to maximize link value from each placement." },
  { emoji: "🔍", title: "Evaluating Backlink Quality in 2026", body: "Understand what makes a backlink valuable and how to spot red flags before you buy." },
  { emoji: "📈", title: "Bulk Outreach: A New Era of Link Building", body: "How to scale your link-building efforts without losing quality or burning out your team." },
];

export function HeroSection() {
  const [searchInput, setSearchInput] = useState("");
  const [demoRows, setDemoRows] = useState(STATIC_ROWS);
  const [demoCount, setDemoCount] = useState(6);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function handleSearch() {
    const domain = searchInput.trim().toLowerCase();
    if (!domain) return;
    const found = DOMAIN_DATA[domain];
    if (found) {
      setDemoRows([{ ...found, id: "D0" }]);
      setDemoCount(1);
    } else {
      setDemoRows([]);
      setDemoCount(0);
    }
  }

  return (
    <>
      <style>{`
        .hp-hero { padding: 80px 40px; background: linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%); text-align: center; }
        .hp-hero-content { max-width: 900px; margin: 0 auto; }
        .hp-h1 { font-size: 56px; font-weight: 900; margin: 0 0 16px; line-height: 1.1; letter-spacing: -1px; color: #111827; }
        .hp-sub { font-size: 18px; color: #4b5563; margin: 0 0 32px; line-height: 1.6; }
        .hp-cta { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; flex-wrap: wrap; }
        .hp-cta-btn { padding: 13px 28px; font-size: 15px; font-weight: 600; border-radius: 10px; text-decoration: none; cursor: pointer; border: none; display: inline-block; transition: all 0.2s; }
        .hp-btn-primary { background: #0052cc; color: #fff; }
        .hp-btn-primary:hover { background: #003a99; }
        .hp-btn-secondary { background: #fff; color: #0052cc; border: 1px solid #0052cc; }
        .hp-btn-secondary:hover { background: #f0f7ff; }
        .hp-trust { font-size: 13px; color: #9ca3af; margin-bottom: 48px; }
        .hp-visual { max-width: 900px; margin: 0 auto; padding: 32px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; text-align: center; color: #9ca3af; font-size: 48px; min-height: 200px; display: flex; align-items: center; justify-content: center; }
        .hp-proof { display: flex; justify-content: center; gap: 48px; margin-top: 48px; flex-wrap: wrap; }
        .hp-proof-stat { font-size: 32px; font-weight: 900; color: #0052cc; }
        .hp-proof-label { font-size: 12px; color: #9ca3af; margin-top: 4px; }

        .hp-demo { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; max-width: 1400px; margin: 40px auto; }
        .hp-demo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .hp-demo-title { font-size: 18px; font-weight: 700; color: #111827; }
        .hp-demo-badge { background: #e6f2ff; color: #0052cc; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; }
        .hp-demo-search { display: flex; gap: 12px; margin-bottom: 24px; }
        .hp-demo-input { flex: 1; padding: 11px 14px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; outline: none; font-family: Inter, -apple-system, system-ui, sans-serif; }
        .hp-demo-input:focus { border-color: #0052cc; box-shadow: 0 0 0 3px rgba(0,82,204,0.1); }
        .hp-demo-go { padding: 11px 28px; background: #0052cc; color: #fff; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: background 0.2s; }
        .hp-demo-go:hover { background: #003a99; }
        .hp-table { width: 100%; border-collapse: collapse; }
        .hp-table th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #9ca3af; letter-spacing: 0.3px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
        .hp-table td { padding: 14px 12px; font-size: 13.5px; color: #374151; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
        .hp-table tr:last-child td { border-bottom: none; }
        .hp-table tr:hover td { background: #f9fafb; }
        .hp-mono { font-family: "JetBrains Mono", "Fira Mono", monospace; font-weight: 600; color: #0052cc; }
        .hp-grade { display: inline-flex; align-items: baseline; gap: 6px; padding: 3px 9px; border-radius: 8px; font-weight: 700; font-size: 12px; }
        .hp-grade-a { background: #e6f6ed; color: #0a8a4a; }
        .hp-grade-b { background: #fef3c7; color: #a35d00; }
        .hp-buy { padding: 8px 14px; background: #0052cc; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 12px; text-decoration: none; display: inline-block; transition: background 0.2s; }
        .hp-buy:hover { background: #003a99; }
        .hp-demo-footer { margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280; }

        .hp-section { padding: 100px 40px; max-width: 1600px; margin: 0 auto; }
        .hp-section-bg { background: #f9fafb; }
        .hp-section-full { max-width: 100%; padding: 100px 40px; }
        .hp-section h2 { font-size: 44px; font-weight: 900; margin: 0 0 0; text-align: center; letter-spacing: -1px; color: #111827; }

        .hp-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 56px; }
        .hp-step { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; text-align: center; transition: all 0.3s; }
        .hp-step:hover { border-color: #0052cc; box-shadow: 0 8px 24px rgba(0,82,204,0.1); transform: translateY(-4px); }
        .hp-step-num { font-size: 40px; font-weight: 900; color: #0052cc; margin-bottom: 12px; }
        .hp-step h3 { font-size: 18px; font-weight: 700; margin: 0 0 12px; color: #111827; }
        .hp-step p { margin: 0; font-size: 14px; color: #4b5563; }

        .hp-value-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; margin-top: 56px; max-width: 1600px; margin-left: auto; margin-right: auto; }
        .hp-value { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 36px; transition: all 0.3s; }
        .hp-value:hover { border-color: #0052cc; box-shadow: 0 8px 24px rgba(0,82,204,0.1); transform: translateY(-4px); }
        .hp-value-icon { font-size: 32px; margin-bottom: 12px; }
        .hp-value h3 { font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #111827; }
        .hp-value p { margin: 0; font-size: 14px; color: #4b5563; }

        .hp-feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; }
        .hp-feat { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; transition: all 0.3s; }
        .hp-feat:hover { border-color: #0052cc; box-shadow: 0 6px 16px rgba(0,82,204,0.08); transform: translateY(-4px); }
        .hp-feat h3 { font-size: 16px; font-weight: 700; margin: 0 0 10px; color: #111827; }
        .hp-feat p { margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6; }

        .hp-price-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 56px; }
        .hp-price { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; text-align: center; transition: all 0.3s; }
        .hp-price:hover { border-color: #0052cc; box-shadow: 0 8px 24px rgba(0,82,204,0.1); transform: translateY(-4px); }
        .hp-price h3 { font-size: 18px; font-weight: 700; margin: 0 0 12px; color: #111827; }
        .hp-price p { margin: 0; font-size: 14px; color: #4b5563; }

        .hp-social { display: grid; grid-template-columns: 2fr 1fr; gap: 48px; align-items: center; }
        .hp-testimonials { display: flex; flex-direction: column; gap: 24px; }
        .hp-testimonial { background: #fff; border-left: 4px solid #0052cc; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .hp-testimonial-text { font-size: 15px; color: #111827; margin: 0; font-weight: 500; line-height: 1.6; }
        .hp-testimonial-meta { font-size: 12px; color: #9ca3af; margin-top: 10px; }
        .hp-security { background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .hp-security h3 { font-size: 18px; font-weight: 700; margin: 0 0 18px; color: #111827; }
        .hp-security-item { display: flex; gap: 12px; margin: 14px 0; font-size: 13px; color: #4b5563; align-items: flex-start; }
        .hp-security-check { color: #0a8a4a; font-weight: 900; font-size: 16px; flex-shrink: 0; }

        .hp-cta-strip { background: linear-gradient(135deg, #0052cc 0%, #003a99 100%); color: #fff; padding: 64px 40px; text-align: center; border-radius: 16px; margin: 80px 40px; max-width: 1200px; margin-left: auto; margin-right: auto; }
        .hp-cta-strip h2 { color: #fff; font-size: 36px; font-weight: 900; margin: 0 0 12px; letter-spacing: -0.5px; }
        .hp-cta-strip p { color: #e6f2ff; margin: 0 0 24px; font-size: 16px; }

        .hp-faq-grid { display: grid; gap: 12px; margin-top: 56px; }
        .hp-faq-item { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; cursor: pointer; transition: all 0.2s; }
        .hp-faq-item:hover { border-color: #0052cc; background: #f0f7ff; }
        .hp-faq-q { font-weight: 700; color: #111827; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
        .hp-faq-toggle { font-size: 18px; transition: transform 0.2s; flex-shrink: 0; }
        .hp-faq-a { margin-top: 14px; font-size: 13px; color: #4b5563; line-height: 1.7; padding-top: 14px; border-top: 1px solid #e5e7eb; }

        .hp-blog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 56px; }
        .hp-blog-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; transition: all 0.3s; }
        .hp-blog-card:hover { border-color: #0052cc; box-shadow: 0 8px 24px rgba(0,82,204,0.08); transform: translateY(-6px); }
        .hp-blog-img { width: 100%; height: 180px; background: linear-gradient(135deg, #f0f7ff 0%, #e6f2ff 100%); display: flex; align-items: center; justify-content: center; font-size: 40px; }
        .hp-blog-body { padding: 20px; }
        .hp-blog-body h3 { font-size: 15px; font-weight: 700; margin: 0 0 8px; color: #111827; }
        .hp-blog-body p { margin: 0; font-size: 12px; color: #4b5563; line-height: 1.5; }

        @keyframes hp-fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 1024px) {
          .hp-how-grid, .hp-feat-grid, .hp-price-grid, .hp-blog-grid { grid-template-columns: repeat(2, 1fr); }
          .hp-social { grid-template-columns: 1fr; }
          .hp-hero { padding: 60px 20px; }
          .hp-h1 { font-size: 40px; }
          .hp-section { padding: 60px 20px; }
          .hp-cta-strip { margin: 40px 20px; }
          .hp-demo { margin: 40px 20px; }
        }
        @media (max-width: 640px) {
          .hp-h1 { font-size: 28px; }
          .hp-how-grid, .hp-feat-grid, .hp-price-grid, .hp-blog-grid { grid-template-columns: 1fr; }
          .hp-value-grid { grid-template-columns: 1fr; }
          .hp-social { grid-template-columns: 1fr; }
          .hp-proof { gap: 24px; }
          .hp-cta-strip { padding: 40px 20px; }
        }
      `}</style>

      {/* Hero */}
      <div className="hp-hero">
        <div className="hp-hero-content">
          <h1 className="hp-h1">One search. 60+ vendors. 1.54M offers</h1>
          <p className="hp-sub">
            The same domain can cost 10× more on one marketplace vs. another. LinkPricer shows you where to buy at the best price, for up to 200 domains at once.
          </p>
          <div className="hp-cta">
            <Link href={ROUTES.signup} className="hp-cta-btn hp-btn-primary">Start free — compare prices</Link>
            <a href="#how" className="hp-cta-btn hp-btn-secondary">See how it works</a>
          </div>
          <div className="hp-trust">✓ No credit card &bull; Free to compare &bull; Pay only when we confirm the webmaster accepts</div>
          <div className="hp-visual">[Product demo or screenshot]</div>
          <div className="hp-proof">
            {[{ stat: "60+", label: "Vendors aggregated" }, { stat: "1.54M+", label: "Offers indexed" }, { stat: "3,000+", label: "Registered users" }].map((item) => (
              <div key={item.label} style={{ textAlign: "center" }}>
                <div className="hp-proof-stat">{item.stat}</div>
                <div className="hp-proof-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Domain Analysis Demo */}
      <div className="hp-demo">
        <div className="hp-demo-header">
          <div className="hp-demo-title">Domain analysis results</div>
          <div className="hp-demo-badge">{demoCount} domain{demoCount !== 1 ? "s" : ""}</div>
        </div>
        <div className="hp-demo-search">
          <input
            className="hp-demo-input"
            type="text"
            placeholder="Enter domain name (e.g., forbes.com)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          />
          <button className="hp-demo-go" onClick={handleSearch}>Search</button>
        </div>
        <table className="hp-table">
          <thead>
            <tr>
              <th style={{ width: "5%" }}></th>
              <th style={{ width: "22%" }}>Domain</th>
              <th style={{ width: "15%" }}>Best Price</th>
              <th style={{ width: "12%" }}>Value</th>
              <th style={{ width: "10%" }}>Country</th>
              <th style={{ width: "10%" }}>DR</th>
              <th style={{ width: "13%" }}>Traffic</th>
              <th style={{ width: "13%" }}>Keywords</th>
            </tr>
          </thead>
          <tbody>
            {demoRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "#9ca3af", padding: "32px 12px" }}>
                  No result found for that domain. Try: forbes.com, healthline.com, techcrunch.com
                </td>
              </tr>
            ) : demoRows.map((row) => (
              <tr key={row.id}>
                <td style={{ color: "#9ca3af", fontWeight: 600 }}>{row.id}</td>
                <td>
                  <span className="hp-mono">{row.domain}</span>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>EN · {row.refs} ref. domains</div>
                </td>
                <td>
                  <Link href={`${ROUTES.signup}?domain=${encodeURIComponent(row.domain)}`} className="hp-buy">
                    Buy {row.price}
                  </Link>
                </td>
                <td>
                  <span className={`hp-grade ${row.gradeClass}`}>{row.grade} {row.score}</span>
                </td>
                <td>{row.country} {row.countryCode}</td>
                <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{row.dr}</td>
                <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{row.traffic}</td>
                <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{row.keywords}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hp-demo-footer">
          💡 Try searching for a domain above to see best prices across 60+ vendors.{" "}
          <Link href={ROUTES.signup} style={{ color: "#0052cc", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>{" "}
          to see all available offers and marketplace details.
        </div>
      </div>

      {/* How It Works */}
      <section className="hp-section" id="how">
        <h2>How it works in 6 steps</h2>
        <div className="hp-how-grid">
          {HOW_STEPS.map((step) => (
            <div key={step.num} className="hp-step">
              <div className="hp-step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Linkpricer */}
      <div style={{ background: "#f9fafb" }}>
        <div className="hp-section">
          <h2>Why choose Linkpricer?</h2>
          <div className="hp-value-grid">
            {VALUE_CARDS.map((card) => (
              <div key={card.title} className="hp-value">
                <div className="hp-value-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="hp-section">
        <h2>What&rsquo;s included</h2>
        <div className="hp-feat-grid">
          {FEATURE_CARDS.map((card) => (
            <div key={card.title} className="hp-feat">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Transparency */}
      <div style={{ background: "#f9fafb" }}>
        <div className="hp-section">
          <h2>Free to use, transparent pricing</h2>
          <div className="hp-price-grid">
            {PRICE_CARDS.map((card) => (
              <div key={card.title} className="hp-price">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Social Proof + Security */}
      <div style={{ background: "#f9fafb" }}>
        <div className="hp-section">
          <div className="hp-social">
            <div className="hp-testimonials">
              <div className="hp-testimonial">
                <p className="hp-testimonial-text">&ldquo;We turned two weeks of vendor hunting into minutes.&rdquo;</p>
                <div className="hp-testimonial-meta">— SEO Agency Lead</div>
              </div>
              <div className="hp-testimonial">
                <p className="hp-testimonial-text">&ldquo;Our team favorites lists, orders, and tracks — all in one place.&rdquo;</p>
                <div className="hp-testimonial-meta">— Freelance Link Builder</div>
              </div>
              <div className="hp-testimonial">
                <p className="hp-testimonial-text">Case studies and receipts available on request</p>
              </div>
            </div>
            <div className="hp-security">
              <h3>Security &amp; compliance</h3>
              {["Role-based access", "GDPR-aligned data choices", "Exports for finance & audit"].map((item) => (
                <div key={item} className="hp-security-item">
                  <span className="hp-security-check">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Strip */}
      <div className="hp-cta-strip">
        <h2>Ready to compare prices?</h2>
        <p>It&rsquo;s free to paste your list, favorite domains, and see the best place to purchase.</p>
        <Link href={ROUTES.signup} className="hp-cta-btn" style={{ background: "#fff", color: "#0052cc", fontWeight: 700, borderRadius: 10, padding: "13px 28px", textDecoration: "none", display: "inline-block" }}>
          Start free
        </Link>
      </div>

      {/* FAQ */}
      <section className="hp-section">
        <h2>Frequently asked questions</h2>
        <div className="hp-faq-grid">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="hp-faq-item"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div className="hp-faq-q">
                {faq.q}
                <span className="hp-faq-toggle" style={{ transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
              </div>
              {openFaq === i && (
                <div className="hp-faq-a">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Blog */}
      <div style={{ background: "#f9fafb" }} id="blog">
        <div className="hp-section">
          <h2>Latest from the blog</h2>
          <div className="hp-blog-grid">
            {BLOG_CARDS.map((card) => (
              <div key={card.title} className="hp-blog-card">
                <div className="hp-blog-img">{card.emoji}</div>
                <div className="hp-blog-body">
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
