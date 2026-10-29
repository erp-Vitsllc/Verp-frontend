import { format, isValid, startOfDay } from 'date-fns';
import { normalizeWorkLocationKey } from '@/utils/workLocations';

export function markAttendanceHref({ date, staffType, blinkEmployee } = {}) {
    const params = new URLSearchParams();
    if (date instanceof Date && isValid(date)) {
        params.set('date', format(startOfDay(date), 'yyyy-MM-dd'));
    } else {
        const key = String(date || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) params.set('date', key);
    }
    const group = normalizeWorkLocationKey(staffType);
    if (group) params.set('staffType', group);
    const employee = String(blinkEmployee || '').trim();
    if (employee) params.set('blinkEmployee', employee);
    const query = params.toString();
    return query ? `/HRM/Attendance/mark?${query}` : '/HRM/Attendance/mark';
}

function dateKeyOf(value) {
    const key = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
}

/** Open Mark Attendance on the request day, same as an app attendance request. */
export function attendanceRequestMarkHref({
    date,
    staffType,
    attendanceId,
    employeeId,
    kind,
    type,
} = {}) {
    const params = new URLSearchParams();
    const day = dateKeyOf(date);
    if (day) params.set('date', day);
    const group = normalizeWorkLocationKey(staffType) || 'office';
    params.set('staffType', group);
    const employee = String(employeeId || '').trim();
    if (employee) params.set('blinkEmployee', employee);
    const id = String(attendanceId || '').trim();
    const typeKey = String(type || '').toLowerCase();
    const kindKey = String(kind || '').toLowerCase();
    const blinkOnly = kindKey === 'off_day_work' || typeKey.includes('off day work');
    if (!blinkOnly && id && (typeKey.includes('flexible ot') || kindKey === 'flexible_ot')) {
        params.set('otAttendanceId', id);
    } else if (!blinkOnly && id && (typeKey.includes('hour') || kindKey === 'hour_adjust')) {
        params.set('hourAttendanceId', id);
    } else if (!blinkOnly && id && (typeKey.includes('change') || kindKey === 'attendance_change')) {
        params.set('changeRequestId', id);
    } else if (!blinkOnly && id) {
        params.set('leaveAttendanceId', id);
    }
    const query = params.toString();
    return query ? `/HRM/Attendance/mark?${query}` : '/HRM/Attendance/mark';
}
