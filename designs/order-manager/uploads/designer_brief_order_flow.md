# Linkpricer — Order Flow Designer Brief
### From "Buy" button to published article
*For a designer who has never used Linkpricer*

---

## 1. Context — what happens before this screen

The user is on the Domain Analysis page (`/app`). They have searched for a domain (e.g. `techcrunch.com`), expanded its marketplace panel, and found a marketplace with a price they like. They then click one of two buttons:

| Button | Label | What it means |
|---|---|---|
| **Managed** | "Buy $XXX" | Linkpricer handles everything — article writing, communication with the marketplace, publishing. The user pays Linkpricer. |
| **Direct** | "Buy Direct" | User is redirected to the marketplace to purchase themselves. Linkpricer still records the order. |

> **Note for the designer:** The primary user flow is always "Managed". That is the product's main value proposition. Direct is a secondary option.

When the user clicks **Buy (Managed)**, a **modal dialog** opens on top of the page. This is the Purchase Modal.

---

## 2. The Purchase Modal — overview

The modal title shows:
- **"Managed Service"** (for managed orders) or **"Direct Purchase"** (for direct)
- A subtitle: *"Complete your guest post order for techcrunch.com via Adsy"*

The modal is a single scrollable form broken into **4 sections**, always in this order:

```
┌─────────────────────────────────────┐
│  SECTION 1: Content Type & Pricing   │  ← only shown if niche prices exist
│  SECTION 2: Content Creation          │
│  SECTION 3: Order Summary             │
│  SECTION 4: Order Details Form        │
│  [ Cancel ]  [ Confirm Order ]        │
└─────────────────────────────────────┘
```

---

## 3. SECTION 1 — Content Type & Pricing

**Only shown if the domain has niche-specific pricing set.**

This is a **radio button group** where the user selects what type of content the article will be about. Each option shows its price on the right.

| Option | Description | When shown |
|---|---|---|
| **Regular Content** | Standard guest post. General topic. | Always shown |
| **iGaming Content** | Gambling / casino related article | Only if marketplace has iGaming pricing |
| **Adult Content** | Adult / mature content | Only if available |
| **CBD Content** | CBD / hemp products | Only if available |
| **Loan Content** | Financial / loan topics | Only if available |
| **Dating Content** | Dating apps / relationships | Only if available |
| **Crypto Content** | Cryptocurrency topics | Only if available |
| **Trading/Forex Content** | Forex trading platforms | Only if available |

Each option is a selectable card showing:
- Content type name (bold)
- Short description (muted text below)
- Price (bold, right-aligned)

Selecting a niche option changes the price used throughout the rest of the modal.

---

## 4. SECTION 2 — Content Creation

**Always shown.** This is where the user decides who writes the article.

Three options as selectable radio cards:

### Option A: "We'll provide the content"
- Linkpricer's team writes the article from scratch
- When selected, a **Word Count dropdown** appears below:
  - 500 words — $X
  - 750 words — $X *(default)*
  - 1,000 words — $X
  - 1,500 words — $X
  - 2,000 words — $X
- Pricing is **$0.05 per word** (e.g. 750 words = $37.50)
- This content price is added to the guest post price in the order summary

### Option B: "I'll provide my own content"
- The user already has a pre-written article
- When selected, a **file upload input** appears:
  - Accepted formats: `.txt`, `.doc`, `.docx`, `.pdf`
  - Shows selected filename after upload
- No content creation fee charged (content price = $0)

### Option C: "I have an article link"
- The user has their article already published somewhere else (e.g. a Google Doc or shared URL)
- When selected, a **URL input field** appears (required)
- No content creation fee charged

---

## 5. SECTION 3 — Order Summary

A grey summary box showing a live price breakdown. Updates in real-time as the user changes options in Sections 1 and 2.

| Line item | Description |
|---|---|
| **Service Type** | Badge: "Managed Service" or "Direct Purchase" |
| **Content Type** | Badge: "Regular" (grey) or niche name (red/orange for restricted niches) |
| **Guest Post Price** | The marketplace price for the selected content type |
| **Content Creation (X words)** | Only shown if Option A selected. Price = words × $0.05 |
| **Management Fee (15%)** | Only shown for Managed orders. 15% of (guest post + content) |
| **── separator ──** | |
| **Total** | Final amount in the user's currency, shown prominently |

**Pricing formula:**
```
subtotal = guest_post_price + content_creation_price
management_fee = subtotal × 0.15  (managed orders only)
total = subtotal + management_fee
```

---

## 6. SECTION 4 — Order Details Form

A standard form with the following fields. All marked with * are required.

### Always required fields:

| Field | Type | Description | AI Feature |
|---|---|---|---|
| **Contact Email** ✱ | Text/email | Pre-filled with the user's account email. Editable. | — |
| **Target URL** ✱ | URL input | The page on the buyer's website where the backlink should point. E.g. `https://myclient.com/services` | ✨ AI Suggestions dropdown — suggests relevant pages from the buyer's site based on the destination domain |
| **Anchor Text** ✱ | Text input | The clickable words of the link in the article. E.g. "best SEO services". | ✨ AI Suggestions dropdown — suggests natural anchor text phrases based on the target URL |

### Conditional fields:

| Field | Shown when | Description | AI Feature |
|---|---|---|---|
| **Article Title** ✱ | Content option = "We write" | The headline of the article Linkpricer will write. | ✨ AI Suggestions dropdown — suggests article titles based on domain, target URL, and anchor text |
| **Article File** ✱ | Content option = "I provide file" | File upload input (.txt/.doc/.docx/.pdf) | — |
| **Article URL** ✱ | Content option = "I have a link" | URL to the pre-written article | — |

### Always optional:

| Field | Type | Description |
|---|---|---|
| **Additional Requirements** | Textarea | Free text. Any special instructions: "Please include 2 internal links", "Do not mention competitors", etc. |

### AI Suggestion dropdowns (important design element):

When the user focuses on Target URL, Anchor Text, or Article Title fields, a **dropdown panel** appears below the input with AI-generated suggestions. Each suggestion is a clickable row. Selecting one fills the input.

The label above each of these inputs shows: `✨ AI Suggestions available`

Loading state: shows a spinner with "Generating suggestions..."

---

## 7. Modal footer — Action buttons

Two full-width buttons at the bottom of the modal:

| Button | Style | Action |
|---|---|---|
| **Cancel** | Outline / secondary | Closes the modal, no order placed |
| **Confirm Order** | Primary (accent colour) | Submits the order. Shows "Processing..." while loading. On success, modal closes and a toast notification confirms. |

**Validation:** If required fields are empty when "Confirm Order" is clicked, a red error toast appears: *"Please fill in all required fields."*

---

## 8. After order submission — Success state

On success:
- Modal closes automatically
- A **toast notification** appears in the corner: *"Order Confirmed! Your iGaming content order for techcrunch.com with platform-written content (750 words) has been submitted successfully."*
- The form resets to defaults

The user can then go to their **Orders page** to track the order status.

---

## 9. The Order Management Screen (Admin view)

This is the back-office screen at `/admin/orders`. Only Linkpricer staff see this. It is how the team processes, fulfills, and tracks every order.

### Page header:
- Title: **"Order Management"**
- Subtitle: "Manage and update customer orders"
- **"Export Orders" button** (top right) — downloads all orders as a CSV file

### Filters bar:

| Filter | Type | Options |
|---|---|---|
| **Search** | Text input | Searches across: user email, domain name, article title, order ID |
| **Status** | Dropdown | All · Pending · Writing · Approved · Waiting for Publication · Published · Cancelled |

---

### Orders table — columns:

| Column | What it shows |
|---|---|
| **User** | Client's email address + order creation date (e.g. "3d ago") |
| **Domain** | The domain the guest post is on + Domain Rating (DR) below it |
| **Article** | Article title (or "Custom Article" if user uploaded) + total price in EUR and USD |
| **Currency** | A badge showing "EUR" (blue) or "USD" (green) — the currency the order was placed in |
| **Status** | Coloured status badge. Clicking it opens an inline dropdown to change status |
| **Link Monitoring** | Whether the published link is being monitored (see Section 10) |
| **Published URL** | The live URL where the article was published. Editable inline. |
| **Actions** | Icon buttons: View Details · Download Content · Start Monitoring |

---

### Order Statuses — full list:

| Status | Colour | Meaning |
|---|---|---|
| **Pending** | Yellow | Order just submitted, not yet assigned |
| **Writing** | Blue | Content team is writing the article |
| **Approved** | Green | Article written and approved internally |
| **Waiting for Publication** | Purple | Article sent to the marketplace, waiting for the website owner to publish it |
| **Published** | Emerald/Green | Article is live on the website. Published URL is entered. |
| **Cancelled** | Red | Order was cancelled |

> Status transitions are done inline — clicking the status badge opens a dropdown on the same row, no page navigation needed.

---

### Inline status editing:

- Clicking the status badge shows a **dropdown selector** directly in the table row
- Changing to **"Published"** requires a Published URL to already be set — if not, an error toast blocks the change
- The admin can also **edit the Published URL inline** by clicking an edit icon, typing the URL, and saving

---

### Order Details Modal (view mode):

Clicking the "View Details" (eye icon) on any row opens a **read-only detail modal** showing all fields of the order:
- Order ID, client name/email, date
- Domain, marketplace, DR
- Article title, target URL, anchor text, niche, word count
- Content option (who wrote it) + download button if file was uploaded
- Price breakdown
- Requirements
- Published URL (if available)
- Review notes (internal notes the admin added)

