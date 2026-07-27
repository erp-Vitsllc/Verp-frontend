import { isAdmin } from '@/utils/permissions';

function collectIdentityIds(user) {
    if (!user) return [];
    return [
        user._id,
        user.id,
        user.employeeObjectId,
        user.employeeMongoId,
        user.empObjectId,
        user.employeeId,
    ]
        .filter(Boolean)
        .map((v) => String(v).trim())
        .filter(Boolean);
}

function normalizeCategory(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, '');
}

/** True when a flowchart row is an HR responsibility. */
export function isHrFlowchartCategory(category) {
    const cat = normalizeCategory(category);
    if (!cat) return false;
    if (cat === 'hr' || cat === 'hradmin' || cat === 'humanresources') return true;
    return cat.startsWith('hr');
}

function flowchartRowMatchesUser(row, user) {
    const userIds = new Set(collectIdentityIds(user));
    if (!userIds.size) return false;

    const rowObjectId = row?.empObjectId?._id ?? row?.empObjectId;
    const candidates = [
        rowObjectId,
        row?.employeeId,
        row?.empObjectId?.employeeId,
    ]
        .filter(Boolean)
        .map((v) => String(v).trim());

    return candidates.some((id) => userIds.has(id));
}

/**
 * True when the viewer is an Active HR row in Settings > FlowChart
 * (any HR category used for Loan / Advance), or a system admin.
 */
export function isActiveFlowchartHrUser(user, flowchartRows = []) {
    if (!user) return false;
    if (isAdmin()) return true;
    if (!Array.isArray(flowchartRows) || flowchartRows.length === 0) return false;

    return flowchartRows.some((row) => {
        const status = String(row?.status || '').toLowerCase();
        if (status !== 'active') return false;
        if (!isHrFlowchartCategory(row?.category)) return false;
        return flowchartRowMatchesUser(row, user);
    });
}

export function getStoredUser() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('user') || localStorage.getItem('employeeUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
