# Linkpricer /app — Designer Brief
### For a designer who has never opened the platform

---

## 1. What is Linkpricer?

Linkpricer is a **B2B SaaS tool used by digital marketing agencies, SEO professionals, and link-building teams**.

The core job-to-be-done is:

> "I have a list of websites I want to buy a guest post / backlink on. Tell me what each site costs on every marketplace that sells it, so I can buy at the best price."

A **guest post** means: you pay a website owner to publish an article that contains a link back to your client's website. This helps improve SEO rankings.

Websites are sold through **marketplaces** — think of them like stock exchanges, but for advertising slots on websites. The same website may be listed on 5–10 different marketplaces at very different prices. Linkpricer aggregates all of those prices in one place so the buyer can see the cheapest option instantly.

---

## 2. Who uses this screen?

**Primary user:** An SEO account manager or link-building specialist at a digital agency.

They arrive at `/app` with a list of 10–200 domains that their client wants links on. They paste the list, choose their content category (niche), click Analyze, and within seconds they see:
- Which marketplaces stock those domains
- What each domain costs per marketplace
- Quality and editorial metrics so they can judge if it's worth buying
- A direct "Buy" button

---

## 3. The page layout — three parts

```
┌──────────────────────────────────────────┐
│  PART A: Search / Input Block             │
├──────────────────────────────────────────┤
│  PART B: Domain Results Table             │
│    └── PART C: Expandable Marketplace     │
│           Detail Panel (per row)          │
└──────────────────────────────────────────┘
```

---

## 4. PART A — Search / Input Block

This is the **hero section** of the page. It appears before any results load.

### Fields:

| Element | Description |
|---|---|
| **Headline** | "Analyze Guest Post Opportunities" |
| **Subtitle** | "Upload up to 200 domains and compare prices and conditions across multiple marketplaces." |
| **Large text area** | Multi-line free-text input. The user pastes a list of domains, one per line, comma or semicolon separated. They can also append a price after the domain (e.g. `forbes.com 200`) if they already know their budget — this enables a comparison view later. |
| **Domain counter badge** | Shows "14/200 domains" next to the text area in real time as the user types. |
| **"Truncated!" warning badge** | Shown if the user exceeds 200 domains. |
| **Niche / Price Category dropdown** | Determines which pricing column is shown in results. Options: General · iGaming/Gambling · Adult · CBD · Loans · Dating · Crypto · Trading/Forex · Link Insertion. |
| **"Analyze Domains" button** | Full-width primary CTA. Shows a loading spinner while processing. |
| **Quick-start sample domain chips** | A row of clickable domain pills (e.g. "footy.dk", "techcrunch.com") to prepopulate the text area for first-time users. |

---

## 5. PART B — Domain Results Table

After the user clicks Analyze, results appear in a card-based table. The card header shows:
- **"Domain Analysis Results (14)"** — count of domains found
- **"Download CSV"** button (top-right of card) — exports the results

### Table columns (desktop):

