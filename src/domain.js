/** Fictional company policy. Rates are an employer-selected benchmark, not tax advice. */
export const initialPolicy = {
  name: 'Field expense policy',
  receiptThreshold: 10,
  mealCap: 75,
  flightCap: 650,
  perDiemRate: 80,
  mileageRates: [
    { effectiveDate: '2026-01-01', rate: 0.725 },
    { effectiveDate: '2026-07-01', rate: 0.76 },
  ],
  mileageRateSource: 'https://www.irs.gov/tax-professionals/standard-mileage-rates',
  glCodes: {
    Meals: '6100', Flights: '6110', Lodging: '6120', Mileage: '6130',
    'Per diem': '6140', Fuel: '6150', 'Parking & tolls': '6160',
    Supplies: '6200', Other: '6290',
  },
};

export const categories = ['Meals', 'Flights', 'Lodging', 'Mileage', 'Per diem', 'Fuel', 'Parking & tolls', 'Supplies', 'Other'];

export const jobs = [
  { id: 'job-canyon', code: 'CR-204', name: 'Canyon Ridge Retrofit' },
  { id: 'job-northstar', code: 'NS-118', name: 'Northstar Distribution' },
  { id: 'job-harbor', code: 'HP-073', name: 'Harbor Point Fit-out' },
];

export const cardTransactions = [
  { id: 'card-101', date: '2026-10-13', merchant: 'Mesa Supply Co.', amount: 184.32, cardLast4: '4242' },
  { id: 'card-102', date: '2026-10-12', merchant: 'Canyon Road Kitchen', amount: 92.4, cardLast4: '4242' },
  { id: 'card-103', date: '2026-10-10', merchant: 'Summit Air', amount: 728, cardLast4: '4242' },
  { id: 'card-104', date: '2026-10-14', merchant: 'Desert Fuel Stop', amount: 67.18, cardLast4: '4242' },
  { id: 'card-105', date: '2026-10-14', merchant: 'Copper House Hotel', amount: 169, cardLast4: '4242' },
];

const fixture = (values) => ({
  id: '', date: '2026-10-13', merchant: '', category: 'Supplies', job: jobs[0].id,
  amount: 0, payment: 'Out of pocket', receipt: true, mapAttachment: false,
  missingReceipt: false, missingReason: '', exceptionNote: '', notes: '',
  miles: '', status: 'draft', deductiblePersonal: 0, cardId: '', ...values,
});

export const seedExpenses = [
  fixture({ id: 'exp-1048', merchant: 'Mesa Supply Co.', amount: 184.32, payment: 'Corporate card', cardId: 'card-101', status: 'approved', approvedAmount: 184.32, approvedReimbursable: 0, notes: 'Fasteners and safety supplies for the west wing.' }),
  fixture({ id: 'exp-1047', date: '2026-10-12', merchant: 'Canyon Road Kitchen', category: 'Meals', amount: 92.4, payment: 'Corporate card', cardId: 'card-102', status: 'submitted', exceptionNote: 'Crew dinner after the delayed concrete inspection.', notes: 'Three-person field crew.' }),
  fixture({ id: 'exp-1046', date: '2026-10-12', merchant: 'Site visit · round trip', category: 'Mileage', amount: 0, miles: 86.4, receipt: false, mapAttachment: true, status: 'approved', approvedAmount: 65.66, approvedReimbursable: 65.66, notes: 'Office to Canyon Ridge and back.' }),
  fixture({ id: 'exp-1045', date: '2026-10-11', merchant: 'Northstar field allowance', category: 'Per diem', job: jobs[1].id, amount: 80, receipt: false, status: 'approved', approvedAmount: 80, approvedReimbursable: 80, tripPurpose: 'Northstar site commissioning', location: 'Flagstaff, AZ', dayFraction: 1, eligible: true, notes: 'Full-day site work. No actual meal expenses claimed.' }),
  fixture({ id: 'exp-1044', date: '2026-10-10', merchant: 'Summit Air', category: 'Flights', job: jobs[1].id, amount: 728, payment: 'Corporate card', cardId: 'card-103', status: 'returned', reviewNote: 'Please explain the fare above the $650 cap.', notes: 'Travel to Northstar commissioning.' }),
  fixture({ id: 'exp-1043', date: '2026-10-10', merchant: 'City Parking', category: 'Parking & tolls', job: jobs[2].id, amount: 8.5, receipt: false, status: 'draft' }),
  fixture({ id: 'exp-1042', date: '2026-10-09', merchant: 'Harbor Tool Rental', category: 'Supplies', job: jobs[2].id, amount: 46.8, receipt: false, missingReceipt: true, missingReason: 'Printer was down; vendor confirmed the rental by phone.', status: 'submitted' }),
  fixture({ id: 'exp-1041', date: '2026-10-08', merchant: 'Airport Market', category: 'Other', job: jobs[1].id, amount: 34.9, payment: 'Corporate card', deductiblePersonal: 12.5, recoveryAmount: 12.5, status: 'approved', approvedAmount: 34.9, approvedReimbursable: 0, notes: '$12.50 personal toiletries approved for employee recovery.' }),
];

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const isNumber = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const effectivePolicy = (policy) => ({ ...initialPolicy, ...policy, glCodes: policy?.glCodes ?? initialPolicy.glCodes });
const others = (expense, allExpenses) => (allExpenses || []).filter((item) => !item.deleted && item !== expense && (!expense.id || item.id !== expense.id));

