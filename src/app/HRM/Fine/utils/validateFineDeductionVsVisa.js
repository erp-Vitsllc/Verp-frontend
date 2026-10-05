/** Required salary deduction month and duration. Visa expiry applies to loan and advance only. */
import { isEndOfServiceFineSource } from '@/app/HRM/Fine/utils/fineScheduleUtils';

function parseMonthStart(yyyyMM) {
    const raw = String(yyyyMM || '').trim();
    if (!/^\d{4}-\d{2}$/.test(raw)) return null;
    const [y, m] = raw.split('-').map(Number);
    if (m < 1 || m > 12) return null;
    return new Date(y, m - 1, 1);
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
}) {
    const errors = {};
    const duration = parseInt(String(payableDuration ?? ''), 10);

    if (!monthStart || !String(monthStart).trim()) {
        errors.monthStart = 'Payable from month is required';
        return errors;
    }

    if (!parseMonthStart(monthStart)) {
        errors.monthStart = 'Payable from month must be valid (YYYY-MM)';
        return errors;
    }

    if (!Number.isFinite(duration) || duration < 1) {
        errors.payableDuration = 'Fine payable duration is required';
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
    getDurationForEmployee,
}) {
    const scheduleMessages = [];
    const merged = {};

    for (const record of selectedEmployeeRecords) {
        const empId = record?.employeeId;
        if (!empId || empId === 'VEGA-HR-0000') continue;

        const duration = getDurationForEmployee
            ? getDurationForEmployee(record)
            : payableDuration;

        const visaErrors = validateFineDeductionVsVisa({
            monthStart,
            payableDuration: duration,
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
}) {
    if (isEndOfServiceFineSource(initialData?.sourceOfIncome)) {
        return null;
    }

    const empId =
        initialData?.assignedEmployees?.[0]?.employeeId ||
        initialData?.employeeId ||
        '';
    if (!empId || empId === 'VEGA-HR-0000') return null;

    return validateFineDeductionVsVisa({
        monthStart,
        payableDuration,
    });
}
