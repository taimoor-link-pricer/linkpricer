# Linkpricer — Home Page Brief
### Main functionalities + required home page sections

---

## Part 1 — What Linkpricer actually does (full feature list)

These are all the things the platform can do today. The home page should communicate the most important ones.

### Core features

| Feature | What it does |
|---|---|
| **Bulk domain search** | User pastes up to 200 domains at once (with or without their known prices). System matches them against the database. |
| **Multi-marketplace price comparison** | Shows every marketplace that has that domain listed and the price on each one. Highlights the cheapest. |
| **SEO metrics per domain** | Shows Domain Rating (DR), monthly organic traffic, keyword count, country of main traffic, and website category. |
| **Value Grade (A+ to F)** | Proprietary score that rates whether a domain is worth its price, based on traffic, DR, and cost vs. market average. |
| **Niche pricing** | Each domain can have separate prices for restricted content categories: iGaming, Adult, CBD, Loans, Dating, Crypto, Trading/Forex. |
| **Link quality metrics** | For each marketplace offer shows: Link Type (Dofollow/Nofollow), Turnaround Time (TAT), and a link to an example published article. |
| **Favorites** | Users can heart/save domains to a shortlist. Come back later and order them in one go. |
| **Price comparison mode** | If the user pastes domains with their own prices (e.g. `forbes.com 200`), the tool shows whether the marketplace price is cheaper, more expensive, or the same. |
| **Direct ordering** | User can place an order through Linkpricer — choose content type, write the brief, and submit. |
| **Managed service** | Linkpricer handles everything: article writing (if needed), placing the order on the marketplace, communication with the site owner. 15% fee on top of marketplace price. |
| **Content writing** | Linkpricer can write the guest post article for the buyer (priced per word). Or the buyer can upload their own article or provide a URL. |
| **AI suggestions** | When filling the order form, AI suggests the best Target URL, Anchor Text, and Article Title for the domain. |
| **Order dashboard** | Buyers can track every order's status (Pending → Writing → Approved → Waiting Publication → Published). |
| **Link monitoring** | After publication, the system checks every 7 days that the backlink is still live. Alerts if it goes missing or is modified. |
| **Google index check** | Tracks whether the published article has been indexed by Google. |
| **CSV export** | Download all orders as a CSV for reporting / invoicing. |
| **Marketplace comparison page** | A public page listing all 40+ integrated marketplaces with their fees, writing service availability, and pricing types. |
| **API access** | Developers can access Linkpricer data via API (documented at `/api-docs`). |
| **Vendor / marketplace portal** | Site owners can list their domains directly in Linkpricer and set their own prices. |
| **Multi-currency** | Prices shown in user's currency (USD/EUR switchable). |
| **Blog** | SEO-focused content hub for link-building education. |
| **Support tickets** | In-app support system for questions and issues. |
| **GDPR compliant** | Role-based access, data exports, DPA available. |

---

## Part 2 — Which features go on the home page

The home page is **public** (no login required). Its only goal is to:
1. Explain what Linkpricer does in 5 seconds
2. Show why it's better than going to marketplaces directly
3. Get the visitor to sign up or start a free comparison

### Required home page sections (in order):

---

### 1. HERO — Above the fold

**Purpose:** Immediately tell the visitor what this is and get them to act.

**Must contain:**
- **Headline** — single sentence, maximum impact. Current: *"Bulk-compare backlink prices. Order directly."*
- **Subheadline** — one sentence that explains the mechanic. Current: *"Paste a list of domains — with or without your prices. LinkPricer shows where each domain is cheapest across 40+ marketplaces."*
- **Primary CTA button** — "Start free — compare prices" → goes to `/login`
- **Secondary CTA** — "See how it works" → scrolls to How It Works section
- **Trust note** under buttons — "No credit card • Free to compare • Pay only when we confirm the webmaster accepts"
- **Hero visual** — currently a product demo video (Loom embed). Could also be a screenshot of the domain search results table or an animated mockup.
- **3 social proof stats** in small cards below the visual:
  - `40+` Marketplaces aggregated
  - `1,000,000+` Offers
  - `2,000+` Registered users

---

### 2. HOW IT WORKS — 6-step process

**Purpose:** Show the user exactly what happens from paste to published article.

**Format:** 6 numbered cards in a 2-column or 3-column grid.

| Step | Title | Description |
|---|---|---|
| 1 | Paste your domain list | Bulk-paste domains (with or without your known prices). We normalize and match them across marketplaces. |
| 2 | Compare & favorite | See where each domain is available and the lowest purchase price. Add domains to Favorites to build your shortlist. |
| 3 | Order in one go | Checkout directly via LinkPricer or leave order details to us. You get an "Order received" email instantly. |
| 4 | Track in your dashboard | All communication continues by email. Progress is mirrored in your dashboard for full visibility. |
| 5 | Invoice after confirmation | When the marketplace API confirms your order, we email the invoice. Pay first, then delivery continues. |
| 6 | Content handling | Upload your own article or ask us to write it — either way, you see every step until publication. |

---

### 3. WHY LINKPRICER — key value props

**Purpose:** Answer "why use this instead of going directly to marketplaces?"

