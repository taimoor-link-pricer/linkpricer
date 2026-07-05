import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export const metadata: Metadata = {
  title: "About Linkpricer",
  description: "Why Linkpricer exists — a personal note from founder Karolis Butkus on bringing every link provider into one place, with real price transparency.",
  openGraph: {
    type: "website",
    title: "About Linkpricer",
    description: "A personal founder story about price transparency in link building.",
  },
};

// Content below is placeholder copy carried over verbatim from the design
// handoff (about.html) — Karolis confirmed on the walkthrough this is
// example text only ("swap the words" once real copy is ready), not final.
export default function AboutPage() {
  return (
    <MarketingLayout>
      <style>{`
        .lp-about-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
        .lp-about-read { max-width: 680px; margin: 0 auto; }

        .lp-about-hero { padding: 72px 0 0; text-align: center; }
        .lp-about-hero .eyebrow {
          font-family: var(--lp-mono); font-size: 12px; font-weight: 600; letter-spacing: 1px;
          text-transform: uppercase; color: var(--lp-accent-700); margin-bottom: 22px;
        }
        .lp-about-hero h1 {
          margin: 0 auto; max-width: 880px;
          font-size: clamp(32px, 5.2vw, 56px); font-weight: 800; letter-spacing: -1.8px;
          line-height: 1.08; color: var(--lp-ink); text-wrap: balance;
        }
        .lp-about-hero h1 .hl { color: var(--lp-accent-700); }
        .lp-about-hero .sub { margin: 22px auto 0; max-width: 600px; font-size: 19px; line-height: 1.55; color: var(--lp-ink-3); }

        .lp-founder {
          display: flex; align-items: center; gap: 28px;
          max-width: 680px; margin: 56px auto 0;
          padding: 24px; border: 1px solid var(--lp-line); border-radius: var(--lp-r-xl);
          background: var(--lp-bg-3);
        }
        .lp-founder-photo {
          width: 132px; height: 132px; flex-shrink: 0; border-radius: 18px;
          box-shadow: var(--lp-shadow-2); border: 1px dashed #cdd3de;
          background-image: repeating-linear-gradient(45deg, #e8ebf2 0 8px, #f1f3f7 8px 16px);
          display: flex; align-items: center; justify-content: center; text-align: center;
          color: #6b7280; font-family: var(--lp-mono); font-size: 11px; padding: 8px;
        }
        .lp-founder-id .role { font-family: var(--lp-mono); font-size: 11.5px; font-weight: 600; letter-spacing: .7px; text-transform: uppercase; color: var(--lp-mute); margin-bottom: 8px; }
        .lp-founder-id h2 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px; color: var(--lp-ink); }
        .lp-founder-id p { margin: 8px 0 0; font-size: 15px; line-height: 1.55; color: var(--lp-ink-3); }
        .lp-founder-id .sig { margin-top: 14px; font-family: var(--lp-mono); font-size: 13px; color: var(--lp-mute); }

        .lp-about-mark { display: flex; align-items: center; gap: 14px; justify-content: center; margin: 56px auto 8px; color: var(--lp-mute-2); }
        .lp-about-mark::before, .lp-about-mark::after { content: ""; height: 1px; width: 60px; background: var(--lp-line); }
        .lp-about-mark span { font-family: var(--lp-mono); font-size: 12px; letter-spacing: 2px; }

        .lp-story { padding: 40px 0 0; font-size: 19px; line-height: 1.75; color: var(--lp-ink-2); }
        .lp-story > * + * { margin-top: 1.4em; }
        .lp-story p { margin: 0; }
        .lp-story p.lead { font-size: 22px; line-height: 1.6; color: var(--lp-ink); font-weight: 500; }
        .lp-story p.lead::first-letter { float: left; font-size: 64px; line-height: 0.86; font-weight: 800; color: var(--lp-accent-700); margin: 6px 12px 0 0; font-family: var(--lp-sans); }
        .lp-story h2 { margin: 1.8em 0 0; font-size: 25px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.25; color: var(--lp-ink); }
        .lp-story strong { color: var(--lp-ink); font-weight: 700; }
        .lp-story em { color: var(--lp-accent-700); font-style: normal; font-weight: 600; }

        .lp-pullquote {
          margin: 1.8em 0 !important; padding: 6px 0 6px 28px; border-left: 4px solid var(--lp-accent);
          font-size: clamp(24px, 3vw, 30px); font-weight: 700; letter-spacing: -0.6px; line-height: 1.3; color: var(--lp-ink);
        }
        .lp-pullquote .by { display: block; margin-top: 14px; font-size: 14px; font-weight: 600; color: var(--lp-mute); letter-spacing: 0; }

        .lp-belief { margin: 1.8em 0 !important; text-align: center; font-size: clamp(22px, 2.8vw, 28px); font-weight: 700; letter-spacing: -0.5px; line-height: 1.35; color: var(--lp-accent-700); }

        .lp-values { margin: 1.8em 0 !important; display: grid; gap: 0; }
        .lp-value-row { display: flex; gap: 18px; padding: 22px 0; border-top: 1px solid var(--lp-line); }
        .lp-value-row:last-child { border-bottom: 1px solid var(--lp-line); }
        .lp-value-row .n { font-family: var(--lp-mono); font-size: 14px; font-weight: 700; color: var(--lp-accent); flex-shrink: 0; padding-top: 3px; min-width: 36px; }
        .lp-value-row h3 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -0.3px; color: var(--lp-ink); }
        .lp-value-row p { margin: 6px 0 0; font-size: 16px; line-height: 1.6; color: var(--lp-ink-3); }

        .lp-signoff { max-width: 680px; margin: 56px auto 0; padding: 36px 0 0; border-top: 1px solid var(--lp-line); text-align: center; color: var(--lp-mute); font-size: 16px; line-height: 1.6; }
        .lp-signoff .name { font-family: var(--lp-mono); font-size: 14px; color: var(--lp-ink-2); margin-top: 12px; font-weight: 600; }

        @media (max-width: 600px) {
          .lp-about-hero { padding: 48px 0 0; }
          .lp-founder { flex-direction: column; text-align: center; gap: 18px; padding: 28px 20px; }
          .lp-story { font-size: 17.5px; }
          .lp-story p.lead { font-size: 20px; }
          .lp-value-row { flex-direction: column; gap: 6px; }
        }
      `}</style>

      <main className="lp-about-wrap" style={{ paddingBottom: 40 }}>
        <section className="lp-about-hero">
          <div className="eyebrow">Our story</div>
          <h1>Every link provider in one place — with <span className="hl">prices you can actually trust</span>.</h1>
          <p className="sub">Placeholder mission line. One sentence on why Linkpricer exists and the change we&rsquo;re trying to make in how links are bought.</p>
        </section>

        <section className="lp-founder">
          <div className="lp-founder-photo" aria-hidden>Drop a photo of Karolis</div>
          <div className="lp-founder-id">
            <div className="role">Founder &amp; Director</div>
            <h2>Karolis Butkus</h2>
            <p>Placeholder one-liner about Karolis — background, what he was doing before Linkpricer, and why this problem became personal.</p>
            <div className="sig">— writing from Kaunas, Lithuania</div>
          </div>
        </section>

        <div className="lp-about-mark"><span>✶</span></div>

        <article className="lp-about-read lp-story">
          <p className="lead">This is placeholder opening copy, written in the founder&rsquo;s own voice. It should drop you straight into a moment — the day the idea clicked, or the frustration that wouldn&rsquo;t go away — so the page reads like a person talking, not a company introducing itself.</p>

          <p>Replace this paragraph with the real beginning of the story. Keep it warm and specific: where Karolis was, what he was trying to do, and the small infuriating detail that started everything. Concrete beats abstract — a real number, a real vendor, a real wasted afternoon.</p>

          <p>A second paragraph continues the narrative. The placeholder text here exists only to show line length, rhythm and spacing at a comfortable reading width. When the real copy lands, the layout won&rsquo;t need to change — just swap the words.</p>

          <blockquote className="lp-pullquote">
            &ldquo;Placeholder pull-quote — a single belief stated plainly. Use these to break up the prose and let one idea land on its own.&rdquo;
            <span className="by">— Karolis Butkus</span>
          </blockquote>

          <h2>The problem nobody would name</h2>
          <p>Placeholder section. Describe the state of the link-buying world before Linkpricer: opaque pricing, the same domain quoted at wildly different rates, hours lost to spreadsheets and back-and-forth. Make the reader nod along because they&rsquo;ve lived it too.</p>

          <p>Another paragraph of placeholder body copy. The <em>emphasized phrase</em> styling marks the lines that carry weight — the convictions you want readers to remember. Use <strong>bold</strong> for plain emphasis and the accent treatment for beliefs.</p>

          <p className="lp-belief">Price transparency isn&rsquo;t a feature. It&rsquo;s the whole point.</p>

          <p>Placeholder paragraph bridging into how that conviction shaped the product. Keep it human — what was built, what was deliberately left out, and the principle behind each call.</p>

          <h2>What we believe</h2>
          <p>A short framing line for the values that follow — the handful of principles the company refuses to compromise on.</p>

          <div className="lp-values">
            <div className="lp-value-row">
              <span className="n">01</span>
              <div>
                <h3>Transparency by default</h3>
                <p>Placeholder value description. One or two sentences on what this principle means in practice and how it shows up in the product.</p>
              </div>
            </div>
            <div className="lp-value-row">
              <span className="n">02</span>
              <div>
                <h3>Every provider, one search</h3>
                <p>Placeholder value description. Explain the belief that buyers shouldn&rsquo;t have to chase a dozen marketplaces to know what a fair price is.</p>
              </div>
            </div>
            <div className="lp-value-row">
              <span className="n">03</span>
              <div>
                <h3>On the buyer&rsquo;s side</h3>
                <p>Placeholder value description. A line about whose interests the company serves and the standard it holds itself to.</p>
              </div>
            </div>
          </div>

          <h2>Where we&rsquo;re headed</h2>
          <p>Closing placeholder section. A forward-looking, personal note — not a roadmap, but a sense of the future Karolis wants to build and the kind of company Linkpricer intends to be. End on something human.</p>

          <div className="lp-signoff">
            <p>Thanks for reading — and for being part of the story.</p>
            <div className="name">Karolis Butkus · Founder, Linkpricer</div>
          </div>
        </article>
      </main>
    </MarketingLayout>
  );
}
