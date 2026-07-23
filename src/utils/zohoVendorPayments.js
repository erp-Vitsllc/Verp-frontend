function cleanText(value, fallback = '—') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export function formatZohoPaymentMoney(amount, currency = 'AED') {
    const value = Number(amount);
    const currencyCode = String(currency || 'AED').trim() || 'AED';

    if (!Number.isFinite(value)) return '—';

    try {
        return new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${value.toFixed(2)} ${currencyCode}`;
    }
}

export function formatZohoPaymentDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '—';

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function paymentStatus(row) {
    const balance = numberValue(row?.balance);
    const raw = String(row?.status || '').trim().toLowerCase();
    if (raw.includes('void')) return 'Void';
    if (raw.includes('draft')) return 'Draft';
    if (raw.includes('pending')) return 'Pending Approval';
    if (raw.includes('partial') || balance > 0) return 'Partially Paid';
    if (raw.includes('paid') || raw.includes('applied') || raw.includes('approved') || !raw) {
        return 'Paid';
    }
    return String(row?.status || 'Paid').trim() || 'Paid';
}

export function mapZohoVendorPaymentListRow(payment) {
    if (!payment || typeof payment !== 'object') return null;

    const currencyCode = cleanText(payment.currency_code || payment.currencyCode, 'AED');
    const amount = numberValue(payment.amount);
    const unusedAmount = numberValue(payment.balance);
    const paymentNumber = cleanText(payment.payment_number || payment.payment_no || payment.payment_id);

    return {
        id: String(payment.payment_id || payment.vendorpayment_id || paymentNumber),
        date: formatZohoPaymentDate(payment.date),
        rawDate: String(payment.date || ''),
        location: cleanText(payment.location_name || payment.branch_name || payment.place_of_supply),
        paymentNumber,
        referenceNumber: cleanText(payment.reference_number),
        vendorName: cleanText(payment.vendor_name),
        billNumber: cleanText(payment.bill_numbers || payment.bill_number),
        mode: cleanText(payment.payment_mode),
        status: paymentStatus(payment),
        paidThroughAccountId: String(
            payment.paid_through_account_id || payment.account_id || '',
        ).trim(),
        paidThrough: cleanText(
            payment.paid_through_account_name || payment.account_name || payment.paid_through,
        ),
        amount: formatZohoPaymentMoney(amount, currencyCode),
        amountValue: amount,
        unusedAmount: formatZohoPaymentMoney(unusedAmount, currencyCode),
        unusedAmountValue: unusedAmount,
        currencyCode,
    };
}

export function mapZohoVendorPaymentListRows(payments) {
    if (!Array.isArray(payments)) return [];
    return payments.map(mapZohoVendorPaymentListRow).filter(Boolean);
}

export function mapZohoBillListRow(bill) {
    if (!bill || typeof bill !== 'object') return null;

    const id = String(bill.bill_id || bill.id || '').trim();
    if (!id) return null;

    const currencyCode = cleanText(bill.currency_code, 'AED');
    const total = numberValue(bill.total);
    const balance = numberValue(bill.balance);

    return {
        id,
        date: formatZohoPaymentDate(bill.date),
        rawDate: String(bill.date || ''),
        billNumber: cleanText(bill.bill_number || bill.reference_number || id),
        referenceNumber: cleanText(bill.reference_number),
        vendorName: cleanText(bill.vendor_name),
        status: cleanText(bill.status),
        dueDate: formatZohoPaymentDate(bill.due_date),
        location: cleanText(bill.location_name || bill.branch_name || bill.place_of_supply),
        amount: formatZohoPaymentMoney(total, currencyCode),
        amountValue: total,
        balanceAmount: formatZohoPaymentMoney(balance, currencyCode),
        balanceValue: balance,
        currencyCode,
        utilityBillPaymentId: cleanText(bill.utility_bill_payment_id),
        utilityParentBillNumber: cleanText(bill.utility_parent_bill_number),
        utilityLineIndex:
            bill.utility_line_index == null || bill.utility_line_index === ''
                ? null
                : Number(bill.utility_line_index),
        utilityDebitAccountId: cleanText(bill.utility_debit_account_id),
        utilityDebitAccountName: cleanText(bill.utility_debit_account_name),
        utilityItemDescription: cleanText(bill.utility_item_description),
        isUtilityChild:
            Number(bill.utility_line_index) > 0 ||
            (cleanText(bill.utility_parent_bill_number) &&
                cleanText(bill.bill_number) !== cleanText(bill.utility_parent_bill_number) &&
                cleanText(bill.bill_number).startsWith(
                    `${cleanText(bill.utility_parent_bill_number)}-`,
                )),
    };
}

export function mapZohoBillListRows(bills) {
    if (!Array.isArray(bills)) return [];
    const mapped = bills.map(mapZohoBillListRow).filter(Boolean);
    return nestUtilityBillListRows(mapped);
}

/**
 * Keep utility Add-more Zoho bills together: parent first, then child lines under it.
 */
export function nestUtilityBillListRows(rows = []) {
    if (!Array.isArray(rows) || rows.length < 2) return rows || [];

    const groupKey = (row) =>
        String(row.utilityBillPaymentId || row.utilityParentBillNumber || '').trim();

    const groups = new Map();
    const standalone = [];

    rows.forEach((row) => {
        const key = groupKey(row);
        if (!key) {
            standalone.push(row);
            return;
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    });

    const ordered = [];
    const emitted = new Set();

    rows.forEach((row) => {
        const key = groupKey(row);
        if (!key || emitted.has(key)) {
            if (!key && !emitted.has(row.id)) {
                ordered.push(row);
                emitted.add(row.id);
            }
            return;
        }
        const members = (groups.get(key) || []).slice().sort((a, b) => {
            const ai = a.utilityLineIndex == null ? 0 : Number(a.utilityLineIndex);
            const bi = b.utilityLineIndex == null ? 0 : Number(b.utilityLineIndex);
            if (ai !== bi) return ai - bi;
            return String(a.billNumber).localeCompare(String(b.billNumber));
        });
        members.forEach((member, index) => {
            ordered.push({
                ...member,
                isUtilityChild: index > 0 || Boolean(member.isUtilityChild),
                utilityGroupSize: members.length,
            });
            emitted.add(member.id);
        });
        emitted.add(key);
    });

    standalone.forEach((row) => {
        if (!emitted.has(row.id)) ordered.push(row);
    });

    return ordered;
}

export function mapZohoExpenseListRow(expense) {
    if (!expense || typeof expense !== 'object') return null;

    const id = String(expense.expense_id || expense.id || '').trim();
    if (!id) return null;

    const currencyCode = cleanText(expense.currency_code, 'AED');
    const total = numberValue(expense.total ?? expense.bcy_total ?? expense.amount);

    return {
        id,
        date: formatZohoPaymentDate(expense.date),
        rawDate: String(expense.date || ''),
        accountName: cleanText(expense.account_name),
        vendorName: cleanText(expense.vendor_name),
        customerName: cleanText(expense.customer_name),
        referenceNumber: cleanText(expense.reference_number),
        status: cleanText(expense.status),
        location: cleanText(expense.location_name || expense.branch_name),
        description: cleanText(expense.description, ''),
        amount: formatZohoPaymentMoney(total, currencyCode),
        amountValue: total,
        currencyCode,
    };
}

export function mapZohoExpenseListRows(expenses) {
    if (!Array.isArray(expenses)) return [];
    return expenses.map(mapZohoExpenseListRow).filter(Boolean);
}

export function mapZohoPaymentAccount(account) {
    if (!account || typeof account !== 'object') return null;

    const id = String(account.account_id || account.id || '').trim();
    if (!id) return null;

    return {
        id,
        name: cleanText(account.account_name || account.name, ''),
        code: cleanText(account.account_code || account.accountCode || account.code, ''),
        type: cleanText(account.account_type_formatted || account.account_type, ''),
        raw: account,
    };
}

export function mapZohoPaymentAccounts(accounts) {
    if (!Array.isArray(accounts)) return [];
    return accounts.map(mapZohoPaymentAccount).filter(Boolean);
}

export function mapZohoBillOption(bill) {
    if (!bill || typeof bill !== 'object') return null;

    const id = String(bill.bill_id || bill.id || '').trim();
    if (!id) return null;

    const balance = numberValue(bill.balance);
    return {
        id,
        recordType: 'bill',
        billNumber: cleanText(bill.bill_number || bill.reference_number || id),
        poNumber: cleanText(bill.purchaseorder_number || bill.purchase_order_number || bill.po_number),
        locationId: String(bill.location_id || '').trim(),
        location: cleanText(bill.location_name || bill.branch_name || bill.place_of_supply),
        date: formatZohoPaymentDate(bill.date),
        dueDate: formatZohoPaymentDate(bill.due_date),
        balance,
        total: numberValue(bill.total),
        currencyCode: cleanText(bill.currency_code, 'AED'),
        vendorId: String(bill.vendor_id || '').trim(),
        raw: bill,
    };
}

export function mapZohoBillOptions(bills) {
    if (!Array.isArray(bills)) return [];
    return bills.map(mapZohoBillOption).filter(Boolean);
}

export function mapZohoExpenseOption(expense) {
    if (!expense || typeof expense !== 'object') return null;

    const id = String(expense.expense_id || expense.id || '').trim();
    if (!id) return null;

    const balance = numberValue(expense.balance ?? expense.total ?? expense.bcy_total ?? expense.amount);
    const total = numberValue(expense.total ?? expense.bcy_total ?? expense.amount);

    return {
        id,
        recordType: 'expense',
        billNumber: cleanText(
            expense.expense_number ||
                expense.reference_number ||
                expense.account_name ||
                `EXP-${id.slice(-6)}`,
        ),
        poNumber: '—',
        locationId: String(expense.location_id || '').trim(),
        location: cleanText(expense.location_name || expense.branch_name),
        date: formatZohoPaymentDate(expense.date),
        dueDate: '—',
        balance,
        total,
        currencyCode: cleanText(expense.currency_code, 'AED'),
        vendorId: String(expense.vendor_id || '').trim(),
        description: cleanText(expense.description || expense.account_name, ''),
        accountName: cleanText(expense.account_name, ''),
        raw: expense,
    };
}

export function mapZohoExpenseOptions(expenses) {
    if (!Array.isArray(expenses)) return [];
    return expenses.map(mapZohoExpenseOption).filter(Boolean);
}

export function mapZohoVendorPayableOptions({ bills = [], expenses = [] } = {}) {
    const billRows = mapZohoBillOptions(bills).map((bill) => ({
        ...bill,
        recordType: 'bill',
    }));
    const expenseRows = mapZohoExpenseOptions(expenses);
    return [...billRows, ...expenseRows].sort((a, b) => {
        const aTime = new Date(a.raw?.date || a.date || 0).getTime();
        const bTime = new Date(b.raw?.date || b.date || 0).getTime();
        return aTime - bTime;
    });
}

export function mapZohoLocations(locations) {
    if (!Array.isArray(locations)) return [];
    return locations
        .map((location) => {
            const id = String(location?.location_id || location?.id || '').trim();
            if (!id) return null;
            const isInactive =
                location?.is_location_active === false ||
                String(location?.status || '').toLowerCase() === 'inactive';
            if (isInactive) return null;

            return {
                id,
                name: String(location?.location_name || location?.name || '').trim() || id,
                isPrimary:
                    location?.is_primary === true ||
                    location?.is_primary_location === true ||
                    String(location?.type || '').toLowerCase().includes('primary'),
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            return a.name.localeCompare(b.name);
        });
}

const DEFAULT_PAYMENT_MODES = [
    'Cash',
    'Check',
    'Bank Transfer',
    'Credit Card',
    'Bank Remittance',
    'Others',
];

/** Normalize Zoho payment mode labels for the Record Payment dropdown. */
export function mapZohoPaymentModes(modes) {
    const seen = new Set();
    const mapped = [];

    (Array.isArray(modes) ? modes : []).forEach((mode) => {
        const name = String(
            typeof mode === 'string'
                ? mode
                : mode?.payment_mode_name || mode?.payment_mode || mode?.name || '',
        ).trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        mapped.push(name);
    });

    if (!mapped.length) return [...DEFAULT_PAYMENT_MODES];
    return mapped;
}

/** Merge Zoho locations with any location ids found on vendor bills or expenses. */
export function mergeLocationOptions(locations = [], payables = []) {
    const byId = new Map();

    locations.forEach((location) => {
        if (!location?.id) return;
        byId.set(location.id, location);
    });

    payables.forEach((row) => {
        const id = String(row?.locationId || row?.raw?.location_id || '').trim();
        const name = String(row?.location || row?.raw?.location_name || '').trim();
        if (!id || byId.has(id)) return;
        byId.set(id, { id, name: name || id, isPrimary: false });
    });

    return Array.from(byId.values()).sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return String(a.name).localeCompare(String(b.name));
    });
}

/** Pre-fill payable amounts like Zoho when vendor bills/expenses are loaded. */
export function buildAutoBillAmounts(payables) {
    const amounts = {};
    let totalDue = 0;

    payables.forEach((row) => {
        const balance = Number(row?.balance) || 0;
        if (balance > 0) {
            amounts[row.id] = balance.toFixed(2);
            totalDue += balance;
        }
    });

    return {
        billAmounts: amounts,
        suggestedPaymentAmount: totalDue > 0 ? totalDue.toFixed(2) : '',
    };
}

/**
 * Apply amounts only for the given bill ids (checkbox-selected / utility prefill).
 * Unlisted rows stay unchecked with no payment amount.
 * Optionally also match by bill number when Zoho ids are not yet known.
 */
export function buildSelectedBillAmounts(payables, selectedBillIds = [], selectedBillNumbers = []) {
    const selected = new Set(
        (Array.isArray(selectedBillIds) ? selectedBillIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean),
    );
    const selectedNumbers = new Set(
        (Array.isArray(selectedBillNumbers) ? selectedBillNumbers : [])
            .map((n) => String(n || '').trim().toLowerCase())
            .filter(Boolean),
    );
    const amounts = {};
    let totalDue = 0;

    (Array.isArray(payables) ? payables : []).forEach((row) => {
        if (row?.recordType === 'expense') return;
        const id = String(row?.id || '').trim();
        if (!id) return;
        const billNumber = String(row?.billNumber || '').trim().toLowerCase();
        const matched =
            (selected.size && selected.has(id)) ||
            (selectedNumbers.size && billNumber && selectedNumbers.has(billNumber));
        if (!matched) return;
        const balance = Number(row?.balance) || 0;
        if (balance > 0) {
            amounts[id] = balance.toFixed(2);
            totalDue += balance;
        }
    });

    return {
        billAmounts: amounts,
        suggestedPaymentAmount: totalDue > 0 ? totalDue.toFixed(2) : '',
    };
}
