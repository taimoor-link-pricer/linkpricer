# LinkPricer Public API — Planning Doc

**Status:** Planning
**Owner:** Engineering
**Last updated:** 2026-06-07

A monetized public API exposing LinkPricer's domain pricing data (without marketplace identities) to third-party customers. Subscription + metered usage billing via Stripe.

---

## 1. Product Definition

### 1.1 What the API sells

Access to LinkPricer's aggregated pricing intelligence across 40+ marketplaces. Customers query a domain and get back the best/aggregate price + meta info, without ever seeing which marketplace the price came from.

### 1.2 Value proposition

- **For SEO agencies:** instant price discovery without checking each marketplace manually
- **For aggregators / competitors:** market-rate intelligence for their own pricing
- **For tools / SaaS:** embed pricing data in their dashboards

### 1.3 Hard constraints

- **MUST NOT** expose marketplace names, IDs, URLs, or any field that lets a buyer infer the source
- **MUST NOT** allow bulk export (forces buyers to keep paying instead of one-shot scraping the DB)
- **MUST** be production-grade: rate limited, cached, monitored, abuse-resistant
- **MUST** integrate with new Stripe account (fresh, no existing customer records)
- **MUST** live in the existing Next.js app (avoids Firebase domain/CORS overhead)

---

## 2. Architectural Decisions

### 2.1 Location

API lives in `link-pricer-app` under `/app/api/v1/public/...`. Same Next.js app as the rest of LinkPricer.

**Why:** No new domain, no new deploy pipeline, shared Neon connection pool, shared Drizzle schema. We just isolate the route group and middleware.

### 2.2 Stack

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Next.js Route Handlers (Node runtime) | Reuses existing app, Drizzle works server-side |
| API key + rate limit | **Unkey** (self-hosted or cloud) | Open source, purpose-built, key management + per-key rate limits + usage analytics out of the box |
| Cache | **Upstash Redis** | Serverless, pay-per-request, low ops |
| Billing | **Stripe Billing + Meters** | Native metered usage, subscription + overage in one product |
| Docs | **Scalar** (open source) or **Mintlify** | Auto-generates from OpenAPI spec, hosted under `/docs` |
| OpenAPI spec | Hand-written `openapi.yaml` + Zod-derived schemas | Single source of truth for validation + docs |
| Observability | Postgres `api_usage_log` table + Stripe meter | One-stop analytics for billing + abuse detection |

### 2.3 Why not roll our own auth

We'd reinvent: key hashing, revocation, rate limit token buckets, key rotation, key analytics. Unkey gives all of that for free. If we ever outgrow it, swap is trivial — keys are HTTP headers.

### 2.4 Why not Kong / Tyk

Heavy ops burden, designed for microservices behind a gateway. Overkill for a single Next.js app with a few endpoints.

---

## 3. API Surface (v1)

### 3.1 Endpoints

```
GET  /api/v1/public/domains/{domain}        Single domain lookup
POST /api/v1/public/domains/batch           Batch lookup (max 50 domains)
GET  /api/v1/public/domains/{domain}/niches Per-niche pricing breakdown
GET  /api/v1/public/health                  Public health check (no auth)
GET  /api/v1/public/usage                   Caller's current period usage
```

**Explicitly NOT offered in v1:**
- Bulk dump / export
- Marketplace-specific filters
- Webhooks (Phase 4 paid add-on)
- Historical price changes (Phase 4 paid add-on)

### 3.2 Response shape (single domain)

```json
{
  "domain": "example.com",
  "found": true,
  "pricing": {
    "min_price_usd": 85,
    "median_price_usd": 120,
    "currency": "USD",
    "offer_count": 7
  },
  "niches": {
    "general":   { "min": 85,  "median": 110, "available": true },
    "igaming":   { "min": 250, "median": 280, "available": true },
    "adult":     { "available": false },
    "cbd":       { "available": false },
    "loans":     { "available": false },
    "dating":    { "min": 180, "median": 200, "available": true },
    "crypto":    { "min": 220, "median": 240, "available": true },
    "trading":   { "min": 220, "median": 240, "available": true }
  },
  "metrics": {
    "domain_rating": 42,
    "traffic_monthly": 18000,
    "language": "en",
    "country": "US"
  },
  "conditions": {
    "link_type": "dofollow",
    "placement": "in_content",
    "max_links_per_post": 2,
    "guidelines_url": null
  },
  "last_updated": "2026-06-06T03:14:22Z"
}
```

