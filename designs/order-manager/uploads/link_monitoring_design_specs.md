# Link Monitoring UI/UX Design Specifications

This document outlines the working logic, data structures, and user flows specifically for the **Link Monitoring** module. It serves as a guide for designing the interface that tracks whether purchased backlinks remain active, retain their SEO value, and get indexed by Google.

## 1. Overview & Goal
Once an order is marked as "Published" and a `liveUrl` is provided, the system automatically begins tracking it. The goal of this UI is to give admins (and eventually clients) instant visibility into the "health" of their backlinks, and to provide a detailed history of automated checks.

---

## 2. Main Dashboard Integration

In the primary Order Management table, Link Monitoring needs a dedicated, highly scannable column.

**Column Layout:**
- **Primary Badge:** The current health status (e.g., Active, Missing, Modified).
- **Secondary Badge (Optional/Small):** Google Indexation status (e.g., a small "G" icon that is either green for indexed or gray for not indexed).
- **Hover Tooltip:** When hovering over the primary badge, display:
  - *Last Checked:* e.g., "2 hours ago"
  - *Next Check:* e.g., "in 5 days"
  - *Days Live:* e.g., "45 days"

---

## 3. Link Health Detail View (Modal / Slide-out)

When a user clicks on the Link Monitoring badge (or accesses it via the Order Details panel), they should see a dedicated "Link Health" view.

### Section A: Current Health Summary (Top Cards)
A visually prominent section showing the current state:
- **Status:** Large colored badge (Active, Missing, etc.).
- **Google Index:** "Indexed" vs "Not Indexed" with the date it was first detected (`indexedAt`).
- **Days Live:** A counter showing how long the link has survived.
- **Manual Action:** A "Check Now" button (with a spinning state) to force an immediate re-check.

### Section B: Expected vs. Found (Comparison UI)
A clean layout (perhaps two columns) comparing what the client ordered versus what the system crawler actually found on the page.
- **Target URL:** *Expected:* `client-site.com/page` | *Found:* `client-site.com/page` (Green check or Red X)
- **Anchor Text:** *Expected:* "best seo tools" | *Found:* "best seo software" (Highlights mismatches)
- **SEO Attributes:** Shows found `rel` tags (e.g., `dofollow`, `sponsored`, `nofollow`). If it was supposed to be `dofollow` but `sponsored` is found, this should trigger a warning.

### Section C: Check History Timeline
A vertical timeline or minimalist table showing the historical log of automated checks (from the `linkMonitoringChecks` database table).
- **Row/Item Data:** Date/Time of check, Status outcome, HTTP Status Code (e.g., 200 OK, 404 Not Found), Response Time.
- **Error States:** If a check fails (e.g., site is down or link was removed), expand the row to show the exact `statusMessage` (e.g., *"Anchor text modified"* or *"Link removed from DOM"*).

---

## 4. Statuses & Color Guidelines

Link Monitoring relies heavily on color-coding for rapid scanning.

### Link Statuses
- **Active (Green):** Link is present, anchor matches, URL matches, attributes are correct. Icon: Checkmark circle.
- **Modified (Amber/Yellow):** Link is present, but something changed (e.g., anchor text is different, or a `nofollow` tag was added). Icon: Alert triangle.
- **Missing (Red):** The page loads, but the link is gone. Icon: X circle.
- **Error (Red):** The page itself is broken (e.g., 404 Not Found, 500 Server Error). Icon: Warning/Broken link.
- **Pending (Gray):** Order is published, but the crawler hasn't performed its first check yet. Icon: Clock/Spinner.

### Indexation Statuses
- **Indexed (Green):** Google has indexed the live URL.
- **Not Indexed (Gray/Amber):** Google has not indexed it yet.

---

## 5. UX Considerations
1. **Clarity on "Modified":** If a link is "Modified", the UI must make it blindingly obvious *what* changed. Do not make the user guess. Highlight the mismatch in the "Expected vs. Found" section.
2. **Client View:** Clients will also see this data. Ensure the language used in error messages is non-technical and helpful (e.g., instead of "DOM missing href", use "Link no longer found on the page").
3. **Empty States:** If an order is still "Writing", the Link Monitoring section should display a placeholder stating: *"Monitoring will begin automatically once the order is published."*
