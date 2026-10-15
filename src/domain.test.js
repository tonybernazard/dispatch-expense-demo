import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialPolicy, seedExpenses, jobs, categories, cardTransactions,
  evaluateExpense, totals, transition, makeExport, mileageRate, amountOf,
} from './domain.js';

const expense = (overrides = {}) => ({
  id: 'test-1', date: '2026-10-12', merchant: 'Example merchant',
  category: 'Supplies', job: jobs[0].id, amount: 20,
  payment: 'Out of pocket', receipt: true, mapAttachment: false,
  missingReceipt: false, missingReason: '', exceptionNote: '', notes: '',
  miles: '', status: 'draft', deductiblePersonal: 0, cardId: '',
  tripPurpose: 'Site commissioning', location: 'Phoenix, AZ', dayFraction: 1, eligible: true,
  ...overrides,
});

test('fixture and policy exports are complete and all seeded records evaluate', () => {
  assert.ok(seedExpenses.length >= 6);
  assert.ok(jobs.length >= 2);
  assert.ok(categories.includes('Mileage'));
  assert.ok(cardTransactions.length >= 3);
  assert.equal(initialPolicy.receiptThreshold, 10);
  for (const item of seedExpenses) {
    const result = evaluateExpense(item, initialPolicy, seedExpenses);
    assert.ok(Array.isArray(result.errors));
    assert.ok(Number.isFinite(result.amount));
  }
});

test('receipt threshold is strictly below $10, not at or below', () => {
  assert.deepEqual(evaluateExpense(expense({ amount: 9.99, receipt: false }), initialPolicy).errors, []);
  assert.match(evaluateExpense(expense({ amount: 10, receipt: false }), initialPolicy).errors.join(' '), /receipt/i);
});

test('missing receipt requires both declaration and nonblank explanation', () => {
  for (const overrides of [
    { missingReceipt: false, missingReason: 'Lost receipt' },
    { missingReceipt: true, missingReason: '  ' },
  ]) {
    assert.ok(evaluateExpense(expense({ receipt: false, ...overrides }), initialPolicy).errors.length);
  }
  assert.deepEqual(evaluateExpense(expense({ receipt: false, missingReceipt: true, missingReason: 'Lost receipt' }), initialPolicy).errors, []);
});

test('meal cap requires exception explanation but preserves partial reimbursement', () => {
  const item = expense({ category: 'Meals', amount: 100 });
  const invalid = evaluateExpense(item, initialPolicy);
  assert.equal(invalid.cap, 75);
  assert.equal(invalid.reimbursable, 75);
  assert.match(invalid.errors.join(' '), /exception/i);
  const explained = evaluateExpense({ ...item, exceptionNote: 'Client dinner exceeded policy.' }, initialPolicy);
  assert.deepEqual(explained.errors, []);
  assert.equal(explained.reimbursable, 75);
  assert.equal(explained.employeeOwes, 0);
  assert.ok(explained.warnings.length);
});

test('flight cap and configured override affect eligible reimbursement', () => {
  const item = expense({ category: 'Flights', amount: 900, exceptionNote: 'Only available flight.' });
  assert.equal(evaluateExpense(item, initialPolicy).reimbursable, 650);
  assert.equal(evaluateExpense(item, { ...initialPolicy, flightCap: 1000 }).reimbursable, 900);
});

test('corporate cap excess and rejection never create employee debt', () => {
  const item = expense({ payment: 'Corporate card', category: 'Meals', amount: 100, exceptionNote: 'Client dinner.' });
  const result = evaluateExpense(item, initialPolicy);
  assert.equal(result.reimbursable, 0);
  assert.equal(result.employeeOwes, 0);
  assert.equal(evaluateExpense({ ...item, status: 'rejected' }, initialPolicy).employeeOwes, 0);
});

