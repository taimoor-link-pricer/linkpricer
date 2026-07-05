import type { Metadata } from "next";
import Link from "next/link";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact us · Linkpricer",
  description: "Get in touch with Linkpricer, UAB — company details, email and registered address in Kaunas, Lithuania.",
  openGraph: {
    type: "website",
    title: "Contact Linkpricer",
    description: "Company details, email and registered address for Linkpricer, UAB.",
  },
};

// Content ported verbatim from the design handoff (contact.html) per
// Karolis's walkthrough — flagged there as an example pending final content.
export default function ContactPage() {
  return (
    <MarketingLayout>
      <style>{`
        .lp-contact-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px 40px; }

        .lp-contact-head { padding: 60px 0 0; text-align: center; max-width: 620px; margin: 0 auto; }
        .lp-contact-head h1 { margin: 0; font-size: clamp(34px, 5vw, 50px); font-weight: 800; letter-spacing: -1.4px; line-height: 1.04; color: var(--lp-ink); }
        .lp-contact-head p { margin: 16px 0 0; font-size: 18px; line-height: 1.55; color: var(--lp-ink-3); }

        .lp-contact-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 720px; margin: 40px auto 0; }
        .lp-qcard {
          display: flex; gap: 15px; align-items: flex-start; text-decoration: none; color: inherit;
          padding: 20px 22px; border: 1px solid var(--lp-line); border-radius: var(--lp-r-lg);
          background: #fff; box-shadow: var(--lp-shadow-1); transition: border-color .12s, box-shadow .12s, transform .04s;
        }
        a.lp-qcard:hover { border-color: #bcd9fb; box-shadow: var(--lp-shadow-2); }
        a.lp-qcard:active { transform: translateY(1px); }
        .lp-qcard-ic { flex-shrink: 0; width: 44px; height: 44px; border-radius: 12px; background: var(--lp-accent-50); color: var(--lp-accent-700); display: inline-flex; align-items: center; justify-content: center; }
        .lp-qcard-k { display: block; font-family: var(--lp-mono); font-size: 11px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase; color: var(--lp-mute); }
        .lp-qcard-v { display: block; margin-top: 5px; font-size: 16.5px; font-weight: 700; letter-spacing: -0.3px; color: var(--lp-ink); line-height: 1.35; word-break: break-word; }
        .lp-qcard-sub { display: block; margin-top: 5px; font-size: 13px; color: var(--lp-mute); }

        .lp-contact-main { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: stretch; max-width: 980px; margin: 28px auto 0; }
        .lp-details { border: 1px solid var(--lp-line); border-radius: var(--lp-r-lg); background: var(--lp-bg-3); padding: 8px 26px; align-self: start; }
        .lp-details dl { margin: 0; }
        .lp-details .row { padding: 18px 0; display: flex; flex-direction: column; gap: 4px; }
        .lp-details .row + .row { border-top: 1px solid var(--lp-line); }
        .lp-details dt { font-family: var(--lp-mono); font-size: 11px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase; color: var(--lp-mute); margin: 0; }
        .lp-details dd { margin: 0; font-size: 16px; font-weight: 600; color: var(--lp-ink-2); line-height: 1.45; }
        .lp-details dd .reg { font-weight: 500; color: var(--lp-mute); }
        .lp-details dd a { color: var(--lp-accent-700); text-decoration: none; border-bottom: 1.5px solid var(--lp-accent-50); }
        .lp-details dd a:hover { border-bottom-color: var(--lp-accent); }

        .lp-map { border: 1px solid var(--lp-line); border-radius: var(--lp-r-lg); overflow: hidden; min-height: 320px; display: flex; flex-direction: column; background: #fff; }
        .lp-map iframe { width: 100%; flex: 1; border: 0; display: block; min-height: 280px; filter: saturate(0.92); }
        .lp-map-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 18px; border-top: 1px solid var(--lp-line); font-size: 13.5px; }
        .lp-map-bar .pin { display: inline-flex; align-items: center; gap: 8px; color: var(--lp-ink-2); font-weight: 600; }
        .lp-map-bar a { color: var(--lp-accent-700); text-decoration: none; font-weight: 600; }
        .lp-map-bar a:hover { text-decoration: underline; }

        .lp-support-note {
          max-width: 720px; margin: 40px auto 0; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
          padding: 20px 24px; border: 1px solid var(--lp-line); border-radius: var(--lp-r-lg); background: #fff;
        }
        .lp-support-note .ic { flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px; background: var(--lp-bg-3); color: var(--lp-ink-2); display: inline-flex; align-items: center; justify-content: center; }
        .lp-support-note .txt { flex: 1; min-width: 240px; }
        .lp-support-note .txt b { display: block; font-size: 15px; color: var(--lp-ink); font-weight: 700; }
        .lp-support-note .txt span { font-size: 14px; color: var(--lp-mute); line-height: 1.5; }

        @media (max-width: 760px) {
          .lp-contact-quick { grid-template-columns: 1fr; }
          .lp-contact-main { grid-template-columns: 1fr; }
          .lp-map { min-height: 280px; }
        }
      `}</style>

      <main className="lp-contact-wrap">
        <div className="lp-contact-head">
          <h1>Contact us</h1>
          <p>Questions about Linkpricer, partnerships or billing? We&rsquo;re a small team and we read every message — reach out and we&rsquo;ll get back to you.</p>
        </div>

        <div className="lp-contact-quick">
          <a className="lp-qcard" href="mailto:butkus@linkpricer.com">
            <span className="lp-qcard-ic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </span>
            <span>
              <span className="lp-qcard-k">Email us</span>
              <span className="lp-qcard-v">butkus@linkpricer.com</span>
              <span className="lp-qcard-sub">We usually reply within one business day</span>
            </span>
          </a>
          <a className="lp-qcard" href="https://www.google.com/maps/search/?api=1&query=Kauno%20Spie%C4%8Dius%2C%20I.%20Kanto%20g.%2018%2C%20Kaunas" target="_blank" rel="noopener">
            <span className="lp-qcard-ic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            </span>
            <span>
              <span className="lp-qcard-k">Visit / write to us</span>
              <span className="lp-qcard-v">Kauno Spiečius<br />I. Kanto g. 18, Kaunas<br />44296 Kauno m. sav.</span>
              <span className="lp-qcard-sub">Open in Google Maps →</span>
            </span>
          </a>
        </div>

        <section className="lp-contact-main">
          <div className="lp-details">
            <dl>
              <div className="row">
                <dt>Company</dt>
                <dd>Linkpricer, UAB <span className="reg">· Reg. No. 306947938</span></dd>
              </div>
              <div className="row">
                <dt>Director</dt>
                <dd>Karolis Butkus</dd>
              </div>
              <div className="row">
                <dt>Email</dt>
                <dd><a href="mailto:butkus@linkpricer.com">butkus@linkpricer.com</a></dd>
              </div>
              <div className="row">
                <dt>Address</dt>
                <dd>Kauno Spiečius<br />I. Kanto g. 18, Kaunas<br />44296 Kauno m. sav., Lithuania</dd>
              </div>
            </dl>
          </div>

          <div className="lp-map">
            <iframe
              title="Map of Kaunas, Lithuania near I. Kanto g. 18"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.openstreetmap.org/export/embed.html?bbox=23.9033%2C54.8901%2C23.9313%2C54.9031&layer=mapnik&marker=54.8966%2C23.9173"
            />
            <div className="lp-map-bar">
              <span className="pin">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                Kaunas, Lithuania
              </span>
              <a href="https://www.google.com/maps/search/?api=1&query=Kauno%20Spie%C4%8Dius%2C%20I.%20Kanto%20g.%2018%2C%20Kaunas" target="_blank" rel="noopener">Get directions →</a>
            </div>
          </div>
        </section>

        <div className="lp-support-note">
          <span className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17h.01" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><circle cx="12" cy="12" r="9" /></svg>
          </span>
          <span className="txt">
            <b>Already a customer with a technical issue?</b>
            <span>Logged-in users get faster, ticketed help from the in-app <Link href={ROUTES.login} style={{ color: "var(--lp-accent-700)", fontWeight: 600, textDecoration: "none", borderBottom: "1.5px solid var(--lp-accent-50)" }}>Support page</Link> — track requests and chat with our team right inside your dashboard.</span>
          </span>
          <Link href={ROUTES.login} className="lp-support-btn" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", fontSize: 13, fontWeight: 600, color: "var(--lp-ink-2)", background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 10, textDecoration: "none" }}>Open Support</Link>
        </div>
      </main>
    </MarketingLayout>
  );
}
