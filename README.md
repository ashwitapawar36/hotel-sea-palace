# Hotel Sea Palace

A full-stack digital restaurant ordering and billing system for table-based dining. Guests scan or open a table-specific link, browse the menu, place multiple order rounds, and request one combined final bill. Managers receive live order notifications and manage orders, menu items, stock, specials, visits, and billing from a separate dashboard.

## Live Application

* Customer application: https://hotel-sea-palace.vercel.app
* Manager login: https://hotel-sea-palace.vercel.app/manager/login
* Backend health check: https://hotel-sea-palace.onrender.com/health
* Source repository: https://github.com/ashwitapawar36/hotel-sea-palace

The free backend may take a few seconds to respond after a period of inactivity.

## Features

### Customer features

* Table-specific access using QR links or `?table=N`
* Food and bar menus
* Menu search and category filters
* Today’s specials and popular dishes
* Mobile-first responsive interface
* Cart with quantity controls
* Multiple order rounds during one table visit
* Add more items after submitting an earlier order
* Order status tracking
* My Orders view for submitted rounds
* Final combined bill for the complete visit
* Split bill among multiple diners
* Customer feedback after the final order
* PDF bill generation and download
* GST and alcohol-tax calculation based on item type

### Manager features

* JWT-protected manager login
* Dashboard with order and revenue information
* Real-time new-order notifications
* Order status management:

  * Pending
  * Accepted
  * Preparing
  * Ready
  * Completed
  * Cancelled
* Order history and table information
* Menu item management
* Bar variant and pour-size management
* Today’s Specials management
* Stock and item-availability management
* Table QR-code management
* Visit and final-billing controls
* Payment-status tracking

## Customer Flow

1. Open the customer application using a table link or QR code.
2. Browse the food or bar menu.
3. Add items to the cart.
4. Place the first order round.
5. Continue browsing and add more items whenever required.
6. Place additional order rounds during the same visit.
7. View all submitted rounds under My Orders.
8. When finished ordering, request the final bill.
9. Submit or skip feedback.
10. Review the combined bill.
11. Split the bill if required.
12. Download the final PDF invoice.

Example table links:

```text
https://hotel-sea-palace.vercel.app/?table=1
https://hotel-sea-palace.vercel.app/?table=2
```

## Manager Flow

1. Open the manager login page.
2. Sign in using the manager account.
3. View new orders on the dashboard.
4. Update each order’s preparation status.
5. Monitor order value, revenue, and table activity.
6. Manage menu items, availability, specials, and bar variants.
7. Review the active visit for a table.
8. Allow the customer to request the final bill.
9. Track payment status separately from bill generation.
10. Close the visit after the customer leaves.

Manager credentials are intentionally not included in this README.

## Tax and Billing

The application calculates taxes on the server using prices stored in PostgreSQL.

* Food and non-alcoholic items use CGST and SGST.
* Alcoholic items use the configured alcohol tax rate.
* Cancelled orders are excluded from the final bill.
* Multiple order rounds belonging to one visit are combined.
* Bill generation does not automatically mark an order as paid.
* Payment status can be tracked separately by the manager.
* The final invoice is generated from database records, not client-supplied prices.

## Technology Stack

### Frontend

* React
* Vite
* React Router
* Plain JavaScript and JSX
* Context API
* CSS
* Socket.IO client
* Lucide icons

### Backend

* Node.js
* Express
* PostgreSQL
* Socket.IO
* JWT authentication
* bcrypt
* PDFKit
* Helmet
* CORS
* Express rate limiting

### Deployment

* Frontend: Vercel
* Backend: Render
* Database: Neon PostgreSQL

## Project Structure

```text
src/
├── components/
│   ├── RequireManager.jsx
│   ├── RequireTable.jsx
│   ├── DishCard.jsx
│   └── ...
├── context/
│   ├── CartContext.jsx
│   ├── MenuContext.jsx
│   ├── ManagerContext.jsx
│   └── ToastContext.jsx
├── hooks/
│   └── useManagerMenu.js
├── pages/
│   ├── Home.jsx
│   ├── Menu.jsx
│   ├── Cart.jsx
│   ├── SplitBill.jsx
│   ├── DigitalBill.jsx
│   ├── OrderSuccess.jsx
│   ├── Feedback.jsx
│   └── manager/
├── services/
│   ├── api.js
│   ├── socket.js
│   └── visits.js
└── App.jsx

backend/
├── config/
├── controllers/
├── database/
├── middleware/
├── routes/
├── validators/
├── server.js
└── package.json
```

## Backend API Overview

### Customer endpoints

```text
GET  /api/menu/items
GET  /api/menu/categories
GET  /api/menu/popular
POST /api/orders
GET  /api/orders/:id/status
POST /api/feedback
POST /api/bills
GET  /api/bills/:id
GET  /api/bills/:id/pdf
```

### Manager endpoints

```text
POST  /api/auth/login
GET   /api/auth/profile
GET   /api/orders
PATCH /api/orders/:id/status
GET   /api/notifications
GET   /api/dashboard
GET   /api/tables
GET   /api/visits
PATCH /api/visits/:id/status
```

## Local Setup

### Requirements

* Node.js
* npm
* PostgreSQL or a Neon PostgreSQL database

### Install frontend dependencies

```bash
npm install
```

### Install backend dependencies

```bash
cd backend
npm install
```

### Frontend environment variable

Create `.env.local` in the project root:

```env
VITE_API_URL=http://localhost:5000/api
```

### Backend environment variables

Create `.env` inside `backend/`:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
CORS_ORIGIN=http://localhost:5174
```

Never commit `.env` files or database credentials.

### Start the backend

```bash
cd backend
npm start
```

### Start the frontend

From the project root:

```bash
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5174
```

The backend normally runs at:

```text
http://localhost:5000
```

### Create a production build

```bash
npm run build
```

The generated frontend files are placed in:

```text
dist/
```

## Production Configuration

The deployed frontend uses:

```env
VITE_API_URL=https://hotel-sea-palace.onrender.com/api
```

The deployed backend must use:

```env
NODE_ENV=production
CORS_ORIGIN=https://hotel-sea-palace.vercel.app
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_production_jwt_secret
JWT_REFRESH_SECRET=your_production_refresh_secret
```

Do not add a trailing slash to `CORS_ORIGIN`.

## Security Notes

* Prices are always read from the database on the backend.
* Customer order requests cannot set their own prices.
* Manager routes require JWT authentication.
* Socket.IO accepts manager connections only when a valid JWT is supplied.
* Customer users do not connect to the manager notification socket.
* Invoice files are not intended to be publicly browsable.
* Secrets and database credentials must remain in environment variables.
* Change all development credentials before using the application in a real hotel.

## Deployment

The frontend is deployed automatically through Vercel when changes are pushed to the main Git branch.

The backend is deployed through Render and runs the Express server.

For a new deployment:

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

Then verify that:

* Vercel shows the frontend deployment as Ready.
* Render shows the backend service as Live.
* The health endpoint returns a successful response.
* The customer site can load menu data.
* The manager can log in and receive new-order notifications.

## Future Improvements

* Customer-facing approved review page
* Manager feedback and review moderation screen
* Online payment gateway integration
* Custom domain
* Persistent object storage for uploaded files
* Automated database backups
* Email or WhatsApp notifications
* Role-based manager permissions
* Production monitoring and error tracking

## License

This project is developed as an academic and portfolio project for Hotel Sea Palace.