test('corporate personal spend becomes debt only after explicit approval recovery', () => {
  const corporate = expense({ payment: 'Corporate card', amount: 100, deductiblePersonal: 30 });
  assert.equal(evaluateExpense(corporate, initialPolicy).employeeOwes, 0);
  assert.equal(evaluateExpense({ ...corporate, recoveryAmount: 30 }, initialPolicy).employeeOwes, 0);
  assert.equal(evaluateExpense({ ...corporate, status: 'approved', recoveryAmount: 20 }, initialPolicy).employeeOwes, 20);
  assert.equal(evaluateExpense({ ...corporate, status: 'exported', recoveryAmount: 20 }, initialPolicy).employeeOwes, 20);
  assert.equal(evaluateExpense({ ...corporate, status: 'rejected', recoveryAmount: 30 }, initialPolicy).employeeOwes, 0);
  const pocket = evaluateExpense(expense({ amount: 100, deductiblePersonal: 30 }), initialPolicy);
  assert.equal(pocket.employeeOwes, 0);
  assert.equal(pocket.reimbursable, 70);
});

test('mileage chooses effective date inclusive, without using a future rate', () => {
  assert.equal(mileageRate('2026-01-01', initialPolicy), 0.725);
  assert.equal(mileageRate('2026-06-30', initialPolicy), 0.725);
  assert.equal(mileageRate('2026-07-01', initialPolicy), 0.76);
  assert.equal(mileageRate('2026-10-12', initialPolicy), 0.76);
  assert.equal(mileageRate('2025-12-31', initialPolicy), null);
  assert.equal(mileageRate('2026-02-30', initialPolicy), null);
  assert.equal(amountOf(expense({ category: 'Mileage', date: '2026-06-30', miles: 40, amount: 999 }), initialPolicy), 29);
  assert.equal(amountOf(expense({ category: 'Mileage', date: '2026-07-01', miles: 40 }), initialPolicy), 30.4);
});

test('mileage requires map evidence, positive distance, and a known date rate', () => {
  const item = expense({ category: 'Mileage', miles: 40, receipt: false, mapAttachment: true });
  assert.deepEqual(evaluateExpense(item, initialPolicy).errors, []);
  assert.match(evaluateExpense({ ...item, mapAttachment: false }, initialPolicy).errors.join(' '), /map/i);
  assert.match(evaluateExpense({ ...item, miles: -1 }, initialPolicy).errors.join(' '), /miles/i);
  assert.match(evaluateExpense({ ...item, date: '2025-12-31' }, initialPolicy).errors.join(' '), /rate/i);
});

test('per diem and actual meals cannot be claimed for the same date', () => {
  const meal = expense({ id: 'meal-1', category: 'Meals', amount: 30 });
  const allowance = expense({ id: 'perdiem-1', category: 'Per diem', amount: 80, receipt: false });
  assert.match(evaluateExpense(meal, initialPolicy, [meal, allowance]).errors.join(' '), /per diem/i);
  assert.match(evaluateExpense(allowance, initialPolicy, [meal, allowance]).errors.join(' '), /meals/i);
  assert.deepEqual(evaluateExpense(allowance, initialPolicy, [{ ...meal, status: 'rejected' }]).errors, []);
  assert.deepEqual(evaluateExpense(allowance, initialPolicy, [{ ...meal, date: '2026-10-11' }]).errors, []);
});

test('two per diem claims for the same day are blocked', () => {
  const item = expense({ category: 'Per diem', amount: 80 });
  assert.match(evaluateExpense(item, initialPolicy, [{ ...item, id: 'another-claim' }]).errors.join(' '), /per diem/i);
});

test('card transactions can be matched only once, including rejected reports', () => {
  const item = expense({ payment: 'Corporate card', cardId: cardTransactions[0].id });
  const duplicate = { ...item, id: 'duplicate', status: 'rejected' };
  assert.match(evaluateExpense(item, initialPolicy, [item, duplicate]).errors.join(' '), /already matched/i);
  assert.deepEqual(evaluateExpense(item, initialPolicy, [item, { ...duplicate, deleted: true }]).errors, []);
});

