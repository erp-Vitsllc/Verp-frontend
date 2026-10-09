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
 * Best bill total for display — prefer pay-split / line sums when they exceed stored amount
 * (e.g. company + employee shares were saved correctly but amount lagged).
 */
export function getBillTotalAmount(bill = {}) {
    const amount = Number(bill?.amount) || 0;
    const company = Number(bill?.companyPayAmount) || 0;
    const employee = Number(bill?.employeePayAmount) || 0;
    const paySum = company + employee;
    const lines = Array.isArray(bill?.zohoLineItems) ? bill.zohoLineItems : [];
    const linesSum = lines.reduce((sum, line) => sum + (Number(line?.amount) || 0), 0);
    return Math.max(amount, paySum, linesSum);
}

/**
 * Allocation badges for a saved bill.
 * Prefer zoho line Payable-to rows, but always surface bill-level company + employee
 * shares so split bills show both parties (not only one line payee).
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

    const coName = String(bill?.payByCompanyName || '').trim();
    const empName = String(bill?.payByEmployeeName || '').trim();
    const coAmt = Number(bill?.companyPayAmount) || 0;
    const empAmt = Number(bill?.employeePayAmount) || 0;
    const paymentBy = String(bill?.paymentBy || '').trim();

    // TOTAL bar shares are the source of truth when both sides were saved.
    if (coAmt > 0.009 && empAmt > 0.009) {
        if (coName) add(bill.payByCompanyId || coName, coName, coAmt, 'company');
        if (empName) add(bill.payByEmployeeId || empName, empName, empAmt, 'employee');
        // Extra payees from lines (e.g. second employee) beyond the primary pair.
        lines.forEach((line) => {
            const amt = Number(line?.amount) || 0;
            if (!(amt > 0.009)) return;
            const payBy = String(line?.payBy || '').trim();
            const lineEmpId = String(line?.payByEmployeeId || '').trim();
            const lineEmpName = String(line?.payByEmployeeName || '').trim();
            const primaryEmpId = String(bill?.payByEmployeeId || '').trim();
            if (payBy === 'employee' || (!payBy && (lineEmpId || lineEmpName))) {
                if (!lineEmpId && !lineEmpName) return;
                if (primaryEmpId && lineEmpId && lineEmpId === primaryEmpId) return;
                if (
                    empName &&
                    lineEmpName &&
                    shortAllocationPartyName(lineEmpName, 'employee') ===
                        shortAllocationPartyName(empName, 'employee') &&
                    !lineEmpId
                ) {
                    return;
                }
                add(lineEmpId || lineEmpName, lineEmpName, amt, 'employee');
            }
        });
        return [...map.values()].filter((p) => p.amount > 0.009 || p.name);
    }

    if (lines.length) {
        lines.forEach((line) => {
            const amt = Number(line?.amount) || 0;
            if (!(amt > 0.009)) return;
            const empId = String(line?.payByEmployeeId || '').trim();
            const lineEmpName = String(line?.payByEmployeeName || '').trim();
            const coId = String(line?.payByCompanyId || '').trim();
            const lineCoName = String(line?.payByCompanyName || '').trim();
            const payBy = String(line?.payBy || '').trim();
            // Explicit payBy wins — employee rows often also carry companyMongoId for Zoho.
            if (payBy === 'employee') {
                if (empId || lineEmpName) add(empId || lineEmpName, lineEmpName, amt, 'employee');
                return;
            }
            if (payBy === 'company') {
                if (coId || lineCoName) add(coId || lineCoName, lineCoName, amt, 'company');
                return;
            }
            if (empId || lineEmpName) {
                add(empId || lineEmpName, lineEmpName, amt, 'employee');
                return;
            }
            if (coId || lineCoName) {
                add(coId || lineCoName, lineCoName, amt, 'company');
            }
        });
    }

    if (!map.size) {
        if (coName && coAmt > 0.009) add(bill.payByCompanyId || coName, coName, coAmt, 'company');
        if (empName && empAmt > 0.009) add(bill.payByEmployeeId || empName, empName, empAmt, 'employee');
    } else {
        const hasCompanyInMap = [...map.values()].some((p) => p.type === 'company');
        const hasEmployeeInMap = [...map.values()].some((p) => p.type === 'employee');
        if (!hasCompanyInMap && coName && coAmt > 0.009) {
            add(bill.payByCompanyId || coName, coName, coAmt, 'company');
        }
        if (!hasEmployeeInMap && empName && empAmt > 0.009) {
            add(bill.payByEmployeeId || empName, empName, empAmt, 'employee');
        }
    }

    // Split mode with overage: rebuild company (up to contract) + employee (rest)
    // when line attribution collapsed onto a single payee.
    if (paymentBy === 'employee_and_company' && coName && empName) {
        const total = getBillTotalAmount(bill);
        const contract = Number(bill?.monthlyRental) || 0;
        const hasCompanyParty = [...map.values()].some(
            (p) => p.type === 'company' && p.amount > 0.009,
        );
        const hasEmployeeParty = [...map.values()].some(
            (p) => p.type === 'employee' && p.amount > 0.009,
        );
        if (total > contract + 0.009 && !(hasCompanyParty && hasEmployeeParty)) {
            map.clear();
            const companyShare = Math.min(total, contract > 0 ? contract : total);
            const employeeShare = Math.max(0, total - companyShare);
            if (companyShare > 0.009) {
                add(bill.payByCompanyId || coName, coName, companyShare, 'company');
            }
            if (employeeShare > 0.009) {
                add(bill.payByEmployeeId || empName, empName, employeeShare, 'employee');
            }
        }
    }

    // Same company (or employee) on two payable lines → one badge, amounts added.
    const byPartyName = new Map();
    for (const party of map.values()) {
        const nameKey = `${party.type}:${shortAllocationPartyName(
            party.fullName || party.name,
            party.type,
        ).toLowerCase()}`;
        const prev = byPartyName.get(nameKey);
        if (!prev) {
            byPartyName.set(nameKey, { ...party, key: nameKey });
            continue;
        }
        prev.amount += Number(party.amount) || 0;
        if (party.fullName) {
            prev.fullName = party.fullName;
            prev.name = shortAllocationPartyName(party.fullName, party.type);
        }
    }

    return [...byPartyName.values()].filter((p) => p.amount > 0.009 || p.name);
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
            const payByMode = String(row.payBy || '').trim();
            const hasBothLineParties =
                fromLines.companyPayAmount > 0.009 && fromLines.employeePayAmount > 0.009;
            // For company+employee mode, incomplete line attribution (one payee only)
            // must not wipe the other party's share — fall through to split math.
            if (payByMode !== 'employee_and_company' || hasBothLineParties) {
                const contractAmt = Number(row.contractAmount) || 0;
                const actualAmt = Number(row.actualAmount);
                const overage =
                    Number.isFinite(actualAmt) && actualAmt > contractAmt
                        ? actualAmt - contractAmt
                        : 0;
                return {
                    companyPayAmount: fromLines.companyPayAmount,
                    employeePayAmount: fromLines.employeePayAmount,
                    companyDiffShare: Math.max(
                        0,
                        fromLines.companyPayAmount > 0 && overage <= 0
                            ? Math.max(0, contractAmt - (Number.isFinite(actualAmt) ? actualAmt : 0))
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
    }

    const contract = Number(row.contractAmount) || 0;
    const actual = Number(row.actualAmount);
    if (!Number.isFinite(actual) || actual < 0 || row.actualAmount === '') {
        return {
            companyPayAmount: 0,
            employeePayAmount: 0,
            companyDiffShare: 0,
            employeeDiffShare: 0,
            payByCompanyName: String(row.payByCompanyName || '').trim(),
            payByEmployeeName: String(row.payByEmployeeName || '').trim(),
        };
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
            payByCompanyName: String(row.payByCompanyName || '').trim(),
            payByEmployeeName: String(row.payByEmployeeName || '').trim(),
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
        payByCompanyName: String(row.payByCompanyName || '').trim(),
        payByEmployeeName: String(row.payByEmployeeName || '').trim(),
    };
}

function classifyLineParty(line) {
    const empId = String(line?.payByEmployeeId || '').trim();
    const empName = String(line?.payByEmployeeName || '').trim();
    const coId = String(line?.payByCompanyId || '').trim();
    const coName = String(line?.payByCompanyName || '').trim();
    const payBy = String(line?.payBy || '').trim();
    const isEmployee = payBy === 'employee' || ((empId || empName) && payBy !== 'company');
    if (isEmployee && (empId || empName)) {
        return { type: 'employee', id: empId, name: empName };
    }
    if (payBy === 'company' || coId || coName) {
        return { type: 'company', id: coId, name: coName };
    }
    return null;
}

function addPayParty(map, type, id, name, amount) {
    const amt = Number(amount) || 0;
    if (!(amt > 0.009)) return;
    const fullName = String(name || '').trim();
    const idStr = String(id || '').trim();
    const shortName = shortAllocationPartyName(
        fullName || idStr,
        type,
    );
    if (!shortName) return;
    const key = `${type}:${(idStr || shortName).toLowerCase()}`;
    const prev = map.get(key);
    if (!prev) {
        map.set(key, {
            key,
            type,
            id: idStr,
            fullName: fullName || shortName,
            name: shortName,
            amount: amt,
        });
        return;
    }
    prev.amount += amt;
    if (fullName && fullName.length >= String(prev.fullName || '').length) {
        prev.fullName = fullName;
        prev.name = shortAllocationPartyName(fullName, type);
    }
}

function linePartyMaps(lines) {
    const employees = new Map();
    const companies = new Map();
    (Array.isArray(lines) ? lines : []).forEach((line) => {
        const amt = Number(line?.amount);
        if (!Number.isFinite(amt) || amt <= 0) return;
        const party = classifyLineParty(line);
        if (!party) return;
        const bucket = party.type === 'employee' ? employees : companies;
        addPayParty(bucket, party.type, party.id, party.name, amt);
    });
    return { employees, companies };
}

/**
 * Put this row's pay on each named company / employee.
 * Several people on one bill stay separate — never folded into the first name.
 */