**Fields explicitly omitted:** marketplace name, marketplace ID, offer ID, supplier ID, raw offer list, URLs, any identifier that can be cross-referenced to a known marketplace.

### 3.3 Developer Portal Routes

Customer-facing UI lives under `/developers`. The machine API stays at `/api/v1/public/...`.

```
/developers                       Public landing — product pitch + CTA
/developers/pricing               Plans + pricing table
/developers/docs                  API reference (Scalar/Mintlify embed)
/developers/docs/quickstart       Getting started guide
/developers/docs/errors           Error catalog (maps RFC 7807 type URLs to fixes)
/developers/playground            Interactive test console (auth required, counts against quota)

/developers/signup                Register as API customer
/developers/login                 Login (alias of main /login)

/developers/dashboard             Logged-in home — usage chart, onboarding checklist
/developers/dashboard/keys        Create / revoke / view API keys
/developers/dashboard/usage       Usage analytics + CSV export (90-day retention)
/developers/dashboard/billing     Plan, invoices, payment method, upgrade/downgrade
/developers/dashboard/settings    Profile, webhooks (Phase 6), team members (future)
```

**Naming rationale:** Avoid `/vendor-apis` — "vendor" in LinkPricer already means link-supplying marketplaces (existing user role + DB table). `/developers` is the industry convention (Linear, GitHub, Shopify) and scopes both docs AND account management.

### 3.4 Auth Model

API customers reuse the existing Firebase Auth identity. The `api_customers` table is a 1:1 extension of the user record, gated by a capability flag — NOT a separate auth system.

**Why:**
- An existing LinkPricer link-buying customer can opt into API access with one click
- Single login experience across products
- Easier upsell from main product → API
- Avoids dual identity sync headaches

Implementation: existing user clicks "Enable API access" → row created in `api_customers` linked to their `user.id` → they now see `/developers/dashboard` in their nav.

### 3.5 Free Trial Flow

- Signup grants 100 free queries instantly, **no credit card required**
- Dashboard banner: "X queries left in trial"
- At 80% used: in-app prompt + email to add a card
- At 0 remaining: key returns 402 Payment Required with `Location` header pointing to `/developers/dashboard/billing`

(Standard developer-tools growth funnel: Stripe, Resend, Clerk all work this way.)

### 3.6 Error shape (RFC 7807)

```json
{
  "type": "https://api.linkpricer.com/errors/rate-limited",
  "title": "Rate limit exceeded",
  "status": 429,
  "detail": "Plan allows 60 req/min; resets in 18s",
  "instance": "req_01HXYZ..."
}
```

---

## 4. Pricing & Plans

To validate with Karolis before build:

| Plan | Monthly | Included queries | Overage | Rate limit |
|---|---|---|---|---|
| Free trial | $0 | 100 (one-time) | n/a | 5 req/min |
| Starter | $10 | 10,000 | $0.005 | 60 req/min |
| Growth | $25 | 100,000 | $0.003 | 300 req/min |
| Scale | $50 | 500,000 | $0.0015 | 1000 req/min |
| Enterprise | Custom | Custom | Custom | Custom + SLA |

**Cost-per-query math (rough):**
- Neon read (cached): ~$0.00005
- Upstash Redis cache hit: ~$0.00001
- Compute (Vercel): ~$0.00010
- **Total cost ~$0.00016/query → 95%+ margin even at lowest overage rate**

---

## 5. Edge Cases (MUST handle before launch)

### 5.1 Data / response edge cases

- [ ] Domain not in our DB → `{ "found": false }`, 200 status, count as billable query
- [ ] Domain found but all offers stale (>30 days) → return with `stale: true` flag
- [ ] Domain has only one niche available → other niches `available: false`
- [ ] Different marketplaces price in different currencies → normalize to USD at sync time, store FX rate
- [ ] Offer price is "on request" / null → exclude from min/median calc
- [ ] Domain normalization: `Example.COM/`, `www.example.com`, `https://example.com` all → `example.com`
- [ ] Subdomain handling: `blog.example.com` ≠ `example.com` (separate lookups)
- [ ] Unicode / IDN domains → punycode normalize
- [ ] Same offer cached at multiple price points across niches → de-dupe before median
- [ ] Batch endpoint partial success → 207 Multi-Status semantics, per-domain status
- [ ] Domain we have but marketplace pulled the offer recently → cache TTL must respect this