test('basic validation catches invalid dates, negative amounts, and unknown values', () => {
  for (const overrides of [
    { date: '2026-02-30' }, { amount: -1 }, { amount: 'abc' },
    { category: 'Unmapped category' }, { payment: 'Cash advance' },
    { deductiblePersonal: 200 }, { deductiblePersonal: -1 }, { job: '' },
  ]) assert.ok(evaluateExpense(expense(overrides), initialPolicy).errors.length, JSON.stringify(overrides));
});

test('currency is rounded to cents and totals distinguish payment obligations', () => {
  const rows = [
    expense({ id: 'a', amount: 100, deductiblePersonal: 20 }),
    expense({ id: 'b', amount: 200, payment: 'Corporate card', deductiblePersonal: 30, recoveryAmount: 30, status: 'approved' }),
    expense({ id: 'c', amount: 50, status: 'rejected' }),
  ];
  assert.deepEqual(totals(rows, initialPolicy), { total: 350, reimbursable: 80, employeeOwes: 30, corporate: 170 });
  assert.equal(amountOf(expense({ amount: 1.005 }), initialPolicy), 1.01);
});

test('submit, approve, and export form a valid immutable workflow', () => {
  const draft = expense();
  const submitted = transition(draft, 'submit');
  const approved = transition(submitted, 'approve', 'Reviewed.');
  const exported = transition(approved, 'export');
  assert.equal(draft.status, 'draft');
  assert.equal(submitted.status, 'submitted');
  assert.equal(approved.status, 'approved');
  assert.equal(exported.status, 'exported');
  assert.equal(exported.history.length, 3);
});

test('returned reports can be resubmitted and reviewer notes are required', () => {
  const submitted = expense({ status: 'submitted' });
  assert.throws(() => transition(submitted, 'return'), /note/i);
  const returned = transition(submitted, 'return', 'Please attach the receipt.');
  assert.equal(returned.status, 'returned');
  assert.equal(returned.reviewNote, 'Please attach the receipt.');
  assert.equal(transition(returned, 'submit').status, 'submitted');
  assert.throws(() => transition(submitted, 'reject'), /note/i);
});

test('rejected and exported states are terminal; invalid jumps are rejected', () => {
  const rejected = transition(expense({ status: 'submitted' }), 'reject', 'Duplicate claim.');
  for (const action of ['submit', 'approve', 'return', 'reject', 'export']) {
    assert.throws(() => transition(rejected, action, 'Note.'), /transition/i);
    assert.throws(() => transition(expense({ status: 'exported' }), action, 'Note.'), /transition/i);
  }
  assert.throws(() => transition(expense(), 'approve'), /transition/i);
});

test('accounting export contains only approved rows, GL codes and split amounts', () => {
  const csv = makeExport([
    expense({ id: 'approved-row', status: 'approved', amount: 50, merchant: 'Vendor, Inc.' }),
    expense({ id: 'draft-row' }),
    expense({ id: 'rejected-row', status: 'rejected' }),
    expense({ id: 'exported-row', status: 'exported' }),
  ], initialPolicy);
  assert.match(csv, /GL Code/);
  assert.match(csv, /Employee Reimbursement/);
  assert.match(csv, /Employee Owes/);
  assert.match(csv, /approved-row/);
  assert.match(csv, /"Vendor, Inc\."/);
  assert.ok(csv.includes(initialPolicy.glCodes.Supplies));
  assert.ok(!csv.includes('draft-row'));
  assert.ok(!csv.includes('rejected-row'));
  assert.ok(!csv.includes('exported-row'));
});

test('export refuses invalid approved rows and neutralizes spreadsheet formulas', () => {
  assert.throws(() => makeExport([expense({ status: 'approved', receipt: false })], initialPolicy), /cannot export/i);
  const csv = makeExport([expense({ status: 'approved', merchant: '=HYPERLINK("https://example.com")' })], initialPolicy);
  assert.ok(csv.includes("'=HYPERLINK"));
});