function contributeRowPayParties(target, row, pay) {
    const lines = Array.isArray(row.lineItems)
        ? row.lineItems
        : Array.isArray(row.zohoLineItems)
          ? row.zohoLineItems
          : [];
    const { employees, companies } = linePartyMaps(lines);
    const payBy = String(row.payBy || '').trim();
    const coName =
        String(pay.payByCompanyName || row.payByCompanyName || '').trim() ||
        (payBy === 'company' ? String(row.assignedToName || '').trim() : '');
    const empName =
        String(pay.payByEmployeeName || row.payByEmployeeName || '').trim() ||
        (['employee', 'employee_balance', 'employee_and_company'].includes(payBy)
            ? String(row.assignedToName || '').trim()
            : '');

    const addSide = (type, fallbackId, fallbackName, totalAmount, lineMap) => {
        const total = Number(totalAmount) || 0;
        const entries = [...lineMap.values()].filter((entry) => entry.amount > 0.009);
        const lineSum = entries.reduce((sum, entry) => sum + entry.amount, 0);
        const linesMatchTotal =
            total > 0.009 && lineSum > 0.009 && Math.abs(lineSum - total) <= 0.05;

        if (entries.length > 1 && lineSum > 0.009 && total > 0.009) {
            entries.forEach((entry) => {
                const amount = linesMatchTotal ? entry.amount : (entry.amount / lineSum) * total;
                addPayParty(target, type, entry.id, entry.fullName, amount);
            });
            return;
        }

        if (total > 0.009) {
            const named = entries[0];
            addPayParty(
                target,
                type,
                named?.id || fallbackId,
                named?.fullName || fallbackName || (type === 'employee' ? 'Employee' : 'Company'),
                total,
            );
        }
    };

    addSide('company', row.payByCompanyId, coName, pay.companyPayAmount, companies);
    addSide('employee', row.payByEmployeeId, empName, pay.employeePayAmount, employees);
}

