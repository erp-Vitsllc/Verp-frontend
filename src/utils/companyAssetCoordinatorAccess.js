import { isAdmin } from '@/utils/permissions';

export function normalizeFlowchartCategoryKey(value = '') {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function flowchartRowMatchesUser(row, user) {
    if (!row || !user) return false;
    if (normalizeFlowchartCategoryKey(row?.status) !== 'active') return false;
    const actualId = user._id || user.id || user.employeeObjectId;
    const actualEid = user.employeeId;
    const rowEmpId = row?.empObjectId?._id || row?.empObjectId;
    return (
        (rowEmpId && actualId && String(rowEmpId) === String(actualId)) ||
        (row?.employeeId && actualEid && String(row.employeeId) === String(actualEid))
    );
}

export function isViewerFlowchartAssetController(user, flowchartRows = []) {
    if (!user) return false;
    return (Array.isArray(flowchartRows) ? flowchartRows : []).some((row) => {
        const category = normalizeFlowchartCategoryKey(row?.category);
        if (category !== 'assetcontroller') return false;
        return flowchartRowMatchesUser(row, user);
    });
}

function profileEmployeeAsUser(employee) {
    if (!employee) return null;
    return {
        _id: employee._id,
        id: employee._id,
        employeeObjectId: employee._id,
        employeeId: employee.employeeId,
    };
}

export function isProfileEmployeeFlowchartAssetController(employee, flowchartRows = []) {
    const subject = profileEmployeeAsUser(employee);
    if (!subject) return false;
    return isViewerFlowchartAssetController(subject, flowchartRows);
}

/** Flowchart Admin / Assigned User row holder — salary summary shows company asset pool on their profile. */
export function isProfileEmployeeFlowchartAdmin(employee, flowchartRows = []) {
    const subject = profileEmployeeAsUser(employee);
    if (!subject) return false;
    return (Array.isArray(flowchartRows) ? flowchartRows : []).some((row) => {
        const category = normalizeFlowchartCategoryKey(row?.category);
        if (!['admin', 'administrator', 'admincontroller', 'assigneduser'].includes(category)) return false;
        return flowchartRowMatchesUser(row, subject);
    });
}

/** @deprecated use isProfileEmployeeFlowchartAdmin — kept for company assets tab permissions */
export function isViewerActiveCompanyAssetCoordinator(user, flowchartRows = []) {
    return isProfileEmployeeFlowchartAdmin(user, flowchartRows);
}

/** Salary summary on employee profile — company pool when profile belongs to flowchart admin. */
export function canProfileShowCompanyAssetTotalOnSalarySummary(employee, flowchartRows = []) {
    return isProfileEmployeeFlowchartAdmin(employee, flowchartRows);
}

/** Salary summary on employee profile — unassigned pool when profile belongs to asset controller. */
export function canProfileShowUnassignedAssetTotalOnSalarySummary(employee, flowchartRows = []) {
    return isProfileEmployeeFlowchartAssetController(employee, flowchartRows);
}

/** Company profile → Assets tab: bulk actions + row checkboxes. */
export function canViewerManageCompanyAssets(user, flowchartRows = [], { isDesignatedFlowchartHr = false } = {}) {
    if (isAdmin()) return true;
    if (isDesignatedFlowchartHr) return true;
    return isViewerActiveCompanyAssetCoordinator(user, flowchartRows);
}

/** Sum unassigned / pool asset values for the salary summary carousel. */
export function sumUnassignedPoolAssetValue(assets = []) {
    return (Array.isArray(assets) ? assets : [])
        .filter((asset) => {
            const status = String(asset?.status || '').trim().toLowerCase();
            return status === 'unassigned' || status === 'returned' || status === 'pending';
        })
        .reduce((sum, asset) => sum + (Number(asset?.assetValue) || 0), 0);
}

export function sumCompanyAssignedAssetValue(assets = []) {
    return (Array.isArray(assets) ? assets : [])
        .filter((asset) => {
            if (String(asset?.assignedToType || '').toLowerCase() !== 'company') return false;
            return String(asset?.status || '').toLowerCase() !== 'draft';
        })
        .reduce((sum, asset) => sum + (Number(asset?.assetValue) || 0), 0);
}

export function normalizeAssignedAssetsResponse(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
}

/** Sum assigned asset values for the profile employee ("Your Assets" on Salary tab). */
export function sumEmployeeAssignedAssetValue(assets = []) {
    return (Array.isArray(assets) ? assets : [])
        .filter((asset) => String(asset?.status || '').trim().toLowerCase() !== 'draft')
        .reduce((sum, asset) => sum + (Number(asset?.assetValue) || 0), 0);
}
