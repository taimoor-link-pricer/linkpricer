import Link from "next/link";

export function BlogCta({ eyebrow, heading, body }: { eyebrow: string; heading: string; body: string }) {
  return (
    <section className="lp-blog-wrap">
      <div className="lp-blog-cta">
        <div className="lp-blog-cta__eyebrow">{eyebrow}</div>
        <h2>{heading}</h2>
        <p>{body}</p>
        <Link
          className="lp-blog-btn"
          href="/#top"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600,
            padding: "15px 26px", fontSize: 15.5, borderRadius: 12,
            background: "#fff", color: "var(--lp-accent-700)", textDecoration: "none",
          }}
        >
          Compare backlink prices →
        </Link>
      </div>
    </section>
  );
}
