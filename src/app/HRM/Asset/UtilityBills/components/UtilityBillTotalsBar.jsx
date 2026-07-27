'use client';

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Sum Payable-to amounts from Add more / zoho line items (supports mixed company + employee).
 */
export function sumLinePartyPayTotals(lineItems = []) {
    const lines = Array.isArray(lineItems) ? lineItems : [];
    let companyPayAmount = 0;
    let employeePayAmount = 0;
    let payByCompanyId = '';
    let payByCompanyName = '';
    let payByEmployeeId = '';
    let payByEmployeeName = '';

    lines.forEach((line) => {
        const amt = Number(line?.amount);
        if (!Number.isFinite(amt) || amt <= 0) return;
        const empId = String(line?.payByEmployeeId || '').trim();
        const empName = String(line?.payByEmployeeName || '').trim();
        const coId = String(line?.payByCompanyId || '').trim();
        const coName = String(line?.payByCompanyName || '').trim();
        const payBy = String(line?.payBy || '').trim();
        const isEmployee =
            payBy === 'employee' || (empId && !(payBy === 'company' && coId && !empId));
        const isCompany = payBy === 'company' || (coId && !isEmployee);

        if (isEmployee && (empId || empName)) {
            employeePayAmount += amt;
            if (!payByEmployeeId && empId) payByEmployeeId = empId;
            if (!payByEmployeeName && empName) payByEmployeeName = empName;
            if (!payByCompanyId && coId) payByCompanyId = coId;
            if (!payByCompanyName && coName) payByCompanyName = coName;
            return;
        }
        if (isCompany || coId || coName) {
            companyPayAmount += amt;
            if (!payByCompanyId && coId) payByCompanyId = coId;
            if (!payByCompanyName && coName) payByCompanyName = coName;
        }
    });

    const hasCompany = companyPayAmount > 0.009 || Boolean(payByCompanyId);
    const hasEmployee = employeePayAmount > 0.009 || Boolean(payByEmployeeId);
    let payBy = '';
    if (hasCompany && hasEmployee) payBy = 'employee_and_company';
    else if (hasEmployee) payBy = 'employee';
    else if (hasCompany) payBy = 'company';

    return {
        hasParty: hasCompany || hasEmployee,
        companyPayAmount: Math.max(0, companyPayAmount),
        employeePayAmount: Math.max(0, employeePayAmount),
        payByCompanyId,
        payByCompanyName,
        payByEmployeeId,
        payByEmployeeName,
        payBy,
    };
}

/**
 * Allocation badge label: company nick (no id), employee first name only.
 * Handles stored labels like "VEGADIGITAL (EST-001)" / "Raseell Muhmmad (VEGA-HR-00001)".
 */
export function shortAllocationPartyName(name, type = 'company') {
    let s = String(name || '')
        .trim()
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .trim();
    if (!s) return type === 'employee' ? 'Employee' : 'Company';
    if (type === 'employee') {
        return s.split(/\s+/)[0] || s;
    }
    return s;
}

/**
 * Allocation badges for a saved bill — prefer zoho line Payable-to rows.
 */
export function getBillAllocationParties(bill = {}) {
    const lines = Array.isArray(bill?.zohoLineItems) ? bill.zohoLineItems : [];
    const map = new Map();

    const add = (key, name, amount, type) => {
        const id = String(key || name || '').trim();
        if (!id && !name) return;
        const mapKey = `${type}:${id || name}`;
        const fullName = String(name || '').trim();
        const displayName =
            shortAllocationPartyName(fullName || name, type) ||
            (type === 'employee' ? 'Employee' : 'Company');
        const prev = map.get(mapKey) || {
            key: mapKey,
            name: displayName,
            fullName: fullName || displayName,
            amount: 0,
            type,
        };
        prev.amount += Number(amount) || 0;
        if (fullName) {
            prev.fullName = fullName;
            prev.name = shortAllocationPartyName(fullName, type);
        }
        map.set(mapKey, prev);
    };

    if (lines.length) {
        lines.forEach((line) => {
            const amt = Number(line?.amount) || 0;
            const empId = String(line?.payByEmployeeId || '').trim();
            const empName = String(line?.payByEmployeeName || '').trim();
            const coId = String(line?.payByCompanyId || '').trim();
            const coName = String(line?.payByCompanyName || '').trim();
            const payBy = String(line?.payBy || '').trim();
            if (payBy === 'employee' || empId || empName) {
                if (empId || empName) add(empId || empName, empName, amt, 'employee');
                return;
            }
            if (payBy === 'company' || coId || coName) {
                if (coId || coName) add(coId || coName, coName, amt, 'company');
            }
        });
    }

    if (!map.size) {
        const coName = String(bill?.payByCompanyName || '').trim();
        const empName = String(bill?.payByEmployeeName || '').trim();
        const coAmt = Number(bill?.companyPayAmount) || 0;
        const empAmt = Number(bill?.employeePayAmount) || 0;
        if (coName && coAmt > 0.009) add(bill.payByCompanyId || coName, coName, coAmt, 'company');
        if (empName && empAmt > 0.009) add(bill.payByEmployeeId || empName, empName, empAmt, 'employee');
    }

    return [...map.values()].filter((p) => p.amount > 0.009 || p.name);
}