---

### Notes Modal:

An admin can click an "Edit Notes" icon to open a textarea modal and add internal notes to any order. These notes are not visible to the client.

---

## 10. Link Monitoring (post-publication feature)

Once an order is marked **Published** and a Published URL is entered, an admin can click **"Start Monitoring"** to activate automatic link checking.

The system then checks every 7 days whether the backlink is still live on the published page.

### Link Monitor statuses (shown as a badge in the orders table):

| Status | Icon | Colour | Meaning |
|---|---|---|---|
| **Pending** | Clock | Grey | Monitoring set up, first check not done yet |
| **Active** | Green checkmark | Green | Link is live and found |
| **Missing** | Red X | Red | Link was removed from the page |
| **Modified** | Warning triangle | Amber | Link exists but has been changed (e.g. switched to Nofollow) |
| **Error** | Red X | Red | System could not check the URL |

### Additional monitoring data (shown in tooltip):
- Last checked: "3d ago" / "Today"
- Next check: "in 4d" / "in 2h" / "Overdue"

### Indexed status:
- **✓ Indexed** (green badge) — the article page has been indexed by Google
- **⏳ Not Indexed** (yellow badge) — page not yet in Google's index

---

## 11. CSV Export — what columns are included

When the admin clicks "Export Orders", the CSV contains:

| Column | Example value |
|---|---|
| Order ID | `ord_abc123` |
| Order Date | `May 5, 2026` |
| Client Email | `client@agency.com` |
| Client Name | `John S.` |
| Domain | `techcrunch.com` |
| Marketplace | `Adsy` |
| Content Option | `We Write` / `Client Provided` |
| Word Count | `750` |
| Article Title | `Best SEO Tools in 2026` |
| Target URL | `https://client.com/seo` |
| Anchor Text | `best SEO tools` |
| Requirements | `Include 2 internal links` |
| Niche | `General` / `iGaming` / `Crypto` |
| Guest Post Price | `€120.00` |
| Content Price | `€37.50` |
| Total Amount | `€181.13` |
| Status | `Published` |
| Published URL | `https://techcrunch.com/article` |

---

## 12. Design instructions for the redesign

### Purchase Modal:
- The modal is currently a scrollable vertical stack with no visual separation between sections. Design it with **clear visual zones** — each section should feel like its own card/block.
- The **pricing radio cards** (Section 1) should make the price extremely visible. Right-align the price in a large, bold font. Restricted niches (iGaming, Adult) could use a subtle warning colour to indicate premium pricing.
- The **Order Summary box** should update with a micro-animation when values change (e.g. slide-count price changing as word count is adjusted).
- The **AI suggestion dropdowns** are a key differentiator feature. Make them feel premium — styled like a popover with a sparkle icon header. Do not let them look like a plain browser autocomplete.
- The **Confirm Order button** is the most important element in the modal. It must be the most visually dominant element. Consider adding the final price directly on the button: "Confirm Order — $181.13"

### Admin Order Management:
- The table is dense. Design it for **power users who scan quickly** — strong visual hierarchy between the most-changed columns (Status, Published URL) and the read-only informational ones.
- The **inline status editing** (clicking the badge) is a core workflow action. Make the badge look interactive — a subtle cursor change, border, or edit icon indicator.
- **Link monitoring statuses** should be visually distinct from order statuses. Consider a different badge shape or icon system so admins immediately know they're looking at two different systems.
- The **Published URL** column needs a smart empty state — when no URL is entered yet, show an obvious "Add URL →" prompt that invites the admin to fill it in, rather than just a blank cell.
- Design for both the **empty state** (no orders yet) and the **loading state** gracefully.

### Glossary additions for order flow:

| Term | Plain English |
|---|---|
| **Anchor Text** | The visible, clickable words in a hyperlink. E.g. in "Click here to read more", the anchor text is "Click here to read more". |
| **Target URL** | The page the buyer wants to drive traffic to via the link. E.g. their client's product page. |
| **Managed order** | Linkpricer handles everything — writing the article, placing it on the marketplace, communicating with the site owner. The buyer pays one total price and waits for a confirmation. |
| **Direct order** | The buyer purchases directly on the marketplace themselves. Linkpricer still tracks the order. |
| **Niche pricing** | Some site owners charge extra if the article topic is in a restricted/competitive category (gambling, adult, crypto). The buyer must select the correct niche to get the right price. |
| **Published URL** | The actual web address of the live article once it has been published on the target website. |
| **Link Monitoring** | An automated service that checks every 7 days whether the backlink is still present on the published page. |
| **Indexed** | Whether Google has discovered and added the published article to its search index. Being indexed means the link can pass SEO value. |
