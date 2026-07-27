# Action and Service Integration

The UI does not query the database directly. Each feature follows one of these paths:

```text
Server-rendered query
Page or layout → query service → Prisma → Postgres

Mutation
Page form → Server Action → Zod validator → domain service → Prisma transaction → Postgres

Offline POS
Client component → offline service → Dexie/IndexedDB → synchronization service → API route → domain service → Prisma transaction → Postgres
```

## Administrator modules

| Module | Page query service | Mutation actions |
|---|---|---|
| Dashboard | `services/admin/dashboard-service.ts` | Read-only |
| Shops | `services/admin/shop-service.ts` | `actions/admin/shop-actions.ts` |
| Products | `services/admin/product-service.ts` | `actions/admin/product-actions.ts` |
| Inventory | `services/admin/inventory-service.ts` | `actions/admin/inventory-actions.ts` |
| Transfers | `services/admin/transfer-service.ts` | `actions/admin/transfer-actions.ts` |
| Registers | `services/admin/register-service.ts` | Read-only administrator view |
| Salespeople | `services/admin/salesperson-service.ts` | `actions/admin/salesperson-actions.ts` |
| Expenses | `services/admin/expense-service.ts` | `actions/admin/expense-actions.ts` |
| Refunds | `services/admin/refund-service.ts` | `actions/admin/refund-actions.ts` |
| Notifications | `services/admin/notification-service.ts` | `actions/admin/notification-actions.ts` |
| Devices | `services/admin/device-service.ts` | `actions/admin/device-actions.ts` |
| Synchronization | `services/admin/synchronization-service.ts` | `actions/admin/synchronization-actions.ts` |
| Reports | `services/admin/report-service.ts` | `actions/admin/report-actions.ts` |
| Settings | `services/admin/settings-service.ts` | `actions/admin/settings-actions.ts` |

## Shop modules

| Module | Page/client service | Mutation action |
|---|---|---|
| Register | `services/shop/register-service.ts` | `actions/shop/register-actions.ts` |
| Expenses | `services/shop/expense-service.ts` | `actions/shop/expense-actions.ts` |
| Refund request | `services/shop/refund-service.ts` | `actions/shop/refund-actions.ts` |
| Incoming transfers | `services/shop/transfer-service.ts` | `actions/shop/transfer-actions.ts` |
| Profile | `services/shop/profile-service.ts` | Read-only |
| POS and stock | `services/offline/query-service.ts` and `services/offline/pos-service.ts` | IndexedDB transaction and sync queue |
| Synchronization | `services/offline/synchronization-service.ts` | `services/shop/offline-sync-service.ts` on the server |

## Infrastructure services

- `services/jobs/queue-processing-service.ts`
- `services/jobs/weekly-inventory-job-service.ts`
- `services/push/subscription-service.ts`
- `services/push/client-push-service.ts`
- `services/shop/bootstrap-service.ts`

Run the integration guard with:

```bash
npm run verify:integration
```