/**
 * Per-row company / employee amounts to store in DB (matches TOTAL cards).
 * When Add more lines have Payable to, totals follow those line amounts.
 */
export function computeRowPayTotals(row = {}) {
    const lineItems = Array.isArray(row.lineItems)
        ? row.lineItems
        : Array.isArray(row.zohoLineItems)
          ? row.zohoLineItems
          : null;
    if (lineItems?.length) {
        const fromLines = sumLinePartyPayTotals(lineItems);
        if (fromLines.hasParty) {
            const contract = Number(row.contractAmount) || 0;
            const actual = Number(row.actualAmount);
            const overage =
                Number.isFinite(actual) && actual > contract ? actual - contract : 0;
            return {
                companyPayAmount: fromLines.companyPayAmount,
                employeePayAmount: fromLines.employeePayAmount,
                companyDiffShare: Math.max(
                    0,
                    fromLines.companyPayAmount > 0 && overage <= 0
                        ? Math.max(0, contract - (Number.isFinite(actual) ? actual : 0))
                        : 0,
                ),
                employeeDiffShare: Math.min(fromLines.employeePayAmount, Math.max(0, overage)),
                payBy: fromLines.payBy,
                payByCompanyId: fromLines.payByCompanyId,
                payByCompanyName: fromLines.payByCompanyName,
                payByEmployeeId: fromLines.payByEmployeeId,
                payByEmployeeName: fromLines.payByEmployeeName,
            };
        }
    }

    const contract = Number(row.contractAmount) || 0;
    const actual = Number(row.actualAmount);
    if (!Number.isFinite(actual) || actual < 0 || row.actualAmount === '') {
        return { companyPayAmount: 0, employeePayAmount: 0, companyDiffShare: 0, employeeDiffShare: 0 };
    }

    const underDiff = Math.max(0, contract - actual);
    const overage = Math.max(0, actual - contract);

    if (actual < contract) {
        const companyDiffShare = underDiff;
        const employeeDiffShare = 0;
        return {
            companyPayAmount: Math.max(0, contract - companyDiffShare),
            employeePayAmount: 0,
            companyDiffShare,
            employeeDiffShare,
        };
    }

    const payBy = String(row.payBy || '').trim();
    let companyUnderShare = 0;
    let employeeUnderShare = 0;
    let employeeOverageShare = 0;
    let companyDiffShare = 0;
    let employeeDiffShare = 0;

    if (payBy === 'company') {
        companyUnderShare = underDiff;
        companyDiffShare = underDiff + overage;
    } else if (payBy === 'employee' || payBy === 'employee_balance') {
        employeeUnderShare = underDiff;
        if (overage > 0) employeeOverageShare = overage;
        employeeDiffShare = underDiff + overage;
    } else if (payBy === 'employee_and_company') {
        companyDiffShare = Number(row.companyDiffAmount) || 0;
        employeeDiffShare = Number(row.employeeDiffAmount) || overage;
        employeeOverageShare = employeeDiffShare;
    }

    return {
        companyPayAmount: Math.max(0, actual + companyUnderShare - employeeOverageShare),
        employeePayAmount: Math.max(0, employeeUnderShare + employeeOverageShare),
        companyDiffShare,
        employeeDiffShare,
    };
}

/**
 * Totals for selected rows — Company/Employee match computeRowPayTotals.
 */
