# Hotel Sea Palace - Implementation Progress

## Completed Changes
1. **Database & Migrations**:
   - Created and executed `backend/database/migration-revisions.sql`:
     - Dropped legacy strict unique constraint on `visit_bills(visit_id)` to support bill revisions.
     - Added `status`, `is_active`, `revision`, `pdf_url`, and `superseded_at` columns with partial unique index `idx_visit_bills_active ON visit_bills(visit_id) WHERE is_active = TRUE`.
     - Added snapshot preservation columns `item_name`, `variant_label`, `is_alcoholic` to `order_items` and backfilled historical data.
   - Updated `backend/database/init.js` with idempotent DDL for fresh installations.

2. **Backend Services & API**:
   - **Visit & Billing Endpoints (`backend/routes/visitRoutes.js`)**:
     - `POST /api/visits/start`: Creates or restores independent browser visit using browser-token hash, defaulting to Table 1.
     - `GET /api/visits/:id`: Returns visit details, order rounds with items/statuses, active bill, and feedback status. Protected by visit token or manager auth.
     - `POST /api/visits/:id/bill`: Consolidated bill combining non-cancelled rounds, calculates combined taxes (Food: CGST 2.5% + SGST 2.5%, Bar alcoholic: VAT 10%, soft drinks non-alcoholic), stores item snapshots and rate breakdowns, with transactional row-level locking.
     - `GET /api/visits/:id/bill/pdf`: On-demand PDF generation from snapshot with download headers; does not mark orders paid or alter order status.
     - `POST /api/visits/:id/feedback`: Optional, visit-based feedback storage with duplicate prevention.
     - `POST /api/visits/:id/split-bill`: Exact paise-accurate split bill calculation matching consolidated snapshot.
     - Manager-only endpoints: `GET /api/visits/active`, `POST /api/visits/:id/reopen` (supersedes active bill, sets visit to open), `POST /api/visits/:id/close` (marks visit closed, rejects subsequent orders).
   - **Order Integrity (`backend/controllers/orderController.js` & `backend/routes/orderRoutes.js`)**:
     - Locks visit on order creation, validates `open` status, populates snapshot fields on `order_items`.
     - Deduplicates orders by `submission_key`.
     - Status updates and cancellations acquire row lock on `table_visits`.
     - Removed public payment bypass; protected `PATCH /:id/pay` with manager auth.
   - **Dashboard & Reporting (`backend/controllers/dashboardController.js`)**:
     - Metric renamed to "Order Value (Today)" using `Asia/Kolkata` timezone window.
     - Counts non-cancelled orders (paid or unpaid) without double-counting combined bills.
     - Top Dish calculation with deterministic tie-breaking.

3. **Frontend Customer & Manager Experience**:
   - **Main Entry & Visits (`src/App.jsx`, `src/context/CartContext.jsx`, `src/services/visits.js`)**:
     - Main URL `/` renders the original Home landing page directly (hero, restaurant information, specials, popular dishes, and Browse Menu button) without QR scan or URL parameter.
     - `/menu` route renders the full Menu page with category tabs and dish browsing.
     - Default Table 1 with independent visit token per browser stored in `localStorage`.
     - Unsent cart items persist across refreshes.
     - Graceful network error handling ("Unable to connect" with Retry).
   - **Customer Flow (`src/pages/Cart.jsx`, `src/pages/DigitalBill.jsx`, `src/pages/SplitBill.jsx`)**:
     - Round 1 button: "Place Order"; subsequent rounds: "Send Additional Items".
     - Live "My Orders" listing showing all submitted rounds and kitchen statuses.
     - "Split Bill" and "Request Final Bill" appear together in the sticky bottom bar on the cart/orders screen.
     - "Split Bill" allows preview splitting for all submitted, non-cancelled dishes before requesting the final bill, without placing orders, finalizing visits, generating PDFs, or recording payment.
     - Unsent cart items remain strictly excluded from the split until ordered.
     - Split choices (custom diner names, diner count, item assignments) are preserved across screen navigation and page reloads.
     - "Request Final Bill" retains confirmation of unsent cart items, optional feedback (Submit/Skip), and bill finalization.
     - If splitting was configured, final shares consistent with the finalized total are presented on Digital Bill; otherwise the normal combined bill is rendered without forcing a split.
     - Reopened visit banner with "Add More Items" link.
     - Closed visit banner with "Start Fresh Visit" reset button.
   - **Manager Dashboard & Order Management (`src/pages/manager/`)**:
     - Active visits listing distinguishing demo visitors sharing Table 1.
     - Kitchen status updates per round.
     - Manager-only Visit Reopen and Visit Close actions.
     - Dashboard displays "Order Value (Today)" and "Today's Orders" in `Asia/Kolkata` time.

## Tests Run & Validation Results
- **Automated Integration Test Suite (`backend/test_integration.cjs`)**:
  - `[PASS] 1. Two independent demo browsers` (separate tokens & orders on Table 1)
  - `[PASS] 2. Multiple rounds in one visit` (Round 1 & Round 2 order tracking)
  - `[PASS] 3. Duplicate clicks and lost-response retry` (same submission key returns existing order)
  - `[PASS] 4. Cancellation excluded from billing` (cancelled rounds omitted from final total)
  - `[PASS] 5. Finalization racing with submission/cancellation` (visit locking & consistent totals)
  - `[PASS] 6. Combined taxes and split totals` (Food 5% total vs Bar Alcoholic 10% VAT, exact paise split)
  - `[PASS] 7. Feedback Submit and Skip` (idempotent, no duplicates)
  - `[PASS] 8. PDF generation failure and retry` (valid PDF buffer generated on demand from snapshot)
  - `[PASS] 9. Reopening, bill revision, closure and fresh visit` (bill superseding, revision bump, closed rejection)
  - `[PASS] 10. Dashboard Asia/Kolkata date filtering & Order Value` (non-cancelled orders included)
  - `[PASS] 11. Manager active visits view` (lists rounds and distinguishes demo visitors)
  - `[PASS] 12. Public payment protection` (unauthenticated PATCH /pay rejected 401)
  - `[PASS] 13. Dish images check` (clean fallback handling, zero broken images)

