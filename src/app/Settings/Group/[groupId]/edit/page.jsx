'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { isAdmin } from '@/utils/permissions';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HRM_MODULE } from '@/constants/hrmModulePermissions';

const MODULES = [
    HRM_MODULE,
    { id: 'crm', label: 'CRM', parent: null, hasDownload: false },
    { id: 'purchases', label: 'Purchases', parent: null, hasDownload: true },
    { id: 'accounts', label: 'Accounts', parent: null, hasDownload: true },
    { id: 'production', label: 'Production', parent: null, hasDownload: false },
    { id: 'reports', label: 'Reports', parent: null, hasDownload: true },
    {
        id: 'settings',
        label: 'Settings',
        parent: null,
        hasDownload: false,
        children: [
            {
                id: 'settings_user_group',
                label: 'Create User & Group',
                parent: 'settings',
                hasDownload: false
            }
        ]
    },
];

const emptyModulePermission = () => ({
    isView: false,
    isCreate: false,
    isEdit: false,
    isDelete: false,
    isDownload: false,
});

/** Flatten MODULES tree (same shape as getAllModulesFlat inside the page). */
const flattenModulesTree = (modules) => {
    let flat = [];
    modules.forEach((m) => {
        flat.push(m);
        if (m.children) {
            flat = flat.concat(flattenModulesTree(m.children));
        }
    });
    return flat;
};

/**
 * Older groups often stored leaf permissions without every parent row.
 * The edit UI hides children when an intermediate parent key is missing — so nested rows
 * (e.g. Documents → Live document) never appeared. Fill missing keys with false, then set
 * View on ancestors for any module that already has View.
 */
const normalizeLoadedGroupPermissions = (permissions, modulesRoot) => {
    const flat = flattenModulesTree(modulesRoot);
    const byId = new Map(flat.map((m) => [m.id, m]));
    const merged = { ...permissions };
    flat.forEach((m) => {
        if (!merged[m.id]) {
            merged[m.id] = emptyModulePermission();
        }
    });
    flat.forEach((m) => {
        if (!merged[m.id]?.isView) return;
        let pid = m.parent;
        while (pid) {
            if (!merged[pid]) {
                merged[pid] = emptyModulePermission();
            }
            merged[pid] = { ...merged[pid], isView: true };
            pid = byId.get(pid)?.parent ?? null;
        }
    });
    return merged;
};

const PERMISSION_TYPES = [
    { id: 'isView', label: 'View' },
    { id: 'isCreate', label: 'Create' },
    { id: 'isEdit', label: 'Edit' },
    { id: 'isDelete', label: 'Delete' },
    { id: 'isDownload', label: 'Download' },
];