/** Returns null when the date predates all configured rates or is invalid. */
export function mileageRate(date, policy = initialPolicy) {
  if (!isDate(date)) return null;
  const rate = [...(effectivePolicy(policy).mileageRates || [])]
    .filter((item) => isDate(item.effectiveDate) && item.effectiveDate <= date && isNumber(item.rate) && Number(item.rate) >= 0)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  return rate ? Number(rate.rate) : null;
}

/** Mileage is calculated from miles and the expense date, never from entered amount. */
export function amountOf(expense, policy = initialPolicy) {
  if (['approved', 'exported'].includes(expense.status) && isNumber(expense.approvedAmount) && Number(expense.approvedAmount) > 0) {
    return money(expense.approvedAmount);
  }
  if (expense.category === 'Mileage') {
    const rate = mileageRate(expense.date, policy);
    return rate !== null && isNumber(expense.miles) ? money(Number(expense.miles) * rate) : 0;
  }
  if (expense.category === 'Per diem') {
    const fraction = Number(expense.dayFraction);
    return [0.5, 1].includes(fraction) ? money(effectivePolicy(policy).perDiemRate * fraction) : 0;
  }
  return isNumber(expense.amount) ? money(expense.amount) : 0;
}

// Already approved/exported records consume the daily meal allowance first.
// Stable IDs make the result independent of table sorting or filtering order.
function remainingMealCap(expense, policy, allExpenses) {
  const limit = money(policy.mealCap);
  const rank = { exported: 0, approved: 1, submitted: 2, returned: 3, draft: 4 };
  const claims = [...others(expense, allExpenses), expense]
    .filter((item) => item.category === 'Meals' && item.date === expense.date && item.status !== 'rejected' && !item.deleted)
    .sort((a, b) => ((rank[a.status] ?? 4) - (rank[b.status] ?? 4)) || String(a.id || '').localeCompare(String(b.id || '')));
  let consumed = 0;
  for (const item of claims) {
    if (item === expense) break;
    const gross = Math.max(0, amountOf(item, policy));
    const personal = isNumber(item.deductiblePersonal) ? Math.max(0, Math.min(gross, money(item.deductiblePersonal))) : 0;
    const settledSnapshot = ['approved', 'exported'].includes(item.status)
      && item.payment === 'Out of pocket' && isNumber(item.approvedReimbursable) && Number(item.approvedReimbursable) >= 0;
    consumed += Math.round((settledSnapshot ? Number(item.approvedReimbursable) : gross - personal) * 100);
  }
  return Math.max(0, money(limit - consumed / 100));
}

