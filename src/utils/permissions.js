/**
 * Permission utility functions for frontend
 */
import { normalizeStoredEmployeeCardPermissions } from '@/constants/employeeGroupPermissionUiRules';

/**
 * Get user permissions from localStorage
 * @returns {Object} User permissions object
 */
/**
 * Get user permissions from localStorage
 * @returns {Object} User permissions object
 */
export const getUserPermissions = () => {
    if (typeof window === 'undefined') return {};

    try {
        const permissionsStr = localStorage.getItem('userPermissions');
        let permissions = {};

        if (permissionsStr) {
            permissions = JSON.parse(permissionsStr);
        }

        // Check if logged in as an employee (employeeUser)
        // If so, grant basic View permissions for HRM modules so they can see their own records
        const employeeUserStr = localStorage.getItem('employeeUser');
        if (employeeUserStr) {
            const defaultEmployeePermissions = {
                'hrm': { isView: true, isActive: true },
                'hrm_fine': { isView: true, isActive: true },
                'hrm_reward': { isView: true, isActive: true },
                'hrm_loan': { isView: true, isActive: true },
                'hrm_asset': { isView: true, isActive: true },
                // Add others if needed
            };

            // Merge defaults, but let existing permissions override if they exist?
            // Actually, we want to ensure these are visible if they were missing.
            // If they exist in permissions, we use those. Use defaults for missing ones.
            permissions = { ...defaultEmployeePermissions, ...permissions };
        }

        normalizeStoredEmployeeCardPermissions(permissions);

        return permissions;
    } catch (error) {
        console.error('Error parsing user permissions:', error);
        return {};
    }
};

/**
 * Check if user is admin
 * Checks if username is "admin" (system admin from .env)
 * @returns {boolean} True if user is admin
 */
export const isAdmin = () => {
    if (typeof window === 'undefined') return false;

    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return false;
        const user = JSON.parse(userStr);
        const username = (user.username || '').toLowerCase();
        const role = (user.role || '').toLowerCase();
        const userType = (user.userType || '').toLowerCase();

        // Support all known admin markers used across backend/frontend payloads.
        return (
            username === 'admin' ||
            role === 'admin' ||
            role === 'administrator' ||
            role === 'root' ||
            userType === 'admin' ||
            userType === 'administrator' ||
            user.isAdmin === true ||
            user.isAdministrator === true
        );
    } catch (error) {
        return false;
    }
};

/**
 * Check if user has permission for a specific module and action
 * @param {string} moduleId - The module ID (e.g., 'hrm_employees', 'settings_user_group')
 * @param {string} permissionType - The permission type ('isView', 'isCreate', 'isEdit', 'isDelete', 'isDownload')
 * @returns {boolean} True if user has permission
 */
export const hasPermission = (moduleId, permissionType = 'isView') => {
    // Admin has all permissions
    if (isAdmin()) {
        return true;
    }

    const permissions = getUserPermissions();

    if (!permissions || !permissions[moduleId]) {
        return false;
    }

    const modulePermission = permissions[moduleId];

    // Support both old format (isActive) and new format (isView) for backward compatibility
    const hasView = modulePermission.isView === true || modulePermission.isActive === true;

    // First check if module has View permission (isView must be true to access)
    // This is the base permission - if View is false, nothing else matters
    if (!hasView) {
        return false;
    }

    // For isView/isActive check, just return the View value
    if (permissionType === 'isView' || permissionType === 'isActive') {
        return hasView;
    }

    // Check specific permission type
    return modulePermission[permissionType] === true;
};

/**
 * Check if user has any permission for a module (checks isView)
 * Also checks child modules if the parent module doesn't have direct permissions
 * @param {string} moduleId - The module ID
 * @returns {boolean} True if user has isView permission for the module or any of its children
 */