export default function EditGroupPage() {
    const router = useRouter();
    const params = useParams();
    const groupId = params?.groupId;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [expandedModules, setExpandedModules] = useState({});
    const [alertDialog, setAlertDialog] = useState({
        open: false,
        title: '',
        description: ''
    });

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        permissions: {}
    });
    const [isSystemGroup, setIsSystemGroup] = useState(false);

    useEffect(() => {
        if (groupId) {
            fetchGroupData();
        }
    }, [groupId]);


    const fetchGroupData = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/User/groups/${groupId}`);
            const group = response.data.group || response.data;


            // Initialize permissions with defaults (all false except dashboard)
            const defaultPermissions = {};
            // Convert existing permissions to new format (isActive, isCreate, isEdit, isDelete)
            if (group.permissions && Object.keys(group.permissions).length > 0) {
                Object.keys(group.permissions).forEach(moduleId => {
                    const oldPerm = group.permissions[moduleId];
                    defaultPermissions[moduleId] = {
                        isView: oldPerm?.isView ?? oldPerm?.isActive ?? (oldPerm?.full || oldPerm?.view || false),
                        isCreate: oldPerm?.isCreate ?? (oldPerm?.full || oldPerm?.create || false),
                        isEdit: oldPerm?.isEdit ?? (oldPerm?.full || oldPerm?.edit || false),
                        isDelete: oldPerm?.isDelete ?? (oldPerm?.full || oldPerm?.delete || false),
                        isDownload: oldPerm?.isDownload ?? false
                    };
                });
            }

            const permissionsNormalized = normalizeLoadedGroupPermissions(defaultPermissions, MODULES);

            setFormData({
                name: group.name || '',
                permissions: permissionsNormalized
            });
            setIsSystemGroup(group.isSystemGroup || false);
        } catch (err) {
            console.error('Error fetching group:', err);
            setAlertDialog({
                open: true,
                title: 'Error',
                description: err.response?.data?.message || 'Failed to load group data'
            });
        } finally {
            setLoading(false);
        }
    };


    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };


    // Helper function to get all child module IDs recursively
    const getAllChildIds = (module) => {
        let childIds = [];
        if (module.children && module.children.length > 0) {
            module.children.forEach(child => {
                childIds.push(child.id);
                // Recursively get children of children
                childIds = childIds.concat(getAllChildIds(child));
            });
        }
        return childIds;
    };

    // Helper function to check if module or any of its children support downloads
    const hasDownloadSupport = (module) => {
        if (module.hasDownload) return true;
        if (module.children && module.children.length > 0) {
            return module.children.some(child => hasDownloadSupport(child));
        }
        return false;
    };

    // Helper function to find a module by ID in the MODULES tree
    const findModuleById = (modules, targetId) => {
        for (const module of modules) {
            if (module.id === targetId) {
                return module;
            }
            if (module.children) {
                const found = findModuleById(module.children, targetId);
                if (found) return found;
            }
        }
        return null;
    };

    // Helper function to get all modules as a flat list
    const getAllModulesFlat = (modules) => {
        let flat = [];
        modules.forEach(m => {
            flat.push(m);
            if (m.children) {
                flat = flat.concat(getAllModulesFlat(m.children));
            }
        });
        return flat;
    };

    // Check if ALL modules have Full permission
    const isAllFullChecked = () => {
        const flatModules = getAllModulesFlat(MODULES);
        return flatModules.every(m => {
            const perms = formData.permissions[m.id];
            return perms?.isFull === true;
        });
    };

    const handleSelectAllFull = (checked) => {
        setFormData(prev => {
            const permissions = { ...prev.permissions };
            const flatModules = getAllModulesFlat(MODULES);

            flatModules.forEach(m => {
                permissions[m.id] = {
                    isFull: checked,
                    isView: checked,
                    isCreate: checked,
                    isEdit: checked,
                    isDelete: checked,
                    isDownload: m.hasDownload ? checked : false
                };
            });

            return { ...prev, permissions };
        });

        // Expand all top-level modules if selecting all
        if (checked) {
            setExpandedModules(prev => {
                const updated = { ...prev };
                MODULES.forEach(m => {
                    updated[m.id] = true;
                });
                return updated;
            });
        }
    };

    const handlePermissionChange = (moduleId, permissionType, checked) => {
        // Find the module to check if it has children
        const module = findModuleById(MODULES, moduleId);

        // If checkbox is being checked, recursively expand the module and all its nested children
        if (checked && module) {
            setExpandedModules(prev => {
                const updated = { ...prev };
                expandAllChildren(module, updated);
                return updated;
            });
        }

        setFormData(prev => {
            const permissions = { ...prev.permissions };

            // Get child IDs
            const childIds = module ? getAllChildIds(module) : [];

            // Initialize permission object if it doesn't exist
            if (!permissions[moduleId]) {
                permissions[moduleId] = {
                    isView: false,
                    isCreate: false,
                    isEdit: false,
                    isDelete: false,
                    isDownload: false
                };
            }

            // Function to update individual module permissions based on cascading rules
            const updateModulePerms = (id, type, isChecked) => {
                if (!permissions[id]) {
                    permissions[id] = { isView: false, isCreate: false, isEdit: false, isDelete: false, isDownload: false };
                }

                if (isChecked) {
                    // When checking a permission, also check all lower-level permissions
                    if (type === 'isDelete') {
                        permissions[id].isView = true;
                        permissions[id].isCreate = true;
                        permissions[id].isEdit = true;
                        permissions[id].isDelete = true;
                    } else if (type === 'isEdit') {
                        permissions[id].isView = true;
                        permissions[id].isCreate = true;
                        permissions[id].isEdit = true;
                    } else if (type === 'isCreate') {
                        permissions[id].isView = true;
                        permissions[id].isCreate = true;
                    } else {
                        permissions[id][type] = true;
                    }
                } else {
                    // When unchecking, apply reverse cascading
                    if (type === 'isView') {
                        permissions[id].isView = false;
                        permissions[id].isCreate = false;
                        permissions[id].isEdit = false;
                        permissions[id].isDelete = false;
                    } else if (type === 'isCreate') {
                        permissions[id].isCreate = false;
                        permissions[id].isEdit = false;
                        permissions[id].isDelete = false;
                    } else if (type === 'isEdit') {
                        permissions[id].isEdit = false;
                        permissions[id].isDelete = false;
                    } else if (type === 'isDelete') {
                        permissions[id].isDelete = false;
                    } else {
                        permissions[id][type] = false;
                    }
                }
            };

            // Update the target module
            updateModulePerms(moduleId, permissionType, checked);

            // Apply to all children
            childIds.forEach(childId => {
                const childModule = findModuleById(MODULES, childId);
                // Skip Download permission for children that don't support it
                if (permissionType === 'isDownload' && childModule && !childModule.hasDownload) {
                    return;
                }
                updateModulePerms(childId, permissionType, checked);
            });

            return { ...prev, permissions };
        });
    };

    const toggleModule = (moduleId) => {
        setExpandedModules(prev => ({
            ...prev,
            [moduleId]: !prev[moduleId]
        }));
    };

    const hasChildren = (module) => {
        return module.children && module.children.length > 0;
    };

    // Recursive function to expand all nested children
    const expandAllChildren = (module, expanded) => {
        if (!module || !hasChildren(module)) {
            return expanded;
        }

        // Expand current module
        expanded[module.id] = true;

        // Recursively expand all children
        if (module.children) {
            module.children.forEach(child => {
                expandAllChildren(child, expanded);
            });
        }

        return expanded;
    };

    const renderModuleRow = (module, level = 0) => {
        const isExpanded = expandedModules[module.id];
        const hasSubmodules = hasChildren(module);
        const indentSteps = ['', 'pl-8', 'pl-16', 'pl-24', 'pl-28', 'pl-32', 'pl-36'];
        const indentClass = indentSteps[Math.min(level, indentSteps.length - 1)] || '';

        // Get current permissions for this module
        const modulePermissions = formData.permissions[module.id] || {
            isView: false,
            isCreate: false,
            isEdit: false,
            isDelete: false,
            isDownload: false
        };

        // If View is false, disable Create/Edit/Delete/Download
        const isViewEnabled = modulePermissions.isView;
        const isCreateDisabled = !isViewEnabled;
        const isEditDisabled = !isViewEnabled;
        const isDeleteDisabled = !isViewEnabled;
        const isDownloadDisabled = (!module.hasDownload) || !isViewEnabled;

        return (
            <React.Fragment key={module.id}>
                <tr className="hover:bg-gray-50">
                    <td className={`px-4 py-3 ${indentClass}`}>
                        <div className="flex items-center gap-2">
                            {hasSubmodules && (
                                <button
                                    type="button"
                                    onClick={() => toggleModule(module.id)}
                                    className="text-gray-400 hover:text-gray-600"
                                    aria-label={isExpanded ? `Collapse ${module.label}` : `Expand ${module.label}`}
                                    title={isExpanded ? `Collapse ${module.label}` : `Expand ${module.label}`}
                                >
                                    {isExpanded ? (
                                        <ChevronDown size={16} aria-hidden="true" />
                                    ) : (
                                        <ChevronRight size={16} aria-hidden="true" />
                                    )}
                                </button>
                            )}
                            {!hasSubmodules && level > 0 && <span className="w-4" />}
                            <span className="text-sm font-medium text-gray-900">
                                {module.label}
                            </span>
                        </div>
                    </td>
                    {PERMISSION_TYPES.map((perm) => {
                        const checkboxId = `permission-${module.id}-${perm.id}`;

                        // Determine if checkbox should be disabled
                        let isDisabled = false;
                        if (perm.id === 'isDownload') {
                            isDisabled = isDownloadDisabled;
                        } else if (perm.id === 'isCreate') {
                            isDisabled = isCreateDisabled;
                        } else if (perm.id === 'isEdit') {
                            isDisabled = isEditDisabled;
                        } else if (perm.id === 'isDelete') {
                            isDisabled = isDeleteDisabled;
                        }
                        // View is never disabled (it's the base permission)

                        return (
                            <td key={perm.id} className="px-4 py-3 text-center">
                                <label htmlFor={checkboxId} className="sr-only">
                                    {module.label} - {perm.label} permission
                                </label>
                                <input
                                    type="checkbox"
                                    id={checkboxId}
                                    name={`permission-${module.id}-${perm.id}`}
                                    checked={modulePermissions[perm.id] || false}
                                    onChange={(e) =>
                                        handlePermissionChange(
                                            module.id,
                                            perm.id,
                                            e.target.checked
                                        )
                                    }
                                    disabled={isDisabled}
                                    className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                    aria-label={`${module.label} - ${perm.label} permission`}
                                    title={
                                        isDisabled
                                            ? (perm.id === 'isDownload'
                                                ? 'Download not available for this module'
                                                : `${perm.label} requires View permission`)
                                            : `${module.label} - ${perm.label} permission`
                                    }
                                />
                            </td>
                        );
                    })}
                </tr>
                {hasSubmodules && isExpanded && module.children?.map((child) =>
                    renderModuleRow(child, level + 1)
                )}
            </React.Fragment>
        );
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name || formData.name.trim() === '') {
            newErrors.name = 'Group name is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        // Check if non-admin user is trying to edit a system group
        if (isSystemGroup && !isAdmin()) {
            setAlertDialog({
                open: true,
                title: 'Access Denied',
                description: 'Only administrators can modify system groups.'
            });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name: formData.name.trim(),
                permissions: formData.permissions
            };

            // Don't send users array - let backend preserve existing users
            // Only send users if we want to explicitly change them
            await axiosInstance.patch(`/User/groups/${groupId}`, payload);
            router.push('/Settings/Group');
        } catch (err) {
            console.error('Error updating group:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to update group';
            setAlertDialog({
                open: true,
                title: 'Error',
                description: errorMessage
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen bg-[#F2F6F9] w-full max-w-full overflow-x-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
                            Loading group data...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#F2F6F9] w-full max-w-full overflow-x-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8 w-full max-w-full overflow-x-hidden">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Edit Group</h1>
                        <p className="text-gray-600">Update group information, users and permissions.</p>
                    </div>

                    {/* Main Form Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-8">
                                {/* Group Name */}
                                <div>
                                    <label htmlFor="group-name" className="block text-sm font-medium text-gray-700 mb-2">
                                        Group Name
                                    </label>
                                    {isSystemGroup && (
                                        <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <p className="text-sm text-blue-800">
                                                <strong>System Group:</strong> This is a protected system group. Only administrators can modify it.
                                            </p>
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        id="group-name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        disabled={isSystemGroup}
                                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                                            } ${isSystemGroup ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                        placeholder="Enter group name"
                                        autoComplete="organization"
                                        aria-describedby={errors.name ? 'group-name-error' : undefined}
                                        aria-invalid={errors.name ? 'true' : 'false'}
                                    />
                                    {errors.name && (
                                        <p id="group-name-error" className="mt-1 text-sm text-red-600" role="alert">{errors.name}</p>
                                    )}
                                    <div className="mt-4 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="full-permission"
                                            checked={isAllFullChecked()}
                                            onChange={(e) => handleSelectAllFull(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                        />
                                        <label htmlFor="full-permission" className="text-sm font-medium text-gray-700 cursor-pointer">
                                            Full Permission (Select all modules & actions)
                                        </label>
                                    </div>
                                </div>

                                {/* Module Permissions */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Module Permissions
                                    </label>
                                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                                        Module
                                                    </th>
                                                    {PERMISSION_TYPES.map((perm) => (
                                                        <th
                                                            key={perm.id}
                                                            className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase"
                                                        >
                                                            {perm.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {MODULES.map((module) =>
                                                    renderModuleRow(module, 0)
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-8 flex items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Updating...' : 'Update Group'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push('/Settings/Group')}
                                    className="px-6 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Alert Dialog */}
            <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog((prev) => ({ ...prev, open }))}>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setAlertDialog({ open: false, title: '', description: '' })}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