function partyListLabel(party, shortNameCounts) {
    const full = String(party.fullName || party.name || '')
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .trim();
    if ((shortNameCounts.get(party.name) || 0) > 1 && full) return full;
    return party.name;
}

/**
 * Totals for selected rows — Company/Employee match computeRowPayTotals.
 * payParties lists every company and employee on the selected bills once, with their own amount.
 */
export function summarizeSelectedBillRows(rows = []) {
    let contractTotal = 0;
    let actualTotal = 0;
    let companyDiffShare = 0;
    let employeeDiffShare = 0;
    let companyTotal = 0;
    let employeeTotal = 0;
    let payByCompanyName = '';
    let payByEmployeeName = '';
    const partyMap = new Map();

    (rows || [])
        .filter((r) => r.selected)
        .forEach((r) => {
            const contract = Number(r.contractAmount) || 0;
            contractTotal += contract;

            const actualRaw = r.actualAmount;
            const actual = Number(actualRaw);
            if (actualRaw === '' || actualRaw == null || !Number.isFinite(actual) || actual < 0) return;

            actualTotal += actual;

            const pay = computeRowPayTotals(r);
            companyDiffShare += pay.companyDiffShare;
            employeeDiffShare += pay.employeeDiffShare;
            companyTotal += pay.companyPayAmount;
            employeeTotal += pay.employeePayAmount;
            contributeRowPayParties(partyMap, r, pay);

            const coName =
                String(pay.payByCompanyName || r.payByCompanyName || '').trim() ||
                (String(r.payBy || '').trim() === 'company'
                    ? String(r.assignedToName || '').trim()
                    : '');
            const empName =
                String(pay.payByEmployeeName || r.payByEmployeeName || '').trim() ||
                (['employee', 'employee_balance', 'employee_and_company'].includes(
                    String(r.payBy || '').trim(),
                )
                    ? String(r.assignedToName || '').trim()
                    : '');
            if (!payByCompanyName && coName) payByCompanyName = coName;
            if (!payByEmployeeName && empName) payByEmployeeName = empName;
        });

    const payByDiffTotal = companyDiffShare + employeeDiffShare;
    // Display difference = Actual − Contract (positive when over budget).
    const billDifference = actualTotal - contractTotal;
    const mergedParties = [];
    partyMap.forEach((party) => {
        const match = mergedParties.find((prev) => {
            if (prev.type !== party.type) return false;
            if (prev.name.toLowerCase() !== party.name.toLowerCase()) return false;
            if (prev.id && party.id && prev.id !== party.id) return false;
            return true;
        });
        if (!match) {
            mergedParties.push({ ...party });
            return;
        }
        match.amount += party.amount;
        if (party.id && !match.id) match.id = party.id;
        if (String(party.fullName || '').length >= String(match.fullName || '').length) {
            match.fullName = party.fullName;
        }
    });
    const payParties = mergedParties.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'company' ? -1 : 1;
        return b.amount - a.amount;
    });
    const shortNameCounts = new Map();
    payParties.forEach((party) => {
        shortNameCounts.set(party.name, (shortNameCounts.get(party.name) || 0) + 1);
    });
    const labeledParties = payParties.map((party) => ({
        ...party,
        label: partyListLabel(party, shortNameCounts),
    }));
    const payByTotal = labeledParties.reduce((sum, party) => sum + party.amount, 0);

    return {
        contractTotal,
        actualTotal,
        differenceTotal: contractTotal - actualTotal,
        billDifference,
        payByDiffTotal,
        companyDiffShare,
        employeeDiffShare,
        companyTotal,
        employeeTotal,
        payByTotal,
        payParties: labeledParties,
        payByCompanyName,
        payByEmployeeName,
        companyLabel: shortAllocationPartyName(payByCompanyName, 'company'),
        employeeLabel: shortAllocationPartyName(payByEmployeeName, 'employee'),
    };
}

