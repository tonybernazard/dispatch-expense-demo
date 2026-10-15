# Real SQL API (local development)

Requires **Node.js 24.13 or later**, tested on Node 24.19.0. No npm backend dependencies, cloud account, database password, or API key is required. The API uses Node's built-in `node:sqlite` with a real on-disk SQLite database; the static preview uses a separate in-browser demo adapter.

From the repository root:

```sh
node server/index.mjs
# Separate terminal:
node --test server/*.test.mjs
```

API listens on `http://127.0.0.1:3001`. Set `PORT` to change it. Set `DATABASE_PATH` to an absolute path to select a different database. Default: `db/dispatch.sqlite`. Schema migration and synthetic seed run on first startup. Restarting preserves edited records. To reset, stop the server and remove only your disposable demo database and its `-wal` / `-shm` files, then restart. Do not use real financial or employee data.

## Connection and authentication boundary

Frontend requests may originate from localhost or 127.0.0.1. The backend binds to loopback. The `X-Demo-User` header deliberately simulates roles: `u1` employee, `u2` manager, `u3` accountant. Anyone running this demo can select any of those roles and view all synthetic records. This is **not authentication, authorization for production, SSO, or tenant isolation**. Do not expose this server to the public internet. No real payment, settlement, bank details, OAuth, or accounting integration is performed.

## Routes

- `GET /api/health`: SQLite health and demo flag
- `GET /api/bootstrap`: `{ demo, authNotice, currentUser, users, categories, jobs, glAccounts, policies, cardTransactions, expenses, receipts, reports, approvals, audit }`
- `POST /api/expenses`: create owner draft
- `PATCH /api/expenses/:id`: edit owner draft/returned expense, resetting it to draft
- `POST /api/expenses/:id/submit`: owner submits
- `POST /api/expenses/:id/approve`: manager approves submitted expense
- `POST /api/expenses/:id/return`: manager returns with `{ "note": "Required explanation" }`
- `POST /api/expenses/:id/reject`: manager rejects with `{ "note": "Required explanation" }`
- `POST /api/expenses/:id/accounting-ready`: accountant marks approved record ready
- `POST /api/card-transactions/:id/match`: owner matches draft via `{ "expenseId": "..." }`
- `POST /api/export`: accountant generates CSV and atomically changes accounting_ready to exported. Repeat requests include prior exported rows without duplicate audit events. This is a downloadable accounting file, not a payout.

Errors return `{ "error": "..." }` with 400, 401, 403, 404 or 409 as appropriate. Unknown unexpected server errors return a generic 500.

## Expense contract

Required create fields: `jobId`, `categoryId`, `merchant`, `date` (valid ISO YYYY-MM-DD), `amountCents` (positive integer, maximum 100000000). Currency is USD only.

Optional: `description`, `receiptId`, `reportId`, `cardTransactionId`, `paymentSource` (`employee` or `company_card`), `exceptionNote`, `missingReceipt`, `missingReceiptNote`, `miles`, `personalCents` (integer, 0..amountCents), `mapAttached`, `tripPurpose`, `location`, `eligible`, `dayFraction` (0.5 or 1).

Server-owned: `id`, `userId`, `status`, `mileageRateCents`, timestamps. For Mileage category (`travel`), `miles` is required and the server calculates `amountCents`, ignoring client amount/rate. No missing-year fallback is allowed.

Statuses: `draft`, `submitted`, `returned`, `approved`, `rejected`, `accounting_ready`, `exported`. Rejected expense is not a debt or recovery. Card-paid spend is not employee reimbursement. Explicit personal-use portions and manager-confirmed recovery are represented; actual debt collection and payroll recovery are not performed.

The demo company policy requires receipt metadata or a nonempty `missingReceipt: true` plus a nonempty `missingReceiptNote` at **$10 or more** (strictly below $10 is waived; Mileage and Per diem are exempt). Meals above $75 require `exceptionNote`, with the full submitted amount preserved. Employee reimbursement remains capped at approval; an exception note does not increase the configured cap. A manager approving either exception must pass `{ "acknowledgeException": true }`. These are demo company rules, not universal legal limits.

Receipt objects refer to synthetic filenames and metadata only. There is no upload endpoint or real file storage. Do not imply the fake PDF exists. Seeded employee and merchant identities are synthetic.

## SQL guarantees and scope

