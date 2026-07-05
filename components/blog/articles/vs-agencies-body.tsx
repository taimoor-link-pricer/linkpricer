// Verbatim body copy from blog/comparison.html in the design handoff.
import Link from "next/link";

export function VsAgenciesBody() {
  return (
    <article className="lp-blog-wrap lp-blog-read lp-blog-prose">
      <p>If you&apos;re buying links at any real volume, you&apos;ve faced this fork: hand the whole thing to an agency, or run it yourself on a marketplace. Neither is universally &quot;better&quot; — they optimise for different things. This comparison lays out who each option is for, then scores them across the seven criteria that actually drive ROI.</p>

      <div className="lp-blog-cmp-intro">
        <div className="lp-blog-cmp-side">
          <span className="badge">The challenger</span>
          <h4>Traditional Agency</h4>
          <p className="who-for">Best for teams that want to fully outsource strategy and execution, and have the budget — and patience — for a retainer.</p>
        </div>
        <div className="lp-blog-cmp-side win">
          <span className="badge">Our pick for most teams</span>
          <h4>Linkpricer</h4>
          <p className="who-for">Best for teams that want agency-grade placements at transparent prices, with full control and no retainer.</p>
        </div>
      </div>

      <h2 id="at-a-glance">At a glance</h2>
      <p>The headline differences come down to <strong>where the markup goes</strong> and <strong>who holds the steering wheel</strong>. Agencies bundle strategy, outreach and placement into one opaque retainer; a marketplace unbundles them so you see — and control — every line item.</p>

      <div className="lp-blog-table-wrap">
        <table className="lp-blog-cmp">
          <thead>
            <tr><th>Criteria</th><th className="us">Linkpricer</th><th className="them">Traditional Agency</th></tr>
          </thead>
          <tbody>
            <tr>
              <th>Price transparency<small>Do you see the real cost of each link?</small></th>
              <td className="us">Per-link price from every marketplace, side by side</td>
              <td>Bundled into a monthly retainer</td>
            </tr>
            <tr>
              <th>Typical cost<small>For comparable DR placements</small></th>
              <td className="us">€120–€720 / link</td>
              <td>€2,000–€8,000 / mo retainer</td>
            </tr>
            <tr>
              <th>Markup<small>What you pay above the publisher&apos;s rate</small></th>
              <td className="us">One flat 15% fee</td>
              <td>40–120%, often hidden</td>
            </tr>
            <tr>
              <th>Speed to first link<small>From decision to live placement</small></th>
              <td className="us">Days</td>
              <td>3–6 weeks onboarding</td>
            </tr>
            <tr>
              <th>Control over targets<small>Choosing exact domains &amp; anchors</small></th>
              <td className="us"><span className="yes">Full</span></td>
              <td><span className="no">Limited / curated</span></td>
            </tr>
            <tr>
              <th>Minimum commitment</th>
              <td className="us">None — pay per link</td>
              <td>3–6 month contract</td>
            </tr>
            <tr>
              <th>Pay only after publication</th>
              <td className="us"><span className="yes">Yes</span></td>
              <td><span className="no">No — paid upfront</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="lp-blog-cmp-foot">
              <td></td>
              <td className="us">
                <Link
                  className="lp-blog-btn"
                  href="/#top"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 600, padding: "8px 13px", fontSize: 13, borderRadius: 10, background: "var(--lp-accent)", color: "#fff", textDecoration: "none" }}
                >
                  Try Linkpricer →
                </Link>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h2 id="cost">Cost &amp; transparency</h2>
      <p>This is the sharpest divide. An agency retainer rolls strategy, content and placement into one number, and the markup on each link is invisible by design. On a marketplace you see the publisher-facing price and a single, flat fee on top — which means you can <Link href="/blog/what-is-a-fair-price-for-a-backlink">benchmark any quote</Link> and never overpay for a placement you could get cheaper elsewhere.</p>

      <div className="lp-blog-callout">
        <span className="mark" />
        <p><strong>The hidden-markup trap:</strong> the same domain an agency bills you €900 for is frequently listed at €420 on an open marketplace. Over a quarter, that gap is the difference between 12 links and 25.</p>
      </div>

      <h2 id="control">Control &amp; speed</h2>
      <p>Agencies win on hands-off convenience — you brief once and step back. The cost is control and tempo: curated target lists, multi-week onboarding, and little say over individual anchors. Running placements yourself flips that: you pick the exact domains, set the anchor mix, and the first link can go live in days rather than weeks.</p>

      <ul className="lead-list">
        <li><b>Choose the agency when:</b> you have no in-house SEO capacity, want strategy included, and value convenience over cost-efficiency.</li>
        <li><b>Choose the marketplace when:</b> you know your targets, want to control spend per link, and need to move quickly without a contract.</li>
      </ul>

      <h2 id="verdict">The verdict</h2>
      <p>For teams with even a little in-house SEO judgement, a transparent marketplace wins on nearly every measurable axis — price, speed, control and risk — while still giving access to the same publisher inventory agencies use. Agencies remain the right call when you genuinely want to outsource the thinking, not just the buying.</p>
      <p>The good news: trying the transparent route costs nothing upfront. Price your current shortlist across every marketplace and see the gap for yourself.</p>
    </article>
  );
}