test('domain evaluation and totals do not mutate caller data', () => {
  const rows = [expense()];
  const before = JSON.stringify(rows);
  evaluateExpense(rows[0], initialPolicy, rows);
  totals(rows, initialPolicy);
  assert.equal(JSON.stringify(rows), before);
});

test('daily meal cap is shared across claims rather than applied per receipt', () => {
  const first = expense({ id: 'meal-a', category: 'Meals', amount: 50, status: 'approved' });
  const second = expense({ id: 'meal-b', category: 'Meals', amount: 50, exceptionNote: 'Extended site work.' });
  const rows = [second, first];
  assert.equal(evaluateExpense(first, initialPolicy, rows).reimbursable, 50);
  assert.equal(evaluateExpense(second, initialPolicy, rows).reimbursable, 25);
  assert.equal(totals(rows, initialPolicy).reimbursable, 75);
  assert.equal(evaluateExpense(second, initialPolicy, [second, { ...first, status: 'rejected' }]).reimbursable, 50);
  assert.match(evaluateExpense({ ...second, exceptionNote: '' }, initialPolicy, rows).errors.join(' '), /exception/i);
});

test('mileage plus fuel for the same job/date requires an exception note', () => {
  const mileage = expense({ id: 'mileage-1', category: 'Mileage', miles: 40, mapAttachment: true });
  const fuel = expense({ id: 'fuel-1', category: 'Fuel' });
  assert.match(evaluateExpense(mileage, initialPolicy, [mileage, fuel]).errors.join(' '), /fuel/i);
  assert.match(evaluateExpense(fuel, initialPolicy, [mileage, fuel]).errors.join(' '), /mileage/i);
  assert.deepEqual(evaluateExpense({ ...fuel, exceptionNote: 'Fuel was for the company generator.' }, initialPolicy, [mileage, fuel]).errors, []);
  assert.deepEqual(evaluateExpense(fuel, initialPolicy, [{ ...mileage, job: jobs[1].id }]).errors, []);
  assert.deepEqual(evaluateExpense(fuel, initialPolicy, [{ ...mileage, status: 'rejected' }]).errors, []);
});

test('per diem requires purpose, location, eligibility, and full or half day', () => {
  const item = expense({ category: 'Per diem', amount: 999, receipt: false });
  assert.equal(amountOf(item, initialPolicy), 80);
  assert.equal(amountOf({ ...item, dayFraction: 0.5 }, initialPolicy), 40);
  for (const overrides of [
    { tripPurpose: '' }, { location: '' }, { eligible: false },
    { dayFraction: 0.25 }, { dayFraction: undefined },
  ]) assert.ok(evaluateExpense({ ...item, ...overrides }, initialPolicy).errors.length, JSON.stringify(overrides));
});

test('approval requires a bounded explicit personal recovery decision and records it', () => {
  const item = expense({ payment: 'Corporate card', amount: 100, deductiblePersonal: 30, status: 'submitted' });
  assert.throws(() => transition(item, 'approve'), /recovery/i);
  assert.throws(() => transition(item, 'approve', 'Reviewed.', { recoveryAmount: 31 }), /recovery/i);
  assert.throws(() => transition(item, 'approve', 'Reviewed.', { recoveryAmount: -1 }), /recovery/i);
  const approved = transition(item, 'approve', 'Recover only the personal snack.', { recoveryAmount: 20 });
  assert.equal(approved.recoveryAmount, 20);
  assert.equal(approved.history[0].recoveryAmount, 20);
  assert.equal(evaluateExpense(approved, initialPolicy).employeeOwes, 20);
  assert.equal(transition(item, 'approve', 'Waived.', { recoveryAmount: 0 }).recoveryAmount, 0);
  assert.ok(evaluateExpense({ ...item, status: 'approved', recoveryAmount: 99 }, initialPolicy).errors.length);
});

