/**
 * Shared service window date rules for Oil / Tire / Mechanical / Body / Accident:
 * - start >= today
 * - end >= start
 */

export function localYmd(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function normalizeServiceScheduleDate(value) {
    if (value == null || String(value).trim() === '') return '';
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return localYmd(d);
}

function startOfLocalDayFromYmd(ymd) {
    const key = normalizeServiceScheduleDate(ymd);
    if (!key) return null;
    const [y, m, d] = key.split('-').map((n) => Number(n));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

/** DatePicker: block days before today (start date). */
export function serviceStartDisabledDays() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { before: today };
}

/** DatePicker: block days before start (or today if start empty). */
export function serviceEndDisabledDays(serviceStartDate) {
    const fromStart = startOfLocalDayFromYmd(serviceStartDate);
    if (fromStart) return { before: fromStart };
    return serviceStartDisabledDays();
}

/**
 * Validate service start/end.
 * @returns {{ serviceStartDate?: string, serviceEndDate?: string }}
 */
export function validateServiceScheduleDates(
    formData = {},
    { requireBoth = true, requireStartFromToday = true } = {},
) {
    const errors = {};
    const start = normalizeServiceScheduleDate(
        formData.serviceStartDate || formData.scheduledServiceDate || '',
    );
    const end = normalizeServiceScheduleDate(
        formData.serviceEndDate ||
            formData.serviceWindowEndDate ||
            formData.nextChangeMonth ||
            '',
    );
    const today = localYmd();

    if (requireBoth && !start) {
        errors.serviceStartDate = 'Service start date is required';
    } else if (start && requireStartFromToday && start < today) {
        errors.serviceStartDate = 'Service start date must be today or later';
    }

    if (requireBoth && !end) {
        errors.serviceEndDate = 'Service end date is required';
    } else if (end && start && end < start) {
        errors.serviceEndDate = 'Service end date must be on or after the start date';
    }

    return errors;
}
