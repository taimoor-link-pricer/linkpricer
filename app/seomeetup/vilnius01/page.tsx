import type { Metadata } from "next";
import Image from "next/image";

// Easily-editable placeholder — swap in the real Google Form URL once it exists.
const GOOGLE_FORM_URL = "https://forms.gle/{GOOGLE_FORM_URL}";

export const metadata: Metadata = {
  title: "Thank you — SEO Meetup #01 Vilnius",
};

// Real event photos, picked from the shared Google Photos album and saved
// to public/seomeetup/vilnius01/ — see file for provenance if replacing.
function EventPhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Image src={src} alt={alt} fill sizes="(max-width: 700px) 50vw, 33vw" style={{ objectFit: "cover" }} />
    </div>
  );
}

export default function SeoMeetupVilnius01Page() {
  return (
    <>
      <style>{`
        .smv-page * { box-sizing: border-box; }
        .smv-page {
          --accent: #0052cc;
          --ink: #0b0d12;
          --ink-soft: #4b5361;
          --line: #e7e9ee;
          --bg: #fbfbfc;
          font-family: var(--font-inter), "Inter", -apple-system, system-ui, sans-serif;
          background: var(--bg);
          color: var(--ink);
          -webkit-font-smoothing: antialiased;
        }
        /* :where() keeps this page-scoped without adding specificity, so
           more specific rules below (.smv-cta-btn, .smv-logo, .smv-foot-social)
           still win the cascade the same way they would with a bare "a"
           selector in an unscoped stylesheet. */
        :where(.smv-page) a { color: var(--accent); }
        :where(.smv-page) a:hover { color: #003a99; }

        .smv-wrap { max-width: 980px; margin: 0 auto; padding: 0 24px; }

        .smv-header { border-bottom: 1px solid var(--line); background: #fff; }
        .smv-header-row { display: flex; align-items: center; justify-content: space-between; height: 68px; gap: 12px; }
        .smv-logo { font-weight: 800; font-size: 19px; letter-spacing: -0.4px; color: var(--ink); text-decoration: none; }
        .smv-hosted-by { font-size: 13px; color: var(--ink-soft); font-weight: 500; display: flex; align-items: center; gap: 6px; }
        .smv-hosted-by b { color: var(--ink); font-weight: 700; }

        .smv-hero { padding: 72px 0 56px; text-align: center; }
        .smv-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12.5px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
          color: var(--accent); background: #eaf1ff; padding: 6px 14px; border-radius: 999px;
          margin-bottom: 22px;
        }
        .smv-hero h1 { margin: 0 auto; max-width: 720px; font-size: clamp(30px, 5vw, 48px); font-weight: 800; letter-spacing: -1px; line-height: 1.12; }
        .smv-hero p { margin: 18px auto 0; max-width: 560px; font-size: 17px; line-height: 1.6; color: var(--ink-soft); }

        .smv-gallery { padding: 0 0 64px; }
        .smv-gallery-grid { display: grid; grid-template-columns: repeat(6, 1fr); grid-auto-rows: 130px; gap: 10px; }
        .smv-g-item { grid-column: span 3; grid-row: span 2; border-radius: 16px; overflow: hidden; }
        .smv-g-item.wide { grid-column: span 4; }
        .smv-g-item.narrow { grid-column: span 2; }
        .smv-g-item.tall { grid-row: span 3; }

        @media (max-width: 700px) {
          .smv-gallery-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 160px; }
          .smv-g-item, .smv-g-item.wide, .smv-g-item.narrow { grid-column: span 1; grid-row: span 2; }
          .smv-g-item.tall { grid-row: span 2; }
        }

        .smv-cta {
          background: linear-gradient(180deg, #0b0d12 0%, #14171f 100%);
          color: #fff; border-radius: 24px; margin: 0 0 72px; padding: 56px 32px; text-align: center;
        }
        .smv-cta h2 { margin: 0 auto; max-width: 480px; font-size: clamp(22px, 3.4vw, 30px); font-weight: 800; letter-spacing: -0.6px; line-height: 1.25; }
        .smv-cta p { margin: 12px auto 0; max-width: 460px; font-size: 15px; line-height: 1.6; color: #b9bfcc; }
        .smv-cta-btn {
          display: inline-flex; align-items: center; gap: 10px; margin-top: 28px;
          background: var(--accent); color: #fff; text-decoration: none;
          font-size: 16px; font-weight: 700; letter-spacing: -0.1px;
          padding: 16px 30px; border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,82,204,0.35);
          transition: filter .15s, transform .05s;
        }
        .smv-cta-btn:hover { filter: brightness(1.08); color: #fff; }
        .smv-cta-btn:active { transform: translateY(1px); }
        .smv-cta-note { margin-top: 16px; font-size: 12.5px; color: #7c8394; }

        .smv-footer { border-top: 1px solid var(--line); background: #fff; padding: 40px 0 32px; }
        .smv-foot-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .smv-foot-tease { font-size: 14.5px; color: var(--ink-soft); }
        .smv-foot-tease b { color: var(--ink); font-weight: 700; }
        .smv-foot-right { display: flex; align-items: center; gap: 18px; }
        .smv-foot-social { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-soft); text-decoration: none; font-size: 13.5px; font-weight: 600; }
        .smv-foot-social:hover { color: var(--accent); }
        .smv-foot-brand { font-size: 12.5px; color: #9aa1ad; }
        .smv-foot-bottom { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 12.5px; color: #9aa1ad; }

        @media (max-width: 600px) {
          .smv-hero { padding: 52px 0 40px; }
          .smv-cta { padding: 44px 22px; }
          .smv-foot-row { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="smv-page">
        <header className="smv-header">
          <div className="smv-wrap smv-header-row">
            <a href="https://linkpricer.com" className="smv-logo">Linkpricer</a>
            <div className="smv-hosted-by">Hosted with <b>Tesonet</b></div>
          </div>
        </header>

        <section className="smv-hero">
          <div className="smv-wrap">
            <span className="smv-eyebrow">SEO Meetup #01 · Vilnius</span>
            <h1>Thank you for coming to SEO Meetup #01</h1>
            <p>It was great having ~75 of you in the room — here&apos;s a quick look back, and one small favor to ask.</p>
          </div>
        </section>

        <section className="smv-gallery">
          <div className="smv-wrap">
            <div className="smv-gallery-grid">
              <div className="smv-g-item wide tall"><EventPhoto src="/seomeetup/vilnius01/crowd.jpg" alt="Full room of attendees at SEO Meetup #01 Vilnius" /></div>
              <div className="smv-g-item narrow"><EventPhoto src="/seomeetup/vilnius01/speaker.jpg" alt="Speaker presenting at SEO Meetup #01 Vilnius" /></div>
              <div className="smv-g-item narrow"><EventPhoto src="/seomeetup/vilnius01/networking.jpg" alt="Attendees networking at SEO Meetup #01 Vilnius" /></div>
              <div className="smv-g-item"><EventPhoto src="/seomeetup/vilnius01/qa.jpg" alt="Attendees in conversation at SEO Meetup #01 Vilnius" /></div>
              <div className="smv-g-item"><EventPhoto src="/seomeetup/vilnius01/chatting.jpg" alt="Attendees chatting at SEO Meetup #01 Vilnius" /></div>
              <div className="smv-g-item"><EventPhoto src="/seomeetup/vilnius01/closing.jpg" alt="Group photo closing out SEO Meetup #01 Vilnius" /></div>
            </div>
          </div>
        </section>

        <section className="smv-wrap">
          <div className="smv-cta">
            <h2>Help us make Meetup #02 even better</h2>
            <p>Two minutes of feedback helps us pick better topics, speakers and format — and unlocks the full photo album from the night.</p>
            <a className="smv-cta-btn" href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer">
              Share Feedback &amp; Get Event Photos →
            </a>
            <div className="smv-cta-note">Takes ~2 minutes · Photos link inside the form</div>
          </div>
        </section>

        <footer className="smv-footer">
          <div className="smv-wrap">
            <div className="smv-foot-row">
              <div className="smv-foot-tease">Meetup #02 is coming this <b>Autumn</b> — watch your inbox.</div>
              <div className="smv-foot-right">
                <a className="smv-foot-social" href="https://www.linkedin.com/company/linkpricer/" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
                <span className="smv-foot-brand">Linkpricer · SEO in the AI era</span>
              </div>
            </div>
            <div className="smv-foot-bottom">© 2026 Linkpricer, UAB. All rights reserved.</div>
          </div>
        </footer>
      </div>
    </>
  );
}