/** Policy assessment is pure. An exception explanation does not raise a cap. */
export function evaluateExpense(expense, policy = initialPolicy, allExpenses = []) {
  const rules = effectivePolicy(policy);
  const errors = [];
  const warnings = [];
  const calculated = amountOf(expense, rules);
  const amount = Math.max(0, calculated);
  const corporate = expense.payment === 'Corporate card';
  const personalInput = expense.deductiblePersonal ?? 0;
  const personal = isNumber(personalInput) ? Math.max(0, Math.min(amount, money(personalInput))) : 0;
  const business = money(amount - personal);
  const capSetting = {
    Meals: remainingMealCap(expense, rules, allExpenses),
    Flights: rules.flightCap,
    'Per diem': Number(rules.perDiemRate) * Number(expense.dayFraction),
  }[expense.category];
  const cap = isNumber(capSetting) ? Math.max(0, money(capSetting)) : null;
  const recoveryRequired = corporate && personal > 0 && ['approved', 'exported'].includes(expense.status);
  const recovery = expense.recoveryAmount;
  const validRecovery = isNumber(recovery) && Number(recovery) >= 0 && Number(recovery) <= personal;
  const settled = ['approved', 'exported'].includes(expense.status);
  const hasSnapshot = settled && isNumber(expense.approvedReimbursable) && Number(expense.approvedReimbursable) >= 0;

  if (!isDate(expense.date)) errors.push('Choose a valid expense date.');
  if (!hasText(expense.merchant)) errors.push('Enter a merchant or trip description.');
  if (!categories.includes(expense.category)) errors.push('Choose a supported expense category.');
  if (!hasText(expense.job)) errors.push('Assign a job or project.');
  if (Array.isArray(rules.allowedJobs) && !rules.allowedJobs.includes(expense.job)) errors.push('Choose an allowed job or project.');
  if (!['Corporate card', 'Out of pocket'].includes(expense.payment)) errors.push('Choose Corporate card or Out of pocket.');
  if (expense.category === 'Mileage') {
    if (!isNumber(expense.miles) || Number(expense.miles) <= 0) errors.push('Enter miles greater than zero.');
    if (mileageRate(expense.date, rules) === null) errors.push('No mileage rate is configured for this expense date.');
    if (!expense.mapAttachment) errors.push('Attach a map or route record for mileage.');
    if (corporate) errors.push('Mileage reimbursement must use Out of pocket payment.');
  } else if (expense.category === 'Per diem') {
    if (!hasText(expense.tripPurpose)) errors.push('Enter a trip purpose for per diem.');
    if (!hasText(expense.location)) errors.push('Enter the travel location for per diem.');
    if (expense.eligible !== true) errors.push('Confirm eligibility for the per diem allowance.');
    if (![0.5, 1].includes(Number(expense.dayFraction))) errors.push('Per diem must be a half day (0.5) or full day (1).');
    if (corporate) errors.push('Per diem reimbursement must use Out of pocket payment.');
  } else if (!isNumber(expense.amount) || Number(expense.amount) <= 0) {
    errors.push('Enter an amount greater than zero.');
  }
  if (!isNumber(personalInput) || Number(personalInput) < 0 || Number(personalInput) > amount) {
    errors.push('Personal portion must be between zero and the expense amount.');
  }
  if (recoveryRequired && !validRecovery) {
    errors.push('Approved personal corporate spend requires an explicit recovery amount between zero and the personal portion.');
  }
  if (recovery !== undefined && (!isNumber(recovery) || Number(recovery) < 0 || Number(recovery) > personal)) {
    errors.push('Recovery amount must be between zero and the declared personal portion.');
  }
  if (expense.approvedReimbursable !== undefined
    && (!isNumber(expense.approvedReimbursable) || Number(expense.approvedReimbursable) < 0 || (corporate && Number(expense.approvedReimbursable) !== 0))) {
    errors.push('Approved reimbursement snapshot must be nonnegative and zero for Corporate card expenses.');
  }
  if (expense.approvedAmount !== undefined && (!isNumber(expense.approvedAmount) || Number(expense.approvedAmount) <= 0)) {
    errors.push('Approved amount snapshot must be greater than zero.');
  }

  const ordinaryReceipt = !['Mileage', 'Per diem'].includes(expense.category);
  if (ordinaryReceipt && amount >= Number(rules.receiptThreshold) && !expense.receipt) {
    if (!expense.missingReceipt || !hasText(expense.missingReason)) {
      errors.push(`Expenses of $${money(rules.receiptThreshold).toFixed(2)} or more need a receipt or a missing-receipt declaration with an explanation.`);
    } else {
      warnings.push('Missing receipt declared; reviewer must consider the explanation.');
    }
  }
  if (cap !== null && business > cap) {
    const excess = money(business - cap);
    const capLabel = expense.category === 'Meals' ? `remaining daily meals allowance (daily cap $${money(rules.mealCap).toFixed(2)})` : `${expense.category.toLowerCase()} cap`;
    warnings.push(`Business amount exceeds the $${cap.toFixed(2)} ${capLabel} by $${excess.toFixed(2)}. ${corporate ? 'Cap excess does not automatically create employee debt.' : 'Reimbursement remains capped unless the policy cap is changed.'}`);
    if (!hasSnapshot && !hasText(expense.exceptionNote)) errors.push('Add an exception note explaining the amount above the policy cap.');
  }

  const otherExpenses = others(expense, allExpenses);
  if (['Mileage', 'Fuel'].includes(expense.category) && otherExpenses.some((item) =>
    item.status !== 'rejected' && item.date === expense.date && item.job === expense.job
    && item.category === (expense.category === 'Mileage' ? 'Fuel' : 'Mileage'))) {
    warnings.push('Mileage and fuel are both claimed for the same job and date; review for duplicate vehicle costs.');
    if (!hasText(expense.exceptionNote)) errors.push('Add an exception note explaining the mileage and fuel claims for the same job and date.');
  }
  if (['Meals', 'Per diem'].includes(expense.category)) {
    const sameDate = otherExpenses.filter((item) => item.date === expense.date && item.status !== 'rejected');
    if (sameDate.some((item) => item.category === (expense.category === 'Meals' ? 'Per diem' : 'Meals'))) {
      errors.push('Per diem and actual meals cannot both be claimed for the same date.');
    }
    if (expense.category === 'Per diem' && sameDate.some((item) => item.category === 'Per diem')) {
      errors.push('Only one per diem claim is allowed per date.');
    }
  }
  if (expense.cardId) {
    if (!corporate) errors.push('A card transaction can only match a Corporate card expense.');
    if (otherExpenses.some((item) => item.cardId === expense.cardId)) {
      errors.push('This card transaction is already matched to another expense.');
    }
  }

  return {
    errors, warnings, cap, amount,
    reimbursable: corporate || expense.status === 'rejected' ? 0
      : hasSnapshot ? money(expense.approvedReimbursable) : money(cap === null ? business : Math.min(business, cap)),
    employeeOwes: corporate && ['approved', 'exported'].includes(expense.status) && validRecovery ? money(recovery) : 0,
  };
}