### 5.2 Anonymization edge cases

- [ ] Single-niche-only marketplaces (e.g., adult-only) → if domain only appears on niche-specific marketplaces, customer could fingerprint. Mitigation: require minimum 3 offers before exposing niche-level data; otherwise omit niche breakdown
- [ ] Offer_count = 1 → don't expose `median`, only `min`, to prevent triangulation
- [ ] Price jitter: do NOT apply random jitter (breaks customer trust + still leakable via averaging across queries). Instead, round to nearest $5 on Starter plan, exact prices on Growth+
- [ ] Conditions field: some marketplaces have unique condition wording → normalize to a fixed vocabulary, never pass raw

### 5.3 Auth / API key edge cases

- [ ] Key revoked mid-request → reject at middleware, before DB hit
- [ ] Key expired but subscription still active (e.g., admin manually expired) → 401 with clear message
- [ ] Subscription canceled, grace period → 7 day soft cancel, key still works but emits deprecation header
- [ ] Failed Stripe payment → after 3 retries (Stripe default), 14-day grace, then suspend key
- [ ] Multiple keys per customer → allowed, each with own rate limit, shared quota
- [ ] Key in URL query string (instead of header) → reject with 400, prevents log leaks
- [ ] Key used from suspicious IP pattern → flag for review, don't auto-block (avoid false positives)
- [ ] Subscription downgraded → new limits apply at next period start, not mid-period

### 5.4 Rate limiting edge cases

- [ ] Burst handling: token bucket with refill, not fixed window (prevents thundering herd at window reset)
- [ ] Concurrent requests from same key → counted individually
- [ ] Quota period: rolling 30-day vs calendar month → use **calendar month** (matches Stripe billing period, easier to explain)
- [ ] Quota exhausted: configurable per-key — `hard_cap: true` (429 block) or `hard_cap: false` (allow, charge overage). Default `false` for paid plans, `true` for free trial
- [ ] Distributed rate limiting → Unkey handles globally; if self-hosted, Redis with Lua script for atomic check+increment

### 5.5 Billing edge cases

- [ ] Usage report to Stripe Meter must be idempotent — use `request_id` as idempotency key
- [ ] Stripe webhook delivery failure → store unprocessed events in `stripe_webhook_log`, retry job
- [ ] Customer disputes specific calls → keep 90 days of `api_usage_log` for evidence
- [ ] Refunds: Stripe-side only, no automatic credit
- [ ] EU customers → Stripe Tax handles VAT, must mark as B2B if VAT ID provided
- [ ] Currency: bill in USD only at launch, multi-currency Phase 4
- [ ] Mid-period plan upgrade → Stripe prorates automatically; verify quota tracking resets correctly

### 5.6 Security edge cases

- [ ] SQL injection on `domain` param → Drizzle parameterizes, but also validate with strict regex `^[a-z0-9.-]+\\.[a-z]{2,}$`
- [ ] Path traversal in `{domain}` → URL decode, validate, reject `..`, `/`, null bytes
- [ ] DDoS via expensive batch endpoint → batch cap at 50, weight batch endpoint as N queries against quota
- [ ] API key timing attack → constant-time compare via Unkey
- [ ] CORS → block browser origins entirely (no `Access-Control-Allow-Origin`). Forces server-to-server use, prevents free embedding
- [ ] Abuse detection: scraping pattern = sequential dictionary words, ascending IDs, alphabetical domain order → flag, throttle, alert
- [ ] Customer hits 95% of monthly quota in <1hr → soft alert email "is this expected?"

### 5.7 Operational edge cases

- [ ] Versioning: `/api/v1/...`; v2 lives alongside, 12 month deprecation window for v1
- [ ] Cache invalidation: scrapper writes new offer → publish to Redis `domain:invalidate:{domain}` channel → cache layer drops entry
- [ ] Scrapper failed last night → API still serves cached data with `last_updated` field; alert ops via Notion if `last_updated` >48h on >5% of queries
- [ ] Database down → graceful 503 with `Retry-After`, log to Sentry
- [ ] Region outage → not handled v1; Vercel edge gives us some resilience
- [ ] Status page: `status.linkpricer.com` via Vercel + simple status check page