export const hasAnyPermission = (moduleId) => {
    // Admin has all permissions
    if (isAdmin()) {
        return true;
    }

    // Dashboard and logout are always accessible
    if (moduleId === 'dashboard' || moduleId === 'logout') {
        return true;
    }

    const permissions = getUserPermissions();

    if (!permissions) {
        return false;
    }

    // Check direct permission - must have isView = true (or isActive for backward compatibility)
    if (permissions[moduleId]) {
        const modulePermission = permissions[moduleId];
        if (modulePermission.isView === true || modulePermission.isActive === true) {
            return true;
        }
    }

    // Check child modules (e.g., if checking 'hrm', also check 'hrm_employees', 'hrm_attendance', etc.)
    const childModules = Object.keys(permissions).filter(key => key.startsWith(moduleId + '_'));
    for (const childModuleId of childModules) {
        const childPermission = permissions[childModuleId];
        if (childPermission && (childPermission.isView === true || childPermission.isActive === true)) {
            return true;
        }
    }

    return false;
};

/**
 * True if the user has View (or legacy isActive) on any of the listed modules.
 * Used for main tabs / sidebar where a section should appear if any child is granted.
 * @param {string[]} moduleIds
 * @returns {boolean}
 */
export const canViewAnyOf = (moduleIds) => {
    if (isAdmin()) {
        return true;
    }
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
        return false;
    }
    return moduleIds.some((id) => hasPermission(id, 'isView'));
};

/**
 * Granular flags for one module (admin: all true).
 * Requires View before any other action is allowed — matches `hasPermission` behaviour.
 * @param {string} moduleId
 * @returns {{ view: boolean, create: boolean, edit: boolean, delete: boolean, download: boolean }}
 */
export const crudAccess = (moduleId) => {
    if (isAdmin()) {
        return { view: true, create: true, edit: true, delete: true, download: true };
    }
    const permissions = getUserPermissions();
    const modulePermission = permissions[moduleId];
    if (!modulePermission) {
        return { view: false, create: false, edit: false, delete: false, download: false };
    }
    const hasView = modulePermission.isView === true || modulePermission.isActive === true;
    if (!hasView) {
        return { view: false, create: false, edit: false, delete: false, download: false };
    }
    return {
        view: true,
        create: modulePermission.isCreate === true,
        edit: modulePermission.isEdit === true,
        delete: modulePermission.isDelete === true,
        download: modulePermission.isDownload === true,
    };
};

/**
 * Merge CRUD flags across multiple modules (OR). Used for company profile tabs that map to several owner modules.
 * @param {string[]} moduleIds
 * @returns {{ view: boolean, create: boolean, edit: boolean, delete: boolean, download: boolean }}
 */
export const crudAccessUnion = (moduleIds) => {
    if (isAdmin()) {
        return { view: true, create: true, edit: true, delete: true, download: true };
    }
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
        return { view: false, create: false, edit: false, delete: false, download: false };
    }
    return moduleIds.reduce(
        (acc, id) => {
            const a = crudAccess(id);
            return {
                view: acc.view || a.view,
                create: acc.create || a.create,
                edit: acc.edit || a.edit,
                delete: acc.delete || a.delete,
                download: acc.download || a.download,
            };
        },
        { view: false, create: false, edit: false, delete: false, download: false }
    );
};

/**
 * Employee Training is not a separate group-permission row; gate by View Employee / List
 * (view tab content) and Employee List edit (add/change/remove training).
 * @returns {{ view: boolean, create: boolean, edit: boolean, delete: boolean, download: boolean }}
 */
export const employeeTrainingAccess = () => {
    if (isAdmin()) {
        return { view: true, create: true, edit: true, delete: true, download: true };
    }
    const tabView = crudAccessUnion(['hrm_employees_view', 'hrm_employees_list']);
    const list = crudAccess('hrm_employees_list');
    return {
        view: tabView.view,
        create: list.edit,
        edit: list.edit,
        delete: list.edit,
        download: list.edit,
    };
};