**Format:** 4 cards in a 2-column grid.

| Title | Description |
|---|---|
| True market pricing | Stop guessing. See price differences across marketplaces in seconds. |
| One order, not 50 emails | Centralize purchasing — let your dashboard and inbox reflect the status. |
| Fewer surprises | Acceptance rules and requirements surfaced up front. Choose viable domains only. |
| Always free to compare | Build lists, favorite targets, and compare prices without paying a cent. |

---

### 4. FEATURES — What's included

**Purpose:** Full feature grid for users who want detail before signing up.

**Format:** 9 cards in a 3-column grid.

| Feature | Description |
|---|---|
| Bulk search | Paste hundreds of domains at once for instant availability & best-price matching. |
| Marketplace comparison | We unify listings from multiple marketplaces and show the best place to purchase. |
| Favorites list | Shortlist domains you like and come back later or order in one go. |
| Direct ordering | Checkout via LinkPricer or delegate ordering to us with your instructions. |
| Email-first workflow | Automatic "Order received" email. Ongoing communication continues by email. |
| Dashboard tracking | Mirror of your email thread: see order status, confirmations, content, and publication. |
| Content options | Upload your article or let us write it for you. Status visible end-to-end. |
| Privacy & security | GDPR-friendly data handling, role-based access, and exportable records. |
| Zero cost to compare | Comparisons are free. You only pay when you place an order. |

---

### 5. FREE TO USE — Pricing transparency explainer

**Purpose:** Remove the biggest objection: "Does this cost money?"

**Format:** 3 cards side by side.

| Title | Description |
|---|---|
| No paywall for research | Paste, compare, and favorite domains without entering a card. |
| Transparent checkout | Before you pay, you see exactly what is being ordered and the total due. |
| Invoices by email | Once a marketplace confirms your order via API, we email the invoice so you can pay and continue. |

---

### 6. SOCIAL PROOF + SECURITY

**Purpose:** Build trust with real user quotes and security credentials.

**Left side (2/3 width):** Testimonial quotes
- *"We turned two weeks of vendor hunting into minutes."*
- *"Our team favorites lists, orders, and tracks — all in one place."*
- Small note: "Case studies and receipts available on request"

**Right side (1/3 width):** Security list
- ✓ Role-based access
- ✓ GDPR-aligned data choices
- ✓ Exports for finance & audit

---

### 7. BLOG SECTION (optional / auto-populated)

**Purpose:** SEO. Show the platform is active and educational.

**Format:** Latest 3 blog posts in a card row. Auto-pulled from the blog.

---

### 8. CTA STRIP — Mid-page conversion push

**Purpose:** Re-capture attention of users who scrolled but haven't clicked yet.

**Format:** Full-width bar with:
- Headline: *"Ready to compare prices?"*
- Subtext: *"It's free to paste your list, favorite domains, and see the best place to purchase."*
- Button: "Start free" → `/login`

---

### 9. FAQ — Common questions

**Purpose:** Handle objections. Also good for SEO.

**Format:** Accordion / expandable list.

| Question | Answer |
|---|---|
| Do I need a credit card to compare prices? | No. LinkPricer is free for research: paste lists, compare, and favorite domains without payment. |
| What happens after I place an order? | You receive an "Order received" email immediately. Communication continues by email, and the same status appears in your dashboard. |
| When do I pay? | When the marketplace confirms your order via API, we email the invoice. Pay first, then we proceed with content and publication. |
| Can I upload my own article? | Yes. You can upload your article or ask us to write it. You will see progress end-to-end. |
| What integrations do you support? | We connect to 40+ marketplaces to confirm availability and orders. More sources are added over time. |
| Is my data secure? | We follow GDPR-friendly practices, provide exports, and limit access by role. |

---

### 10. FOOTER

Standard footer with:
- Logo + short tagline
- Navigation links: Home · App · Marketplaces · Blog · About · Contact · API Docs
- Legal links: Privacy Policy · Terms · DPA
- Copyright

---

## Part 3 — Navigation bar (public header)

The header appears on the home page and all public pages.

**Left:** Logo (Linkpricer)

**Center/Right links:**
- Marketplaces (→ `/marketplaces`) — shows the 40+ marketplace comparison
- Blog (→ `/blog`)
- About (→ `/about`)
- API (→ `/api-docs`)

**Right side CTAs:**
- "Log in" (secondary)
- "Start free" / "Get started" (primary button)

---

## Part 4 — Design notes for the redesign

- **Tone:** Professional but approachable. This is a tool for SEO agencies and freelancers — not a consumer app. Clean, data-forward, trustworthy.
- **The demo video** in the hero is important — it's the fastest way for a new visitor to understand the product. Keep it or replace with an animated product screenshot.
- **"Free to compare"** is the biggest conversion lever. Repeat it multiple times. Visitors assume it costs money and leave without trying.
- **Numbers matter** — 40+ marketplaces, 1M+ offers, 2000+ users. These build instant credibility. Make them large and visible.
- The page is currently minimal / plain. The new design should feel **premium and modern** — but still fast and scannable. Users are in a research mindset, not a browsing mindset.