### 5.8 Documentation / DX edge cases

- [ ] Code samples in: curl, Python (requests), Node (fetch + axios), PHP, Go
- [ ] Playground in docs uses customer's real key but counts against their quota → confirm in UI before sending
- [ ] OpenAPI spec is source of truth; CI validates response handlers match spec
- [ ] Error catalog page so customers can map error `type` URLs to root causes

---

## 6. Database Changes Needed

New tables in existing Neon DB:

```sql
api_customers       -- 1:1 extension of users.id (NOT a separate identity, per §3.4)
  id, user_id (FK→users, unique), stripe_customer_id, plan, status, created_at, ...

api_keys            -- many keys per customer
  id, customer_id, key_hash, key_prefix, name,
  scopes, last_used_at, revoked_at, created_at

api_usage_log       -- every call (for billing + audit)
  id, key_id, endpoint, domain_queried, status_code,
  cached, response_ms, billable, request_id, created_at
  -- partition by created_at month, retain 90 days hot

api_quota_state     -- rolling counter per key per month
  key_id, period_start, included_used, overage_used,
  hard_cap, updated_at

stripe_webhook_log  -- inbound webhook events for replay
  id, stripe_event_id (unique), type, payload, processed_at, error
```

Existing tables we read from: `lp_marketplace_domains`, `lp_marketplace_offers` (populated by scrapper).

---

## 7. Build Phases

### Phase 0 — Decisions (no code, ~2 days)

Before any code, get sign-off from Karolis on:
- [ ] Final response shape (esp. which fields anonymize OK)
- [ ] Pricing tiers + monthly + overage
- [ ] Hard cap default for paid plans
- [ ] Whether to expose `domain_rating` / `traffic_monthly` in free trial or paid-only
- [ ] Brand: separate subdomain (`api.linkpricer.com`) or path (`linkpricer.com/api/v1/...`)?

### Phase 1 — Core API (1 week)

- [ ] Drizzle schema migrations for new tables
- [ ] Unkey integration (or self-hosted Unkey container if cost matters)
- [ ] Middleware: key validation + rate limit
- [ ] `/api/v1/public/domains/{domain}` endpoint with Zod validation
- [ ] Aggregation query (min/median per niche, anonymized)
- [ ] Upstash Redis caching layer with stale-while-revalidate
- [ ] `api_usage_log` writes (fire-and-forget, queued)
- [ ] OpenAPI v1 spec written

### Phase 2 — Batch + Niches + Anonymization Hardening (3 days)

- [ ] `POST /domains/batch` endpoint (max 50)
- [ ] `/domains/{domain}/niches` endpoint
- [ ] Single-offer privacy guard (no median when offer_count = 1)
- [ ] Currency normalization at query time
- [ ] Domain normalization (IDN, www, casing, scheme)
- [ ] Stale data flagging

### Phase 3 — Billing (1 week)

- [ ] Stripe products / prices / meters configured (new account)
- [ ] Subscription checkout page (in admin customer-facing portal)
- [ ] Stripe webhooks: `customer.subscription.*`, `invoice.*`, `payment_intent.*`
- [ ] Stripe Meter usage reporter (batched every 1min, idempotent by request_id)
- [ ] Self-serve customer portal: API keys, usage chart, billing history, plan changes
- [ ] Grace period + suspension logic

### Phase 4 — Public Docs Site (4 days)

- [ ] Scalar or Mintlify embedded under `/docs`
- [ ] Auth-aware playground
- [ ] Code samples (curl/Python/Node/PHP/Go)
- [ ] Error catalog pages
- [ ] Status page
- [ ] Public landing page for the API product (separate from main LinkPricer marketing)

### Phase 5 — Hardening + Monetization Polish (1 week)

- [ ] Abuse detection job (scraping pattern detection)
- [ ] Alert hooks: customer >95% quota, customer 0 usage in 7d (churn risk), stale data >48h
- [ ] Per-key analytics dashboard (admin)
- [ ] Revenue dashboard (admin)
- [ ] Onboarding email sequence (Resend or SendGrid)
- [ ] Terms of Service + Acceptable Use Policy (no resale, no bulk scraping)

