// Seeds the `marketplaces` registry (migration 0005).
//
// Source of truth for the URLs is the OLD app's
// client/src/data/marketplaceUrls.ts, which mixed two different things under
// one name: 30 real referral links that earn Linkpricer a commission, and 18
// plain URLs with no tracking at all. They're split here -- affiliateUrl only
// holds genuine referral links, so "which marketplaces are monetized" stays a
// truthful query instead of string-matching for "?ref=".
//
// Homepages were verified live (HTTP probe) rather than derived from the
// hostname, because derivation is wrong often enough to matter:
//   ereferer.com          -> en.ereferer.com   (bare domain doesn't resolve)
//   cp.adsy.com           -> ref.adsy.com
//   app.linkhouse.co      -> linkhouse.pl      (different TLD)
//   dashboard.serppro.io  -> serppro.ai        (rebranded)
// and ~11 more scraped hostnames are login panels, not landing pages.
//
// Idempotent: re-running updates URLs in place and never duplicates a row.
// Deliberately does NOT overwrite affiliate_url with NULL, so a link added
// later via the admin UI survives a re-run.
//
//   npx tsx scripts/seed-marketplaces.mts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!.replace(/[&?]channel_binding=require/g, ''));

type Row = { name: string; homepageUrl: string; affiliateUrl: string | null };