export function summarizeSelectedBillRows(rows = []) {
    let contractTotal = 0;
    let actualTotal = 0;
    let companyDiffShare = 0;
    let employeeDiffShare = 0;
    let companyTotal = 0;
    let employeeTotal = 0;

    (rows || [])
        .filter((r) => r.selected)
        .forEach((r) => {
            const contract = Number(r.contractAmount) || 0;
            const actualRaw = r.actualAmount;
            const actual = Number(actualRaw);
            if (actualRaw === '' || !Number.isFinite(actual) || actual < 0) return;

            contractTotal += contract;
            actualTotal += actual;

            const pay = computeRowPayTotals(r);
            companyDiffShare += pay.companyDiffShare;
            employeeDiffShare += pay.employeeDiffShare;
            companyTotal += pay.companyPayAmount;
            employeeTotal += pay.employeePayAmount;
        });

    const payByDiffTotal = companyDiffShare + employeeDiffShare;

    return {
        contractTotal,
        actualTotal,
        differenceTotal: contractTotal - actualTotal,
        payByDiffTotal,
        companyDiffShare,
        employeeDiffShare,
        companyTotal,
        employeeTotal,
    };
}

export default function UtilityBillTotalsBar({ rows = [] }) {
    const t = summarizeSelectedBillRows(rows);
    const showCompanyDiff = t.companyDiffShare > 0;
    const showEmployeeDiff = t.employeeDiffShare > 0;
    const showCompanyTotal = t.companyTotal > 0;
    const showEmployeeTotal = t.employeeTotal > 0;

    return (
        <div className="mx-4 sm:mx-5 mb-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 sm:px-4 py-3 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-lg bg-white border border-gray-100 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Contract Amount
                    </p>
                    <p className="text-sm font-bold tabular-nums text-gray-800">
                        {formatMoney(t.contractTotal)}{' '}
                        <span className="text-[11px] font-semibold text-gray-400">AED</span>
                    </p>
                </div>

                <div className="rounded-lg bg-white border border-gray-100 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Actual Amount
                    </p>
                    <p className="text-sm font-bold tabular-nums text-gray-800">
                        {formatMoney(t.actualTotal)}{' '}
                        <span className="text-[11px] font-semibold text-gray-400">AED</span>
                    </p>
                </div>

                <div className="rounded-lg bg-white border border-gray-100 px-3 py-2.5 sm:col-span-2 lg:col-span-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Difference
                    </p>
                    <p
                        className={`text-sm font-bold tabular-nums mb-1 ${
                            t.payByDiffTotal > 0 ? 'text-gray-800' : 'text-gray-500'
                        }`}
                    >
                        {formatMoney(t.payByDiffTotal)}{' '}
                        <span className="text-[11px] font-semibold text-gray-400">AED</span>
                    </p>
                    <div className="space-y-0.5 text-[11px] text-gray-700">
                        {showCompanyDiff ? (
                            <p className="whitespace-nowrap">
                                <span className="font-semibold text-gray-800">Company</span>
                                <span className="text-gray-400">: </span>
                                <strong className="tabular-nums font-semibold text-gray-700">
                                    {formatMoney(t.companyDiffShare)}
                                </strong>
                            </p>
                        ) : null}
                        {showEmployeeDiff ? (
                            <p className="whitespace-nowrap">
                                <span className="font-semibold text-gray-800">Employee</span>
                                <span className="text-gray-400">: </span>
                                <strong className="tabular-nums font-semibold text-gray-700">
                                    {formatMoney(t.employeeDiffShare)}
                                </strong>
                            </p>
                        ) : null}
                        {!showCompanyDiff && !showEmployeeDiff ? (
                            <p className="text-[10px] text-gray-400">No difference assigned</p>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 sm:col-span-2 lg:col-span-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">
                        Total
                    </p>
                    <div className="space-y-1 text-[11px] text-gray-700">
                        {showCompanyTotal ? (
                            <p className="whitespace-nowrap">
                                <span className="font-semibold text-gray-800">Company</span>
                                <span className="text-gray-400">: </span>
                                <strong className="text-sm tabular-nums text-emerald-600">
                                    {formatMoney(t.companyTotal)} AED
                                </strong>
                            </p>
                        ) : null}
                        {showEmployeeTotal ? (
                            <p className="whitespace-nowrap">
                                <span className="font-semibold text-gray-800">Employee</span>
                                <span className="text-gray-400">: </span>
                                <strong className="text-sm tabular-nums text-emerald-600">
                                    {formatMoney(t.employeeTotal)} AED
                                </strong>
                            </p>
                        ) : null}
                        {!showCompanyTotal && !showEmployeeTotal ? (
                            <p className="text-[10px] text-gray-400">—</p>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
