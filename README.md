# Sanjaya Professional Tailors — ERP

A modern ERP web app for a Sri Lankan tailoring & professional suit rental business, built as a React + Vite single-page application. This is a **front-end prototype with in-memory dummy data** — no backend yet — designed so a backend (Node/Django/Laravel + database) can be wired in later without changing the UI.

## What's included

Rebuilt and expanded from the client's existing system (Items, Customers, Orders, Due Returns Report) with new modules suited to running the full business:

- **Dashboard** — revenue vs expenses trend, inventory mix, active rentals, due-today alerts, recent orders
- **Items** — inventory of coats, trousers, vests, national wear, shirts & accessories, with category/status filters and add/edit
- **Customers** — customer directory with rental history
- **Orders** — all orders with status & dry-clean tracking, and a guided "Add Order" flow (pick customer → dates → browse available garments by category → payment)
- **Due Returns Report** — matches the client's original report, plus overdue-day and late-fee calculation, and one-click "Mark Returned"
- **Accounting** *(new)* — income, expense ledger (rent, salaries, fabric purchases, utilities, dry cleaning, etc.), category breakdown chart, profit & loss snapshot
- **Reports** *(new)* — revenue trend, item utilization (which garments earn the most), top customers, overdue balances
- **Login** — a demo authentication screen gates the whole app. Credentials are checked against the seeded team members in `mockData.js`; the login screen shows one-tap demo accounts for each role
- **Organization** — team members and roles (Admin, Manager, Accountant, Staff) with permission summaries, for a **single business location**
- **Settings** — business profile (name, reg. no., VAT, address, currency, late-fee rate), configurable item & expense categories
- **Confirmation dialogs** — every delete, and every save-on-edit (items, customers, order status changes, dry-clean toggle, user role changes, user removal) asks for confirmation before applying, via a single reusable `useConfirm()` hook
- **Invoicing** — submitting a new order generates a formatted invoice immediately, which can be printed (dedicated print stylesheet that hides everything but the invoice) or downloaded as a PDF. The PDF is built natively with `jsPDF`'s own text and drawing API (not a screenshot), so it has crisp, selectable text and a small file size. Every existing order also has a print/download invoice action in the Orders list

## Design

A distinct visual identity built around the tailoring trade: a charcoal-navy sidebar (suiting fabric), a brass accent (tailor's buttons), a warm ivory canvas (fabric swatch paper), and a "ticket edge" stitched-border motif on cards and invoices. Type pairs a **Fraunces** display serif with **Inter** for UI text and **IBM Plex Mono** for invoice/reference numbers.

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

To build for production:

```bash
npm run build
npm run preview
```

## Demo login credentials

The login screen (`/login`) also shows these, with a one-tap "Use" button per role:

| Role       | Email                          | Password     |
|------------|---------------------------------|--------------|
| Admin      | sanjaya@sanjayatailors.lk       | admin123     |
| Manager    | ruwani@sanjayatailors.lk        | manager123   |
| Accountant | kasun@sanjayatailors.lk         | account123   |
| Staff      | nadeesha@sanjayatailors.lk      | staff123     |

Sessions persist across page refreshes via `localStorage` (just the logged-in user's ID — no tokens, since there's no real backend yet). Sign out from the account menu in the top right.

## Project structure

```
src/
  components/
    layout/       Sidebar, Topbar
    ui/            Reusable primitives (Card, Button, Modal, Badge, StatCard, form fields)
    RequireAuth.jsx Route guard — redirects to /login when not authenticated
    InvoiceDocument.jsx / InvoiceModal.jsx  Printable invoice + print/download actions
  context/
    AppContext.jsx  In-memory data store + CRUD actions (items, customers, orders, expenses, users)
    AuthContext.jsx Demo login/logout, session persistence, current user
    ConfirmContext.jsx Global confirm-before-delete/edit dialog (useConfirm())
  data/
    mockData.js     All seed/dummy data, including demo user passwords — swap this out or replace AppContext with real API calls
  pages/             One file per route (Login.jsx is public; everything else requires auth)
  utils/
    format.js        LKR currency formatting, date formatting helpers
    pdf.js            Native jsPDF invoice generator
```

## Connecting a real backend later

All reads/writes currently go through `src/context/AppContext.jsx`. To add a backend:

1. Replace the `useState` seed data in `AppContext.jsx` with API calls (e.g. `fetch`/`axios`) inside `useEffect`.
2. Replace each `addX` / `updateX` / `deleteX` function body with the matching API request, keeping the same function signatures so no page components need to change.
3. Replace `AuthContext.jsx`'s `login()` with a real request to your auth endpoint (e.g. issuing a JWT), and store the token instead of a plain user ID in `localStorage`. The `roles`/permissions model in Organization is already shaped for this.

## Notes

- **This login is a front-end demo only** — passwords live in plain text in `mockData.js` and are checked in the browser. There is no real authentication server, hashing, or session security. Do not reuse this login logic as-is once a backend is connected — replace it per the note above.
- This is set up as a **single business location** — one shop, multiple team members with roles. If the business later opens a second branch, the natural extension point is adding a `branches` collection back into `AppContext.jsx` (items, orders and expenses would each gain a `branchId`) and a location switcher in the topbar.
- All data is seeded in `src/data/mockData.js` and lives only in memory — refreshing the page resets it.
- Currency is Sri Lankan Rupees (LKR) throughout.
- "Today" in the seeded due-returns data is set to **22 Aug 2026** to match the sample invoices; update this when the app is running live.
