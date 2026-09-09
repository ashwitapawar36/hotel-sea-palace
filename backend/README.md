# Hotel Sea Palace Backend

This backend provides a production-style Node.js + Express + PostgreSQL foundation for the restaurant management application.

## Features

- Express server with Helmet, CORS, Morgan, and JSON parsing
- PostgreSQL connection via `pg`
- JWT-based manager authentication with bcrypt password hashing
- Structured routes, controllers, middleware, validators, and services
- SQL schema and seed scripts for a normalized restaurant data model
- Static uploads folder support

## Setup

1. Create a PostgreSQL database named `sea_palace`.
2. Copy `.env.example` to `.env` and update the values.
3. Install dependencies:

```bash
npm install
```

4. Initialize the database schema and seed data:

```bash
npm run db:init
```

5. Start the development server:

```bash
npm run dev
```

## API Endpoints

- `GET /health`
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `POST /api/auth/logout`
- `GET /api/menu/categories`
- `GET /api/menu/items?type=food|bar|all` — bar items include a `variants`
  array (`{ id, label, price }`) per pour size
- `POST /api/orders` — client sends `{ tableNumber, customerName, items: [{ menuItemId, variantId?, quantity }] }` only; price is always looked up server-side from `menu_items`/`menu_item_variants`, never trusted from the request
- `GET /api/orders/:id/status` — order + line items, with variant labels resolved
- `GET /api/orders` *(manager auth required)*
- `PATCH /api/orders/:id/status` *(manager auth required)*

## Default seeded manager login

```
username: admin     password: SeaPalace@123
username: manager   password: SeaPalace@123
```

Change these (or seed your own managers) before deploying anywhere real.
