# LinkPricer — Onboarding Forms Specification
**Version:** May 2026  
**For:** Designer (redesign brief)  
**Source:** `client/src/components/OnboardingFlow.tsx` + `docs/MARKETPLACE_ONBOARDING_QUESTIONS.md`

---

## Overview

There are **two separate onboarding flows** in the product:

| # | Flow | Who sees it | When |
|---|------|-------------|------|
| 1 | **New User Onboarding** | Every new registered user (clients) | Immediately after first login — shown as a full-screen modal. Cannot be skipped. |
| 2 | **Marketplace Partner Onboarding** | Internal team / admin | When a new link-selling marketplace is being integrated into the platform |

---

## Form 1 — New User Onboarding (5-Step Modal)

### Context & Behaviour
- Appears as a **full-screen overlay** (blurred backdrop) on top of the app.
- User **cannot access the app** until all 5 steps are completed.
- Has a **progress bar** at the top showing `Step X of 5` and `XX% Complete`.
- Navigation: **Back** and **Next/Complete** buttons at the bottom.
- Each step must be answered before the Next button becomes active (all fields required).
- On completion, data is saved to the database and the user enters the main app.

---

### Step 1 — Who Are You?

**Title:** `Welcome to LinkPricer! 👋`  
**Subtitle:** `Let's personalise your experience`  
**Question:** `What best describes you?`

| Field | Type | Options |
|-------|------|---------|
| User type | Single-select (checkbox style, only one can be active) | `SEO agency`, `Freelancer`, `In-house marketer`, `Brand owner`, `Other` |
| Custom user type *(conditional)* | Text input | Free text — appears only when "Other" is selected |

**Validation:** Must select one option. If "Other" is selected, the text field must not be empty.

---

### Step 2 — Budget

**Title:** `Budget Information`  
**Subtitle:** `Help us understand your budget`  
**Question:** `How much do you usually spend on link building each month?`

| Field | Type | Options |
|-------|------|---------|
| Monthly spend | Single-select (checkbox style) | `Under €1,000`, `€1,000–€5,000`, `€5,000–€20,000`, `€20,000+` |

**Validation:** Must select one option.

---

### Step 3 — Biggest Challenge

**Title:** `Your Challenges`  
**Subtitle:** `Share your biggest pain point`  
**Question:** `What's your biggest challenge when buying backlinks?`

| Field | Type | Notes |
|-------|------|-------|
| Biggest challenge | Long text area (5 rows) | Placeholder: `Tell us about your main challenge...` |

**Validation:** Must not be empty.

---

### Step 4 — Priorities

**Title:** `What Matters Most`  
**Subtitle:** `What do you prioritise?`  
**Question:** `What matters most to you when choosing backlinks?`

| Field | Type | Options |
|-------|------|---------|
| Priority factors | Multi-select (checkboxes, pick any combination) | `Price`, `Website quality`, `Niche relevance`, `Speed`, `Transparency` |

**Validation:** At least one option must be selected.

---

### Step 5 — Current Workflow

**Title:** `Current Workflow`  
**Subtitle:** `How do you currently work?`  
**Question:** `How do you currently find and order backlinks?`

| Field | Type | Options |
|-------|------|---------|
| Current methods | Multi-select (checkboxes, pick any combination) | `Manually contacting sites`, `Using marketplaces`, `Through agencies`, `Mixed methods` |

**Validation:** At least one option must be selected.

---

### Step 5 — Final Action

On the last step the **Next** button is replaced by **Complete**.  
On click → data is submitted → user lands in the main `/app` dashboard.

---

### Data Stored (Database Fields)

| DB Column | Maps to | Type |
|-----------|---------|------|
| `user_type` | Step 1 selection | `varchar` |
| `user_type_other` | Step 1 free text (if "Other") | `text` (nullable) |
| `monthly_spend` | Step 2 selection | `varchar` |
| `biggest_challenge` | Step 3 text area | `text` |
| `priority_factors` | Step 4 selections | `text[]` (array) |
| `current_method` | Step 5 selections | `text[]` (array) |

---

## Form 2 — Marketplace Partner Onboarding (Internal Checklist)

### Context & Behaviour
- This is an **internal admin checklist** — not a user-facing UI form.
- Used by the LinkPricer team when onboarding a new link marketplace (e.g. a new guest posting site aggregator).
- Currently exists as a markdown document; the designer may be asked to turn this into a UI form in a future sprint.

---

### Section 1 — Basic Information

| Question | Notes |
|----------|-------|
| Marketplace name | |
| Website URL | |
| Do they have an API? | Yes/No |
| API documentation link | If yes |
| API rate limit | |

---

### Section 2 — Pricing Structure

| Question | Notes |
|----------|-------|
| Standard guest post price (General niche) | |
| iGaming / Gambling price | Sensitive niche |
| Adult price | Sensitive niche |
| CBD price | Sensitive niche |
| Crypto price | Sensitive niche |
| Loans / Finance price | Sensitive niche |
| Dating price | Sensitive niche |
| Trading / Forex price | Sensitive niche |
| Currency used | |
| Additional fees? | |
| Tax / VAT charged? | |
| Writing service available? | + fee if yes |

---

### Section 3 — Niche Restrictions

| Question |
|----------|
| Which niches do they **reject**? (gambling, adult, CBD, etc.) |
| Which sensitive niches do they **accept**? |
| Any topic restrictions within accepted niches? |

---

### Section 4 — Publication Details

| Question | Options / Notes |
|----------|-----------------|
| Publication types offered | Guest post, Sponsored post, Link insertion, Niche edit, Other |
| Link type | Dofollow, Nofollow, Mixed |
| Turnaround time (TAT) | |
| Max links per article | |
| Min/max word count | |
| Sponsored/paid disclosure required? | Yes/No |
| Link duration | Permanent / 1 year / Other |
| Other requirements or restrictions | |

---

### Section 5 — Payment

| Question | Options |
|----------|---------|
| Payment methods accepted | PayPal, Stripe/Credit Card, Bank Wire, Crypto, Other |
| Credit / prepay options? | |
| Payment terms | Upfront, Net 30, Other |

---

### Section 6 — Data Access

| Question |
|----------|
| How often is the domain inventory updated? |
| Can they provide a data export / feed? (CSV, API) |
| What domain metrics do they provide? (DA, DR, Traffic, etc.) |
| How are domain metrics sourced? |

---

### Section 7 — Technical Integration

| Question |
|----------|
| Do they have a staging / test environment? |
| Can they provide test API credentials? |
| Who is the technical contact for integration? |
| API response format? (JSON, XML, etc.) |

---

### Section 8 — Business Terms

| Question |
|----------|
| Affiliate / referral commission offered? |
| Terms of service link |
| Minimum order volume requirement? |
| Dedicated account manager? |

---

### Contact Details to Collect

| Field |
|-------|
| Primary contact name |
| Primary contact email |
| Technical contact email |
| Phone number *(optional)* |

---

## Notes for the Designer

1. **Form 1** is the priority — this is user-facing and triggers on every new signup.
2. The current implementation uses a plain card-based modal. The redesign should feel **premium and on-brand** while keeping the form steps clearly separated.
3. Step indicators (progress bar + "Step X of 5") must stay visible at all times within the modal.
4. The **Back** button should be visible but visually secondary (outlined/ghost style).
5. The **Next / Complete** button should be disabled and visually muted when validation fails.
6. For **Form 2** (Marketplace Onboarding), the team may want this turned into an admin UI panel in a future sprint — keep this in mind when designing the overall admin area, but it is not required immediately.
