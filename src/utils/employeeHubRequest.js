// Kinds offered in the dashboard Request card.
export const HUB_KINDS = [
    { key: 'leave', label: 'Leave' },
    { key: 'advance', label: 'Advance' },
    { key: 'loan', label: 'Loan' },
    { key: 'salary', label: 'Salary' },
    { key: 'certificate', label: 'Certificate' },
    { key: 'assets', label: 'Assets' },
];

// Asset areas an employee picks before writing an asset request.
export const HUB_ASSET_TYPES = [
    { key: 'Vehicle', label: 'Vehicle' },
    { key: 'Tools', label: 'Tools' },
    { key: 'Utility Bill', label: 'Utility Bill' },
];

// Includes retired kinds so older requests still route and render correctly.
export const HUB_DASHBOARD_TYPES = new Set([
    'Employee Leave Request',
    'Employee Advance Request',
    'Employee Loan Request',
    'Employee Salary Request',
    'Employee Certificate Request',
    'Employee Asset Request',
    'Employee Fine Request',
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
