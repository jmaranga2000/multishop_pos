# MultiShop POS

An offline-first, multi-shop point-of-sale application built with Next.js, Mongoose, signed-cookie authentication, Dexie/IndexedDB, Web Push, and SMTP queues.

## What is implemented

- A central administrator account and one authenticated account per physical shop
- Server-side role enforcement and shop isolation
- Administrator dashboards for shops, products, inventory, sales, reports, notifications, devices, and synchronization
- Touch-friendly shop POS, register, expenses, transfers, refunds, stock, and sales views
- Offline product and stock snapshots in IndexedDB
- Persistent offline cash sales with idempotent MongoDB synchronization
- Stock, register, sale, refund, and transfer workflows protected by MongoDB transactions
- Low, critical, and out-of-stock alerts
- SMTP and Web Push queues
- Weekly inventory reports with PDF and Excel exports
- PWA manifest, service worker, install prompt, update prompt, and offline fallback
- An idempotent MongoDB seed; production pages do not contain hardcoded business records

## Architecture

```text
src/
├── actions/
│   ├── admin/        # Administrator-only Server Actions
│   └── shop/         # Shop-scoped Server Actions
├── services/
│   ├── admin/        # Administrator business workflows
│   ├── shop/         # Shop operational workflows
│   ├── jobs/         # Queue and weekly report jobs
│   └── shared/       # Auditing and cross-cutting logic
├── validators/
│   ├── admin/        # Administrator Zod input schemas
│   └── shop/         # Shop Zod input schemas
├── models/           # Typed domain model files, validation, indexes, and relations
├── lib/
│   ├── db.ts         # Native MongoDB query/relation/transaction data layer
│   ├── mongodb.ts    # Cached MongoDB connection
│   ├── offline/      # Dexie database and synchronization client
│   ├── notifications/# In-app, email, and push orchestration
│   └── reports/      # Weekly inventory and exports
└── app/              # Routes and database-backed UI
```

Pages read through query services. Mutations flow through Server Actions, Zod validators, domain services, and the Mongoose-backed data layer. UI code is kept away from direct database access.

MongoDB documents keep string `id` values for compatibility with offline-generated identifiers. Relationships are explicit reference fields, while compound and sparse indexes enforce business rules. Sales, stock changes, register reconciliation, transfers, refunds, and sync operations use Mongoose sessions.

## Requirements

- Node.js 20.9+
- npm 10+
- MongoDB 7+ installed locally, configured as a replica set for transactions, or MongoDB Atlas

MongoDB transactions require a replica set. Configure the installed server as a single-node replica set for development.

## Local setup

1. Create the local environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Set a long random `AUTH_SECRET` and a private `SEED_ADMIN_PASSWORD`.

3. Start the installed MongoDB service, then install dependencies, seed, and start the app:

   ```bash
   npm install
   npm run db:init
   npm run db:seed
   npm run dev
   ```

Open `http://localhost:3000`.

For MongoDB Atlas, replace `MONGODB_URI` with the Atlas connection string and keep retryable writes enabled.

## Administrator seed

The seed creates or updates the administrator using:

```env
SEED_ADMIN_EMAIL="jmaranga35@gmail.com"
SEED_ADMIN_PASSWORD=""
```

The password has no source-code default and must be supplied through the environment. Re-running the seed updates the administrator, demo shops, catalog, and inventory without duplicating them. Seeding is blocked when `NODE_ENV=production` unless `ALLOW_PRODUCTION_SEED=true` is explicitly set.

## Authentication

- There is no public registration.
- The administrator creates shop accounts and resets their passwords.
- Passwords and salesperson PINs use Argon2.
- Signed, HTTP-only cookies hold short session claims.
- Every request verifies the live MongoDB user record and password version.
- Suspending a shop invalidates its account sessions.
- Shop IDs are always derived from the authenticated session.

## Offline synchronization

1. A shop signs in online.
2. `/api/shop/bootstrap` stores that shop’s catalog and stock snapshot in IndexedDB.
3. Cash sales can be created offline within the authorized device window.
4. Every sale gets a UUID and idempotency key.
5. Reconnection submits queued records to `/api/shop/sync`.
6. The server commits the sale, items, payment, stock movements, and idempotency record in a MongoDB transaction.
7. Repeated submissions return the original result.
8. Stock, price, and product conflicts are retained for administrator review.

## Scheduled jobs

Call the protected endpoints with:

```http
Authorization: Bearer <CRON_SECRET>
```

Recommended Africa/Nairobi schedules:

```text
POST /api/jobs/process-queues      every 5 minutes
POST /api/jobs/weekly-inventory    Friday at 21:00
```

## Verification

```bash
npm run typecheck
npm run lint
npm run verify:models
npm run verify:architecture
npm run build
```

The architecture checks verify the page → action/service → native MongoDB data-layer boundaries and internal source imports.

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for the route and domain wiring map.

## Production checklist

- Use MongoDB Atlas or a managed replica set with authentication, TLS, backups, and monitoring.
- Store `MONGODB_URI`, `AUTH_SECRET`, SMTP, VAPID, and cron secrets in the deployment secret manager.
- Disable automatic index creation in production and review indexes during deployment.
- Serve over HTTPS for service workers and Web Push.
- Replace all development seed credentials.
- Add a verified payment-provider callback before enabling non-cash methods.
- Put scheduled job endpoints behind network controls in addition to the bearer secret.
- Add object storage for product images and expense receipts.
- Run browser and receipt-printer tests for the intended devices.
