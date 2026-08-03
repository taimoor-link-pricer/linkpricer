// Shared Blog CSS, ported from styles/blog.css and scoped with an
// `lp-blog-` prefix (rather than appended to app/globals.css) to avoid any
// class-name collisions and to sidestep the Turbopack CSS-ordering issue
// documented in globals.css — same pattern already used by the About page.
export function BlogStyles() {
  return (
    <style>{`
      .lp-blog-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
      .lp-blog-read { max-width: 720px; margin: 0 auto; }

      .lp-blog-tag {
        display: inline-flex; align-items: center; gap: 6px;
        font-family: var(--lp-mono); font-size: 11px; font-weight: 600;
        letter-spacing: .6px; text-transform: uppercase;
        color: var(--cat, var(--lp-accent-700)); background: var(--cat-bg, var(--lp-accent-50));
        padding: 4px 9px; border-radius: 999px; text-decoration: none;
      }
      .lp-blog-tag::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: currentColor; }
      .lp-blog-dotsep { color: var(--lp-mute-2); }
      .lp-blog-avatar {
        width: 36px; height: 36px; border-radius: 999px; flex-shrink: 0;
        background: linear-gradient(135deg, #d7e3f7, #c3d3ef);
        color: var(--lp-accent-700); font-weight: 800; font-size: 14px;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .lp-blog-ph {
        position: relative; overflow: hidden; border-radius: var(--lp-r-lg);
        background-image: repeating-linear-gradient(45deg, #e8ebf2 0 10px, #f1f3f7 10px 20px);
        border: 1px solid var(--lp-line);
        display: flex; align-items: center; justify-content: center;
      }
      .lp-blog-ph__label {
        font-family: var(--lp-mono); font-size: 12px; color: #7d8696;
        background: rgba(255,255,255,.78); padding: 5px 11px; border-radius: 999px;
        border: 1px solid var(--lp-line); backdrop-filter: blur(2px);
      }

      /* ---- category accent colors ---- */
      [data-lp-cat="case-studies"] { --cat: var(--lp-good); --cat-bg: var(--lp-good-bg); }
      [data-lp-cat="comparisons"]  { --cat: var(--lp-accent-700); --cat-bg: var(--lp-accent-50); }
      [data-lp-cat="guides"]       { --cat: var(--lp-warn); --cat-bg: var(--lp-warn-bg); }
      [data-lp-cat="playbooks"]    { --cat: #5b2bc4; --cat-bg: #ece4fb; }

      /* ---- index: head + filters ---- */
      .lp-blog-head { padding: 56px 0 8px; }
      .lp-blog-head h1 { margin: 0; font-size: clamp(34px, 5vw, 50px); font-weight: 800; letter-spacing: -1.4px; line-height: 1.04; color: var(--lp-ink); }
      .lp-blog-head p { margin: 16px 0 0; max-width: 620px; font-size: 18px; line-height: 1.55; color: var(--lp-ink-3); }

      .lp-blog-filters {
        position: sticky; top: 64px; z-index: 40;
        display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
        padding: 18px 0; margin: 26px 0 8px;
        background: rgba(255,255,255,0.9); backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--lp-line);
      }
      .lp-blog-chip {
        font-family: inherit; font-size: 14px; font-weight: 600;
        color: var(--lp-ink-3); background: var(--lp-bg-3);
        border: 1px solid transparent; border-radius: 999px;
        padding: 8px 16px; cursor: pointer; text-decoration: none;
        transition: background .12s, color .12s;
      }
      .lp-blog-chip:hover { background: #e9ebf0; }
      .lp-blog-chip[aria-pressed="true"] { background: var(--lp-ink); color: #fff; }
      .lp-blog-chip__count { opacity: .55; margin-left: 6px; font-variant-numeric: tabular-nums; }

      /* ---- featured ---- */
      .lp-blog-featured {
        display: grid; grid-template-columns: 1.15fr 1fr; gap: 36px; align-items: center;
        margin: 30px 0 12px; padding: 6px 0 34px; border-bottom: 1px solid var(--lp-line);
      }
      .lp-blog-featured__media { aspect-ratio: 16 / 10; }
      .lp-blog-featured__eyebrow {
        display: inline-flex; align-items: center; gap: 8px; margin-bottom: 16px;
        font-family: var(--lp-mono); font-size: 11.5px; font-weight: 600;
        letter-spacing: .8px; text-transform: uppercase; color: var(--lp-mute); text-decoration: none;
      }
      .lp-blog-featured h2 { margin: 0; font-size: clamp(26px, 3.2vw, 36px); font-weight: 800; letter-spacing: -1px; line-height: 1.1; color: var(--lp-ink); }
      .lp-blog-featured h2 a { text-decoration: none; color: inherit; }
      .lp-blog-featured h2 a:hover { color: var(--lp-accent-700); }
      .lp-blog-featured__excerpt { margin: 16px 0 22px; font-size: 16.5px; line-height: 1.6; color: var(--lp-ink-3); }

      /* ---- grid + card ---- */
      .lp-blog-section-label { margin: 38px 0 20px; font-size: 13px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--lp-mute); }
      .lp-blog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px 28px; padding-bottom: 24px; }
      .lp-blog-card { display: flex; flex-direction: column; text-decoration: none; color: inherit; }
      .lp-blog-card__media { aspect-ratio: 16 / 10; margin-bottom: 16px; }
      .lp-blog-card__cat { margin-bottom: 12px; }
      .lp-blog-card__title {
        margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.25; color: var(--lp-ink);
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .lp-blog-card:hover .lp-blog-card__title { color: var(--lp-accent-700); }
      .lp-blog-card__excerpt {
        margin: 9px 0 0; font-size: 14.5px; line-height: 1.55; color: var(--lp-mute);
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .lp-blog-card__meta { margin-top: auto; padding-top: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--lp-mute); }
      .lp-blog-empty { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--lp-mute); font-size: 15px; }

      /* ---- article head ---- */
      .lp-blog-article-head { padding: 44px 0 0; }
      .lp-blog-crumb { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 22px; font-size: 13.5px; color: var(--lp-mute); text-decoration: none; }
      .lp-blog-crumb:hover { color: var(--lp-accent-700); }
      .lp-blog-article-head h1 { margin: 14px 0 0; font-size: clamp(30px, 4.4vw, 46px); font-weight: 800; letter-spacing: -1.3px; line-height: 1.08; color: var(--lp-ink); }
      .lp-blog-article-head .dek { margin: 18px 0 0; font-size: 19px; line-height: 1.55; color: var(--lp-ink-3); }
      .lp-blog-byline { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin: 26px 0 28px; padding-bottom: 28px; border-bottom: 1px solid var(--lp-line); }
      .lp-blog-byline .who { display: flex; align-items: center; gap: 11px; }
      .lp-blog-byline .who b { font-size: 14.5px; color: var(--lp-ink-2); font-weight: 700; }
      .lp-blog-byline .who span { font-size: 13px; color: var(--lp-mute); }
      .lp-blog-byline .facts { margin-left: auto; display: flex; gap: 10px; align-items: center; font-size: 13.5px; color: var(--lp-mute); flex-wrap: wrap; }
      .lp-blog-cover { aspect-ratio: 16 / 8; margin: 0 0 8px; }
      .lp-blog-cover-cap { font-size: 12.5px; color: var(--lp-mute-2); margin: 10px 2px 0; font-style: italic; }

      /* ---- table of contents ---- */
      .lp-blog-article-layout {
        display: grid; grid-template-columns: 240px minmax(0, 720px);
        gap: 8px 56px; justify-content: center; align-items: start;
      }
      .lp-blog-toc-col { position: sticky; top: 96px; max-height: calc(100vh - 120px); overflow-y: auto; }
      .lp-blog-toc {
        margin: 0; border-radius: var(--lp-r-lg);
        background: #fff; border: 1px solid var(--lp-line); box-shadow: var(--lp-shadow-1);
      }
      .lp-blog-toc__toggle {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 15px 18px; background: none; border: 0; cursor: pointer;
        border-bottom: 1px solid var(--lp-line-2);
      }
      .lp-blog-toc__label {
        display: inline-flex; align-items: center; gap: 9px;
        font-family: var(--lp-mono); font-size: 11.5px; font-weight: 700; letter-spacing: .6px;
        text-transform: uppercase; color: var(--lp-mute);
      }
      .lp-blog-toc__label svg { color: var(--lp-accent); flex-shrink: 0; }
      .lp-blog-toc__chev { color: var(--lp-mute-2); transition: transform .18s ease; flex-shrink: 0; }
      .lp-blog-toc__chev.is-open { transform: rotate(180deg); }
      .lp-blog-toc__rail {
        list-style: none; margin: 0; padding: 10px 14px 12px 0; display: flex; flex-direction: column; gap: 1px;
        border-left: 1.5px solid var(--lp-line-2); margin-left: 22px;
      }
      .lp-blog-toc__rail li { padding-left: 0; margin-top: 0 !important; }
      .lp-blog-toc__rail li::before { display: none; }
      .lp-blog-toc__rail li.lp-blog-toc__sub a { padding-left: 26px; font-size: 13.5px; color: var(--lp-mute); }
      .lp-blog-toc__rail a {
        display: block; padding: 6.5px 14px; margin-left: -1.5px; font-size: 14px; line-height: 1.4;
        color: var(--lp-ink-3); text-decoration: none; border-bottom: none;
        border-left: 1.5px solid transparent; transition: color .12s, border-color .12s;
      }
      .lp-blog-toc__rail a:hover { color: var(--lp-ink); }
      .lp-blog-toc__rail li.lp-blog-toc__sub a:hover { color: var(--lp-ink-2); }
      .lp-blog-toc__rail a[aria-current="location"] {
        color: var(--lp-accent-700); font-weight: 600; border-left-color: var(--lp-accent);
      }
      .lp-blog-toc__rail li.lp-blog-toc__sub a[aria-current="location"] { color: var(--lp-accent-700); font-weight: 600; }

      /* ---- prose ---- */
      .lp-blog-prose { font-size: 18px; line-height: 1.72; color: var(--lp-ink-2); padding: 18px 0 0; }
      .lp-blog-prose > * + * { margin-top: 1.35em; }
      .lp-blog-prose p { margin: 0; }
      .lp-blog-prose h2 { margin: 1.9em 0 0; font-size: 27px; font-weight: 800; letter-spacing: -0.7px; line-height: 1.2; color: var(--lp-ink); scroll-margin-top: 80px; }
      .lp-blog-prose h3 { margin: 1.5em 0 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; line-height: 1.3; color: var(--lp-ink); scroll-margin-top: 80px; }
      .lp-blog-prose a:not(.lp-blog-btn) { color: var(--lp-accent-700); text-decoration: none; border-bottom: 1.5px solid var(--lp-accent-50); }
      .lp-blog-prose a:not(.lp-blog-btn):hover { border-bottom-color: var(--lp-accent); }
      .lp-blog-prose strong { color: var(--lp-ink); font-weight: 700; }
      .lp-blog-prose ul, .lp-blog-prose ol { margin: 0; padding-left: 0; list-style: none; }
      .lp-blog-prose ul > li, .lp-blog-prose ol > li { position: relative; padding-left: 28px; margin-top: .7em; }
      .lp-blog-prose ul > li::before { content: ""; position: absolute; left: 6px; top: .62em; width: 7px; height: 7px; border-radius: 999px; background: var(--lp-accent); }
      .lp-blog-prose ol { counter-reset: li; }
      .lp-blog-prose ol > li { counter-increment: li; }
      .lp-blog-prose ol > li::before {
        content: counter(li); position: absolute; left: 0; top: .05em; width: 20px; height: 20px; border-radius: 999px;
        background: var(--lp-accent-50); color: var(--lp-accent-700); font-size: 12px; font-weight: 700; font-family: var(--lp-mono);
        display: inline-flex; align-items: center; justify-content: center;
      }
      .lp-blog-prose .lead-list > li { padding-left: 0; }
      .lp-blog-prose .lead-list > li::before { display: none; }
      .lp-blog-prose .lead-list > li + li { margin-top: 1.1em; }
      .lp-blog-prose .lead-list b { color: var(--lp-ink); }

      .lp-blog-figure { margin: 2.2em 0 !important; }
      .lp-blog-figure .lp-blog-ph { aspect-ratio: 16 / 9; }
      .lp-blog-figure figcaption { font-size: 13px; color: var(--lp-mute); margin-top: 11px; text-align: center; font-style: italic; }

      .lp-blog-table-wrap { margin: 2.2em 0 !important; overflow-x: auto; border: 1px solid var(--lp-line); border-radius: var(--lp-r-lg); }
      table.lp-blog-data { width: 100%; border-collapse: collapse; font-size: 15px; min-width: 520px; }
      table.lp-blog-data caption {
        caption-side: top; text-align: left; padding: 14px 18px 12px; font-size: 13px; font-weight: 700; color: var(--lp-mute);
        font-family: var(--lp-mono); letter-spacing: .3px; text-transform: uppercase; border-bottom: 1px solid var(--lp-line); background: var(--lp-bg-3);
      }
      table.lp-blog-data th, table.lp-blog-data td { padding: 13px 18px; text-align: left; }
      table.lp-blog-data thead th { font-size: 12.5px; font-weight: 700; color: var(--lp-ink-2); background: var(--lp-bg-3); border-bottom: 1px solid var(--lp-line); text-transform: uppercase; letter-spacing: .4px; }
      table.lp-blog-data tbody tr + tr td { border-top: 1px solid var(--lp-line-2); }
      table.lp-blog-data td.num { font-family: var(--lp-mono); font-variant-numeric: tabular-nums; text-align: right; }
      table.lp-blog-data .best { color: var(--lp-good); font-weight: 700; }

      .lp-blog-callout { margin: 2.2em 0 !important; padding: 22px 24px; border-radius: var(--lp-r-lg); background: var(--lp-accent-50); border: 1px solid #cfe2fb; display: flex; gap: 16px; align-items: flex-start; }
      .lp-blog-callout .mark { width: 4px; align-self: stretch; border-radius: 999px; background: var(--lp-accent); flex-shrink: 0; }
      .lp-blog-callout p { margin: 0; font-size: 16.5px; line-height: 1.6; color: var(--lp-ink-2); }
      .lp-blog-callout strong { color: var(--lp-accent-700); }

      .lp-blog-stat { margin: 2.2em 0 !important; padding: 26px 28px; border-radius: var(--lp-r-lg); background: var(--lp-ink); color: #fff; text-align: center; }
      .lp-blog-stat .big { font-size: clamp(40px, 7vw, 60px); font-weight: 800; letter-spacing: -2px; line-height: 1; font-variant-numeric: tabular-nums; }
      .lp-blog-stat .cap { margin-top: 12px; font-size: 15px; color: #c8cdd6; line-height: 1.5; max-width: 460px; margin-left: auto; margin-right: auto; }
      .lp-blog-stat .big em { font-style: normal; color: #7fb0ff; }
      .lp-blog-rule { border: 0; border-top: 1px solid var(--lp-line); margin: 2.6em 0 !important; }

      .lp-blog-cta {
        margin: 56px auto 0; max-width: 820px; background: var(--lp-accent); color: #fff;
        border-radius: var(--lp-r-xl); padding: 48px 44px; text-align: center; position: relative; overflow: hidden;
      }
      .lp-blog-cta::after { content: ""; position: absolute; inset: 0; background: radial-gradient(120% 140% at 100% 0%, rgba(255,255,255,.16), transparent 55%); pointer-events: none; }
      .lp-blog-cta__eyebrow { font-family: var(--lp-mono); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #bcd6ff; }
      .lp-blog-cta h2 { margin: 12px 0 0; font-size: clamp(26px, 3.4vw, 34px); font-weight: 800; letter-spacing: -0.8px; line-height: 1.15; }
      .lp-blog-cta p { margin: 14px auto 0; max-width: 520px; font-size: 16px; line-height: 1.55; color: #dce8fb; }
      .lp-blog-cta .lp-blog-btn { margin-top: 26px; position: relative; }

      .lp-blog-related { margin-top: 64px; padding-top: 40px; border-top: 1px solid var(--lp-line); }
      .lp-blog-related h3 { margin: 0 0 22px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
      .lp-blog-related .lp-blog-grid { gap: 28px; }

      /* ---- comparison variant ---- */
      .lp-blog-cmp-intro { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 1.6em 0 !important; }
      .lp-blog-cmp-side { border: 1px solid var(--lp-line); border-radius: var(--lp-r-lg); padding: 22px 24px; }
      .lp-blog-cmp-side.win { border-color: #bcd9fb; background: var(--lp-accent-50); }
      .lp-blog-cmp-side h4 { margin: 0 0 6px; font-size: 18px; font-weight: 800; letter-spacing: -0.3px; }
      .lp-blog-cmp-side .who-for { font-size: 14px; color: var(--lp-mute); line-height: 1.5; }
      .lp-blog-cmp-side .badge {
        display: inline-block; margin-bottom: 12px; font-family: var(--lp-mono); font-size: 11px; font-weight: 600;
        letter-spacing: .6px; text-transform: uppercase; padding: 4px 9px; border-radius: 999px;
        background: #fff; border: 1px solid var(--lp-line); color: var(--lp-mute);
      }
      .lp-blog-cmp-side.win .badge { background: var(--lp-accent); color: #fff; border-color: var(--lp-accent); }

      table.lp-blog-cmp { width: 100%; border-collapse: collapse; font-size: 15px; min-width: 560px; }
      table.lp-blog-cmp thead th { padding: 16px 18px; text-align: left; font-size: 13px; }
      table.lp-blog-cmp thead th:nth-child(2), table.lp-blog-cmp thead th:nth-child(3) { text-align: center; width: 24%; }
      table.lp-blog-cmp thead th.us { background: var(--lp-accent); color: #fff; border-radius: 10px 10px 0 0; }
      table.lp-blog-cmp thead th.them { color: var(--lp-ink-2); }
      table.lp-blog-cmp tbody th { text-align: left; padding: 15px 18px; font-weight: 700; font-size: 14.5px; color: var(--lp-ink-2); width: 52%; vertical-align: top; }
      table.lp-blog-cmp tbody th small { display: block; font-weight: 500; color: var(--lp-mute); font-size: 12.5px; margin-top: 3px; }
      table.lp-blog-cmp tbody td { padding: 15px 18px; text-align: center; vertical-align: top; font-size: 14px; }
      table.lp-blog-cmp tbody td.us { background: var(--lp-accent-50); color: var(--lp-ink-2); font-weight: 600; }
      table.lp-blog-cmp tbody tr + tr th, table.lp-blog-cmp tbody tr + tr td { border-top: 1px solid var(--lp-line-2); }
      table.lp-blog-cmp .yes { color: var(--lp-good); font-weight: 800; }
      table.lp-blog-cmp .no { color: var(--lp-mute-2); }
      .lp-blog-cmp-foot td { padding: 16px 18px !important; }
      .lp-blog-cmp-foot td.us { background: var(--lp-accent) !important; }
      .lp-blog-cmp-foot .lp-blog-btn { width: 100%; }

      @media (max-width: 1080px) {
        .lp-blog-article-layout { grid-template-columns: minmax(0, 720px); justify-content: center; }
        .lp-blog-toc-col { position: static; max-height: none; margin-bottom: 8px; }
      }
      @media (max-width: 900px) {
        .lp-blog-featured { grid-template-columns: 1fr; gap: 22px; }
        .lp-blog-featured__media { order: -1; }
        .lp-blog-grid { grid-template-columns: repeat(2, 1fr); gap: 28px 22px; }
        .lp-blog-cmp-intro { grid-template-columns: 1fr; }
        .lp-blog-byline .facts { margin-left: 0; width: 100%; }
      }
      @media (max-width: 600px) {
        .lp-blog-wrap { padding: 0 18px; }
        .lp-blog-grid { grid-template-columns: 1fr; }
        .lp-blog-prose { font-size: 17px; }
        .lp-blog-cta { padding: 36px 24px; }
      }
    `}</style>
  );
}
