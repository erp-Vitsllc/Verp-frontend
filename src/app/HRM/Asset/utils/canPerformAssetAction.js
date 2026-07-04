/** @typedef {'edit'|'transfer'|'loss'|'eol'|'service'|'assign'|'addAccessories'|'unattach'} AssetAction */

export const ASSET_ACTIONS = Object.freeze({
    EDIT: 'edit',
    TRANSFER: 'transfer',
    LOSS: 'loss',
    EOL: 'eol',
    SERVICE: 'service',
    ASSIGN: 'assign',
    ADD_ACCESSORIES: 'addAccessories',
    UNATTACH: 'unattach',
});

const ALL_ACTIONS = new Set(Object.values(ASSET_ACTIONS));

/** Asset Controller may act on unassigned pool assets for these actions only. */
const UNASSIGNED_ASSET_CONTROLLER_ACTIONS = new Set([
    ASSET_ACTIONS.SERVICE,
    ASSET_ACTIONS.EOL,
    ASSET_ACTIONS.EDIT,
    ASSET_ACTIONS.ASSIGN,
    ASSET_ACTIONS.ADD_ACCESSORIES,
]);

function normalizeId(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') return value;
    if (value._id != null) return String(value._id);
    if (typeof value.toString === 'function') return value.toString();
    return String(value);
}

function normalizeCategory(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function normalizeEmployeeCode(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '');
}

/**
 * True when the asset is assigned to an employee or allocated to a company.
 */
export function isAssetAssigned(asset) {
    if (!asset) return false;
    const isCompanyAsset =
        String(asset.assignedToType || '').toLowerCase() === 'company' && !!asset.assignedCompany;
    return !!(asset.assignedTo || isCompanyAsset);
}

/**
 * Flowchart Asset Controller, or the employee linked on the asset record.
 */
export function isUserAssetController(user, asset) {
    if (!user) return false;
    if (user.isAssetController) return true;

    const employeeId = normalizeId(user.employeeObjectId);
    const acId = normalizeId(asset?.assetControllerId ?? asset?.assetController?._id ?? asset?.assetController);
    if (employeeId && acId && employeeId === acId) return true;
    if (employeeId === 'flowchart_assetcontroller') return true;
    return false;
}

/**
 * Employee currently holding the asset (employee assignment only).
 */
export function isUserAssignedToAsset(user, asset) {
    if (!user || !asset) return false;
    const employeeId = normalizeId(user.employeeObjectId);
    const assignedToId = normalizeId(asset?.assignedTo?._id ?? asset?.assignedTo);
    return !!(employeeId && assignedToId && employeeId === assignedToId);
}

/**
 * Admin row in the assigned company's flowchart responsibilities.
 */
export function resolveAdminInCompanyFlowchart(userEmployee, asset, companies) {
    const companyId = normalizeId(asset?.assignedCompany?._id ?? asset?.assignedCompany);
    if (!companyId || !userEmployee || !Array.isArray(companies)) return false;

    const company = companies.find((c) => normalizeId(c._id) === companyId);
    if (!company?.responsibilities?.length) return false;

    const userEmpObjId = normalizeId(userEmployee._id ?? userEmployee.id);
    const userEmpId = userEmployee.employeeId;

    return company.responsibilities.some((row) => {
        if (normalizeCategory(row.category) !== 'admincontroller') return false;
        if (String(row.status || '').trim() !== 'Active') return false;

        if (row.employeeId && userEmpId) {
            if (normalizeEmployeeCode(row.employeeId) === normalizeEmployeeCode(userEmpId)) return true;
        }

        const rowEmpObjId = normalizeId(row.employeeObjectId?._id ?? row.employeeObjectId);
        return !!(rowEmpObjId && userEmpObjId && rowEmpObjId === userEmpObjId);
    });
}

function isUserAdminInCompanyFlowchart(user, asset) {
    if (!user?.isAdminInCompanyFlowchart) return false;
    const isCompanyAsset =
        String(asset?.assignedToType || '').toLowerCase() === 'company' && !!asset?.assignedCompany;
    return isCompanyAsset;
}

function canUserActOnAssignedAsset(user, asset) {
    return (
        isUserAssetController(user, asset) ||
        isUserAssignedToAsset(user, asset) ||
        isUserAdminInCompanyFlowchart(user, asset)
    );
}

/**
 * Build the user context expected by {@link canPerformAssetAction}.
 */
export function buildAssetActionUser({
    employeeObjectId,
    isAssetController = false,
    isAdminInCompanyFlowchart = false,
    isSystemAdmin = false,
}) {
    return {
        employeeObjectId,
        isAssetController: !!isAssetController,
        isAdminInCompanyFlowchart: !!isAdminInCompanyFlowchart,
        isSystemAdmin: !!isSystemAdmin,
    };
}

/**
 * Unattach returns an accessory to the catalog. Matches API: Asset Controller, asset-linked AC, or system admin only.
 */
export function canUnattachAccessoryFromAsset(user, asset, { isSystemAdmin = false } = {}) {
    if (!user || !asset) return false;
    if (isSystemAdmin) return true;
    return isUserAssetController(user, asset);
}

/**
 * Centralized button permission for asset and accessory actions.
 * Accessories use the parent asset for the permission check.
 *
 * @param {object} user
 * @param {string|{ toString(): string }|null|undefined} user.employeeObjectId
 * @param {boolean} [user.isAssetController]
 * @param {boolean} [user.isAdminInCompanyFlowchart]
 * @param {boolean} [user.isSystemAdmin]
 * @param {object} asset
 * @param {AssetAction} action
 */
export function canPerformAssetAction(user, asset, action) {
    if (!user || !asset || !action) return false;
    if (!ALL_ACTIONS.has(action)) return false;

    if (user.isSystemAdmin) return true;

    if (action === ASSET_ACTIONS.UNATTACH) {
        return canUnattachAccessoryFromAsset(user, asset, { isSystemAdmin: user.isSystemAdmin });
    }

    const isController = isUserAssetController(user, asset);

    if (!isAssetAssigned(asset)) {
        return isController && UNASSIGNED_ASSET_CONTROLLER_ACTIONS.has(action);
    }

    return canUserActOnAssignedAsset(user, asset);
}

/** Map tools header button labels to centralized action keys. */
export function mapHeaderLabelToAssetAction(label) {
    switch (label) {
        case 'Edit Asset':
            return ASSET_ACTIONS.EDIT;
        case 'TRANSFER ASSET':
        case 'Transfer':
            return ASSET_ACTIONS.TRANSFER;
        case 'Loss and Damage':
            return ASSET_ACTIONS.LOSS;
        case 'End of life':
            return ASSET_ACTIONS.EOL;
        case 'Service':
        case 'Extend Service':
        case 'Live':
            return ASSET_ACTIONS.SERVICE;
        case 'Assign':
        case 'Reassign':
        case 'Reassign (Parking)':
            return ASSET_ACTIONS.ASSIGN;
        default:
            return null;
    }
}