const MARKETPLACES: Row[] = [
  { name: "123.media", homepageUrl: "https://123.media/", affiliateUrl: "https://123.media/?code=bcf8fa1c97" },
  { name: "accessily.com", homepageUrl: "https://accessily.com/", affiliateUrl: null },
  { name: "app.backlinksglobal.com", homepageUrl: "https://app.backlinksglobal.com/", affiliateUrl: null },
  { name: "app.bazoom.com", homepageUrl: "https://bazoom.com/", affiliateUrl: "https://app.bazoom.com/refer?ref=kY2AqMtYN4AiY647" },
  { name: "app.develink.com", homepageUrl: "https://www.develink.com/", affiliateUrl: "https://app.develink.com/register?code=KAROLISBUTKUS" },
  { name: "app.insert.link", homepageUrl: "https://app.insert.link/guest-posts", affiliateUrl: null },
  { name: "app.link.builders", homepageUrl: "https://app.link.builders/", affiliateUrl: null },
  { name: "app.linkhouse.co", homepageUrl: "https://linkhouse.pl/", affiliateUrl: "https://app.linkhouse.co/register/NDA5Z" },
  { name: "app.mistergoodlink.com", homepageUrl: "https://www.mistergoodlink.com/", affiliateUrl: "https://app.mistergoodlink.com/welcome-dd45c72" },
  { name: "app.motherlink.io", homepageUrl: "https://motherlink.io/", affiliateUrl: "https://app.motherlink.io/register/index?ref=a2Fyb2xpc0BzbWFydGJldHRpbmdndWlkZS5jb20%3D" },
  { name: "app.nobsmarketplace.com", homepageUrl: "https://nobsmarketplace.com", affiliateUrl: null },
  { name: "app.purolink.com", homepageUrl: "https://app.purolink.com/", affiliateUrl: null },
  { name: "app.revpanda.com", homepageUrl: "https://app.revpanda.com/", affiliateUrl: null },
  { name: "app.unancor.com", homepageUrl: "https://www.unancor.com/", affiliateUrl: "https://app.unancor.com?aff=75de003c-d1b1-11ef-ae65-0e52f3fe678a" },
  { name: "backlinked.com", homepageUrl: "https://backlinked.com/", affiliateUrl: "https://backlinked.com?ref=nmnmnmz" },
  { name: "bulldoz.net", homepageUrl: "https://www.bulldoz.net/", affiliateUrl: null },
  { name: "collaborator.pro", homepageUrl: "https://collaborator.pro/", affiliateUrl: "https://collaborator.pro/?ref=sjj98z" },
  { name: "conexoo.com", homepageUrl: "https://conexoo.com/", affiliateUrl: "https://panel.conexoo.com?af=315621d554dcec5c16483be2c4bcd7d98a071abf" },
  { name: "cp.adsy.com", homepageUrl: "https://adsy.com/", affiliateUrl: "https://ref.adsy.com/?ref=referral&ref_type=direct&ref_id=0wddowu0d4ik5acp&ref_item=3" },
  { name: "crm.1ereplace.com", homepageUrl: "https://1ereplace.com/", affiliateUrl: null },
  { name: "dashboard.serppro.io", homepageUrl: "https://serppro.io", affiliateUrl: null },
  { name: "equote.eu", homepageUrl: "https://equote.eu/", affiliateUrl: null },
  { name: "ereferer.com", homepageUrl: "https://en.ereferer.com/", affiliateUrl: null },
  { name: "getalink.com", homepageUrl: "https://www.getalink.com/", affiliateUrl: "https://app.getalink.com/authentication/register?aff=2641" },
  { name: "guestpostlinks.net", homepageUrl: "https://guestpostlinks.net/sites/", affiliateUrl: null },
  { name: "guestpostnow.com", homepageUrl: "https://guestpostnow.com", affiliateUrl: null },
  { name: "guestpostsale.com", homepageUrl: "https://guestpostsale.com/", affiliateUrl: null },
  { name: "invalley.com", homepageUrl: "https://invalley.com/", affiliateUrl: null },
  { name: "lemmilink.fr", homepageUrl: "https://lemmilink.fr/", affiliateUrl: "https://app.lemmilink.fr/Register?ref=72b1f3" },
  { name: "linkatomic.com", homepageUrl: "https://linkatomic.com/", affiliateUrl: "https://app.linkatomic.com/register/r/ac095ad411cd8efab83aaf094c201932" },
  { name: "linkavista.com", homepageUrl: "https://linkavista.com/en", affiliateUrl: "https://linkavista.com/register?Ref=Karolis7449" },
  { name: "linkbroker.io", homepageUrl: "https://www.linkbroker.io/", affiliateUrl: null },
  { name: "linkscope.io", homepageUrl: "https://linkscope.io/", affiliateUrl: null },
  { name: "market.pryard.com", homepageUrl: "https://pryard.com/", affiliateUrl: null },
  { name: "mellowpromo.com", homepageUrl: "https://mellowpromo.com/", affiliateUrl: null },
  { name: "meup.com", homepageUrl: "https://meup.com/", affiliateUrl: "https://meup.com/?ref=67DBF47451410" },
  { name: "mistergoodlink.com", homepageUrl: "https://www.mistergoodlink.com/", affiliateUrl: "https://app.mistergoodlink.com/welcome-dd45c72" },
  { name: "motherlink.io", homepageUrl: "https://motherlink.io/", affiliateUrl: "https://app.motherlink.io/register/index?ref=a2Fyb2xpc0BzbWFydGJldHRpbmdndWlkZS5jb20%3D" },
  { name: "newcp.linksmanagement.com", homepageUrl: "https://www.linksmanagement.com/", affiliateUrl: "https://www.linksmanagement.com/?ref=referral&ref_type=direct&ref_id=0wddowu0d4ik5acp&ref_item=3" },
  { name: "outreachmantra.com", homepageUrl: "https://outreachmantra.com/", affiliateUrl: "https://outreachmantra.com/signup?referral=sDhRo4vsKM" },
  { name: "panel.conexoo.com", homepageUrl: "https://conexoo.com/", affiliateUrl: "https://panel.conexoo.com?af=315621d554dcec5c16483be2c4bcd7d98a071abf" },
  { name: "paper.club", homepageUrl: "https://www.paper.club/en/", affiliateUrl: null },
  { name: "portal.loganix.com", homepageUrl: "https://loganix.com/", affiliateUrl: null },
  { name: "pr.seolutions.biz", homepageUrl: "https://seolutions.biz/shop/", affiliateUrl: null },
  { name: "prensalink.com", homepageUrl: "https://prensalink.com/", affiliateUrl: "https://join.prensalink.com/a/xc9XEbQSUw" },
  { name: "prnews.io", homepageUrl: "https://prnews.io/", affiliateUrl: "https://prnews.io/sites?i=3751537" },
  { name: "prposting.com", homepageUrl: "https://prposting.com/", affiliateUrl: "https://prposting.com/ref/G50jX0Nj" },
  { name: "publisuites.com", homepageUrl: "https://www.publisuites.com/", affiliateUrl: "https://www.publisuites.com/publishers/aff/175761d4b099ea70419231ff2e238bfd1b5a021d/" },
  { name: "rankcastle.com", homepageUrl: "https://rankcastle.com/", affiliateUrl: null },
  { name: "reputepost.com", homepageUrl: "https://reputepost.com/", affiliateUrl: null },
  { name: "seo-jungle.com", homepageUrl: "https://seo-jungle.com/", affiliateUrl: "https://seo-jungle.com/fr/plateforme-de-netlinking/?affiliate=3A5IVDTY" },
  { name: "serpzilla.com", homepageUrl: "https://serpzilla.com/", affiliateUrl: "https://serpzilla.com/r.RnZSxFcRoo.php" },
  { name: "soumettre.fr", homepageUrl: "https://soumettre.fr/", affiliateUrl: "https://soumettre.fr/parrain/PqfRp3" },
  { name: "tool.growwer.com", homepageUrl: "https://growwer.com/", affiliateUrl: "https://growwer.com/?af=ba1a49b90b154b7f9d2a099a685eaa72" },
  { name: "unancor.com", homepageUrl: "https://www.unancor.com/", affiliateUrl: "https://app.unancor.com?aff=75de003c-d1b1-11ef-ae65-0e52f3fe678a" },
  { name: "websuccessmedia.com", homepageUrl: "https://websuccessmedia.com/", affiliateUrl: null },
  { name: "whitehat.link", homepageUrl: "https://whitehat.link/", affiliateUrl: null },
];

let inserted = 0;
let updated = 0;

for (const m of MARKETPLACES) {
  const existing = await sql`SELECT id FROM marketplaces WHERE name = ${m.name}`;
  if (existing.length === 0) {
    await sql`
      INSERT INTO marketplaces (name, homepage_url, affiliate_url)
      VALUES (${m.name}, ${m.homepageUrl}, ${m.affiliateUrl})
    `;
    inserted++;
  } else {
    // COALESCE keeps a hand-entered affiliate link when this script has
    // none for that marketplace -- re-running must never wipe an admin edit.
    await sql`
      UPDATE marketplaces
      SET homepage_url  = ${m.homepageUrl},
          affiliate_url = COALESCE(${m.affiliateUrl}, affiliate_url),
          updated_at    = now()
      WHERE name = ${m.name}
    `;
    updated++;
  }
}

const [{ total, monetized }] = await sql`
  SELECT count(*)::int AS total,
         count(affiliate_url)::int AS monetized
  FROM marketplaces
` as { total: number; monetized: number }[];

console.log(`seeded: ${inserted} inserted, ${updated} updated`);
console.log(`marketplaces: ${total} total, ${monetized} monetized, ${total - monetized} homepage-only`);