### Phase 6 — Optional / Future

- Webhook subscriptions for price changes (premium add-on)
- Historical price endpoint (premium add-on)
- SLA monitoring + status page automation
- Multi-currency billing
- Enterprise SSO for customer portal

---

## 8. Ready-to-Use Prompts

When ready to start each phase, paste the prompt below into a fresh Claude session.

### 8.1 Prompt: Phase 1 — Core API

> Build Phase 1 of the LinkPricer Public API as defined in `link-pricer-app/PUBLIC_API.md`. Specifically:
> 1. Add Drizzle migrations for `api_customers`, `api_keys`, `api_usage_log`, `api_quota_state`, `stripe_webhook_log` per §6
> 2. Integrate Unkey (use Unkey cloud, free tier) for API key validation + rate limiting via middleware at `/app/api/v1/public/`
> 3. Implement `GET /api/v1/public/domains/{domain}` — Zod-validate the param, normalize the domain per §5.1, look up offers in `lp_marketplace_offers`, return the §3.2 response shape (anonymized, no marketplace identifiers)
> 4. Add Upstash Redis caching with stale-while-revalidate; 1hr fresh TTL, 24hr stale TTL
> 5. Write each request to `api_usage_log` async (do not block response)
> 6. Write/update `openapi.yaml` for the endpoint
>
> Hard rules: no marketplace name/id/url in any response field. SQL must be parameterized via Drizzle. CORS blocked. Read PUBLIC_API.md §5 edge cases before writing anything and call out which ones you're explicitly handling vs deferring.

### 8.2 Prompt: Phase 2 — Batch + Niches

> Implement Phase 2 of the LinkPricer Public API per `PUBLIC_API.md`:
> 1. `POST /api/v1/public/domains/batch` — accepts up to 50 domains, returns array; weight as N billable queries
> 2. `GET /api/v1/public/domains/{domain}/niches` — per-niche pricing breakdown
> 3. Anonymization guard: when `offer_count == 1` for a niche, omit `median`, expose only `min`
> 4. Niche breakdown is only exposed when `offer_count >= 3` total for the domain (per §5.2)
> 5. Currency normalization to USD using stored FX rate
> 6. Full domain normalization per §5.1 (IDN, casing, www, scheme, trailing slash)
> 7. Add `stale: true` flag if `last_updated > 30 days`
>
> Update OpenAPI spec. Add unit tests for normalization + anonymization guards.

### 8.3 Prompt: Phase 3 — Billing

> Implement Phase 3 (Stripe billing) of the LinkPricer Public API per `PUBLIC_API.md`:
> 1. Set up Stripe products + prices + meters for the four plans in §4 (use the NEW Stripe account, env var `STRIPE_API_SECRET_KEY`)
> 2. Build customer-facing checkout page at `/developers/dashboard/billing` using Stripe Checkout
> 3. Implement webhooks at `/api/stripe/webhook` for: `customer.subscription.{created,updated,deleted}`, `invoice.{paid,payment_failed}`, `customer.deleted`. All events logged to `stripe_webhook_log` with `stripe_event_id` unique constraint for idempotency
> 4. Build a batched usage reporter (cron every 1min) that ships unreported `api_usage_log` rows to the Stripe Meter, using `request_id` as idempotency key
> 5. Customer self-serve portal under `/developers/dashboard/*` per §3.3 — `/keys` (list/create/revoke), `/usage` (chart this month + last 3 months + CSV export), `/billing` (plan + invoices + payment method + upgrade/downgrade), `/settings`. Reuse Firebase Auth — add `api_customers` row linked to existing `users.id` per §3.4
> 6. Free trial flow per §3.5: 100 free queries on signup, no CC, soft prompts at 80%, hard 402 at 100% with link to `/developers/dashboard/billing`
> 7. Grace period: 14 days after failed payment before suspending keys; emit `X-LinkPricer-Subscription-Status` header during grace
>
> Edge cases to handle: §5.3, §5.5. Don't skip the idempotency parts — those are the ones that bite later.

### 8.4 Prompt: Phase 4 — Docs Site

