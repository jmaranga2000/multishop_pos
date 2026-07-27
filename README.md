# MultiShop POS

A production-oriented, offline-first multi-shop point of sale starter built with Next.js, Supabase-hosted Postgres, Prisma, Auth.js credentials, Dexie/IndexedDB, Web Push, SMTP queues, React Icons and Lucide React.

## Implemented

- One central `ADMIN` account and one authenticated `SHOP` account per physical shop
- Server-side RBAC and shop isolation
- Administrator dashboard, shops, products, stock, sales, notifications, devices and synchronization monitoring
- Responsive shop dashboard and touch-friendly POS
- Offline product catalogue and shop inventory snapshot in IndexedDB
- Persistent offline cash sales with projected local stock
- Idempotent synchronization into the hosted Postgres database
- Conflict preservation for insufficient central stock, changed prices and deactivated products
- Automatic low, critical and out-of-stock alerts
- SMTP and Web Push queues
- Weekly inventory report generation with PDF and Excel exports
- PWA manifest, service worker, install prompt, update prompt and offline fallback
- Idempotent Prisma seed script; no business data is hardcoded in production pages


## Application architecture

The project uses feature-based boundaries rather than putting database mutations inside pages:

```text
src/
├── actions/
│   ├── admin/        # Manager-only Server Actions
│   └── shop/         # Shop-scoped Server Actions
├── services/
│   ├── admin/        # Business rules and Postgres transactions
│   ├── shop/         # Shop-specific operational workflows
│   └── shared/       # Audit logging and cross-cutting services
├── validators/
│   ├── admin/        # Zod input schemas for manager operations
│   └── shop/         # Zod input schemas for shop operations
├── lib/
│   ├── errors/       # Typed application errors
│   ├── ids/          # Receipt/transfer/refund number generation
│   ├── offline/      # Dexie database and synchronization client
│   ├── notifications/# In-app, SMTP and push orchestration
│   └── reports/      # Weekly inventory and export generation
└── app/              # Route layouts and database-backed UI pages
```

Implemented Server Action workflows include:

- Shop creation, activation/suspension and administrator password reset
- Product creation
- Stock receipt and manual stock adjustment with movement ledgers
- Salesperson PIN profile creation and activation control
- Stock transfer creation, dispatch and destination receipt
- Shop register opening and cash reconciliation
- Shop expense submission and administrator approval/rejection
- Shop refund requests and administrator full-refund processing

The service layer owns authorization-sensitive business logic, Prisma transactions, inventory reconciliation, notifications and audit logs. Pages call services for queries and Server Actions for mutations.

## Important scope note

Cash sales are fully implemented for online and offline operation. M-Pesa, card and bank transfer models and UI states are present, but a real payment-provider integration and verification callback must be added before those methods can be marked as verified in production.

## Requirements

- Node.js 22+
- npm 10+
- Supabase project with a Postgres database

## Local setup

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

For Supabase-hosted Postgres, configure your Supabase project and set `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

The seed script reads credentials from:

```env
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_SHOP_PASSWORD=
SEED_CASHIER_PIN=
```

Seed execution is blocked when `NODE_ENV=production` unless the explicit `ALLOW_PRODUCTION_SEED=true` override is supplied.

## Authentication model

- No public registration
- No shop self-service password reset
- The administrator creates shops and their login credentials
- The administrator resets shop passwords, which increments `passwordVersion` and invalidates existing sessions after server-side verification
- Shop IDs are always derived from the authenticated session

## Offline flow

1. A shop signs in online.
2. `/api/shop/bootstrap` stores only that shop's assigned products and stock snapshot in IndexedDB.
3. Cash sales can be created offline within the configured authorization window.
4. Each sale receives a UUID and idempotency key.
5. Reconnection triggers `/api/shop/sync`.
6. The server saves the sale, payment, item and stock movements inside a Postgres transaction.
7. Repeated submissions return the original idempotent response.
8. Conflicts are preserved and shown to the administrator rather than silently deleting sales.

## PWA and Web Push

Generate VAPID keys using the `web-push` CLI or your deployment secret manager and configure:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

The administrator must explicitly enable notifications from the Settings or Notifications page.

## SMTP

Configure the SMTP variables in `.env`. Checkout never waits for SMTP. Events are inserted into `EmailQueue`, then sent by the protected queue endpoint.

## Scheduled jobs

Configure your VPS scheduler, Vercel Cron, GitHub Actions or another scheduler to call these endpoints with:

```http
Authorization: Bearer <CRON_SECRET>
```

Recommended Africa/Nairobi schedules:

```text
POST /api/jobs/process-queues      every 5 minutes
POST /api/jobs/weekly-inventory    Monday at 08:00
```

## Database commands

```bash
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
```

## Production checklist

- Replace all development seed credentials
- Configure `NEXTAUTH_SECRET`, SMTP, VAPID and `CRON_SECRET`
- Run migrations rather than `db push`
- Serve over HTTPS; service workers and Web Push require a secure context outside localhost
- Configure automated database backups
- Add a real M-Pesa/Card provider integration before enabling those payment buttons
- Put job endpoints behind network controls in addition to the bearer secret where possible
- Review offline authorization duration and trusted-device revocation policies
- Add object storage for product images and uploaded expense receipts
- Add end-to-end tests for your exact target browsers and receipt printers

## Integration verification

The project includes architecture checks that prevent the disconnected action/service problem:

```bash
npm run verify:integration
npm run verify:architecture
```

`verify:integration` confirms that UI files do not import Prisma directly, every Server Action delegates to a service, and every action/service is imported. `verify:architecture` additionally parses all TypeScript files and verifies internal module exports and imports.

See [`docs/INTEGRATION.md`](docs/INTEGRATION.md) for the complete page → action/service → domain service → Prisma/IndexedDB wiring map.