4. **QR-Based Table Identification & Demo Fallback**:
   - **Table Resolution & State Flow (`src/context/CartContext.jsx`, `src/App.jsx`)**:
     - Wrapped `<BrowserRouter>` around `CartProvider` so URL query parameters are reactively monitored on location changes.
     - Reads table query parameter `?table=N` via URLSearchParams on app open and popstate/navigation.
     - Supported URLs: `/?table=1`, `/?table=2`, `/?table=3`, etc.
     - New valid table parameter in URL overrides any previously stored table.
     - Persists active table in `localStorage` under `sea-palace-active-table` across page refreshes and route navigations.
     - When table number switches, isolated table-specific cart, diners, dish split assignments, and active visit sessions are reloaded cleanly without data bleeding across tables.
     - All order creation payloads (`buildOrderPayload` & `submitOrderRound`) automatically include the active table number.
   - **Backend Table Validation (`backend/validators/orderValidators.js`, `backend/controllers/orderController.js`, `backend/routes/visitRoutes.js`)**:
     - `orderValidators.js` validates `body('tableNumber').exists().isInt({ min: 1 })`.
     - `orderController.js` looks up `restaurant_tables WHERE table_number = $1` and rejects missing/out-of-range tables with HTTP 400.
     - `visitRoutes.js` validates `tableNumber` is integer >= 1 and table exists in `restaurant_tables`, returning 404 if not found.
   - **Demo Fallback & Table Selector (`src/components/RequireTable.jsx`)**:
     - If the application is opened normally without `?table=` and no stored table exists (`tableStatus === 'unselected'`), renders a clean, dark/gold "Select Your Table" fallback screen with available restaurant tables (1..16).
     - If an invalid URL is opened (`?table=abc` or `?table=999`), renders "Table Not Found" with the table selection grid.
     - If the URL contains a valid table, directly renders the customer interface without ever showing the table-selection screen.
   - **Active Table Indicator**:
     - Active table number is displayed unobtrusively in UI headers across pages (`Home.jsx`, `Menu.jsx`, `Cart.jsx`, `SplitBill.jsx`, `DigitalBill.jsx`, `OrderSuccess.jsx`).
   - **Production QR URL Structure**:
     - QR codes encode dynamic domain URLs (`${window.location.origin}/?table=${tableNumber}`) without hardcoded localhost.

5. **Menu Item Images & Fallback Handling**:
   - **Database Schema Alteration**:
     - Added `image_url TEXT` column to `menu_items` table in PostgreSQL database via idempotent DDL (`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT; ALTER TABLE menu_items ALTER COLUMN image_url TYPE TEXT;`).
     - Updated `backend/database/schema.sql` and `backend/database/init.js` to ensure schema reproducibility.
   - **Royalty-Free Image Population**:
     - Created `backend/populate_images.cjs` and generated `backend/database/update_menu_images.sql`.
     - Populated all 398 active menu items with high-resolution, royalty-free Unsplash food and beverage images matched by dish name and beverage type (e.g. Paneer Tikka, Butter Chicken, Chicken Biryani, Kingfisher Beer, Mojito, Dal Makhani, Naan, etc.).
     - Preserved 100% of dish names, prices, categories, and UUIDs without any modifications.
   - **Frontend React Menu Card (`src/components/DishCard.jsx`)**:
     - Normalized `image_url` across `MenuContext.jsx` and `useManagerMenu.js` to support both `item.image_url` and `item.imageUrl`.
     - Updated `DishCard.jsx` to render `item.image_url` with `loading="lazy"` and graceful fallback handling: on image load failure or absence, renders an elegant dark/gold gradient placeholder featuring an `UtensilsCrossed` icon.

## Tests Run & Validation Results
- **Automated Integration Test Suite (`backend/test_integration.cjs`)**: All 13 tests passed 100%.
- **Table Identification & Validation Suite**:
  - `/?table=1` -> visit started on Table 1, order created with table_number: 1.
  - `/?table=2` -> visit started on Table 2, order created with table_number: 2.
  - URL table override -> switching from Table 1 to Table 3 overrides stored table in state and localStorage.
  - Demo fallback -> opening `/` without table parameter triggers "Select Your Table" fallback screen.
  - Invalid tables -> non-numeric (`?table=abc`) and out-of-range (`?table=999`) rejected with status 400/404.
  - Table persistence -> navigating away and refreshing retains active assigned table.
- **Menu Item Image Population Verification**:
  - Database verification confirmed 398 out of 398 menu items have valid direct image URLs.
  - Verified 0 dishes missing image URLs.
  - Verified zero alterations to dish names, prices, categories, or IDs.
- **Frontend Build (`npm run build`)**: Vite production bundle built successfully in 2.99s with 0 errors.

## Remaining Tasks & Blockers
- None. System is fully operational and deployment ready.
