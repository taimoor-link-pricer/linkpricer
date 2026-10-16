/**
 * Hosts search never returns, with every subdomain under them — the data
 * behind isPlatformHost (source-quality.ts).
 *
 * What they have in common: the catalogue gives the host the Domain Rating of
 * a big domain it merely sits on (every *.blogspot.com site reads DR 95, every
 * *.it.com one DR 92), and what is sold "on" it is a profile, a free page, an
 * uploaded file or a comment — listed at a few dollars, not an editorial
 * placement. Left in, a "high DR" search is all of them.
 *
 * Built from the live catalogue (Oct 2026): every host of DR 80+ search could
 * still return, grouped by parent domain and by suspiciously low price, and
 * reviewed by hand. A cheap price alone is not a reason to be here — cheap
 * offers on real publications (nypost.com, marketwatch.com) are a pricing
 * question, not this one.
 *
 * Each entry matches the host itself and any subdomain of it, so list the
 * narrowest name that is wholly a platform (blog.libero.it, not libero.it).
 */

/** Blog hosts, site builders and personal-page services. */
const SITE_BUILDERS = [
  "blogger.com", "wordpress.com", "wpcomstaging.com", "tumblr.com", "medium.com", "substack.com",
  "beehiiv.com", "ghost.io", "hashnode.com", "hashnode.dev", "dev.to", "paragraph.com", "vocal.media",
  "hubpages.com", "steemit.com", "livejournal.com", "over-blog.com", "canalblog.com", "altervista.org",
  "typepad.com", "telegra.ph", "neocities.org", "tripod.com", "tripod.lycos.com",
  "bravenet.com", "estranky.cz", "jouwweb.nl", "startpagina.nl", "de.tl", "free.fr", "blog.libero.it",
  "sito.libero.it", "digilander.libero.it", "narod.ru", "ucoz.ru", "ucoz.net", "liveinternet.ru",
  "dzen.ru", "wixsite.com", "wix.com", "weebly.com", "squarespace.com", "jimdo.com", "jimdofree.com",
  "jimdosite.com", "webflow.io", "framer.website", "canva.site", "gamma.site", "gamma.app",
  "mystrikingly.com", "strikingly.com", "site123.me", "tilda.ws", "carrd.co", "webnode.page",
  "simplesite.com", "yola.com", "yolasite.com", "super.site", "mn.co", "pbworks.com", "wikidot.com",
  "fandom.com", "notion.site", "es.tl", "rf.gd", "hol.es", "yo.fr", "writeas.com",
  "blogs.sapo.pt", "infonu.nl", "mirtesen.ru", "everybodywiki.com",
  // WordPress.com's free blogs under its .blog topic names (someone.news.blog)
  "home.blog", "news.blog", "business.blog", "health.blog", "travel.blog", "food.blog", "tech.blog",
  "fashion.blog", "finance.blog", "law.blog", "car.blog", "art.blog", "sport.blog", "video.blog",
  "design.blog", "game.blog", "code.blog", "school.blog",
  // Japanese and Chinese blog hosts
  "ameblo.jp", "amebaownd.com", "exblog.jp", "fc2.com", "blog.jp", "hatenablog.com", "hatena.blog",
  "hatena.ne.jp", "blog.goo.ne.jp", "note.com", "peraichi.com", "select-type.com", "plaza.rakuten.co.jp",
  "pixnet.net", "blog.udn.com", "blog.csdn.net", "baijiahao.baidu.com", "blog.naver.com",
] as const;

/** Hosting, storage and app-deploy domains: each subdomain is someone's upload or app. */
const HOSTING = [
  "amazonaws.com", "cloudfront.net", "storage.googleapis.com", "googleusercontent.com",
  "blob.core.windows.net", "azurewebsites.net", "web.app", "firebaseapp.com", "netlify.app",
  "vercel.app", "pages.dev", "herokuapp.com", "lovable.app", "hostingersite.com", "cloudwaysapps.com",
  "wpenginepowered.com", "github.io", "gitlab.io", "gitbook.io", "gitbook.com", "dropbox.com",
  "4shared.com", "myshopify.com",
] as const;

/**
 * Shared registry spaces: each name under them is a separate site, but the
 * catalogue gives every one the registry domain's Domain Rating.
 */
const SHARED_REGISTRIES = [
  "it.com", "us.com", "uk.com", "eu.com", "de.com", "co.com", "ru.com", "cn.com", "br.com", "gb.com",
  "jpn.com", "sa.com", "za.com", "kr.com", "ar.com", "mex.com", "qc.com", "uy.com", "com.com", "com.de",
  "com.se", "se.net", "hu.net", "in.net", "uk.net", "gb.net", "za.net", "eu.org", "us.org", "ae.org",
  "co.ua", "pp.ua", "msk.ru", "spb.ru", "com.ru", "org.ru", "net.ru", "pp.ru", "cx.ua", "at.ua", "biz.ua",
  "v.ua", "locator.ua", "co.pl", "xmc.pl", "co.bz", "my.id",
] as const;

