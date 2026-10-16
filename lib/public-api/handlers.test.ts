/**
 * The two public endpoints through their real handlers, with the database
 * replaced by an in-memory fake that plays the api_keys row, the catalogue
 * and the request log.
 *
 * What this pins is the money: what a call claims, what it hands back, what
 * it reports as charged — for the search endpoint, and for the pricing
 * endpoint whose key-and-quota code the search endpoint now shares
 * (lib/public-api/access.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const KEY = "lp_live_" + "a".repeat(32);

const state = vi.hoisted(() => ({
  key: null as null | { active: boolean; blocked: boolean; expired: boolean; limit: number; perMinute: number },
  monthUsed: 0,
  minuteUsed: 0,
  claims: [] as number[],
  refunds: [] as number[],
  logs: [] as { domain: string; status: number }[],
  hosts: [] as string[],
  catalog: new Map<string, { dr: number; traffic: number | null; offers: Record<string, unknown>[] }>(),
  failSearch: false,
  hangSearch: false,
  searchSql: [] as { text: string; params: unknown[] }[],
}));

vi.mock("@/lib/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const keyState = () =>
    state.key
      ? { is_active: state.key.active, blocked: state.key.blocked, expired: state.key.expired, expires_at: null }
      : null;

  const execute = async (query: unknown) => {
    const { sql: text, params } = dialect.sqlToQuery(query as never);

    // The claim: authenticate and reserve `units` in one statement.
    if (text.includes("WITH k AS")) {
      const k = keyState();
      if (!k || !state.key) return { rows: [] };
      const units = Number(params[Number(/\+ \$(\d+)::int/.exec(text)![1]) - 1]);
      const minuteBlocked = state.minuteUsed >= state.key.perMinute;
      const monthBlocked = state.monthUsed + units > state.key.limit;
      const allowed = k.is_active && !k.blocked && !k.expired && !minuteBlocked && !monthBlocked;
      const before = state.monthUsed;
      if (allowed) {
        state.monthUsed += units;
        state.minuteUsed += 1;
        state.claims.push(units);
      }
      return {
        rows: [{
          id: "key-1", user_id: "user-1", ...k,
          month_limit: state.key.limit, per_minute_limit: state.key.perMinute,
          month_used_before: before,
          month_used: allowed ? state.monthUsed : null,
          minute_used: allowed ? state.minuteUsed : null,
          allowed, minute_blocked: minuteBlocked, month_blocked: monthBlocked,
        }],
      };
    }
    if (text.includes("GREATEST(month_count")) {
      const n = Number(params[0]);
      state.refunds.push(n);
      state.monthUsed = Math.max(0, state.monthUsed - n);
      return { rows: [{ month_count: state.monthUsed }] };
    }
    // A rejected request: counted against the minute, not the month.
    if (text.includes("WITH rk AS")) {
      const k = keyState();
      if (!k || !state.key) return { rows: [] };
      const minuteBlocked = state.minuteUsed >= state.key.perMinute;
      const counted = k.is_active && !k.blocked && !k.expired && !minuteBlocked;
      if (counted) state.minuteUsed += 1;
      return {
        rows: [{
          ...k,
          month_limit: state.key.limit, per_minute_limit: state.key.perMinute,
          month_used: state.monthUsed,
          minute_used: counted ? state.minuteUsed : null,
          minute_blocked: minuteBlocked,
        }],
      };
    }
    if (text.includes("INSERT INTO api_request_logs")) {
      for (let i = 0; i < params.length; i += 5) {
        state.logs.push({ domain: String(params[i + 2]), status: Number(params[i + 3]) });
      }
      return { rows: [] };
    }
    // The stored country spellings the country filter matches exactly.
    if (text.includes("WITH RECURSIVE t(c)")) {
      return { rows: ["United States", "US", "États-Unis", "United Kingdom", "Germany"].map((c) => ({ c })) };
    }
    // The search's candidate queries: grouped (price) or ranked (metric).
    if (text.includes("AS host")) {
      state.searchSql.push({ text, params });
      if (state.failSearch) throw new Error("db down");
      if (state.hangSearch) return new Promise(() => {});
      // Every fixture site has its metrics; the ranked query's "unknown" part has none.
      if (text.includes(" IS NULL OR ")) return { rows: [] };
      return { rows: state.hosts.map((host) => ({ host })) };
    }
    // The catalogue query both endpoints price with.
    if (text.includes("WITH req(req_domain, form)")) {
      const requested = [...new Set(params.filter((_, i) => i % 2 === 0).map(String))];
      return {
        rows: requested.map((d) => {
          const c = state.catalog.get(d);
          return {
            req_domain: d,
            domain_row: c
              ? { domain: d, domain_rating: c.dr, org_traffic: c.traffic, ref_domains: 100, country_main_traffic: "United States" }
              : null,
            offers: c ? c.offers : null,
          };
        }),
      };
    }
    throw new Error(`unexpected query: ${text.slice(0, 80)}`);
  };
  return { db: { execute } };
});
vi.mock("@/lib/currency", async (orig) => {
  const real = await orig<typeof import("@/lib/currency")>();
  return { ...real, getUsdRates: async () => ({ USD: 1, EUR: 1.25 }) };
});
vi.mock("next/server", async (orig) => {
  const real = await orig<typeof import("next/server")>();
  return { ...real, after: (fn: () => unknown) => void fn() };
});

const { handleSearchRequest, distinctHosts } = await import("@/lib/public-api/search-handler");
const { handleBatchPricingRequest } = await import("@/lib/public-api/batch-handler");
const { withFeeUsd, minFeeCents } = await import("@/lib/pricing/fee");

const FLOOR = minFeeCents({ USD: 1, EUR: 1.25 });

function post(path: string, body: unknown, key: string | null = KEY) {
  return new NextRequest(`https://x.test/api/v1/public/domains/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const search = (body: unknown, key: string | null = KEY) => handleSearchRequest(post("search", body, key));
const pricing = (body: unknown, key: string | null = KEY) => handleBatchPricingRequest(post("pricing", body, key));

function add(domain: string, price: number, dr = 50, extra: Record<string, unknown> = {}) {
  state.catalog.set(domain, {
    dr,
    traffic: 5000,
    // Fresh as of today: search only returns prices confirmed recently.
    offers: [{ currency: "USD", min_price: price, trusted: false, freshness: new Date().toISOString(), ...extra }],
  });
  state.hosts.push(domain);
}

beforeEach(() => {
  state.key = { active: true, blocked: false, expired: false, limit: 1000, perMinute: 10 };
  state.monthUsed = 0;
  state.minuteUsed = 0;
  state.claims = [];
  state.refunds = [];
  state.logs = [];
  state.hosts = [];
  state.catalog = new Map();
  state.failSearch = false;
  state.hangSearch = false;
  state.searchSql = [];
  vi.useRealTimers();
});

describe("search — who gets in", () => {
  it("needs a key", async () => {
    const res = await search({ filters: { min_dr: 40 } }, null);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("missing_api_key");
  });

  it("reports a bad key before a bad body, and a bad body costs nothing", async () => {
    state.key = null;
    expect((await search({ filters: { min_DR: 40 } })).status).toBe(401);

    state.key = { active: true, blocked: false, expired: false, limit: 1000, perMinute: 10 };
    const res = await search({ filters: { min_DR: 40 } });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("unknown_filter");
    expect((await search("{not json")).status).toBe(400);
    expect(state.claims).toEqual([]);
    expect(state.monthUsed).toBe(0);
  });

  it("gives a rejected request the rate-limit headers, and counts it against the minute only", async () => {
    state.monthUsed = 7;
    const res = await search({ filters: { min_DR: 40 } });
    expect(res.status).toBe(422);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("1000");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("993");
    expect(res.headers.get("X-RateLimit-Limit-Minute")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining-Minute")).toBe("9");
    expect(res.headers.get("X-Lookups-Charged")).toBe("0");
    expect(state.minuteUsed).toBe(1);
    expect(state.monthUsed).toBe(7);
  });

  it("refuses rejected requests past the per-minute limit like any other", async () => {
    for (let i = 0; i < 10; i++) expect((await search("{not json")).status).toBe(400);
    const res = await search("{not json");
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_exceeded");
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(res.headers.get("X-RateLimit-Remaining-Minute")).toBe("0");
    // And a valid request in the same minute is refused too.
    expect((await search({ filters: { min_dr: 40 } })).status).toBe(429);
    expect(state.claims).toEqual([]);
  });

  it("refuses a blocked key", async () => {
    state.key!.blocked = true;
    const res = await search({ filters: { min_dr: 40 } });
    expect(res.status).toBe(401);
    expect((await res.json()).message).toContain("blocked");
  });
});

describe("search — what it costs", () => {
  it("claims the limit, returns what matched and charges only that", async () => {
    add("a.com", 300, 70);
    add("b.com", 100, 60);
    add("c.com", 200, 50);
    const res = await search({ filters: { min_dr: 40 } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.map((r: { domain: string }) => r.domain)).toEqual(["a.com", "b.com", "c.com"]);
    expect(body.summary).toEqual({ returned: 3, limit: 50, has_more: false });
    expect(state.claims).toEqual([50]);
    expect(state.refunds).toEqual([47]);
    expect(state.monthUsed).toBe(3);
    expect(body.usage).toMatchObject({ charged: 3, monthly_limit: 1000, monthly_remaining: 997 });
    expect(res.headers.get("X-Lookups-Charged")).toBe("3");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("997");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(state.logs).toEqual([
      { domain: "a.com", status: 200 },
      { domain: "b.com", status: 200 },
      { domain: "c.com", status: 200 },
    ]);
  });

  it("returns each domain's body exactly as the pricing endpoint does", async () => {
    add("a.com", 300, 70);
    add("b.com", 100, 60);
    const found = (await (await search({ filters: { min_dr: 40 } })).json()).results;
    const priced = (await (await pricing({ domains: ["a.com", "b.com"] })).json()).results;
    expect(found.map((r: { data: unknown }) => r.data)).toEqual(priced.map((r: { data: unknown }) => r.data));
  });

  it("drops, and does not charge for, a candidate whose published price breaks the filter", async () => {
    add("cheap.com", 100);
    // Passes a source-price test at 180 but costs more than 200 with the fee.
    add("edge.com", 180);
    expect(withFeeUsd(180, FLOOR)).toBeGreaterThan(200);
    const body = await (await search({ filters: { max_price: 200 } })).json();
    expect(body.results.map((r: { domain: string }) => r.domain)).toEqual(["cheap.com"]);
    expect(body.usage.charged).toBe(1);
    expect(state.monthUsed).toBe(1);
  });

  it("stops at the limit and says there is more", async () => {
    for (let i = 0; i < 8; i++) add(`site${i}.com`, 100 + i, 80 - i);
    const body = await (await search({ filters: { min_dr: 40 }, limit: 5 })).json();
    expect(body.results).toHaveLength(5);
    expect(body.results[0].domain).toBe("site0.com");
    expect(body.summary).toEqual({ returned: 5, limit: 5, has_more: true });
    expect(state.claims).toEqual([5]);
    expect(state.monthUsed).toBe(5);
  });

  it("charges nothing when nothing matches, and still leaves a log row", async () => {
    const res = await search({ filters: { min_dr: 99 } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results).toEqual([]);
    expect(body.summary).toEqual({ returned: 0, limit: 50, has_more: false });
    expect(body.usage.charged).toBe(0);
    expect(state.monthUsed).toBe(0);
    expect(state.logs).toEqual([{ domain: "(search)", status: 200 }]);
  });

  it("leaves out a site whose price no source has confirmed recently, and does not charge for it", async () => {
    add("fresh.com", 100, 70);
    add("stale.com", 100, 80, { freshness: "2026-02-13T00:00:00Z" });
    const body = await (await search({ filters: { min_dr: 40 } })).json();
    expect(body.results.map((r: { domain: string }) => r.domain)).toEqual(["fresh.com"]);
    expect(body.usage.charged).toBe(1);
    // The candidate query asks for recent offers in the first place.
    expect(state.searchSql[0].text).toContain("GREATEST(o.updated_at::timestamp, o.last_fetched_at) >=");
    // The pricing endpoint still prices it when asked by name.
    const priced = await (await pricing({ domains: ["stale.com"] })).json();
    expect(priced.results[0]).toMatchObject({ status: "ok", data: { found: true } });
  });

  it("answers a max_price below the minimum fee without searching", async () => {
    add("a.com", 1);
    const body = await (await search({ filters: { max_price: 10 } })).json();
    expect(body.results).toEqual([]);
    expect(state.searchSql).toHaveLength(0);
    expect(state.monthUsed).toBe(0);
  });

  it("hands everything back when the search fails", async () => {
    add("a.com", 100);
    state.failSearch = true;
    const res = await search({ filters: { min_dr: 40 } });
    expect(res.status).toBe(500);
    expect((await res.json()).message).toContain("No lookups were charged");
    expect(state.refunds).toEqual([50]);
    expect(state.monthUsed).toBe(0);
    expect(state.logs).toEqual([{ domain: "(search)", status: 500 }]);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("1000");
    expect(res.headers.get("X-Lookups-Charged")).toBe("0");
  });

  it("answers a search that outruns the deadline with a timeout, and hands everything back", async () => {
    vi.useFakeTimers();
    add("a.com", 100);
    state.hangSearch = true;
    const pending = search({ filters: { min_dr: 40 } });
    await vi.advanceTimersByTimeAsync(25_000);
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "timeout", status: 503 });
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("1000");
    expect(state.refunds).toEqual([50]);
    expect(state.monthUsed).toBe(0);
    expect(state.logs).toEqual([{ domain: "(search)", status: 503 }]);
  });

  it("refuses a search the remaining quota cannot cover, and says what would fit", async () => {
    state.monthUsed = 990;
    add("a.com", 100);
    const res = await search({ filters: { min_dr: 40 } });
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error).toBe("quota_exceeded");
    expect(body.message).toContain('Set "limit" to 10 or lower');
    expect(state.monthUsed).toBe(990);

    const ok = await search({ filters: { min_dr: 40 }, limit: 10 });
    expect(ok.status).toBe(200);
    expect(state.monthUsed).toBe(991);
  });

  it("counts one call against the per-minute limit", async () => {
    state.minuteUsed = 10;
    const res = await search({ filters: { min_dr: 40 } });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_exceeded");
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

describe("search — the query it sends", () => {
  it("filters and sorts on the niche's own price column", async () => {
    await search({ filters: { min_dr: 40, max_price: 300 }, niche: "gambling", sort: "price" });
    const { text, params } = state.searchSql[0];
    expect(text).toContain("o.gambling_min_price > 0");
    expect(text).toContain("HAVING");
    expect(text).toMatch(/ORDER BY MIN\(o\.gambling_min_price::float [^\n]*\) ASC NULLS LAST/);
    expect(text).toContain("d.domain_rating >= 1");
    // Over-fetched, so a dropped candidate does not leave the page short.
    expect(params.at(-1)).toBe(120);
  });

  it("walks a metric sort in order, with no grouping, when price is not filtered", async () => {
    await search({ filters: { country: ["US"], tld: "com" } });
    const { text, params } = state.searchSql[0];
    expect(text).toContain("o.min_price > 0");
    expect(text).toContain("EXISTS (SELECT 1 FROM marketplace_offers o");
    expect(text).not.toContain("GROUP BY");
    expect(text).toMatch(/ORDER BY d\.domain_rating DESC, lower\(d\.domain\) ASC/);
    // The country as its exact stored spellings, which the column's index can serve.
    expect(text).toMatch(/d\.country_main_traffic IN \(\$\d+, \$\d+, \$\d+\)/);
    expect(params).toEqual(expect.arrayContaining(["United States", "US", "États-Unis"]));
    expect(params).not.toContain("United Kingdom");
  });

  it("reads the sites with an unknown metric only when the known ones do not fill the page", async () => {
    add("a.com", 100, 70);
    await search({ filters: { tld: "com" }, limit: 5 });
    expect(state.searchSql).toHaveLength(2);
    expect(state.searchSql[1].text).toMatch(/\(d\.domain_rating IS NULL OR d\.domain_rating < 1\)/);
    expect(state.searchSql[1].text).toMatch(/ORDER BY lower\(d\.domain\) ASC/);

    // A DR range already requires a known DR: nothing more to read.
    state.searchSql = [];
    await search({ filters: { min_dr: 40 }, limit: 5 });
    expect(state.searchSql).toHaveLength(1);
  });

  it("tests a price range per offer on a metric sort, without grouping", async () => {
    await search({ filters: { min_price: 100, max_price: 300 } });
    const { text } = state.searchSql[0];
    expect(text).not.toContain("GROUP BY");
    expect(text).toMatch(/AND EXISTS \(SELECT 1 FROM marketplace_offers o [\s\S]* <= \$\d+::float\)/);
    expect(text).toMatch(/AND NOT EXISTS \(SELECT 1 FROM marketplace_offers o [\s\S]* < \$\d+::float\)/);
  });

  it("matches nothing for a country no site is stored under", async () => {
    await search({ filters: { country: ["NE"] } });
    expect(state.searchSql[0].text).toContain("AND false");
  });
});

describe("distinctHosts", () => {
  it("keeps one spelling per host and skips what cannot be looked up", () => {
    expect(
      distinctHosts(["a.com", "lübeck.nu", "xn--lbeck-kva.nu", "www.b.com", "not a host", "b.com", "a.com"])
    ).toEqual(["a.com", "lübeck.nu", "b.com"]);
  });
});

describe("pricing — unchanged by sharing its quota code", () => {
  it("claims per distinct domain and refunds the ones it does not hold", async () => {
    add("a.com", 300);
    const res = await pricing({ domains: ["a.com", "A.com", "nosuch.org"] });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary).toEqual({ requested: 3, unique_domains: 2, ok: 2, not_found: 1, invalid: 0 });
    expect(state.claims).toEqual([2]);
    expect(state.refunds).toEqual([1]);
    expect(body.usage).toMatchObject({ charged: 1, monthly_remaining: 999 });
    expect(res.headers.get("X-Lookups-Charged")).toBe("1");
    expect(state.logs).toEqual([
      { domain: "a.com", status: 200 },
      { domain: "nosuch.org", status: 404 },
    ]);
  });

  it("keeps its own wording for a batch that does not fit", async () => {
    state.monthUsed = 999;
    const res = await pricing({ domains: ["a.com", "b.com"] });
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.message).toContain("This batch needs 2 lookups but only 1 of your 1000");
    expect(state.monthUsed).toBe(999);
  });

  it("still rejects a bad body without charging, and a bad key first", async () => {
    const empty = await pricing({ domains: [] });
    expect(empty.status).toBe(422);
    expect(empty.headers.get("X-RateLimit-Remaining")).toBe("1000");
    expect((await pricing("nope")).status).toBe(400);
    expect(state.claims).toEqual([]);
    state.key = null;
    expect((await pricing({ domains: [] })).status).toBe(401);
  });
});

describe("pricing — charges only for a price", () => {
  it("reports a listed domain with no usable price as no_prices, uncharged", async () => {
    add("priced.com", 300);
    add("empty.nl", 0);
    state.catalog.get("empty.nl")!.offers = [{ currency: "EUR", min_price: null, trusted: false, freshness: null }];
    const res = await pricing({ domains: ["priced.com", "empty.nl"] });
    const body = await res.json();
    expect(body.results[1]).toMatchObject({ status: "not_found", data: null, error: { code: "no_prices" } });
    expect(body.summary).toMatchObject({ ok: 1, not_found: 1 });
    expect(state.claims).toEqual([2]);
    expect(state.refunds).toEqual([1]);
    expect(body.usage).toMatchObject({ charged: 1, monthly_remaining: 999 });
    expect(res.headers.get("X-Lookups-Charged")).toBe("1");
  });

  it("answers a niche the domain is not priced for, with what it is priced for, at no cost", async () => {
    add("a.com", 300);
    const res = await pricing({ domains: ["a.com"], niche: "gambling" });
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ status: "ok", data: { found: false, available_niches: ["standard"] } });
    expect(body.usage.charged).toBe(0);
    expect(state.monthUsed).toBe(0);
  });
});

describe("search — leaves out what is not a placement", () => {
  it("drops platform hosts and excluded sources in the candidate query", async () => {
    await search({ filters: { min_dr: 40 } });
    const { text, params } = state.searchSql[0];
    expect(text).toMatch(/lower\(d\.domain\) !~ \$\d+/);
    expect(text).toMatch(/lower\(o\.marketplace_name\) NOT IN \(\$\d+\)/);
    expect(params).toContain("serpzilla.com");
    expect(params.some((p) => typeof p === "string" && p.includes("blogspot"))).toBe(true);
  });
});
