/**
 * HR Approval pay split: keep Approved = Company + Employee, and redistribute employee rows.
 * Also derives paymentByMode / pay % so Initiate Service reflects the same numbers.
 */

export function redistributeHrEmployeePayRows(rows, targetTotal) {
    const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
    if (!list.length) return list;
    const total = Number(targetTotal);
    if (!Number.isFinite(total) || total < 0) {
        return list.map((row) => ({ ...row, paidAmount: '' }));
    }
    const count = list.length;
    const base = Math.floor(total / count);
    const remainder = Math.round(total) - base * count;
    return list.map((row, index) => ({
        ...row,
        paidAmount: String(base + (index === 0 ? remainder : 0)),
    }));
}

export function sumHrEmployeeRowPaidAmounts(rows) {
    return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
        const n = Number(row?.paidAmount);
        return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
}

function clampMoney(value, max = Number.POSITIVE_INFINITY) {
    if (value === '' || value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.min(Math.round(n), Math.round(max));
}

function derivePayPercents(approvedAmount, companyPay, employeePay, paymentByMode) {
    const approved = Number(approvedAmount) || 0;
    const company = Number(companyPay) || 0;
    const employee = Number(employeePay) || 0;

    let nextMode = paymentByMode || 'company';
    if (employee <= 0 && company > 0) nextMode = 'company';
    else if (company <= 0 && employee > 0) nextMode = 'person';
    else if (company > 0 && employee > 0) nextMode = 'split';

    if (approved <= 0) {
        return {
            companyPayPercent: nextMode === 'person' ? '0' : '100',
            employeePayPercent: nextMode === 'person' ? '100' : '0',
            paymentByMode: nextMode,
        };
    }

    const employeePct = Math.min(100, Math.max(0, Math.round((employee / approved) * 100)));
    const companyPct = Math.min(100, Math.max(0, 100 - employeePct));
    return {
        companyPayPercent: String(companyPct),
        employeePayPercent: String(employeePct),
        paymentByMode: nextMode,
    };
}

/**
 * Recalculate HR review amounts when one field changes.
 * @param {'companyPay'|'employeePay'|'approvedAmount'} field
 */
export function syncHrReviewPayCalculation({
    field,
    value,
    approvedAmount,
    companyPay,
    employeePay,
    employeeRows = [],
    paymentByMode = 'company',
}) {
    const approved = Number(approvedAmount) || 0;
    let nextApproved = approved;
    let nextCompany = Number(companyPay) || 0;
    let nextEmployee = Number(employeePay) || 0;
    // Keep employee rows as-is — only Estimated / Company / Employee auto-sync.
    const nextRows = Array.isArray(employeeRows)
        ? employeeRows.map((row) => ({ ...row }))
        : [];

    if (field === 'approvedAmount') {
        const raw = value === '' || value == null ? '' : value;
        if (raw === '') {
            nextApproved = 0;
            nextCompany = 0;
            nextEmployee = 0;
        } else {
            const amt = clampMoney(raw, Number.POSITIVE_INFINITY);
            nextApproved = amt == null ? approved : amt;
            const mode = paymentByMode || 'company';
            if (mode === 'company') {
                nextCompany = nextApproved;
                nextEmployee = 0;
            } else if (mode === 'person') {
                nextCompany = 0;
                nextEmployee = nextApproved;
            } else {
                const prevApproved = approved > 0 ? approved : nextApproved;
                const ratio = prevApproved > 0 ? nextEmployee / prevApproved : 0.5;
                nextEmployee = Math.round(nextApproved * ratio);
                nextCompany = Math.max(0, nextApproved - nextEmployee);
            }
        }
    } else if (field === 'employeePay') {
        if (value === '' || value == null) {
            nextEmployee = 0;
            nextCompany = approved;
        } else {
            const emp = clampMoney(value, approved > 0 ? approved : Number.POSITIVE_INFINITY);
            nextEmployee = emp == null ? nextEmployee : emp;
            nextCompany = Math.max(0, approved - nextEmployee);
        }
    } else if (field === 'companyPay') {
        if (value === '' || value == null) {
            nextCompany = 0;
            nextEmployee = approved;
        } else {
            const company = clampMoney(value, approved > 0 ? approved : Number.POSITIVE_INFINITY);
            nextCompany = company == null ? nextCompany : company;
            nextEmployee = Math.max(0, approved - nextCompany);
        }
    }

    const percents = derivePayPercents(nextApproved, nextCompany, nextEmployee, paymentByMode);

    return {
        approvedAmount: nextApproved ? String(nextApproved) : value === '' && field === 'approvedAmount' ? '' : String(nextApproved || 0),
        companyPay: String(nextCompany),
        employeePay: String(nextEmployee),
        employeeRows: nextRows,
        ...percents,
    };
}

/** After editing employee paid-amount rows, keep Employee / Company / Approved totals in sync. */
export function syncHrReviewPayFromEmployeeRows({
    employeeRows,
    approvedAmount,
    companyPay,
    paymentByMode = 'split',
}) {
    const employee = Math.max(0, Math.round(sumHrEmployeeRowPaidAmounts(employeeRows)));
    const mode = String(paymentByMode || 'split').toLowerCase();

    if (mode === 'person') {
        const percents = derivePayPercents(employee, 0, employee, 'person');
        return {
            approvedAmount: employee ? String(employee) : '',
            companyPay: '0',
            employeePay: String(employee),
            employeeRows,
            ...percents,
        };
    }

    if (mode === 'company') {
        const approved = Number(approvedAmount) || employee;
        const percents = derivePayPercents(approved, approved, 0, 'company');
        return {
            approvedAmount: approved ? String(approved) : '',
            companyPay: approved ? String(approved) : '0',
            employeePay: '0',
            employeeRows,
            ...percents,
        };
    }

    // split: employee rows drive employee total; company stays; approved = company + employee
    const company =
        companyPay != null && companyPay !== ''
            ? Math.max(0, Math.round(Number(companyPay) || 0))
            : Math.max(0, Math.round((Number(approvedAmount) || 0) - employee));
    const approved = company + employee;
    const percents = derivePayPercents(approved, company, employee, 'split');
    return {
        approvedAmount: approved ? String(approved) : '',
        companyPay: String(company),
        employeePay: String(employee),
        employeeRows,
        ...percents,
    };
}

/** Remark fields to mirror Initiate Service payment split after HR edits. */
export function buildHrReviewInitiateRemarkPatch({
    approvedAmount,
    companyPay,
    employeePay,
    employeeRows,
    paymentByMode,
    companyPayPercent,
    employeePayPercent,
    companyPayPartyName,
    companyPayPartyId,
}) {
    const approvedAmountNum = Number(approvedAmount) || 0;
    const companyPayNum = Number(companyPay) || 0;
    const employeePayNum = Number(employeePay) || 0;
    const rows = (Array.isArray(employeeRows) ? employeeRows : []).map((row) => {
        const employeeId = row.employeeId;
        const employeeName = String(row.employeeName || row.name || '').trim();
        return {
            employeeId,
            ...(employeeName ? { employeeName } : {}),
            paidAmount: Number(row.paidAmount) || 0,
        };
    });
    const derived = derivePayPercents(
        approvedAmountNum,
        companyPayNum,
        employeePayNum,
        paymentByMode,
    );

    return {
        hrReviewApprovedAmount: approvedAmountNum || undefined,
        hrReviewCompanyPay: companyPayNum,
        hrReviewEmployeePay: employeePayNum,
        hrReviewEmployeeRows: rows,
        employeeLiabilityRows: rows,
        employeeLiabilityTotal: rows.reduce((sum, row) => sum + (Number(row.paidAmount) || 0), 0),
        estimatedCost: approvedAmountNum || undefined,
        companyPayPercent: companyPayPercent != null ? String(companyPayPercent) : derived.companyPayPercent,
        employeePayPercent: employeePayPercent != null ? String(employeePayPercent) : derived.employeePayPercent,
        // Always prefer mode derived from amounts so Initiate / Accounts stay consistent.
        paymentByMode: derived.paymentByMode || paymentByMode || 'company',
        companyPayAmount: companyPayNum,
        employeePayAmount: employeePayNum,
        ...(companyPayPartyId
            ? { companyPayPartyId: String(companyPayPartyId).trim() }
            : {}),
        ...(companyPayPartyName
            ? {
                  companyPayPartyName: String(companyPayPartyName).trim(),
                  companyName: String(companyPayPartyName).trim(),
              }
            : {}),
    };
}

/**
 * Auto-sync Estimated / Total / Company / Employee amounts.
 * Does NOT change individual employee row amounts — those stay manual + validated.
 */
export function syncInitiateServicePayAmounts({
    field,
    value,
    estimatedCost,
    companyPayAmount,
    employeePayAmount,
    paymentByMode = 'company',
    employeeLiabilityRows = [],
} = {}) {
    const mode = String(paymentByMode || 'company').toLowerCase();
    const prevCost = Math.max(0, Math.round(Number(estimatedCost) || 0));
    let nextCost = prevCost;
    let nextCompany = Math.max(0, Math.round(Number(companyPayAmount) || 0));
    let nextEmployee = Math.max(0, Math.round(Number(employeePayAmount) || 0));
    const nextRows = Array.isArray(employeeLiabilityRows)
        ? employeeLiabilityRows.map((row) => ({ ...row }))
        : [];

    const parseAmt = (raw) => {
        if (raw === '' || raw == null) return 0;
        const n = Math.round(Number(raw));
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    // Keep empty string while the user is clearing/retyping so backspace can remove "0".
    const clearing = value === '' || value == null;
    let companyPayOut = null;
    let employeePayOut = null;
    let costOut = null;

    if (field === 'estimatedCost' || field === 'totalAmount') {
        if (clearing) {
            nextCost = 0;
            costOut = '';
            if (mode === 'company') {
                nextCompany = 0;
                nextEmployee = 0;
                companyPayOut = '';
                employeePayOut = '0';
            } else if (mode === 'person') {
                nextCompany = 0;
                nextEmployee = 0;
                companyPayOut = '0';
                employeePayOut = '';
            } else {
                nextCompany = 0;
                nextEmployee = 0;
                companyPayOut = '';
                employeePayOut = '';
            }
        } else {
            nextCost = parseAmt(value);
            if (mode === 'company') {
                nextCompany = nextCost;
                nextEmployee = 0;
            } else if (mode === 'person') {
                nextCompany = 0;
                nextEmployee = nextCost;
            } else {
                const ratio = prevCost > 0 ? nextEmployee / prevCost : 0.5;
                nextEmployee = Math.round(nextCost * ratio);
                nextCompany = Math.max(0, nextCost - nextEmployee);
            }
        }
    } else if (field === 'companyPay') {
        if (clearing) {
            companyPayOut = '';
            if (mode === 'company') {
                nextCompany = 0;
                nextEmployee = 0;
                nextCost = 0;
                costOut = '';
            } else if (mode === 'split') {
                nextCompany = 0;
                nextEmployee = nextCost;
            }
        } else {
            const amt = parseAmt(value);
            if (mode === 'company') {
                nextCompany = amt;
                nextEmployee = 0;
                nextCost = nextCompany;
            } else if (mode === 'split') {
                nextCompany = Math.min(amt, nextCost);
                nextEmployee = Math.max(0, nextCost - nextCompany);
            }
        }
    } else if (field === 'employeePay') {
        if (clearing) {
            employeePayOut = '';
            if (mode === 'person') {
                nextEmployee = 0;
                nextCompany = 0;
                nextCost = 0;
                costOut = '';
            } else if (mode === 'split') {
                nextEmployee = 0;
                nextCompany = nextCost;
            }
        } else {
            const amt = parseAmt(value);
            if (mode === 'person') {
                nextEmployee = amt;
                nextCompany = 0;
                nextCost = nextEmployee;
            } else if (mode === 'split') {
                nextEmployee = Math.min(amt, nextCost);
                nextCompany = Math.max(0, nextCost - nextEmployee);
            }
        }
    }

    const percents = derivePayPercents(nextCost, nextCompany, nextEmployee, mode);

    return {
        estimatedCost: costOut != null ? costOut : nextCost ? String(nextCost) : '',
        quotation1Amount: costOut != null ? costOut : nextCost ? String(nextCost) : '',
        value: costOut != null ? costOut : nextCost ? String(nextCost) : '',
        companyPayAmount: companyPayOut != null ? companyPayOut : String(nextCompany),
        employeePayAmount: employeePayOut != null ? employeePayOut : String(nextEmployee),
        companyPayPercent: percents.companyPayPercent,
        employeePayPercent: percents.employeePayPercent,
        paymentByMode: mode,
        employeeLiabilityRows: nextRows,
    };
}

/** Prefer stored absolute company/employee amounts; fall back to % of estimated cost. */
export function resolveInitiateAbsolutePayAmounts({
    estimatedCost,
    companyPayPercent,
    employeePayPercent,
    companyPayAmount,
    employeePayAmount,
} = {}) {
    const cost = Math.max(0, Math.round(Number(estimatedCost) || 0));
    const hasCompanyAbs = companyPayAmount != null && String(companyPayAmount).trim() !== '';
    const hasEmployeeAbs = employeePayAmount != null && String(employeePayAmount).trim() !== '';
    const company = hasCompanyAbs
        ? Math.max(0, Math.round(Number(companyPayAmount) || 0))
        : Math.round((cost * (Number(companyPayPercent) || 0)) / 100);
    const employee = hasEmployeeAbs
        ? Math.max(0, Math.round(Number(employeePayAmount) || 0))
        : Math.round((cost * (Number(employeePayPercent) || 0)) / 100);
    return {
        estimatedCost: cost,
        companyPayAmount: company,
        employeePayAmount: employee,
    };
}

/**
 * Prefer live/saved HR absolute amounts only while they still match the Initiate
 * estimated cost and pay %. Once Initiate cost/% changes, recalculate so Company /
 * Employee Pay are not stuck on previous service values.
 */
export function resolveShopServicePayAmounts({
    estimatedCost,
    companyPayPercent,
    employeePayPercent,
    paymentByMode: paymentByModeOverride,
    remark = {},
    liveHrReview = null,
} = {}) {
    const cost = Number(estimatedCost) || 0;
    const companyPct = Number(companyPayPercent) || 0;
    const employeePct = Number(employeePayPercent) || 0;
    const preferredMode = paymentByModeOverride || remark?.paymentByMode || 'company';

    const fromPercents = () => ({
        estimatedCost: cost,
        companyPayAmount: Number.isFinite(cost) ? Math.round((cost * companyPct) / 100) : 0,
        employeePayAmount: Number.isFinite(cost) ? Math.round((cost * employeePct) / 100) : 0,
        paymentByMode: preferredMode,
    });

    const deriveMode = (company, employee) => {
        if (employee <= 0 && company > 0) return 'company';
        if (company <= 0 && employee > 0) return 'person';
        if (company > 0 && employee > 0) return 'split';
        return preferredMode;
    };

    const amountsMatchCost = (approved, company, employee) => {
        const approvedNum = Number(approved) || 0;
        const companyNum = Number(company) || 0;
        const employeeNum = Number(employee) || 0;
        const splitTotal = companyNum + employeeNum;
        if (cost <= 0) return true;
        if (approvedNum > 0 && Math.abs(cost - approvedNum) < 0.01) return true;
        if (splitTotal > 0 && Math.abs(cost - splitTotal) < 0.01) return true;
        return false;
    };

    const percentsMatchAmounts = (approved, company, employee) => {
        const approvedNum = Number(approved) || 0;
        const companyNum = Number(company) || 0;
        const employeeNum = Number(employee) || 0;
        const base = approvedNum > 0 ? approvedNum : companyNum + employeeNum;
        if (base <= 0) return true;
        const expectedCompany = Math.round((base * companyPct) / 100);
        const expectedEmployee = Math.round((base * employeePct) / 100);
        return (
            Math.abs(expectedCompany - companyNum) <= 1 &&
            Math.abs(expectedEmployee - employeeNum) <= 1
        );
    };

    const liveApproved = liveHrReview?.approvedAmount;
    const liveCompany = liveHrReview?.companyPay;
    const liveEmployee = liveHrReview?.employeePay;
    const liveMode = String(liveHrReview?.paymentByMode || '').toLowerCase();
    const hasLive =
        (liveCompany != null && liveCompany !== '') ||
        (liveEmployee != null && liveEmployee !== '') ||
        (liveApproved != null && liveApproved !== '') ||
        liveMode === 'person' ||
        liveMode === 'company' ||
        liveMode === 'split';

    // Prefer live HR absolutes while they still match Initiate estimated cost.
    // If Initiate cost diverges (e.g. employee row edits), recalculate from percents.
    if (hasLive && amountsMatchCost(liveApproved, liveCompany, liveEmployee)) {
        const approved =
            Number(liveApproved) ||
            cost ||
            Number(remark?.hrReviewApprovedAmount) ||
            Number(remark?.estimatedCost) ||
            0;
        const company = liveCompany != null && liveCompany !== '' ? Number(liveCompany) || 0 : 0;
        const employee = liveEmployee != null && liveEmployee !== '' ? Number(liveEmployee) || 0 : 0;
        const liveModeExplicit =
            liveMode === 'person' || liveMode === 'company' || liveMode === 'split';
        return {
            estimatedCost: approved,
            companyPayAmount: company,
            employeePayAmount: employee,
            paymentByMode: liveModeExplicit ? liveMode : deriveMode(company, employee),
        };
    }

    const absApproved = remark?.hrReviewApprovedAmount ?? remark?.estimatedCost;
    const absCompany = remark?.hrReviewCompanyPay ?? remark?.companyPayAmount;
    const absEmployee = remark?.hrReviewEmployeePay ?? remark?.employeePayAmount;
    const hasAbsolute =
        (absCompany != null && absCompany !== '') || (absEmployee != null && absEmployee !== '');

    if (
        hasAbsolute &&
        amountsMatchCost(absApproved, absCompany, absEmployee) &&
        percentsMatchAmounts(absApproved, absCompany, absEmployee)
    ) {
        const approved = Number(absApproved) || cost || 0;
        const company = absCompany != null && absCompany !== '' ? Number(absCompany) || 0 : 0;
        const employee = absEmployee != null && absEmployee !== '' ? Number(absEmployee) || 0 : 0;
        return {
            estimatedCost: approved,
            companyPayAmount: company,
            employeePayAmount: employee,
            paymentByMode: deriveMode(company, employee),
        };
    }

    return fromPercents();
}