| # | Column | What it shows |
|---|---|---|
| 1 | *(expand toggle)* | A `›` chevron icon. Clicking it opens Part C (marketplace detail panel) for that row. |
| 2 | **Domain** | The domain name, e.g. `techcrunch.com`. |
| 3 | **Actions** | ❤ Favourite button + "Buy $XXX" button (the best price across all marketplaces, with Linkpricer's 15% service fee included). |
| 4 | **Value** | A grade badge: `A+`, `A`, `B+`, `B`, `B-`, `C`, `F` with a numeric score in parentheses. Tooltip explains the formula. |
| 5 | **Country** | Primary traffic country (e.g. "US", "UK", "DE") shown as a small badge. |
| 6 | **DR** | Domain Rating (0–100). An authority score from Ahrefs. Higher = more authoritative. Shown with a trend icon. |
| 7 | **Traffic** | Monthly organic search traffic, formatted as `14K`, `2.1M`, etc. |
| 8 | **Keywords** | Number of organic keywords the site ranks for. |
| 9 | **Category** | Website topic / niche (e.g. "Technology", "Health", "Finance"). Shown as a badge, truncated to 20 characters with a tooltip for long names. |

### Row states:

- **Normal row** — domain found, data displayed.
- **"Domain not found" row** — grey badge spanning all columns: "Domain not found in our database".
- **Expanded row** — shows Part C panel below the main row.

### Value grade color coding:
- `A+`, `A` → Green
- `B+`, `B` → Blue
- `B-` → Yellow
- `C`, `F` → Grey

### Buy button behaviour:
- If a price exists → "Buy $XXX" (price = cheapest marketplace × 1.15 for Linkpricer's fee)
- If domain is listed but has no price → "No Pricing" (disabled, grey)
- If no marketplace has the domain → "No offers"

### Mobile layout:
On mobile, the table becomes a card stack. Each domain card shows:
- Domain name + Country badge + Category badge
- A 3-column mini stats grid: DR · Traffic · Keywords · Value grade
- "Buy Now" full-width button
- "Compare X Marketplaces ›" toggle button

---

## 6. PART C — Expandable Marketplace Detail Panel

When the user clicks the `›` icon on a domain row, a **grey panel slides open below that row**. It contains a grid of **marketplace cards** — one card per marketplace that has this domain listed.

### Panel header:
- "Top 3 Best Prices" (default) or "All Marketplaces (X available)" (after clicking "Show all")

### Layout:
- **Grid: 1 column on mobile / 2 on tablet / 3 on desktop**
- Each card is a white rounded box with padding

---

### Marketplace Card — ALL fields currently displayed:

This is the **full list of every metric** shown inside each marketplace card.

#### Identity
| Field | Description |
|---|---|
| **Marketplace Name** | Name of the marketplace (e.g. "Adsy", "Getlinks", "Sedo", "Vendor: John D."). Also shows last data update timestamp: e.g. "Adsy (Update 05-05-2026 14:30)". |

#### Pricing
| Field | Description |
|---|---|
| **Price** | The marketplace's asking price for a guest post on this domain, for the selected niche. May show a range if multiple sellers exist: "$80 – $120". ℹ icon opens a popover: "This marketplace brings together multiple freelancers who offer the same site at different prices." |
| **Our Price** | Linkpricer's price = cheapest marketplace price × 1.15. ℹ icon opens a popover explaining the 15% service fee. |
| **Your Price** (conditional) | Only appears if the user entered a comparison price in the input (e.g. `forbes.com 200`). Shows the user's price and a badge: "X% cheaper" (green) / "X% more expensive" (red) / "Same price" (grey). |

#### Quality & Editorial
| Field | Description |
|---|---|
| **Quality** | Star rating 1–5 (★). Filled stars vs. empty stars. |
| **Delivery** | Number of days the marketplace guarantees article publication (e.g. "7 days"). |
| **TAT** | Turnaround Time — same concept as Delivery but sourced directly from the domain's info record in the database (e.g. "5 days"). Different marketplaces may report this differently. |
| **Link Type** | Whether the link in the article will be `Dofollow` or `Nofollow`. Dofollow passes SEO value; Nofollow does not. Shown as plain text. |
| **Example Post** | A clickable "View Example" link that opens a real published article on that domain. Allows the buyer to judge editorial quality before purchasing. |

#### Niche-specific pricing section
Only shown if the marketplace has set custom pricing for restricted niches. Shown as a sub-section with the heading "Niche Pricing":

| Niche | Description |
|---|---|
| **Gambling** | iGaming/casino content — typically 2–5× the general price |
| **Adult** | Adult content pricing |
| **CBD** | CBD / cannabis products |
| **Loans** | Financial / payday loans |
| **Dating** | Dating sites / apps |
| **Crypto** | Cryptocurrency content |
| **Trading/Forex** | Trading platform promotions |

Each niche shows as a price or price range on its own line.

#### Action buttons
| Button | Description |
|---|---|
| **Buy direct** | Opens the purchase modal to buy directly through the original marketplace (external redirect). |
| **Buy managed** | Linkpricer manages the whole process for the user — they pay Linkpricer, Linkpricer handles the marketplace. This is the recommended flow. |

---

## 7. Complete Data Model — all metrics at a glance

Here is every single data point the system has for a domain:

### Domain-level metrics (always shown)

| Metric | Source | Meaning |
|---|---|---|
| `domain` | Search input | The domain name |
| `countryMainTraffic` | SEO data provider | Two-letter country code for main traffic origin |
| `languageWrittenInWebsite` | SEO data | Language of the site's content |
| `category` | SEO data | Website topic/niche |
| `domainRating` | Ahrefs DR | Domain authority score 0–100 |
| `orgTraffic` | Ahrefs | Monthly organic search visitors |
| `orgKeywords` | Ahrefs | Count of keywords ranked |
| `refDomains` | Ahrefs | Number of external websites linking to this domain |
| `linkedDomains` | Ahrefs | Number of external sites this domain links out to |
| `allowedNiche` | DB | Niche restrictions set by the marketplace |
| `valueScore` | Calculated | Internal algorithm score (0–100) for cost-efficiency |
| `valueGrade` | Calculated | Letter grade: A+, A, B+, B, B-, C, F |
| `gamblingValueScore` | Calculated | Same score but calculated for gambling niche pricing |
| `gamblingValueGrade` | Calculated | Letter grade for gambling niche |

### Per-marketplace offer metrics (shown in expanded panel)

| Metric | Source | Meaning |
|---|---|---|
| `marketplaceName` | DB | Name of the marketplace |
| `updatedAt` | DB | Timestamp of last price update |
| `minPrice` | DB / API | Cheapest general price on this marketplace |
| `maxPrice` | DB / API | Most expensive general price (if range) |
| `gamblingMinPrice` | DB / API | Gambling niche price (min) |
| `gamblingMaxPrice` | DB / API | Gambling niche price (max) |
| `adultMinPrice` | DB / API | Adult niche price (min) |
| `adultMaxPrice` | DB / API | Adult niche price (max) |
| `cbdMinPrice` | DB / API | CBD niche price (min) |
| `cbdMaxPrice` | DB / API | CBD niche price (max) |
| `loanMinPrice` | DB / API | Loans niche price (min) |
| `loanMaxPrice` | DB / API | Loans niche price (max) |
| `datingMinPrice` | DB / API | Dating niche price (min) |
| `datingMaxPrice` | DB / API | Dating niche price (max) |
| `cryptoMinPrice` | DB / API | Crypto niche price (min) |
| `cryptoMaxPrice` | DB / API | Crypto niche price (max) |
| `tradingForexMinPrice` | DB / API | Trading/Forex niche price (min) |
| `tradingForexMaxPrice` | DB / API | Trading/Forex niche price (max) |
| `linkInsertionMinPrice` | DB / API | Link insertion price (min) |
| `linkInsertionMaxPrice` | DB / API | Link insertion price (max) |
| `qualityScore` | Marketplace | Star rating 1–5 |
| `deliveryTime` | Marketplace | Days to publish (from vendor's own offer) |
| `tat` | `lp_domain_info` | Turnaround Time in days (from domain info record) |
| `linkType` | `lp_domain_info` | "Dofollow" or "Nofollow" |
| `exampleUrl` | `lp_domain_info` | URL of a real published article on this domain |
| `available` | DB | Whether this marketplace currently has the domain listed |
| `showPrice` | DB | Whether the price is publicly visible |
| `dynamicPrice` | API | Live price fetched from marketplace API (may differ from cached DB price) |

---

## 8. Value Score — how it works

The Value Score formula gives buyers a quick signal of whether a domain is worth the money:
- **Traffic (40%)** — how much organic traffic vs. the average in the same country + category
- **Domain Rating (30%)** — how authoritative the site is vs. market average
- **Price (30%)** — how the price compares to the market average

Score range 0–100 → converted to a grade:
- **80–100 = A+** (exceptional value)
- **60–79 = A** (very good)
- **45–59 = B+**
- **30–44 = B**
- **15–29 = B-**
- **5–14 = C**
- **0–4 = F** (poor value)

---

## 9. Marketplace types

Not all marketplaces work the same way:

| Type | Example | How prices are fetched |
|---|---|---|
| **API-connected marketplace** | Getlinks, Adsy | Prices fetched live from their API on each search |
| **Database-stored marketplace** | Sedo, Linkbuilder | Prices imported in bulk from a CSV/sync job |
| **Vendor offer** | "Vendor: John D." | A direct seller who has set their own prices inside Linkpricer |

The "updatedAt" timestamp tells the buyer how fresh the price data is.

---

## 10. Design instructions for the redesign

### What to redesign
The task is to redesign the **entire `/app` Domain Analysis page** — both the search form and the results — using all of the metrics listed above.

### Design goals
1. **Make every metric discoverable** — the current design hides many fields. Buyers need to see TAT, Link Type, and Example Post clearly without hunting for them.
2. **Hierarchy first** — the most important information (price, buy button, value grade) should be the most visually prominent. Secondary metrics (DR, traffic, keywords) next. Editorial quality (TAT, link type, example) last.
3. **At-a-glance comparison** — it must be easy to compare 3–5 marketplace cards side by side and immediately spot the best option.
4. **Trust signals** — the Example Post link and Link Type are trust builders. They should look important, not like afterthoughts.

### Specific elements to solve in the new design
- **How to display TAT vs. Delivery** — currently both exist but they look identical. The designer should differentiate them clearly (e.g. "Delivery guarantee: 7 days" vs. "Avg. TAT: 5 days").
- **Link Type badge** — `Dofollow` should be visually distinct from `Nofollow` (green vs. orange, or icon-based).
- **Example Post** — should not just be a plain blue link. It should be a prominent call to action, ideally showing a preview or clear label like "📄 See published example".
- **Niche pricing section** — currently collapsed under a tiny heading. For users working in iGaming or Crypto, these are the most important prices. Consider a tab or toggle to switch the primary price view.
- **Value Grade** — currently shown as a text badge. Could be stronger as a coloured score circle or a visual meter.
- **Mobile** — the card stack on mobile needs clear buy actions and the ability to expand marketplace details without horizontal scrolling.

### Design constraints
- The platform has both **light mode and dark mode** — the new design must support both.
- Prices are shown in the user's currency (USD by default, switchable) — always use a currency symbol placeholder.
- Some fields are `null` / empty — the design must gracefully handle missing data with a dash (`—`) or a "Not available" placeholder. Never show blank/broken UI.
- The results load **progressively** — the first few domains appear within 1–2 seconds, then more stream in over 5–10 seconds. The design should account for a loading / streaming state.

---

## 11. Glossary for the designer

| Term | Plain English |
|---|---|
| **DR (Domain Rating)** | A score from 0–100 that represents how authoritative a website is. Higher = more trusted by Google. |
| **Organic Traffic** | Visitors who arrive at the website via Google search (not paid ads). |
| **Organic Keywords** | The number of search terms the website appears in Google results for. |
| **Referring Domains** | The number of other websites that link to this domain. More = better for SEO. |
| **Guest Post** | A paid article published on someone else's website that contains a link back to the buyer's client. |
| **Backlink** | A link on another website pointing to your website. |
| **Dofollow** | A type of link that passes "SEO juice" to the target page. What buyers want. |
| **Nofollow** | A link that does NOT pass SEO value. Less desirable, sometimes still useful. |
| **TAT (Turnaround Time)** | How many days from placing the order to the article going live. |
| **Niche pricing** | Some domains charge extra for articles in sensitive categories (gambling, adult, etc.). |
| **Value Score** | Linkpricer's proprietary score — how good is this domain's price compared to its SEO metrics? |
| **Marketplace** | A platform/website where domain owners list their guest post slots for sale. |
| **Managed purchase** | Linkpricer acts as the middleman — the buyer pays Linkpricer, and Linkpricer handles the marketplace communication. |
