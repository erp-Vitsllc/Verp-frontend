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
    let nextRows = Array.isArray(employeeRows) ? employeeRows : [];

    if (field === 'approvedAmount') {
        const raw = value === '' || value == null ? '' : value;
        if (raw === '') {
            nextApproved = 0;
            nextCompany = 0;
            nextEmployee = 0;
            nextRows = redistributeHrEmployeePayRows(nextRows, 0);
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
                // Keep current employee share ratio when possible.
                const prevApproved = approved > 0 ? approved : nextApproved;
                const ratio = prevApproved > 0 ? nextEmployee / prevApproved : 0.5;
                nextEmployee = Math.round(nextApproved * ratio);
                nextCompany = Math.max(0, nextApproved - nextEmployee);
            }
            nextRows = redistributeHrEmployeePayRows(nextRows, nextEmployee);
        }
    } else if (field === 'employeePay') {
        if (value === '' || value == null) {
            nextEmployee = 0;
            nextCompany = approved;
            nextRows = redistributeHrEmployeePayRows(nextRows, 0);
        } else {
            const emp = clampMoney(value, approved > 0 ? approved : Number.POSITIVE_INFINITY);
            nextEmployee = emp == null ? nextEmployee : emp;
            nextCompany = Math.max(0, approved - nextEmployee);
            nextRows = redistributeHrEmployeePayRows(nextRows, nextEmployee);
        }
    } else if (field === 'companyPay') {
        if (value === '' || value == null) {
            nextCompany = 0;
            nextEmployee = approved;
            nextRows = redistributeHrEmployeePayRows(nextRows, nextEmployee);
        } else {
            const company = clampMoney(value, approved > 0 ? approved : Number.POSITIVE_INFINITY);
            nextCompany = company == null ? nextCompany : company;
            nextEmployee = Math.max(0, approved - nextCompany);
            nextRows = redistributeHrEmployeePayRows(nextRows, nextEmployee);
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

/** After editing a single employee paid-amount row, keep Employee/Company totals consistent. */
export function syncHrReviewPayFromEmployeeRows({
    employeeRows,
    approvedAmount,
    paymentByMode = 'split',
}) {
    const approved = Number(approvedAmount) || 0;
    const employee = Math.max(0, Math.round(sumHrEmployeeRowPaidAmounts(employeeRows)));
    const cappedEmployee = approved > 0 ? Math.min(employee, approved) : employee;
    const company = Math.max(0, approved - cappedEmployee);
    const percents = derivePayPercents(approved, company, cappedEmployee, paymentByMode);
    return {
        approvedAmount: approved ? String(approved) : '',
        companyPay: String(company),
        employeePay: String(cappedEmployee),
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
}) {
    const approvedAmountNum = Number(approvedAmount) || 0;
    const companyPayNum = Number(companyPay) || 0;
    const employeePayNum = Number(employeePay) || 0;
    const rows = (Array.isArray(employeeRows) ? employeeRows : []).map((row) => ({
        employeeId: row.employeeId,
        paidAmount: Number(row.paidAmount) || 0,
    }));
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
    };
}

/**
 * Prefer absolute HR / remark pay amounts over % × estimated cost
 * so Initiate Service shows the same numbers HR edited.
 */
export function resolveShopServicePayAmounts({
    estimatedCost,
    companyPayPercent,
    employeePayPercent,
    remark = {},
    liveHrReview = null,
} = {}) {
    const liveApproved = liveHrReview?.approvedAmount;
    const liveCompany = liveHrReview?.companyPay;
    const liveEmployee = liveHrReview?.employeePay;

    const hasLive =
        (liveCompany != null && liveCompany !== '') ||
        (liveEmployee != null && liveEmployee !== '') ||
        (liveApproved != null && liveApproved !== '');

    if (hasLive) {
        const approved =
            Number(liveApproved) ||
            Number(estimatedCost) ||
            Number(remark?.hrReviewApprovedAmount) ||
            Number(remark?.estimatedCost) ||
            0;
        const company = liveCompany != null && liveCompany !== '' ? Number(liveCompany) || 0 : 0;
        const employee = liveEmployee != null && liveEmployee !== '' ? Number(liveEmployee) || 0 : 0;
        return {
            estimatedCost: approved,
            companyPayAmount: company,
            employeePayAmount: employee,
            paymentByMode:
                employee <= 0 && company > 0
                    ? 'company'
                    : company <= 0 && employee > 0
                      ? 'person'
                      : company > 0 && employee > 0
                        ? 'split'
                        : remark?.paymentByMode || 'company',
        };
    }

    const absApproved = remark?.hrReviewApprovedAmount ?? remark?.estimatedCost ?? estimatedCost;
    const absCompany = remark?.hrReviewCompanyPay ?? remark?.companyPayAmount;
    const absEmployee = remark?.hrReviewEmployeePay ?? remark?.employeePayAmount;
    const hasAbsolute =
        (absCompany != null && absCompany !== '') || (absEmployee != null && absEmployee !== '');

    if (hasAbsolute) {
        const approved = Number(absApproved) || Number(estimatedCost) || 0;
        const company = absCompany != null && absCompany !== '' ? Number(absCompany) || 0 : 0;
        const employee = absEmployee != null && absEmployee !== '' ? Number(absEmployee) || 0 : 0;
        return {
            estimatedCost: approved,
            companyPayAmount: company,
            employeePayAmount: employee,
            paymentByMode:
                employee <= 0 && company > 0
                    ? 'company'
                    : company <= 0 && employee > 0
                      ? 'person'
                      : company > 0 && employee > 0
                        ? 'split'
                        : remark?.paymentByMode || 'company',
        };
    }

    const cost = Number(estimatedCost) || 0;
    const companyPct = Number(companyPayPercent) || 0;
    const employeePct = Number(employeePayPercent) || 0;
    return {
        estimatedCost: cost,
        companyPayAmount: Number.isFinite(cost) ? Math.round((cost * companyPct) / 100) : 0,
        employeePayAmount: Number.isFinite(cost) ? Math.round((cost * employeePct) / 100) : 0,
        paymentByMode: remark?.paymentByMode || 'company',
    };
}
