# Order Management UI/UX Design Specifications

This document outlines the working logic, data structures, and user flows for the **Order Management** module in the LinkPricer platform. It is written specifically for designers to understand what elements need to be styled, what states exist, and how users (Admins & Clients) interact with orders.

## 1. Overview
The Order Management page is the central hub to track customer purchases, update the status of guest posts, download content, monitor published links, and communicate directly with clients.

**Primary Goal:** Allow admins to quickly scan orders, filter, perform rapid inline updates, and communicate seamlessly with clients without leaving the platform.

---

## 2. Main Dashboard & Layout (Admin List View)

### Header & Top Controls
- **Page Title:** "Order Management" with a subtitle "Manage and update customer orders".
- **Global Actions:** `Export Orders` button (downloads a CSV based on the current filters).

### Filters
- **Search Bar:** Searches across *User Email, Domain Name, Article Title, and Order ID*.
- **Status Filter:** Dropdown to filter orders by current status.

### The Data Table
**Columns to Design:**
1. **User:** Email (primary) + Date of Order (secondary).
2. **Domain:** Target Domain name + Domain Rating (DR) indicator.
3. **Article / Pricing:** Article Title + Dual Pricing Display (e.g., "€150.00" on top, "$162.00" muted below).
4. **Status:** Interactive badge. Clicking it transforms it into an inline dropdown to change status.
5. **Link Monitoring:** Status badge (e.g. Active, Missing) + Indexation badge. Hover tooltip shows "Last checked" and "Next check".
6. **Published URL:** The live URL. Hovering shows an "Edit" icon to paste the URL directly inline.
7. **Actions (Icon buttons):**
   - **View Details & Chat** (Split panel icon)
   - **Chat Notification Badge:** A small red dot/badge on the View button if there are *unread messages* from the client.
   - **Download Content** (Download icon, *if applicable*)
   - **Edit Status** (Pencil icon)

---

## 3. Order Details & Chat Modal (Split View)

This is the most critical update. Rather than a simple pop-up, the Order Details should now be a **wide modal or a full-height slide-out panel** split into two distinct sections: **Order Info (Left)** and **Chat/Communication (Right)**.

### Left Side: Order Information
A clean, scrollable column containing the structured data.
1. **Meta:** Order ID, Order Date, Client Email, Full Name.
2. **Domain Details:** Target Domain, Marketplace Name, Niche/Category.
3. **Marketplace Guidelines (NEW):**
   *This section exposes deep database info to help admins verify the order meets the publisher's rules.*
   - **Expected TAT (Turnaround Time):** e.g., *48 Hours*
   - **Link Type:** e.g., *DoFollow, Permanent*
   - **Sponsored Tag:** e.g., *Not Required* or *Required*
   - **Example Post:** A clickable link to a previously published example.
   - **Rejected Niches:** e.g., *Adult, Casino, CBD* (Highlight these in red so admins immediately spot them).
4. **Link Details:** Target URL, Anchor Text (Click-to-copy functionality).
5. **Content Instructions:** Content Option (Uploaded, URL, or "We Write"), Word Count, Download File button.
6. **Special Requirements:** Client's custom notes at checkout.
7. **Pricing Breakdown:** Guest Post Price, Content Price, Total Amount.

### Right Side: Chat & Activity Interface
A dedicated column for communication.
1. **Message History:** A scrollable area showing the timeline of the order.
   - **Client Messages:** Left-aligned, light gray/blue bubble.
   - **Admin Messages:** Right-aligned, primary brand color bubble.
   - **System Events:** Centered, muted text (e.g., *"Order status changed to Published by Admin"*).
   - **Internal Notes (NEW):** Right-aligned, yellow/amber bubble. Clearly labeled "Internal Note - Hidden from Client".
2. **Input Area:** 
   - Text input box for typing messages.
   - Attachment icon (optional future proofing).
   - **Toggle/Switch:** "Reply to Client" vs "Add Internal Note". This dictates the color of the message bubble and who can see it.
   - Send button.

---

## 4. Client-Side Order Tracking (NEW)

Clients need transparency to reduce support tickets. On the client's "View Order" page, expose the hidden marketplace guidelines cleanly.

**UI Additions for Clients:**
- **Order Timeline:** Visual progress bar (Pending → Writing → Approved → Published).
- **Publisher Terms Card:** 
  - *Expected Turnaround:* 5 Days
  - *Link Attributes:* DoFollow, 12 Months
  - *Sponsorship Label:* Will be marked as "Sponsored"
- **Client Chat Interface:** Similar to the right-side admin panel, but they ONLY see public messages and system events, never internal notes.

---

## 5. Statuses & Color Guidelines

### Order Statuses
- **Pending / Waiting:** Yellow/Amber
- **Writing / In Progress:** Blue
- **Approved / Published / Completed:** Green
- **Cancelled:** Red

### Link Monitoring Statuses
- **Active:** Green (Check circle)
- **Modified:** Amber/Orange (Alert triangle - link exists but attributes changed)
- **Missing / Error:** Red (X circle)
- **Pending:** Gray (Clock)

---

## 6. User Experience (UX) Considerations
1. **Visual Hierarchy in Chat:** It is *critical* that "Internal Notes" look entirely different from "Client Replies" to prevent admins from accidentally sending private info to the client. Use distinct background colors (e.g., bright yellow for internal, standard blue for client).
2. **Inline Speed:** Ensure admins can still update statuses and URLs directly from the table list without opening the split-view modal if they don't need to chat.
3. **Empty Chat State:** If no messages exist, show an illustration and a prompt: "No messages yet. Send an update to the client."
4. **Truncation:** Target URLs and Published URLs can be extremely long. Ensure they truncate with an ellipsis (`...`) in the table, but are fully readable/copyable in the Details modal.
