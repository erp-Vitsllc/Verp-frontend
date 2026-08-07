/**
 * Build Make Payment / Zoho "Payable from" rows from Initiate + HR pay split.
 * Company + each employee get their own line; total = full approved amount (not company-only).
 */

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function normalizeId(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'object') {
        if (typeof value.$oid === 'string') return value.$oid.trim();
        if (value._id != null) return normalizeId(value._id);
        if (value.id != null) return normalizeId(value.id);
    }
    return String(value).trim();
}

/** Build lookup map: mongo id, raw id, and employee code → display name. */
export function buildEmployeeNameByIdMap(employees = []) {
    const map = {};
    (Array.isArray(employees) ? employees : []).forEach((emp) => {
        const label =
            `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() ||
            String(emp?.employeeId || '').trim() ||
            '';
        if (!label) return;
        const ids = [
            normalizeId(emp?._id),
            normalizeId(emp?.id),
            String(emp?._id || '').trim(),
            String(emp?.id || '').trim(),
            String(emp?.employeeId || '').trim(),
        ].filter(Boolean);
        ids.forEach((key) => {
            if (!key || key === '[object Object]') return;
            map[key] = label;
            map[String(key).toLowerCase()] = label;
        });
    });
    return map;
}

export function resolveEmployeeDisplayName(row, employeeNameById = {}) {
    const named = String(row?.employeeName || row?.name || '').trim();
    if (named && !/^Employee\b/i.test(named)) return named;

    const raw = row?.employeeId;
    const id = normalizeId(raw);
    const candidates = [id, String(raw || '').trim(), id.toLowerCase()].filter(Boolean);
    for (const key of candidates) {
        const hit = String(employeeNameById[key] || '').trim();
        if (hit) return hit;
    }
    // Last-resort: match by id suffix (handles truncated / alternate id forms).
    if (id.length >= 6) {
        const suffix = id.slice(-6).toLowerCase();
        for (const [key, label] of Object.entries(employeeNameById)) {
            if (String(key).toLowerCase().endsWith(suffix) && label) {
                return String(label).trim();
            }
        }
    }
    const fromRow = String(row?.partyName || '').trim();
    if (fromRow && !/^Employee\s*\(/i.test(fromRow) && !/^Employee$/i.test(fromRow)) {
        return fromRow;
    }
    return '';
}

export function resolveVehicleServiceBillingTotal(service, remark = {}) {
    const company = money(remark.hrReviewCompanyPay ?? remark.companyPayAmount);
    const employee = money(remark.hrReviewEmployeePay ?? remark.employeePayAmount);
    const splitSum = company + employee;

    return (
        money(remark.billingTotalAmount) ||
        money(remark.garageBillAmount) ||
        money(remark.hrReviewApprovedAmount) ||
        money(remark.estimatedCost) ||
        money(remark.approvedAmount) ||
        money(remark.totalServiceCharge) ||
        money(service?.value) ||
        (splitSum > 0 ? splitSum : 0) ||
        company ||
        0
    );
}

function mapExistingBillingLine(row) {
    return {
        partyType: String(row?.partyType || '').trim() || undefined,
        partyName: String(row?.partyName || row?.description || row?.employeeName || '').trim(),
        description: String(row?.description || row?.partyName || row?.employeeName || '').trim(),
        employeeId: normalizeId(row?.employeeId) || undefined,
        payableTo: String(row?.payableTo || row?.payAccountName || '').trim(),
        payAccountId: String(row?.payAccountId || row?.accountId || '').trim(),
        amount: row?.amount != null && row?.amount !== '' ? String(row.amount) : '',
    };
}

function hasCommittedPayAccount(lines) {
    return (Array.isArray(lines) ? lines : []).some((row) => String(row?.payAccountId || '').trim());
}

function isPlaceholderPartyName(name) {
    const s = String(name || '').trim();
    if (!s) return true;
    if (/^Employee\b/i.test(s)) return true;
    if (/^Company$/i.test(s)) return true;
    return false;
}

/**
 * Prefer saved payables only after Accounts has picked Chart of Accounts.
 * Otherwise rebuild from HR/Initiate pay split so totals stay correct.
 */
export function buildVehicleServiceBillingPayables(service, remark = {}, options = {}) {
    const {
        employeeNameById = {},
        companyName = 'Company',
    } = options;

    const existingLines = Array.isArray(remark.billingPayables) ? remark.billingPayables : [];
    if (existingLines.length && hasCommittedPayAccount(existingLines)) {
        return existingLines.map((row) => {
            const mapped = mapExistingBillingLine(row);
            if (mapped.partyType === 'employee' || mapped.employeeId) {
                const resolved = resolveEmployeeDisplayName(
                    { employeeId: mapped.employeeId, partyName: mapped.partyName },
                    employeeNameById,
                );
                if (resolved && isPlaceholderPartyName(mapped.partyName)) {
                    mapped.partyName = resolved;
                    mapped.description = resolved;
                    mapped.partyType = mapped.partyType || 'employee';
                }
            }
            if (
                (mapped.partyType === 'company' || !mapped.employeeId) &&
                isPlaceholderPartyName(mapped.partyName) &&
                companyName &&
                companyName !== 'Company'
            ) {
                mapped.partyName = companyName;
                mapped.description = companyName;
                mapped.partyType = mapped.partyType || 'company';
            }
            return mapped;
        });
    }

    const lines = [];
    const mode = String(remark.paymentByMode || '').toLowerCase().trim();
    const companyPay = money(remark.hrReviewCompanyPay ?? remark.companyPayAmount);
    const includeCompany = companyPay > 0 && mode !== 'person';

    if (includeCompany) {
        const label = String(companyName || 'Company').trim() || 'Company';
        lines.push({
            partyType: 'company',
            partyName: label,
            description: label,
            payableTo: '',
            payAccountId: '',
            amount: String(companyPay),
        });
    }

    const empSource =
        Array.isArray(remark.hrReviewEmployeeRows) && remark.hrReviewEmployeeRows.length
            ? remark.hrReviewEmployeeRows
            : Array.isArray(remark.employeeLiabilityRows)
              ? remark.employeeLiabilityRows
              : [];

    if (mode !== 'company') {
        empSource.forEach((row) => {
            const amount = money(row?.paidAmount);
            if (!(amount > 0)) return;
            const employeeId = normalizeId(row?.employeeId);
            const resolved = resolveEmployeeDisplayName(row, employeeNameById);
            const name = resolved || 'Employee';
            lines.push({
                partyType: 'employee',
                partyName: name,
                description: name,
                employeeId: employeeId || undefined,
                payableTo: '',
                payAccountId: '',
                amount: String(amount),
            });
        });
    }

    if (lines.length) return lines;

    const total = resolveVehicleServiceBillingTotal(service, remark);
    const fallbackLabel = String(companyName || 'Company').trim() || 'Company';
    return [
        {
            partyType: 'company',
            partyName: fallbackLabel,
            description: fallbackLabel,
            payableTo: String(remark.payAccountName || remark.garagePayAccountName || '').trim(),
            payAccountId: String(remark.payAccountId || remark.garagePayAccountId || '').trim(),
            amount: total > 0 ? String(total) : '',
        },
    ];
}