/** Estimates for supplied rows; callers can scope to approved or another status. */
export function totals(expenses, policy = initialPolicy) {
  const sum = { reimbursable: 0, employeeOwes: 0, corporate: 0, total: 0 };
  for (const expense of expenses.filter((item) => !item.deleted)) {
    const result = evaluateExpense(expense, policy, expenses);
    sum.total += Math.round(result.amount * 100);
    sum.reimbursable += Math.round(result.reimbursable * 100);
    sum.employeeOwes += Math.round(result.employeeOwes * 100);
    if (expense.payment === 'Corporate card') sum.corporate += Math.round((result.amount - result.employeeOwes) * 100);
  }
  return Object.fromEntries(Object.entries(sum).map(([key, cents]) => [key, cents / 100]));
}

/** The caller validates before submission/approval; this function guards state transitions. */
export function transition(expense, action, note = '', decision = {}) {
  const nextStatus = {
    draft: { submit: 'submitted' },
    returned: { submit: 'submitted' },
    submitted: { approve: 'approved', return: 'returned', reject: 'rejected' },
    approved: { export: 'exported' },
  }[expense.status]?.[action];
  if (!nextStatus) throw new Error(`Invalid transition: ${expense.status} → ${action}.`);
  if (['return', 'reject'].includes(action) && !hasText(note)) throw new Error('A reviewer note is required to return or reject an expense.');
  const cleanNote = typeof note === 'string' ? note.trim() : '';
  const recoveryAmount = decision.recoveryAmount ?? expense.recoveryAmount;
  const personal = Number(expense.deductiblePersonal || 0);
  if (action === 'approve' && expense.payment === 'Corporate card' && personal > 0
    && (!isNumber(recoveryAmount) || Number(recoveryAmount) < 0 || Number(recoveryAmount) > personal)) {
    throw new Error('Approval requires an explicit recovery amount between zero and the declared personal portion.');
  }
  if (action === 'approve' && recoveryAmount !== undefined
    && (!isNumber(recoveryAmount) || Number(recoveryAmount) < 0 || Number(recoveryAmount) > personal)) {
    throw new Error('Recovery amount must be between zero and the declared personal portion.');
  }
  const recoveryDecision = action === 'approve' && recoveryAmount !== undefined ? { recoveryAmount: money(recoveryAmount) } : {};
  const reimbursement = decision.reimbursable;
  if (action === 'approve' && reimbursement !== undefined
    && (!isNumber(reimbursement) || Number(reimbursement) < 0
      || (expense.payment === 'Corporate card' && Number(reimbursement) !== 0)
      || (!['Mileage', 'Per diem'].includes(expense.category) && Number(reimbursement) > money(Number(expense.amount) - personal)))) {
    throw new Error('Approved reimbursement must be nonnegative, within the business amount, and zero for Corporate card expenses.');
  }
  const reimbursementDecision = action === 'approve' && reimbursement !== undefined ? { approvedReimbursable: money(reimbursement) } : {};
  if (action === 'approve' && decision.amount !== undefined && (!isNumber(decision.amount) || Number(decision.amount) <= 0)) {
    throw new Error('Approved amount must be greater than zero.');
  }
  const amountDecision = action === 'approve' && decision.amount !== undefined ? { approvedAmount: money(decision.amount) } : {};
  return {
    ...expense, ...recoveryDecision, ...reimbursementDecision, ...amountDecision, status: nextStatus,
    reviewNote: ['return', 'reject', 'approve'].includes(action) ? cleanNote : expense.reviewNote || '',
    history: [...(expense.history || []), { action, from: expense.status, to: nextStatus, note: cleanNote, ...recoveryDecision, ...(reimbursementDecision.approvedReimbursable !== undefined ? { reimbursable: reimbursementDecision.approvedReimbursable } : {}), ...(amountDecision.approvedAmount !== undefined ? { amount: amountDecision.approvedAmount } : {}) }],
  };
}