function MetricCard({ label, value, hint, accentClass, valueClass }) {
    return (
        <div className={`rounded-xl bg-white border border-slate-100 shadow-sm px-3.5 py-3 border-l-4 ${accentClass}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {label}
            </p>
            <p className={`text-lg font-bold tabular-nums leading-none ${valueClass}`}>
                {formatMoney(value)}{' '}
                <span className="text-[11px] font-semibold text-slate-400">AED</span>
            </p>
            {hint ? <p className="mt-1.5 text-[10px] font-medium text-slate-400">{hint}</p> : null}
        </div>
    );
}

export default function UtilityBillTotalsBar({ rows = [] }) {
    const t = summarizeSelectedBillRows(rows);
    const billDiffAbs = Math.abs(Number(t.billDifference) || 0);
    const isOverage = Number(t.billDifference) > 0.009;
    const isUnder = Number(t.billDifference) < -0.009;
    const diffColorClass = isOverage
        ? 'text-rose-600'
        : isUnder
          ? 'text-emerald-600'
          : 'text-slate-700';
    const diffHint = billDiffAbs <= 0.009
        ? 'No difference'
        : isOverage
          ? 'Actual is over contract'
          : 'Actual is under contract';
    const parties = Array.isArray(t.payParties) ? t.payParties : [];
    const payByTotal = parties.length
        ? Number(t.payByTotal) || 0
        : Number(t.companyTotal || 0) + Number(t.employeeTotal || 0);

    return (
        <div className="mx-4 sm:mx-5 mb-3 shrink-0 rounded-2xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/70 to-amber-50/50 p-3 sm:p-3.5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                <MetricCard
                    label="Contract Amount"
                    value={t.contractTotal}
                    accentClass="border-l-slate-400"
                    valueClass="text-slate-800"
                />
                <MetricCard
                    label="Actual Amount"
                    value={t.actualTotal}
                    accentClass="border-l-sky-500"
                    valueClass="text-slate-800"
                />
                <MetricCard
                    label="Difference"
                    value={billDiffAbs}
                    hint={diffHint}
                    accentClass={isOverage ? 'border-l-rose-500' : isUnder ? 'border-l-emerald-500' : 'border-l-slate-300'}
                    valueClass={diffColorClass}
                />
                <div className="rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 px-3.5 py-3 text-white shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-teal-100 mb-1">
                        Pays by
                    </p>
                    <p className="text-lg font-bold tabular-nums leading-none">
                        {formatMoney(payByTotal)}{' '}
                        <span className="text-[11px] font-semibold text-teal-100">AED</span>
                    </p>
                    <p className="mt-1.5 text-[10px] font-medium text-teal-100">
                        {parties.length
                            ? `${parties.length} included`
                            : 'No pay split yet'}
                    </p>
                </div>
            </div>

            {parties.length ? (
                <div className="mt-3 rounded-xl border border-white/80 bg-white/80 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Included on this bill
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                        {parties.map((party) => {
                            const isEmployee = party.type === 'employee';
                            return (
                                <span
                                    key={party.key}
                                    title={`${party.fullName || party.label}: ${formatMoney(party.amount)} AED`}
                                    className={`inline-flex items-baseline gap-1 rounded-full border px-2.5 py-1 text-xs shadow-sm ${
                                        isEmployee
                                            ? 'border-amber-200 bg-amber-50 text-amber-950'
                                            : 'border-teal-200 bg-teal-50 text-teal-950'
                                    }`}
                                >
                                    <span className="font-semibold">{party.label}</span>
                                    <span className="opacity-50">:</span>
                                    <span className="font-bold tabular-nums">
                                        {formatMoney(party.amount)}
                                    </span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
