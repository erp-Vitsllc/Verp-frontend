/** Same day colors as the employee attendance calendar. */

export function groupCalendarDayKind(
    statusKey,
    { isFuture = false, isToday = false, isHoliday = false, isWeeklyOff = false, beforeStart = false } = {},
) {
    const key = String(statusKey || '');
    if (key === 'on_office' || key === 'work_from_home') return 'present';
    if (key === 'late_arrived' || key === 'early_go' || key === 'mispunch') return 'attention';
    if (key === 'sick_leave') return 'sick';
    if (key === 'authorized_leave') return 'authorized';
    if (key === 'on_leave') return 'annual';
    if (key === 'compoff_leave') return 'compoff';
    if (beforeStart) return 'empty';
    if (key === 'holiday' || isHoliday) return 'holiday';
    if (key === 'weekly_off' || isWeeklyOff) return 'weekend';
    // Pending or unmarked future leave is not unauthorized. That color is for past days only.
    if (isFuture) return 'future';
    if (key === 'unauthorized_leave' || key === 'not_marked') return 'absent';
    if (isToday) return 'future';
    if (!key) return 'absent';
    return 'empty';
}

export const GROUP_CALENDAR_DAY_STYLE = {
    present: 'bg-[#4ADE80] text-white',
    attention: 'bg-[#FACC15] text-[#713F12]',
    absent: 'bg-[#F87171] text-white',
    sick: 'bg-[#86EFAC] text-[#14532D]',
    authorized: 'bg-[#3B82F6] text-white',
    annual: 'bg-[#A78BFA] text-white',
    compoff: 'bg-[#2DD4BF] text-white',
    holiday: 'bg-[#FDBA74] text-[#7C2D12]',
    weekend: 'bg-[#E8EDF3] text-[#94A3B8]',
    empty: 'bg-[#F8FAFC] text-[#CBD5E1]',
    future: 'bg-[#F8FAFC] text-[#94A3B8]',
    outside: 'bg-[#F1F5F9] text-[#94A3B8]',
};

export const GROUP_CALENDAR_LEGEND = [
    { key: 'present', label: 'Present', swatch: 'bg-[#4ADE80]' },
    { key: 'attention', label: 'Late / Missed Punch', swatch: 'bg-[#FACC15]' },
    { key: 'absent', label: 'Unauthorized / Absent', swatch: 'bg-[#F87171]' },
    { key: 'sick', label: 'Sick Leave', swatch: 'bg-[#86EFAC]' },
    { key: 'authorized', label: 'Authorized Leave', swatch: 'bg-[#3B82F6]' },
    { key: 'annual', label: 'Annual Leave', swatch: 'bg-[#A78BFA]' },
    { key: 'compoff', label: 'Comp Off', swatch: 'bg-[#2DD4BF]' },
    { key: 'holiday', label: 'Holiday', swatch: 'bg-[#FDBA74]' },
    { key: 'weekend', label: 'Weekly Off', swatch: 'bg-[#CBD5E1]' },
];

export function groupCalendarDayLabel(kind) {
    return GROUP_CALENDAR_LEGEND.find((item) => item.key === kind)?.label || 'No mark';
}

/**
 * Short label inside a calendar cell.
 * Approved overtime stays OT. A comp-off day, or the next day marked from that overtime, is COMPOFF.
 */
export function attendanceCellTag(record, note = null) {
    if (!record && !note) return '';
    const timeIn = String(record?.timeIn || '').trim();
    const timeOut = String(record?.timeOut || '').trim();
    const placeholder = timeIn === 'OT' || timeOut === 'OT';
    const status = String(record?.statusKey || '');
    const takenFrom = String(note?.takenFrom || record?.flexibleFromOtDate || '').trim();
    const givenTo = String(note?.givenTo || record?.flexibleOtNextDayDate || '').trim();
    const compOff = status === 'compoff_leave' || placeholder || Boolean(takenFrom) || Boolean(givenTo);
    const noteHours = Number(note?.otHours) || 0;
    const approvedHours = String(record?.flexibleOtStatus || '') === 'approved'
        ? Number(record?.flexibleOtApprovedHours) || 0
        : 0;
    if ((noteHours > 0 || approvedHours > 0) && !compOff) return 'OT';
    if (compOff) return 'COMPOFF';
    return '';
}
