# Dispatch — field expense operations

An original, fictional Northstar Field Services expense-management demo. React 19 + **real Material UI (MUI) Material community components**, with a dense graphite/indigo operations console. This is a separate project and does not modify Fieldnote.

## Run the public-style browser demo

Requires Node.js 24.13+ and npm.

```sh
npm ci
npm run dev
```

Open the Vite localhost URL. The default mode uses fictional fixtures and browser local storage. Choose Technician, Approver, Accounting or Admin in the top-right role selector. Role selection is explicitly simulated, not real authentication.

## Run the actual SQLite-backed mode

```sh
# Terminal 1: creates the real, local SQLite database and runs migrations/seeds
npm run dev:api

# Terminal 2: enables the frontend HTTP adapter
VITE_API_BASE_URL=http://127.0.0.1:3001 npm run dev
```

The API binds only to loopback. SQL mode loads database records and supports UI create/edit/submit, report submission, approval/return/rejection and accounting CSV export through the API. The integration test exercises the exact frontend adapter through HTTP into SQLite, then closes/reopens the database to verify persistence. No database credentials belong in Vite variables. See [server/API.md](server/API.md) for endpoint details and role headers.

The public GitHub Pages preview is **static browser demo mode**, not a hosted SQL deployment. The SQLite implementation is runnable locally and is not a tested PostgreSQL/MySQL adapter. SQL-mode report creation and policy administration are not exposed through the frontend; use seeded reports and documented administration endpoints. The browser-mode policy editor demonstrates configuration separately. Production deployment requires genuine identity, role/tenant authorization, secure receipt storage, immutable server audit records, migrations and operational controls.

## Demonstrated workflow

1. Technician creates an expense, assigns a named report and job, chooses category/payment source, and supplies receipt evidence or a missing-receipt explanation.
2. Mileage uses date-effective rates and requires a route map. Per diem uses a fictional company allowance and requires trip location, purpose and eligibility. Actual meals/per diem overlap is blocked; daily meals share a cap. Mileage/fuel overlap needs an explanation.
3. Submit one expense or a report. Approver reviews evidence, explicitly acknowledges exceptions, and approves, returns or rejects. Return/reject need reasons. Returned entries can be edited and resubmitted.
4. Personal corporate-card amounts require an explicit manager recovery decision. Rejection and cap overages never automatically create employee debt. Employee reimbursement and recovery are displayed separately. Approved reimbursement is snapshotted.
5. Accounting exports eligible approved records with job/GL information. SQL mode marks accounting-ready then exports transactionally; browser mode creates a local CSV. No payout occurs.

Additional screens show fixture card matching, configurable receipt/meal/flight/per-diem/mileage policies, preset-category GL mapping, mock integration contracts, safe SSO/reset simulations and an audit trail.

## Policy and security boundaries

- Receipt waiver is strictly **less than $10**, not less than or equal. This is fictional company policy, not an IRS receipt rule. Mileage uses map evidence and per diem uses eligibility declarations rather than purchase receipts.
- Default 2026 business-mileage benchmarks: $0.725/mile from January 1, $0.76/mile from July 1. Sources: [IRS table](https://www.irs.gov/tax-professionals/standard-mileage-rates), [Announcement 2026-11](https://www.irs.gov/irb/2026-29_irb). Employer rules and legal obligations vary.
- Actual-meal cap $75/day, flight cap $650/expense, company meal allowance $80/full day. Half-day allowance is supported. These are demo employer settings, not live GSA locality rates.
- QuickBooks/card-feed/SSO/bank-provider integrations are clearly labeled simulations. No OAuth tokens, passwords, bank-account details or real payment information are collected.
- Local receipt images can be previewed, and PDF/image evidence can be selected. Files are not uploaded to a server. Image blobs live in memory; only evidence flags, fictional expense text and demo state persist. After refresh, a persisted attachment flag is a demo declaration, not retained evidence. SQL receipt IDs reference synthetic metadata only.
- Only use synthetic data. Browser storage is not suitable for confidential financial or employee information. The local server's selectable `X-Demo-User` identity is deliberately not production authentication.
- Static audit data is editable local demo state. SQL actions and audit rows are transactionally recorded, but this is not a tamper-proof production audit system.
- No paid components, MUI X Pro/Premium, commercial fonts, live external financial API calls or automatic settlement.

## Verification and build

```sh
npm test                    # domain + SQLite API + frontend adapter integration
npm run test:coverage       # JSX MUI composition audit
npm run build              # produces dist/ with relative asset URLs
```

The MUI audit counts JSX element occurrences, excluding custom composition wrappers that themselves render MUI. Native file inputs are the only intrinsic UI exceptions. It is a source composition measure, not a claim about generated DOM or percentage of application logic. Current result is above 99%, exceeding the requested 95% target.

Automated checks cover receipt boundaries, missing explanations, effective-dated mileage, map evidence, meal/per-diem conflicts, daily caps, recoveries, immutable approvals, workflow transitions, GL validation, card-match uniqueness, SQL persistence, prepared statements/constraints, rollback, CORS, CSV safety and API adapter lifecycle.

The initial React tree also passes a server-render smoke check. Public-browser visual/interaction testing is a separate release check; automated policy tests alone do not establish visual correctness.

### Static publishing

GitHub Actions runs the tests, MUI audit and production build, then deploys only `dist/` to GitHub Pages. Build without `VITE_API_BASE_URL` for static demo mode. The deployment workflow is `.github/workflows/deploy.yml`. Vite uses relative URLs. Never publish `node_modules`, `.env` files, SQLite database files, WAL/SHM files, real receipt files or real customer data. The checked-in SQL seed is intentionally synthetic.

## Source map

- `src/main.jsx`: MUI UI, browser state and role workflows
- `src/domain.js`: pure policy/financial/workflow engine and fictional fixtures
- `src/api-adapter.js`: configured HTTP ↔ UI model translation
- `src/*.test.js`: domain and actual HTTP/SQLite adapter tests
- `server/`: local Node API, SQL service, API contract and tests
- `db/001_initial.sql`, `db/seed.sql`: schema, constraints and fictional seed
- `scripts/component-coverage.mjs`: reproducible MUI composition count

Design patterns were informed by official SAP Concur available-expense/report workflows. This is an independent design; it uses no Concur branding, logos or copied assets.
