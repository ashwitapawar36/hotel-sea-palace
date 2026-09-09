# Hotel Sea Palace — Frontend

A full mobile-first React (plain JavaScript, `.jsx` — no TypeScript) frontend for
the Hotel Sea Palace ordering app, built to match the original homepage design
(dark navy `#0D1117`, gold `#D4AF37`, Playfair Display headings, Poppins UI text).

**This is built mobile-first, for real phones.** On any screen ≤480px wide
(i.e. an actual phone) the app fills the whole viewport edge-to-edge, respects
the iPhone notch/home-indicator safe areas, disables pinch-zoom so it feels
like a native app, and every tap target (buttons, chips, cards) is sized for
thumbs. On a wider desktop browser it centers itself into a phone-sized column
purely so you can preview it — the moment you open it on your phone, or resize
a browser window narrow, it behaves like a normal full-screen mobile site.

## Getting started

This app now talks to the real backend in `/backend` (Express + PostgreSQL) —
menu, orders, and manager auth are no longer mocked.

```bash
npm install
```

Create a `.env` file (or `.env.local`) if the backend isn't running on the
default `http://localhost:5000/api`:

```
VITE_API_URL=http://localhost:5000/api
```

Then, with the backend set up and seeded (see `backend/README.md`):

```bash
npm run dev        # starts a local dev server (usually http://localhost:5173)
npm run build       # production build into /dist
```

Open it on your phone or shrink your browser to ~390–430px wide for the intended
mobile-first layout (it's centered on desktop so it's still easy to preview).

**Default manager login (dev seed data):** username `admin` or `manager`,
password `SeaPalace@123`. Change this before deploying anywhere real.

## What's inside

**Customer flow**
- `/` — Home (hero, today's specials, popular dishes, category shortcuts, about, contact)
- `/menu` — Full menu with search + category chips (Today's Specials, Seafood, Chicken, Veg, Chinese, Rice, Desserts, Bar)
- `/cart` — Cart with quantity steppers and sticky subtotal/GST/total summary
- `/split-bill` — Assign dishes to diners (Rahul, Priya, Anjali) with live running totals
- `/bill` — Digital invoice (itemized, printable via the Download PDF button)
- `/order-success` — Confetti + order confirmation with prep time & table number
- `/feedback` — Star rating, comments, recommend Yes/No

**Manager / admin**
- `/manager/login` — Admin login (real JWT auth)
- `/manager/dashboard` — Revenue & recent orders, sourced from PostgreSQL
- `/manager/orders` — Order board with the full status lifecycle (Pending → Accepted → Preparing → Ready → Completed, or Cancelled), updates pushed live via Socket.IO
- `/manager/menu` — Full CRUD against `/api/menu/items`, including a pour-size editor for bar items
- `/manager/specials` — Toggle Today's Specials, persists to the `todays_specials` table
- `/manager/stock` — Toggle item availability, persists to `menu_items.is_available`
- `/manager/qr` — Real per-table QR codes (`/api/tables`) that deep-link guests to `/?table=N`

All six manager routes require an authenticated session (`RequireManager`) - the customer-facing pages never check this at all, and manager auth is entirely separate from anything a guest can access.

## Structure

```
src/
  theme.css                  design tokens (colors, fonts, spacing) + shared classes
  services/api.js             fetch wrapper for the backend (auth header
                               injection, error handling, multipart upload)
  services/socket.js          Socket.IO client, connects only with a manager JWT
  context/MenuContext.jsx     fetches live food/bar items + categories from the
                               backend for the customer-facing app
  context/CartContext.jsx     cart state, keyed by real UUIDs
                               ("<itemId>" or "<itemId>::<variantId>"), builds
                               the order payload sent to the API, and picks up
                               ?table= from a QR scan
  context/ManagerContext.jsx  real JWT login + profile hydration on refresh +
                               Socket.IO live order feed (REST poll as fallback)
  hooks/useManagerMenu.js     shared fetch/mutate hook for the manager
                               menu/specials/stock screens (all read the same
                               PostgreSQL-backed source of truth)
  components/RequireManager.jsx  route guard used by every /manager/* route
  components/                TopBar, DishCard (shared UI)
  pages/                      one file per customer-facing screen
  pages/manager/              one file per admin screen
```

## Backend wiring

Every screen in the app is backend-backed - there's no mock/static data flow
left in the customer or manager UI.

- **Menu** (`/`, `/menu`) - `GET /api/menu/items`, `GET /api/menu/categories`.
  Bar items carry a real `variants` array; the size chips on each card are
  `menu_item_variants` rows, not client-side guesses.
- **Checkout** (`/bill`) - `POST /api/orders`. The request only ever contains
  `menuItemId` / `variantId` / `quantity`; the server looks up every price
  from `menu_items` / `menu_item_variants` itself and ignores anything else.
- **Order status** - guests poll `GET /api/orders/:id/status` on the order
  confirmation screen; managers update it from `/manager/orders`, which
  `PATCH`es `/api/orders/:id/status` and broadcasts an `order_status_updated`
  Socket.IO event to every connected manager.
- **Real-time notifications** - placing an order writes a row to
  `notifications` for every manager and emits `new_order` over Socket.IO.
  The socket server only accepts connections carrying a valid manager JWT
  (verified in `io.use(...)`), so this channel never reaches a customer.
- **Bill / PDF invoice** - `POST /api/bills` generates a real PDF with
  `pdfkit` from the order's actual rows in `orders`/`order_items` and returns
  a downloadable URL; "Download PDF" on `/bill` links straight to it (falling
  back to the browser print dialog only if generation failed).
- **Table / QR** - `/manager/qr` renders a real QR per row of
  `restaurant_tables` pointing at `/?table=N`; `CartContext` picks that up on
  load and carries it through Split Bill → Order → Bill without the guest
  typing anything (they can also still type a table number by hand).
- **Manager auth** - `POST /api/auth/login` (bcrypt + JWT), `GET
  /api/auth/profile` rehydrates the session after a page refresh, every
  `/manager/*` route is gated behind it via `RequireManager`.

## Notes on what changed from the Figma export

The original Figma export rendered the homepage decoratively inside a fake iPhone
bezel (status bar, side buttons, etc.) — that's a Figma presentation trick, not
something a real deployed web app needs. This version keeps the exact same visual
language (colors, type, spacing, cards) but renders each screen as a real page,
wired up with React Router so the "Browse Menu", "Proceed to Split Bill",
"Generate Bills", etc. buttons actually navigate between screens, and cart state
is shared across pages via Context.

This build is **plain JavaScript** (`.jsx`/`.js` files) — no TypeScript, no build-time
type checking, nothing to compile away. If you open any file it reads like normal
React you'd hand-write.
