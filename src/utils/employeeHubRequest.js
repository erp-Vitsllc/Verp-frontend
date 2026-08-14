export const HUB_KINDS = [
    { key: 'leave', label: 'Leave' },
    { key: 'fine', label: 'Fine' },
    { key: 'advance', label: 'Advance' },
    { key: 'assets', label: 'Assets' },
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'utility', label: 'Utility Bill' },
];

export const HUB_DASHBOARD_TYPES = new Set([
    'Employee Leave Request',
    'Employee Fine Request',
    'Employee Advance Request',
    'Employee Asset Request',
    'Employee Vehicle Request',
    'Employee Utility Request',
]);

export function parseHubRequestMeta(extra3) {
    if (!extra3) return null;
    if (typeof extra3 === 'object') {
        return extra3.hubRequest ? extra3 : null;
    }
    try {
        const parsed = JSON.parse(String(extra3));
        return parsed?.hubRequest ? parsed : null;
    } catch {
        return null;
    }
}

export function isEmployeeHubRequestItem(item = {}) {
    const type = String(item?.type || item?.requestType || '').trim();
    if (HUB_DASHBOARD_TYPES.has(type)) return true;
    if (item?.hubRequest === true) return true;
    return Boolean(parseHubRequestMeta(item?.extra3));
}

export function buildEmployeeHubDashboardPath(item = {}) {
    const meta = parseHubRequestMeta(item?.extra3) || {};
    const id = String(
        item?.requestObjectId ||
            item?.id ||
            item?.requestId ||
            item?.dashboardActionId ||
            item?.primaryFineId ||
            '',
    ).trim();
    if (!id) return '';
    const qs = new URLSearchParams({ hubRequestId: id });
    const emp =
        meta.requesterMongoId ||
        item?.employeeMongoId ||
        item?.subjectMongoId ||
        item?.targetEmployeeId ||
        '';
    if (emp) qs.set('viewEmployee', String(emp));
    return `/dashboard?${qs.toString()}`;
}
