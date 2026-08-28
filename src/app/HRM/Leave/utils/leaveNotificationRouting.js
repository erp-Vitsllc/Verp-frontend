function parseMeta(extra3) {
    if (!extra3) return {};
    if (typeof extra3 === 'object') return extra3;
    try {
        return JSON.parse(String(extra3));
    } catch {
        return {};
    }
}

function isDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

export function isLeaveDashboardNotification(item = {}) {
    const type = String(item?.type || item?.requestType || '').trim();
    const meta = parseMeta(item?.extra3);
    if (meta?.leaveDashboard) return true;
    if (type === 'Employee Leave Request') return true;
    const kind = String(
        item?.leaveRequestKind || meta?.leaveRequestKind || meta?.kind || '',
    ).trim();
    return kind === 'leave' || kind === 'future_leave' || kind === 'future_annual';
}

export function buildLeaveDashboardNotificationPath(item = {}) {
    const meta = parseMeta(item?.extra3);
    if (meta?.hubRequest && !isDateKey(meta?.from) && !isDateKey(item?.startDateKey)) {
        return '/HRM/Leave/annual-leave';
    }

    const from = String(meta?.from || item?.startDateKey || item?.extra1 || item?.date || '').trim();
    const to = String(meta?.to || item?.endDateKey || from).trim();
    const attendanceId = String(
        meta?.attendanceId ||
            (!meta?.hubRequest && (item?.requestObjectId || item?.id || item?.dashboardActionId)) ||
            '',
    ).trim();

    const params = new URLSearchParams();
    if (isDateKey(from)) params.set('from', from);
    if (isDateKey(to)) params.set('to', to);
    if (attendanceId && !meta?.hubRequest) params.set('approvalId', attendanceId);
    const query = params.toString();
    return query ? `/HRM/Leave/annual-leave?${query}` : '/HRM/Leave/annual-leave';
}
