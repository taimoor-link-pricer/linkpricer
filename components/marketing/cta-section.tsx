"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

const TESTIMONIALS = [
  { text: "We turned two weeks of vendor hunting into minutes. The price comparison saved us thousands.", meta: "SEO Agency Lead" },
  { text: "Our team favorites lists, orders, and tracks — all in one place. No more scattered emails.", meta: "Freelance Link Builder" },
  { text: "Case studies and receipts available on request", meta: "" },
];

const SECURITY_ITEMS = ["Role-based access", "GDPR-aligned data choices", "Exports for finance & audit"];

const FAQS = [
  { q: "Do I need a credit card to compare prices?", a: "No. Linkpricer is free for research: paste lists, compare, and favorite domains without payment. No credit card required, no trial period." },
  { q: "What happens after I place an order?", a: 'You receive an "Order received" email immediately. Communication continues by email, and the same status appears in your dashboard. We keep you updated every step of the way.' },
  { q: "When do I pay?", a: "When the marketplace confirms your order via API, we email the invoice. Pay first, then we proceed with content and publication. No surprises." },
  { q: "Can I upload my own article?", a: "Yes. You can upload your article, paste a URL to an existing article, or ask us to write it for you. You will see progress end-to-end in your dashboard." },
  { q: "What integrations do you support?", a: "We connect to 40+ marketplaces to confirm availability and orders. More sources are added over time. Check our Marketplaces page for the full list." },
  { q: "Is my data secure?", a: "We follow GDPR-friendly practices, provide exports, and limit access by role. Your data is encrypted in transit and at rest." },
];

const BLOG_POSTS = [
  { icon: "📚", title: "The Complete Guide to Guest Posting", description: "Learn the fundamentals of guest posting and how to maximize link value from each placement." },
  { icon: "🔍", title: "Evaluating Backlink Quality in 2026", description: "Understand what makes a backlink valuable and how to spot red flags before you buy." },
  { icon: "📈", title: "Bulk Outreach: A New Era of Link Building", description: "How to scale your link-building efforts without losing quality or burning out your team." },
];

export function CTASection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <style>{`
        .cta-section { padding: 100px 40px; }
        .cta-h2 { font-size: 44px; margin: 0 0 56px; }
        .social-proof-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 48px; align-items: start; }
        .cta-strip { padding: 64px 40px; margin: 80px auto; max-width: 1200px; border-radius: 16px; }
        .cta-strip-h2 { font-size: 36px; }
        .blog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        @media (max-width: 1024px) {
          .blog-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .cta-section { padding: 56px 16px; }
          .cta-h2 { font-size: 26px; margin: 0 0 32px; letter-spacing: -0.5px; }
          .social-proof-grid { grid-template-columns: 1fr; gap: 24px; }
          .cta-strip { padding: 40px 20px; margin: 40px 16px; border-radius: 12px; }
          .cta-strip-h2 { font-size: 24px; }
          .blog-grid { grid-template-columns: 1fr; gap: 16px; }
        }
      `}</style>

      {/* Social proof + security */}
      <section className="cta-section" style={{ background: "linear-gradient(135deg, #f5f6f8 0%, #eff0f3 100%)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div className="social-proof-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} style={{ background: "#ffffff", borderLeft: "4px solid #0052cc", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <p style={{ fontSize: 15, color: "#1a202c", margin: 0, fontWeight: 500, lineHeight: 1.6 }}>&ldquo;{t.text}&rdquo;</p>
                  {t.meta && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10, fontWeight: 500 }}>— {t.meta}</div>}
                </div>
              ))}
            </div>
            <div style={{ background: "#ffffff", borderRadius: 14, padding: 28, border: "1px solid #e8eaed", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 16px", color: "#000000" }}>Security &amp; compliance</h3>
              {SECURITY_ITEMS.map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, margin: "14px 0", fontSize: 14, color: "#4b5563" }}>
                  <span style={{ color: "#006621", fontWeight: 900, fontSize: 15, flexShrink: 0 }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <div className="cta-strip" style={{ background: "linear-gradient(135deg, #0052cc 0%, #003a99 100%)", color: "#ffffff", textAlign: "center" }}>
        <h2 className="cta-strip-h2" style={{ color: "#ffffff", margin: "0 0 12px", fontWeight: 900, letterSpacing: -1 }}>Ready to compare prices?</h2>
        <p style={{ color: "#e6f2ff", margin: "0 0 24px", fontSize: 15 }}>
          It&apos;s free to paste your list, favorite domains, and see the best place to purchase.
        </p>
        <Link
          href={ROUTES.signup}
          style={{ padding: "12px 28px", background: "#ffffff", color: "#0052cc", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none", display: "inline-block" }}
        >
          Start free
        </Link>
      </div>

      {/* FAQ */}
      <section className="cta-section" style={{ background: "#ffffff" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 className="cta-h2" style={{ fontWeight: 900, textAlign: "center", color: "#000000", letterSpacing: -1 }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ background: openFaq === i ? "#eff6ff" : "#ffffff", border: `1px solid ${openFaq === i ? "#0052cc" : "#e8eaed"}`, borderRadius: 10, padding: 20, cursor: "pointer", transition: "all 0.2s" }}
              >
                <div style={{ fontWeight: 700, color: "#000000", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 14 }}>
                  <span>{faq.q}</span>
                  <span style={{ fontSize: 18, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none", flexShrink: 0 }}>+</span>
                </div>
                {openFaq === i && (
                  <div style={{ marginTop: 14, fontSize: 14, color: "#4b5563", lineHeight: 1.7, paddingTop: 14, borderTop: "1px solid #e8eaed" }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog section */}
      <section className="cta-section" style={{ background: "#f5f6f8" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 className="cta-h2" style={{ fontWeight: 900, textAlign: "center", color: "#000000", letterSpacing: -1 }}>
            Latest from the blog
          </h2>
          <div className="blog-grid">
            {BLOG_POSTS.map((post) => (
              <div
                key={post.title}
                style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden", transition: "all 0.3s", cursor: "pointer" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#0052cc";
                  el.style.boxShadow = "0 8px 24px rgba(0,82,204,0.08)";
                  el.style.transform = "translateY(-6px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#e8eaed";
                  el.style.boxShadow = "none";
                  el.style.transform = "none";
                }}
              >
                <div style={{ width: "100%", height: 160, background: "linear-gradient(135deg, #e6f2ff 0%, #eff6ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
                  {post.icon}
                </div>
                <div style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", color: "#000000" }}>{post.title}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{post.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
