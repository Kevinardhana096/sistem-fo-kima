# CLAUDE.md

## Project context

Sistem FO KIMA is a React/Vite web application for document archiving and tenant monitoring across ISP, customer, contract, invoice, and fiber route data.

## Architecture

- The application uses a full Supabase backend.
- The main app flow is frontend React/Vite → Supabase client/REST/RPC/Storage → Supabase Auth/PostgreSQL/RLS/Storage.
- There is no separate Node/NestJS backend for the main application flow.
- Valhalla is only a supporting service for the FO route planner feature.

## Supabase access rules

- Prefer existing Supabase access patterns in `frontend/src/lib/supabase.js` and `frontend/src/lib/api.js`.
- Do not use direct PostgreSQL for normal investigation, feature work, or data access.
- Use Supabase client, REST, RPC, Storage API, or reviewed SQL scripts intended for Supabase SQL Editor.
- Only use direct PostgreSQL when the user explicitly asks for database administration/schema-level access.
- Never print secrets from `.env` files or Supabase keys in responses or logs.
- Redact sensitive columns such as password, token, secret, key, and hash when sampling data.

## Data and business rules

- `customers` stores tenant/customer data and the initial business relationship date.
- `isps` stores ISP/vendor data.
- `customer_isp_memberships` is the main customer-to-ISP relationship.
- `contracts` is the source of truth for customer contract number, period, package, core allocation, and status.
- `contract_versions` stores optional snapshots/amendments and billing amounts used by monitoring.
- `invoices` is the source of truth for monthly billing monitoring status.
- `customer_route_versions`, `customer_route_points`, and `customer_route_history` store FO route planning and history.
- Customers with status `berhenti` imply inactive route/jalur handling.

## Development commands

```bash
npm --prefix frontend install
npm --prefix frontend run dev
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Implementation guidance

- Keep create/update payload mapping in `frontend/src/lib/api.js`; do not send raw form payloads directly to Supabase.
- Preserve camelCase UI to snake_case database mapping conventions.
- Respect Supabase RLS and role-based access behavior.
- Production SQL scripts must be idempotent and reviewed before being run in Supabase SQL Editor.
- For frontend/UI changes, run the app and verify the affected flow in the browser when possible.