> Build the public documentation site for the LinkPricer Public API per `PUBLIC_API.md` Phase 4. All routes live under `/developers/*` per §3.3:
> 1. Embed Scalar (or Mintlify) at `/developers/docs` driven by `openapi.yaml`. Quickstart guide at `/developers/docs/quickstart`
> 2. Playground at `/developers/playground` — signed-in customers run real requests using their key, with confirmation dialog noting it counts against quota
> 3. Code samples for: curl, Python (requests), Node.js (fetch), PHP (Guzzle), Go (net/http)
> 4. Error catalog at `/developers/docs/errors` mapping every RFC 7807 `type` URL from §3.6 to root cause + fix
> 5. Public landing page at `/developers` (separate from main marketing) explaining the product, plus pricing page at `/developers/pricing` with §4 plans table and signup CTA → `/developers/signup`
> 6. Status page at `/status` showing API up/down, scrapper freshness, and incident history

### 8.5 Prompt: Phase 5 — Hardening

> Implement Phase 5 hardening of the LinkPricer Public API per `PUBLIC_API.md`:
> 1. Abuse detection job (runs hourly): flag keys whose query patterns look like scraping — sequential alphabetical domains, dictionary words, unusually high uniqueness ratio. Log to `api_abuse_signals`, send email if score >threshold
> 2. Alert hooks (email via Resend): customer >95% of monthly quota, customer 0 usage in 7 days (churn risk), scrapper stale >48h affecting >5% of queries
> 3. Admin dashboard at `/admin/api` — list customers, search by email/key prefix, view per-customer revenue, view per-key usage, ability to revoke a key, ability to comp credits
> 4. Revenue dashboard at `/admin/api/revenue` — MRR, ARR, churn, plan distribution
> 5. Onboarding email sequence: signup → 24h → 7d → 14d (with quota usage tips)
> 6. Write ToS and AUP at `/legal/api-terms` and `/legal/api-aup` — no resale, no bulk scraping, no reverse-engineering marketplaces. Require checkbox at signup.

---

## 9. Open Questions for Karolis

Park these and surface to Karolis before Phase 0 closes:

1. ~~**Branding:** Separate subdomain or under main domain?~~ **DECIDED:** under main domain at `/developers/*` (per §3.3). Subdomain split can come later if needed.
2. ~~**Free trial gating:** Credit card required upfront?~~ **DECIDED:** no CC, 100 free queries (per §3.5).
3. **Domain rating / traffic data:** Already in our DB? Or do we need to integrate Ahrefs/Semrush? Affects margin math.
4. **Scrapper SLA:** What's the freshness commitment? Daily? Are we OK promising 24h freshness in marketing?
5. **Geo restrictions:** Block any countries (sanctions, scrapy markets)?
6. **B2B contracts:** Will enterprise tier need DPA, security questionnaire responses, custom contracts?
7. **Whose support owns this?** API customer support is a real workload — who responds?
8. **Auth model confirmation:** Confirm with Karolis that API customers should reuse the existing Firebase Auth identity (per §3.4) rather than a separate `api_customers` auth space.

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Customer reverse-engineers marketplaces by cross-referencing public catalogs | Medium | High | Anonymization guards in §5.2, ToS clause, abuse detection |
| Bulk scraping by one customer drains DB / cache | Medium | Medium | Rate limits, batch cap, abuse detection, hard quota on Free |
| Stripe meter ingestion lag delays revenue recognition | Low | Low | Batched reporter with idempotency; accept ~1min lag |
| Scrapper outage degrades API quality, hurts brand | Medium | High | Stale flag, status page, scrapper alerting (separate doc) |
| Customer disputes specific charges | Low | Medium | 90-day `api_usage_log` retention with request_id |
| Marketplace partner sees customer expose pricing → asks us to take down | Low | High | Anonymization is the whole point — if it's working they can't prove it. ToS says we aggregate publicly available data |
| Competitor signs up to study our coverage gaps | High | Low | Acceptable — they're paying us. Don't expose `found: false` patterns publicly. |

---

## 11. Definition of Done (v1 launch)

- [ ] All Phase 1–3 checklist items shipped
- [ ] Docs site live (Phase 4)
- [ ] At least 3 internal test accounts running 1000+ queries/day for 7 days without incident
- [ ] Stripe in live mode, 1 real paid customer onboarded
- [ ] Abuse detection running, alerts configured
- [ ] Status page live
- [ ] Karolis signs off on response shape, pricing, and ToS