`db/001_initial.sql` creates migrations, users, jobs, gl_accounts, categories, policies, card_transactions, receipts, reports, expenses, approvals and audit. Foreign keys, money/status constraints, unique card match, and query indexes run in SQLite. Updates and audit entries share transactions. Parameterized queries protect all user input; dynamic table/column names come only from code-owned allowlists. Currency is integer cents; mileage rate uses fractional cents and rounds final expense cents once.

This is a **SQLite implementation**, not a tested PostgreSQL adapter. A PostgreSQL deployment needs a driver/connection pool, dialect changes for PRAGMA, AUTOINCREMENT and typeof checks, an authentication system, deployment secrets stored server-side, tenant-aware authorization, real receipt storage, migration orchestration, and production operational controls. Never put a SQL password into client-side Vite variables.

## Verification

`node --test server/*.test.mjs` covers disk persistence/reopen, strict receipt threshold, exception acknowledgment, role/status transitions, returned editing, accounting export idempotency, unique card matches and rollback, SQL injection as literal data, foreign-key/check constraints, effective-dated mileage, and actual HTTP requests including invalid JSON and remote-origin rejection.

## Expanded policy and accounting operations

- `PUT /api/categories/:id`: accountant updates `{ "glAccountId": "gl1" }` to an existing GL account; foreign key and audit enforced.
- `GET /api/totals`: approved/accounting_ready/exported-only `{reimbursableCents, employeeOwesCents, corporateBusinessCents}`; draft/submitted/rejected records do not count.
- `PUT /api/policies/:id`: accountant may edit `receiptThresholdCents`, `limitCents` (nullable), `mileageRateCents`, or `allowanceCents`. Nonnegative cents and SQL constraints are validated; audit records store the changes. This edits an existing demo policy, not a production effective-date administration system.
- `POST /api/reports/:id/submit|approve|return|reject|accounting-ready`: all contained expenses must have the applicable status. Actions and audit writes are atomic; any failure rolls back the whole report. Approval arguments apply to every report row; use individual approvals when rows need different recovery amounts.

Category IDs: `meals`, `flights`, `lodging`, `travel` (Mileage), `per_diem`, `fuel`, `parking`, `supplies`, `other`. Defaults: Meals $75, Flights $650, Per diem $80 per full day. Other categories have no cap until configured. These are fictional employer policy defaults.

Per diem requires `eligible: true`, `tripPurpose`, `location`, and `dayFraction`. At submission and approval, a second per diem or actual meal on the same employee/date is rejected; draft, returned and rejected claims do not conflict. The cap is $80 × dayFraction. Mileage requires `mapAttached: true` and employee payment. Mileage plus fuel on the same employee/job/date requires an explicit exception note and approver acknowledgment, allowing different-vehicle cases to be reviewed. These flags describe synthetic attachment evidence and eligibility declarations, not independently verified travel.

`personalCents` declares personal-use amount. Corporate-card personal use requires the approving manager to explicitly provide `recoveryAmountCents` between zero and the personal portion. Employee owed totals use only this approved recovery amount. A cap overage, missing receipt, or rejection never silently becomes employee debt. Out-of-pocket personal portions are excluded from reimbursement. `approvedReimbursementCents` is calculated and snapshotted at approval, so later cap edits do not rewrite approved reimbursement amounts. The CSV includes the approved reimbursement snapshot, personal portion and recovery separately.

Unrelated draft edits preserve the original mileage snapshot; changing miles, category or expense date recalculates it. Per diem allowance edits synchronize its daily cap.

Mileage snapshots: 2025 70¢; Jan 1–Jun 30 2026 72.5¢; Jul 1–Dec 31 2026 76¢ per mile. Sources: [IRS standard mileage rates](https://www.irs.gov/tax-professionals/standard-mileage-rates), [IRS Bulletin 2026-29 / Announcement 2026-11](https://www.irs.gov/irb/2026-29_irb). Future or preconfigured-date gaps are blocked rather than silently applying a guessed rate. This app uses these as configured employer benchmarks; reimbursement law depends on jurisdiction and employer policy.

Meals caps are per employee/calendar date across claims, not per receipt. Submission considers submitted and approved claims; approval allocates remaining allowance after already-approved claims and snapshots that reimbursement. Corporate meal business spend also consumes the daily allowance without automatically becoming employee debt. Per diem amount is computed on the server from configured daily allowance × dayFraction, ignoring client-entered amount. Unrelated edits preserve the calculated amount; relevant date/fraction edits recalculate it.