/** Forms, documents, notebooks and other tools whose pages users create. */
const USER_DOCUMENTS = [
  "google.com", "jotform.com", "wufoo.com", "cognitoforms.com", "typeform.com", "tally.so", "notion.so",
  "notion.com", "coda.io", "clickup.com", "evernote.com", "trello.com", "padlet.com", "wakelet.com",
  "prezi.com", "canva.com", "venngage.com", "infogram.com", "heyzine.com", "issuu.com", "scribd.com",
  "slideshare.net", "scribehow.com", "hackmd.io", "cloud.microsoft", "sway.office.com",
  "microsoftonline.com", "arcgis.com", "getpostman.com", "codepen.io", "stackblitz.com", "github.com",
  "gitlab.com", "bitbucket.org", "codeberg.org", "launchpad.net", "kaggle.com", "wandb.ai", "zenodo.org",
  "archive.org", "openlibrary.org", "openstreetmap.org", "kahoot.it", "instructure.com", "pressbooks.pub",
  "list-manage.com", "getresponse.com", "imgur.com", "adobe.com", "elements.envato.com",
  "wordpress.org", "smore.com", "diigo.com", "are.na", "linktr.ee", "bit.ly",
  "tinyurl.com", "cutt.ly",
] as const;

/** Storefronts, creator pages, courses, events and fundraisers. */
const CREATOR_PAGES = [
  "gumroad.com", "ko-fi.com", "buymeacoffee.com", "patreon.com", "boosty.to", "payhip.com", "selar.com",
  "hotmart.com", "bigcartel.com", "teachable.com", "thinkific.com", "skool.com", "mightynetworks.com",
  "kickstarter.com", "gofundme.com", "change.org", "wefunder.com", "opencollective.com", "liberapay.com",
  "zrzutka.pl", "caringbridge.org", "camp-fire.jp", "suzuri.jp", "myminifactory.com", "signupgenius.com",
  "evite.com", "peatix.com", "eventbrite.com", "lu.ma", "helloasso.com", "billetweb.fr", "weezevent.com",
  "tickettailor.com", "cal.com",
] as const;

/** Social networks, profiles, directories, Q&A, wikis and podcast listings. */
const SOCIAL_AND_PROFILES = [
  "reddit.com", "linkedin.com", "quora.com", "facebook.com", "twitter.com", "x.com", "youtube.com",
  "instagram.com", "pinterest.com", "tiktok.com", "discord.com", "ok.ru", "band.us", "zhihu.com",
  "news.ycombinator.com", "community.ibm.com", "creators.yahoo.com", "ed.ted.com",
  "bookshop.org", "stackoverflow.com", "stackexchange.com", "wikipedia.org", "wikidata.org",
  "about.me", "gravatar.com", "disqus.com", "proboards.com", "indiehackers.com", "producthunt.com",
  "alternativeto.net", "bloglovin.com", "cake.me", "contra.com", "behance.net", "dribbble.com",
  "deviantart.com", "pixiv.net", "furaffinity.net", "flickr.com", "500px.com", "pbase.com", "pixieset.com",
  "mypixieset.com", "domestika.org", "skillshare.com", "wattpad.com", "goodreads.com", "letterboxd.com",
  "myanimelist.net", "anilist.co", "themoviedb.org", "genius.com", "soundcloud.com", "mixcloud.com",
  "vimeo.com", "myspace.com", "strava.com", "outdooractive.com", "zooniverse.org",
  "researchgate.net", "yelp.com", "merchantcircle.com", "hotfrog.com", "provenexpert.com",
  "podcasts.apple.com", "podbean.com", "spreaker.com", "podchaser.com", "castbox.fm", "pocketcasts.com",
  "podcastaddict.com", "goodpods.com", "castro.fm", "ivoox.com", "rss.com", "iheart.com", "bebee.com", "kompass.com",
] as const;

/** Domain marketplaces and parking pages: the "site" is a for-sale listing. */
const DOMAIN_SALES = [
  "hugedomains.com", "dropcatch.com", "dynadot.com", "afternic.com", "sedo.com", "above.com", "dan.com",
  "namebright.com", "atom.com", "expireddomains.com", "buydomainnames.co.uk", "forsale.godaddy.com",
] as const;

export const PLATFORM_DOMAINS: readonly string[] = [
  ...SITE_BUILDERS,
  ...HOSTING,
  ...SHARED_REGISTRIES,
  ...USER_DOCUMENTS,
  ...CREATOR_PAGES,
  ...SOCIAL_AND_PROFILES,
  ...DOMAIN_SALES,
];

/**
 * Whole families matched by pattern (POSIX and JS regex alike), each with any
 * subdomain:
 *
 * - blogspot and houzz on every country domain (x.blogspot.co.uk, houzz.fr);
 * - universities and governments (.edu, .gov, .mil, .ac.uk, .edu.au,
 *   .gouv.fr, .gob.mx, .gc.ca, europa.eu). What marketplaces list on them is
 *   a student page, a course site or a profile — harvard.edu at $18 — never
 *   an editorial placement the institution sells.
 */
export const PLATFORM_FAMILIES: readonly string[] = [
  "blogspot\\.[a-z]{2,3}(\\.[a-z]{2})?",
  "houzz\\.[a-z]{2,3}(\\.[a-z]{2})?",
  "(edu|gov|gob|mil)(\\.[a-z]{2})?",
  "ac\\.[a-z]{2}",
  "gouv\\.fr",
  "gc\\.ca",
  "europa\\.eu",
];
