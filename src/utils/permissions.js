/**
 * Permission utility functions for frontend
 */

/**
 * Get user permissions from localStorage
 * @returns {Object} User permissions object
 */
export const getUserPermissions = () => {
    if (typeof window === 'undefined') return {};

    try {
        const permissionsStr = localStorage.getItem('userPermissions');
        if (!permissionsStr) return {};
        return JSON.parse(permissionsStr);
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
        // Check if username is "admin" (system admin) or if isAdmin/isAdministrator flags are set
        return user.username?.toLowerCase() === 'admin' || user.isAdmin === true || user.isAdministrator === true;
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