test('approval freezes reimbursement and preserves earlier same-day approved amounts', () => {
  const prior = expense({ id: 'meal-z', category: 'Meals', amount: 50, status: 'approved', approvedReimbursable: 50 });
  const pending = expense({ id: 'meal-a', category: 'Meals', amount: 50, status: 'submitted', exceptionNote: 'Long site day.' });
  const before = evaluateExpense(pending, initialPolicy, [prior, pending]);
  assert.equal(before.reimbursable, 25);
  const approved = transition(pending, 'approve', 'Reviewed.', { reimbursable: before.reimbursable });
  assert.equal(approved.approvedReimbursable, 25);
  assert.equal(approved.history[0].reimbursable, 25);
  const rows = [approved, prior];
  assert.equal(evaluateExpense(prior, initialPolicy, rows).reimbursable, 50);
  assert.equal(evaluateExpense(approved, initialPolicy, rows).reimbursable, 25);
  assert.equal(totals(rows, initialPolicy).reimbursable, 75);
  assert.equal(evaluateExpense(approved, { ...initialPolicy, mealCap: 10 }, rows).reimbursable, 25);
  assert.equal(evaluateExpense(transition(approved, 'export'), initialPolicy, rows).reimbursable, 25);
});

test('reimbursement snapshots must be nonnegative and corporate approval never reimburses', () => {
  const item = expense({ status: 'submitted' });
  assert.throws(() => transition(item, 'approve', '', { reimbursable: -1 }), /reimbursement/i);
  assert.throws(() => transition(item, 'approve', '', { reimbursable: 999 }), /reimbursement/i);
  assert.throws(() => transition({ ...item, payment: 'Corporate card' }, 'approve', '', { reimbursable: 1 }), /reimbursement/i);
});

test('dynamic job IDs are accepted unless policy supplies an allowlist', () => {
  assert.deepEqual(evaluateExpense(expense({ job: 'j1' }), initialPolicy).errors, []);
  assert.deepEqual(evaluateExpense(expense({ job: 'j1' }), { ...initialPolicy, allowedJobs: ['j1', 'j2'] }).errors, []);
  assert.match(evaluateExpense(expense({ job: 'j3' }), { ...initialPolicy, allowedJobs: ['j1', 'j2'] }).errors.join(' '), /job/i);
});

test('export requires a nonblank GL mapping but missing mappings do not block submission', () => {
  const item = expense({ status: 'approved' });
  for (const glCodes of [{}, { Supplies: '' }, { Supplies: '   ' }, { Supplies: undefined }]) {
    const policy = { ...initialPolicy, glCodes };
    assert.deepEqual(evaluateExpense(item, policy).errors, []);
    assert.throws(() => makeExport([item], policy), /missing GL mapping.*Supplies/i);
    assert.ok(makeExport([{ ...item, status: 'draft' }], policy).startsWith('Expense ID'));
  }
});

test('approval freezes mileage and per diem gross amounts through policy changes', () => {
  const mileage = expense({ category: 'Mileage', miles: 40, mapAttachment: true, status: 'submitted' });
  const assessment = evaluateExpense(mileage, initialPolicy);
  const approved = transition(mileage, 'approve', 'Reviewed.', { amount: assessment.amount, reimbursable: assessment.reimbursable });
  assert.equal(approved.approvedAmount, 30.4);
  assert.equal(approved.history[0].amount, 30.4);
  const changed = { ...initialPolicy, mileageRates: [{ effectiveDate: '2026-01-01', rate: 0.99 }], perDiemRate: 120 };
  assert.equal(amountOf(approved, changed), 30.4);
  assert.equal(amountOf(transition(approved, 'export'), changed), 30.4);
  const perDiem = expense({ category: 'Per diem', dayFraction: 0.5, status: 'submitted' });
  const allowance = transition(perDiem, 'approve', '', { amount: 40, reimbursable: 40 });
  assert.equal(amountOf(allowance, changed), 40);
  assert.throws(() => transition(mileage, 'approve', '', { amount: -1 }), /amount/i);
  assert.throws(() => transition(mileage, 'approve', '', { amount: NaN }), /amount/i);
});
