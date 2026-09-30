/**
 * The single-domain catalogue query.
 *
 * The public API used to serve this at GET /api/v1/public/domains/{domain}/pricing.
 * That route was retired when the batch endpoint became v1
 * (POST /api/v1/public/domains/pricing, lib/public-api/batch-handler.ts); the
 * query stays because the order API prices listings from it, and
 * scripts/verify-public-api-batch.mts uses it as the reference the batch
 * query must match domain for domain.
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { domainForms } from "@/lib/public-api/common";

/**
 * Offers, metrics and price freshness for one domain in one round trip.
 * Also the reference the batch parity check
 * (scripts/verify-public-api-batch.mts) compares against.
 *
 * A bound JS array is NOT a Postgres array in a Drizzle sql template —
 * `= ANY(${array})` fails at runtime with "op ANY/ALL (array) requires
 * array on right side". An explicit IN list of individually-bound values
 * is the form that works and stays parameterised.
 */
export async function fetchDomainCatalog(domain: string): Promise<{
  domain_row: Record<string, unknown> | null;
  offers: Record<string, unknown>[] | null;
} | undefined> {
  const forms = domainForms(domain);
  const domainList = sql.join(forms.map((f) => sql`${f}`), sql`, `);
  const result = await db.execute(sql`
    WITH d AS (
      -- Every domains row for this host, not one of them.
      --
      -- domains_domain_unique is case-SENSITIVE, so the catalog carries
      -- 6,951 groups of rows that are the same site spelled differently
      -- ("huliq.com" and "Huliq.com" are two rows, with two separate sets
      -- of offers and two different DR values). A LIMIT 1 here returned
      -- whichever row Postgres happened to hand back first — for
      -- huliq.com that is either 22 offers at DR 58 or 3 offers at DR 0,
      -- with nothing in the query to decide which, so the same request
      -- could legitimately return either. Pricing has to be deterministic,
      -- so offers are pooled across every matching row below.
      SELECT id, domain, domain_rating, org_traffic, ref_domains, country_main_traffic
      FROM domains
      WHERE lower(domain) IN (${domainList})
    ),
    best_domain AS (
      -- The row the metrics are read from. Duplicates are rarely equally
      -- populated (the canonical row has the real DR/traffic and the
      -- stray one is usually zeroed), so prefer the row that actually
      -- knows something, and order fully so the choice never depends on
      -- storage order.
      SELECT * FROM d
      ORDER BY
        (domain_rating IS NOT NULL AND domain_rating > 0) DESC,
        COALESCE(org_traffic, 0) DESC,
        COALESCE(ref_domains, 0) DESC,
        domain ASC
      LIMIT 1
    ),
    offers AS (
      SELECT * FROM (
      -- DISTINCT ON collapses a marketplace back to ONE offer.
      --
      -- Pooling across every matching domains row is what makes a duplicated host
      -- complete, but marketplace_offers is unique on (domain_id,
      -- marketplace_name) — per row, not per host — so when the SAME
      -- marketplace has scraped two spellings of one site it contributes
      -- two rows. Those were both counted, which inflated offer_count and
      -- dragged average_price toward a single source's second quote.
      -- 1,463 hosts are affected and their two quotes genuinely differ
      -- (abbynews.com: one marketplace at both $780 and $889).
      --
      -- The docs sell offer_count as "how many independent sources back
      -- these figures", so counting one source twice makes that claim
      -- false. Cheapest quote per source wins, which keeps this consistent
      -- with how the headline price is chosen.
      --
      -- The same claim breaks a second way: three marketplaces are in the
      -- catalogue under TWO names each, because they are scraped from both
      -- their public site and their logged-in panel --
      --
      --   mistergoodlink.com / app.mistergoodlink.com   (38,174 shared domains)
      --   unancor.com        / app.unancor.com
      --   conexoo.com        / panel.conexoo.com
      --
      -- One company, counted as two independent sources on every domain
      -- both names carry. MisterGoodLink alone inflates offer_count on
      -- 38,174 domains, and they are an API trial partner who can
      -- recognise their own listings. Stripping an app. or panel.
      -- prefix collapses each pair to one source. It is deliberately a
      -- narrow rule rather than "same registrable domain": no other
      -- source in the catalogue of 57 carries either prefix alongside a
      -- bare twin, so nothing else changes, and two genuinely different
      -- marketplaces sharing a root domain cannot be merged by accident.
      SELECT DISTINCT ON (regexp_replace(lower(o.marketplace_name), '^(app|panel)\\.', ''))
        -- Identity + listing conditions. Ignored by toOffer() and so by every
        -- pricing response; read only by the order API's listing lookup
        -- (lib/order-api/listings.ts), which prices from this same pool so a
        -- listing price can never differ from what this endpoint quotes.
        'M-' || o.id AS listing_id, o.marketplace_name AS source_name,
        o.delivery_time_days, o.link_type, o.sponsored_tag, o.duration,
        o.currency,
        o.min_price, o.max_price,
        o.gambling_min_price, o.gambling_max_price,
        o.adult_min_price, o.adult_max_price,
        o.cbd_min_price, o.cbd_max_price,
        o.loan_min_price, o.loan_max_price,
        o.dating_min_price, o.dating_max_price,
        o.crypto_min_price, o.crypto_max_price,
        o.trading_forex_min_price, o.trading_forex_max_price,
        o.link_insertion_min_price, o.link_insertion_max_price,
        COALESCE(m.trusted, false) AS trusted,
        GREATEST(o.updated_at::timestamp, o.last_fetched_at) AS freshness
      FROM marketplace_offers o
      JOIN d ON d.id = o.domain_id
      LEFT JOIN marketplaces m ON lower(m.name) = lower(o.marketplace_name)
      WHERE o.available = true
      ORDER BY regexp_replace(lower(o.marketplace_name), '^(app|panel)\\.', ''), o.min_price::float ASC NULLS LAST
      ) mo

      UNION ALL

      SELECT
        'V-' || s.id AS listing_id, 'vendor' AS source_name,
        s.delivery_time_days, NULL AS link_type, NULL AS sponsored_tag, NULL AS duration,
        s.currency,
        s.min_price, s.max_price,
        s.gambling_min_price, s.gambling_max_price,
        s.adult_min_price, s.adult_max_price,
        s.cbd_min_price, s.cbd_max_price,
        s.loan_min_price, s.loan_max_price,
        s.dating_min_price, s.dating_max_price,
        s.crypto_min_price, s.crypto_max_price,
        s.trading_forex_min_price, s.trading_forex_max_price,
        s.link_insertion_min_price, s.link_insertion_max_price,
        -- A vendor is not a marketplace, so there is no marketplaces row
        -- to carry a trust decision. Vendor offers are therefore never
        -- "recommended" until trust is modelled for them explicitly.
        false AS trusted,
        s.updated_at AS freshness
      FROM supplier_offers s
      -- Matched on the normalized host directly rather than joined to the
      -- domain CTE: it can hold several rows for the same host (see its
      -- comment above), and
      -- joining would multiply every vendor offer by that row count,
      -- double-counting it in the average and the offer count.
      WHERE lower(s.domain) IN (${domainList})
        AND s.status = 'active' AND s.is_active = true
    )
    SELECT
      (SELECT row_to_json(best_domain) FROM best_domain)          AS domain_row,
      -- Each offer carries its own freshness column; the response dates
      -- every niche from the offers that actually priced it. There is
      -- deliberately no domain-wide MAX here any more -- it overstated
      -- freshness on 55% of priced niches, by up to 186 days.
      (SELECT json_agg(offers) FROM offers)                       AS offers
  `);
  return result.rows[0] as
    | { domain_row: Record<string, unknown> | null; offers: Record<string, unknown>[] | null }
    | undefined;
}
