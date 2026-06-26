/** Salary deduction schedule vs employee visa expiry (shared across fine modals). */
import { isEndOfServiceFineSource } from '@/app/HRM/Fine/utils/fineScheduleUtils';

export function resolveEmployeeVisaExpiry(employee) {
    if (!employee) return null;

    if (employee.visaExpiry) {
        const direct = new Date(employee.visaExpiry);
        if (!Number.isNaN(direct.getTime())) return direct;
    }

    const details = employee.visaDetails;
    if (!details) return null;

    const candidates = [
        details.employment?.expiryDate,
        details.spouse?.expiryDate,
        details.visit?.expiryDate,
    ].filter(Boolean);

    for (const dateStr of candidates) {
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) return d;
    }

    return null;
}

function parseMonthStart(yyyyMM) {
    const raw = String(yyyyMM || '').trim();
    if (!/^\d{4}-\d{2}$/.test(raw)) return null;
    const [y, m] = raw.split('-').map(Number);
    if (m < 1 || m > 12) return null;
    return new Date(y, m - 1, 1);
}

function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

function lastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatMonthYear(date) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function shouldValidateFineDeductionSchedule(responsibleFor) {
    return String(responsibleFor || 'Employee').trim() !== 'Company';
}

/**
 * @returns {Record<string, string> | null}
 */
export function validateFineDeductionVsVisa({
    monthStart,
    payableDuration,
    employee,
    employeeLabel,
}) {
    const errors = {};
    const duration = parseInt(String(payableDuration ?? ''), 10);

    if (!monthStart || !String(monthStart).trim()) {
        errors.monthStart = 'Payable from month is required';
        return errors;
    }

    const startDate = parseMonthStart(monthStart);
    if (!startDate) {
        errors.monthStart = 'Payable from month must be valid (YYYY-MM)';
        return errors;
    }

    if (!Number.isFinite(duration) || duration < 1) {
        errors.payableDuration = 'Fine payable duration is required';
        return errors;
    }

    const visaExpiry = resolveEmployeeVisaExpiry(employee);
    const name = employeeLabel || employee?.employeeId || 'Employee';

    if (!visaExpiry) {
        const message = `${name}: visa expiry date is not available. Cannot set salary deduction schedule.`;
        errors.deductionSchedule = message;
        errors.monthStart = message;
        return errors;
    }

    const visaDay = new Date(visaExpiry);
    visaDay.setHours(0, 0, 0, 0);

    const endMonthStart = addMonths(startDate, duration - 1);
    const lastDeductionDay = lastDayOfMonth(endMonthStart);

    if (lastDeductionDay >= visaDay) {
        const endLabel = formatMonthYear(endMonthStart);
        const visaLabel = formatMonthYear(visaDay);
        const message = `${name}: deduction end month (${endLabel}) must be before visa expiry (${visaLabel}). Reduce duration or change start month.`;
        errors.deductionSchedule = message;
        errors.monthStart = message;
        errors.payableDuration = message;
        return errors;
    }

    return null;
}

export function mergeFineDeductionVisaErrors(targetErrors, visaErrors) {
    if (!visaErrors) return targetErrors;
    return { ...targetErrors, ...visaErrors };
}

/**
 * Validate each assigned employee against shared or per-employee duration.
 */
export function validateEmployeesDeductionVsVisa({
    monthStart,
    payableDuration,
    selectedEmployeeRecords = [],
    employees = [],
    getDurationForEmployee,
}) {
    const scheduleMessages = [];
    const merged = {};

    for (const record of selectedEmployeeRecords) {
        const empId = record?.employeeId;
        if (!empId || empId === 'VEGA-HR-0000') continue;

        const employee = employees.find((e) => e.employeeId === empId);
        const duration = getDurationForEmployee
            ? getDurationForEmployee(record)
            : payableDuration;
        const label = record.employeeName || empId;

        const visaErrors = validateFineDeductionVsVisa({
            monthStart,
            payableDuration: duration,
            employee,
            employeeLabel: label,
        });

        if (!visaErrors) continue;

        if (visaErrors.deductionSchedule) {
            scheduleMessages.push(visaErrors.deductionSchedule);
        }
        Object.assign(merged, visaErrors);
    }

    if (scheduleMessages.length > 0) {
        merged.deductionSchedule = scheduleMessages.join(' ');
    }

    return Object.keys(merged).length > 0 ? merged : null;
}

export function validateApprovedFineScheduleEdit({
    monthStart,
    payableDuration,
    initialData,
    employees = [],
}) {
    if (isEndOfServiceFineSource(initialData?.sourceOfIncome)) {
        return null;
    }

    const empId =
        initialData?.assignedEmployees?.[0]?.employeeId ||
        initialData?.employeeId ||
        '';
    if (!empId || empId === 'VEGA-HR-0000') return null;

    const employee = employees.find((e) => e.employeeId === empId);
    const label =
        initialData?.assignedEmployees?.[0]?.employeeName ||
        initialData?.employeeName ||
        empId;

    return validateFineDeductionVsVisa({
        monthStart,
        payableDuration,
        employee,
        employeeLabel: label,
    });
}
