/**
 * What the public API (and so the MCP server) leaves out because it is not
 * a placement anyone is actually buying.
 *
 * API-only for now: the dashboard's Analyze page still counts all of it, so
 * the two can show different figures for the sites this touches.
 */

import { sql, type SQL } from "drizzle-orm";

/**
 * Marketplaces whose listings are not one-off placements. serpzilla.com sells
 * monthly link rentals priced in cents (median $0.11 across ~20,000 listings
 * in Oct 2026); counted as a source it made the €25 minimum fee the "lowest
 * price" of every site it lists.
 */
export const EXCLUDED_SOURCES = ["serpzilla.com"] as const;

/** `AND`-able condition keeping offers from every other marketplace. */
export function sourceAllowed(marketplaceName: SQL): SQL {
  return sql`lower(${marketplaceName}) NOT IN (${sql.join(EXCLUDED_SOURCES.map((s) => sql`${s}`), sql`, `)})`;
}

/**
 * Hosts search never returns, with every subdomain under them.
 *
 * Blog and site builders: a subdomain is somebody's free blog, and the
 * catalogue gives it the platform's own Domain Rating (every *.blogspot.com
 * site reads DR 95), so a "high DR, low price" search filled up with them.
 *
 * Shared registry spaces (CentralNic's uk.com, us.com, it.com …): each name
 * under them is a separate site, but the catalogue gives every one the
 * registry domain's Domain Rating — all 243 *.it.com sites read DR 92.
 *
 * Social and user-content platforms: what is sold "on" them is a profile,
 * post or comment link, listed at a few dollars, not an editorial placement.
 *
 * The pricing endpoint still answers for them when asked by name; only
 * search, which picks sites for the caller, leaves them out.
 */
const PLATFORM_DOMAINS = [
  // blog and site builders
  "blogger.com", "wordpress.com", "tumblr.com", "medium.com", "substack.com", "wixsite.com", "weebly.com",
  "webflow.io", "github.io", "gitbook.io", "sites.google.com", "livejournal.com", "over-blog.com",
  "jimdofree.com", "jimdosite.com", "typepad.com", "home.blog", "hashnode.dev", "mystrikingly.com",
  "strikingly.com", "site123.me", "tilda.ws", "notion.site", "netlify.app", "vercel.app", "pages.dev",
  "herokuapp.com", "carrd.co", "webnode.page", "simplesite.com", "yolasite.com", "wikidot.com", "fandom.com",
  "telegra.ph",
  // shared registry spaces
  "it.com", "us.com", "uk.com", "eu.com", "de.com", "co.com", "ru.com", "cn.com", "br.com", "gb.com",
  "jpn.com", "sa.com", "za.com", "kr.com", "ar.com", "mex.com", "qc.com", "uy.com", "se.net", "hu.net",
  "in.net", "uk.net", "gb.net", "za.net", "eu.org", "us.org", "ae.org",
  // social and user-content platforms
  "reddit.com", "linkedin.com", "quora.com", "facebook.com", "twitter.com", "x.com", "youtube.com",
  "instagram.com", "pinterest.com", "tiktok.com", "github.com", "gitlab.com", "soundcloud.com", "vimeo.com",
  "flickr.com", "behance.net", "dribbble.com", "issuu.com", "scribd.com", "slideshare.net", "about.me",
  "gravatar.com", "disqus.com", "canva.com", "patreon.com", "wattpad.com", "deviantart.com",
  "producthunt.com", "houzz.com", "trello.com", "myspace.com", "academia.edu", "researchgate.net",
] as const;

const escape = (d: string) => d.replace(/[.]/g, "\\.");

/**
 * POSIX regex (Postgres `~`) and JS RegExp alike: the host is one of the
 * platforms or a subdomain of one. Blogspot is matched on any country TLD
 * (example.blogspot.co.uk, example.blogspot.de).
 */
export const PLATFORM_HOST_PATTERN = `(^|\\.)(blogspot\\.[a-z]{2,3}(\\.[a-z]{2})?|${PLATFORM_DOMAINS.map(escape).join("|")})$`;

const PLATFORM_HOST_RE = new RegExp(PLATFORM_HOST_PATTERN);

export function isPlatformHost(host: string): boolean {
  return PLATFORM_HOST_RE.test(host.toLowerCase());
}

/**
 * `AND`-able condition dropping platform hosts. The pattern goes in as a bound
 * parameter, not inline SQL text — drizzle's sql template would eat the
 * backslashes in it.
 */
export function notPlatformHost(host: SQL): SQL {
  return sql`lower(${host}) !~ ${PLATFORM_HOST_PATTERN}`;
}