const csvCell = (value) => {
  let text = String(value ?? '');
  // Prefix spreadsheet formulas, including those hidden behind leading whitespace.
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Returns CSV only. Export marking is an explicit transition performed by the caller. */
export function makeExport(expenses, policy = initialPolicy) {
  const rules = effectivePolicy(policy);
  const header = ['Expense ID', 'Date', 'Merchant', 'Category', 'Job', 'Payment', 'Amount', 'GL Code', 'Employee Reimbursement', 'Employee Owes', 'Corporate Business Amount', 'Status'];
  const rows = expenses.filter((item) => item.status === 'approved' && !item.deleted).map((expense) => {
    if (!hasText(rules.glCodes[expense.category])) throw new Error(`Cannot export ${expense.id}: Missing GL mapping for category "${expense.category}".`);
    const result = evaluateExpense(expense, rules, expenses);
    if (result.errors.length) throw new Error(`Cannot export ${expense.id}: ${result.errors.join(' ')}`);
    const job = jobs.find((item) => item.id === expense.job);
    return [
      expense.id, expense.date, expense.merchant, expense.category, job?.code || expense.job,
      expense.payment, result.amount.toFixed(2), rules.glCodes[expense.category],
      result.reimbursable.toFixed(2), result.employeeOwes.toFixed(2),
      (expense.payment === 'Corporate card' ? money(result.amount - result.employeeOwes) : 0).toFixed(2), expense.status,
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
