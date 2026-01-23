'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { ChevronRight, ChevronDown } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MODULES = [
    {
        id: 'hrm',
        label: 'HRM',
        parent: null,
        hasDownload: false,
        children: [
            {
                id: 'hrm_employees',
                label: 'Employees',
                parent: 'hrm',
                hasDownload: false,
                children: [
                    { id: 'hrm_employees_add', label: 'Add Employee', parent: 'hrm_employees', hasDownload: false },
                    { id: 'hrm_employees_list', label: 'Employee List', parent: 'hrm_employees', hasDownload: false },
                    {
                        id: 'hrm_employees_view',
                        label: 'View Employee',
                        parent: 'hrm_employees',
                        hasDownload: false,
                        children: [
                            { id: 'hrm_employees_view_basic', label: 'Basic Details', parent: 'hrm_employees_view', hasDownload: false },
                            { id: 'hrm_employees_view_personal', label: 'Personal Details', parent: 'hrm_employees_view', hasDownload: false },
                            { id: 'hrm_employees_view_passport', label: 'Passport', parent: 'hrm_employees_view', hasDownload: true },
                            { id: 'hrm_employees_view_visa', label: 'Visa', parent: 'hrm_employees_view', hasDownload: true },
                            { id: 'hrm_employees_view_education', label: 'Education', parent: 'hrm_employees_view', hasDownload: true },
                            { id: 'hrm_employees_view_experience', label: 'Experience', parent: 'hrm_employees_view', hasDownload: true },
                            { id: 'hrm_employees_view_work', label: 'Work Details', parent: 'hrm_employees_view', hasDownload: false },
                            { id: 'hrm_employees_view_salary', label: 'Salary', parent: 'hrm_employees_view', hasDownload: true },
                            { id: 'hrm_employees_view_bank', label: 'Bank Details', parent: 'hrm_employees_view', hasDownload: false },
                            { id: 'hrm_employees_view_emergency', label: 'Emergency Contacts', parent: 'hrm_employees_view', hasDownload: false },
                            { id: 'hrm_employees_view_emirates_id', label: 'Emirates ID', parent: 'hrm_employees_view', hasDownload: true },
                            { id: 'hrm_employees_view_labour_card', label: 'Labour Card', parent: 'hrm_employees_view', hasDownload: true },
                            { id: 'hrm_employees_view_medical_insurance', label: 'Medical Insurance', parent: 'hrm_employees_view', hasDownload: true },
                            { id: 'hrm_employees_view_driving_license', label: 'Driving License', parent: 'hrm_employees_view', hasDownload: true },
                        ]
                    }
                ]
            },
            { id: 'hrm_attendance', label: 'Attendance', parent: 'hrm', hasDownload: true },
            { id: 'hrm_leave', label: 'Leave', parent: 'hrm', hasDownload: true },
            { id: 'hrm_ncr', label: 'NCR', parent: 'hrm', hasDownload: true },
            { id: 'hrm_fine', label: 'Fine', parent: 'hrm', hasDownload: true },
            { id: 'hrm_loan', label: 'Loan / Advance', parent: 'hrm', hasDownload: true },
            { id: 'hrm_reward', label: 'Reward', parent: 'hrm', hasDownload: true },
        ]
    },
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
            { id: 'settings_user_group', label: 'Create User & Group', parent: 'settings', hasDownload: false }
        ]
    },
];

const PERMISSION_TYPES = [
    { id: 'isView', label: 'View' },
    { id: 'isCreate', label: 'Create' },
    { id: 'isEdit', label: 'Edit' },
    { id: 'isDelete', label: 'Delete' },
    { id: 'isDownload', label: 'Download' },
];

export default function CreateGroupPage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [expandedModules, setExpandedModules] = useState({});
    const [alertDialog, setAlertDialog] = useState({
        open: false,
        title: '',
        description: ''
    });

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        permissions: {
        }
    });

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
        const indentClass = level === 0 ? '' : level === 1 ? 'pl-8' : level === 2 ? 'pl-16' : 'pl-24';

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
                                >
                                    {isExpanded ? (
                                        <ChevronDown size={16} />
                                    ) : (
                                        <ChevronRight size={16} />
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
                        // Disable Download checkbox if module doesn't support downloads
                        const isDownloadDisabled = perm.id === 'isDownload' && !module.hasDownload;
                        return (
                            <td key={perm.id} className="px-4 py-3 text-center">
                                <input
                                    type="checkbox"
                                    checked={
                                        formData.permissions[module.id]?.[perm.id] || false
                                    }
                                    onChange={(e) =>
                                        handlePermissionChange(
                                            module.id,
                                            perm.id,
                                            e.target.checked
                                        )
                                    }
                                    disabled={isDownloadDisabled}
                                    className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${isDownloadDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    title={isDownloadDisabled ? 'Download not available for this module' : ''}
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

        setSubmitting(true);
        try {
            const payload = {
                name: formData.name.trim(),
                users: [],
                permissions: formData.permissions,
                status: 'Active'
            };

            await axiosInstance.post('/User/groups', payload);
            router.push('/Settings/Group');
        } catch (err) {
            console.error('Error creating group:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to create group';
            setAlertDialog({
                open: true,
                title: 'Error',
                description: errorMessage
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-8 w-full max-w-full overflow-x-hidden">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Group</h1>
                        <p className="text-gray-600">Create a new user group, assign users and set permissions.</p>
                    </div>

                    {/* Main Form Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-8">
                                {/* Group Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Group Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        placeholder="Enter group name"
                                    />
                                    {errors.name && (
                                        <p className="mt-1 text-sm text-red-600">{errors.name}</p>
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
                                                {MODULES.map((module, index, array) => {
                                                    const isLast = index === array.length - 1;
                                                    return renderModuleRow(module, 0, isLast, []);
                                                })}
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
                                    {submitting ? 'Creating...' : 'Create Group'}
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
