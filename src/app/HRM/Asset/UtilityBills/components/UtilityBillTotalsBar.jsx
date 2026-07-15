'use client';

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Per-row company / employee amounts to store in DB (matches TOTAL cards).
 * Green (actual < contract): Company TOTAL = Contract − Company difference; Pay by Company.
 * Red/over: Company = Actual + company under − employee overage; Employee = under + overage.
 */
export function computeRowPayTotals(row = {}) {
    const contract = Number(row.contractAmount) || 0;
    const actual = Number(row.actualAmount);
    if (!Number.isFinite(actual) || actual < 0 || row.actualAmount === '') {
        return { companyPayAmount: 0, employeePayAmount: 0, companyDiffShare: 0, employeeDiffShare: 0 };
    }

    const underDiff = Math.max(0, contract - actual);
    const overage = Math.max(0, actual - contract);

    // Green (actual < contract): Pay by Company — TOTAL = Contract − Company difference
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
        /** Sum of Pay by difference shares (matches Company + Employee lines). */
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
