import { format, isValid, startOfDay } from 'date-fns';
import { normalizeWorkLocationKey } from '@/utils/workLocations';

export function markAttendanceHref({ date, staffType } = {}) {
    const params = new URLSearchParams();
    if (date instanceof Date && isValid(date)) {
        params.set('date', format(startOfDay(date), 'yyyy-MM-dd'));
    } else {
        const key = String(date || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) params.set('date', key);
    }
    const group = normalizeWorkLocationKey(staffType);
    if (group) params.set('staffType', group);
    const query = params.toString();
    return query ? `/HRM/Attendance/mark?${query}` : '/HRM/Attendance/mark';
}
