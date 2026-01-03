'use client';

import { statusOptions } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import { useState, useEffect } from 'react';
import axiosInstance from '@/utils/axios';
import DropdownWithDelete from '@/components/ui/DropdownWithDelete';
import AddDepartmentModal from '@/app/HRM/Department/components/AddDepartmentModal';
import AddDesignationModal from '@/app/HRM/Designation/components/AddDesignationModal';
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
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";

// Validate individual work details field
const validateWorkDetailsField = (field, value, form, errors, setErrors, employee) => {
    const newErrors = { ...errors };
    let error = '';

    if (field === 'department') {
        if (!value || value.trim() === '') {
            error = 'Department is required';
        }
    } else if (field === 'contractJoiningDate') {
        if (!value || value.trim() === '') {
            error = 'Contract Joining Date is required';
        } else if (employee && employee.dateOfJoining) {
            const joiningDate = new Date(employee.dateOfJoining);
            const contractDate = new Date(value);
            joiningDate.setHours(0, 0, 0, 0);
            contractDate.setHours(0, 0, 0, 0);

            if (contractDate < joiningDate) {
                error = 'Contract Joining Date cannot be before Date of Joining';
            }
        }
    } else if (field === 'designation') {
        if (!value || value.trim() === '') {
            error = 'Designation is required';
        }
    } else if (field === 'status') {
        if (!value || value.trim() === '') {
            error = 'Work Status is required';
        } else if (!['Probation', 'Permanent', 'Temporary', 'Notice'].includes(value)) {
            error = 'Invalid work status';
        }
    } else if (field === 'primaryReportee') {
        const isGM = form.department === 'Management' && form.designation === 'General Manager';
        if (!isGM && (!value || value.trim() === '')) {
            error = 'Primary Reportee is required';
        }
    }
    // Secondary Reportee is optional - no validation needed

    if (error) {
        newErrors[field] = error;
    } else {
        delete newErrors[field];
    }

    setErrors(newErrors);
};

// Validate entire work details form
const validateWorkDetailsForm = (form, setErrors, employee) => {
    const errors = {};

    // Department validation
    if (!form.department || form.department.trim() === '') {
        errors.department = 'Department is required';
    }

    // Contract Joining Date validation
    if (!form.contractJoiningDate || form.contractJoiningDate.trim() === '') {
        errors.contractJoiningDate = 'Contract Joining Date is required';
    } else if (employee && employee.dateOfJoining) {
        const joiningDate = new Date(employee.dateOfJoining);
        const contractDate = new Date(form.contractJoiningDate);
        joiningDate.setHours(0, 0, 0, 0);
        contractDate.setHours(0, 0, 0, 0);

        if (contractDate < joiningDate) {
            errors.contractJoiningDate = 'Contract Joining Date cannot be before Date of Joining';
        }
    }

    // Designation validation
    if (!form.designation || form.designation.trim() === '') {
        errors.designation = 'Designation is required';
    }

    // Work Status validation
    if (!form.status || form.status.trim() === '') {
        errors.status = 'Work Status is required';
    } else if (!['Probation', 'Permanent', 'Temporary', 'Notice'].includes(form.status)) {
        errors.status = 'Invalid work status';
    }

    // Primary Reportee validation

    // Primary Reportee validation
    const isGM = form.department === 'Management' && form.designation === 'General Manager';
    if (!isGM && (!form.primaryReportee || form.primaryReportee.trim() === '')) {
        errors.primaryReportee = 'Primary Reportee is required';
    }

    // Secondary Reportee is optional - no validation needed

    setErrors(errors);
    return Object.keys(errors).length === 0;
};

export default function WorkDetailsModal({
    isOpen,
    onClose,
    workDetailsForm,
    setWorkDetailsForm,
    workDetailsErrors,
    setWorkDetailsErrors,
    updatingWorkDetails,
    onUpdate,
    employee,
    reportingAuthorityOptions,
    reportingAuthorityLoading,
    reportingAuthorityError

}) {
    if (!isOpen) return null;

    const { toast } = useToast();

    const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
    const [isAddDesigModalOpen, setIsAddDesigModalOpen] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);

    // State for delete confirmation
    const [deleteConfig, setDeleteConfig] = useState({
        isOpen: false,
        type: '', // 'department' or 'designation'
        item: null
    });

    // Check user permissions
    const [canManageMetadata, setCanManageMetadata] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    // Check if user is Admin or Administrator (or Super User)
                    if (user.isAdmin || user.isAdministrator) {
                        setCanManageMetadata(true);
                    }
                } catch (e) {
                    console.error("Error parsing user data", e);
                }
            }
        }
    }, []);

    // Fetch Departments and Designations on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, desigRes] = await Promise.all([
                    axiosInstance.get('/Department'),
                    axiosInstance.get('/Designation')
                ]);
                setDepartments(deptRes.data);
                setDesignations(desigRes.data);
            } catch (error) {
                console.error("Failed to fetch departments/designations", error);
            }
        };
        fetchData();
    }, []);

    // Enforce Probation status if employee has a Visiting Visa
    useEffect(() => {
        if (isOpen && employee?.visaDetails?.visit?.number) {
            setWorkDetailsForm(prev => {
                if (prev.status !== 'Probation') {
                    return { ...prev, status: 'Probation' };
                }
                return prev;
            });
            // Clear any status errors
            setWorkDetailsErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.status;
                return newErrors;
            });
        }
    }, [isOpen, employee]);

    // Get sorted departments
    const getAllDepartments = () => {
        return [...departments]
            .sort((a, b) => {
                if (a.name === 'Management') return -1;
                if (b.name === 'Management') return 1;
                return a.name.localeCompare(b.name);
            })
            .map(d => ({ value: d.name, label: d.name, _id: d._id, isSystem: d.isSystem }));
    };

    // Get designations for selected department
    const getDesignationsForDept = (deptName) => {
        return designations
            .filter(d => d.department === deptName)
            .sort((a, b) => {
                if (a.name === 'General Manager') return -1;
                if (b.name === 'General Manager') return 1;
                return a.name.localeCompare(b.name);
            })
            .map(d => ({ value: d.name, label: d.name, _id: d._id, department: d.department, isSystem: d.isSystem }));
    };

    const handleDeleteDepartment = (option) => {
        const deptName = option.value;
        if (!deptName) return;

        const deptId = option._id || departments.find(d => d.name === deptName)?._id;
        if (!deptId) return;

        setDeleteConfig({
            isOpen: true,
            type: 'department',
            item: { ...option, _id: deptId }
        });
    };

    const handleDeleteDesignation = (option) => {
        const desigName = option.value;
        const deptName = option.department;

        if (!desigName) return;

        const desigId = option._id || designations.find(d => d.name === desigName && d.department === (deptName || workDetailsForm.department))?._id;
        if (!desigId) return;

        setDeleteConfig({
            isOpen: true,
            type: 'designation',
            item: { ...option, _id: desigId }
        });
    };

    const confirmDelete = async () => {
        const { type, item } = deleteConfig;
        if (!type || !item) return;

        try {
            if (type === 'department') {
                await axiosInstance.delete(`/Department/${item._id}`);
                setDepartments(prev => prev.filter(d => d._id !== item._id));
                if (workDetailsForm.department === item.value) {
                    handleChange('department', '');
                }
                toast({
                    title: "Department Deleted",
                    description: `Department "${item.value}" has been deleted successfully.`,
                });
            } else if (type === 'designation') {
                await axiosInstance.delete(`/Designation/${item._id}`);
                setDesignations(prev => prev.filter(d => d._id !== item._id));
                if (workDetailsForm.designation === item.value) {
                    handleChange('designation', '');
                }
                toast({
                    title: "Designation Deleted",
                    description: `Designation "${item.value}" has been deleted successfully.`,
                });
            }
        } catch (error) {
            console.error(`Failed to delete ${type}`, error);
            toast({
                title: "Deletion Failed",
                description: `Failed to delete ${type}. Please try again.`,
                variant: "destructive",
            });
        } finally {
            setDeleteConfig({ isOpen: false, type: '', item: null });
        }
    };

    const handleDepartmentChange = (value) => {
        if (value === 'add_new_department') {
            setIsAddDeptModalOpen(true);
            return;
        }
        handleChange('department', value);
    };

    const handleDesignationChange = (value) => {
        if (value === 'add_new_designation') {
            setIsAddDesigModalOpen(true);
            return;
        }
        handleChange('designation', value);
    };

    const onDepartmentAdded = (newDept) => {
        setDepartments(prev => [...prev, newDept]);
        handleChange('department', newDept.name);
    };

    const onDesignationAdded = (newDesig) => {
        setDesignations(prev => [...prev, newDesig]);
        handleChange('designation', newDesig.name);
    };


    const handleChange = (field, value) => {
        const updatedForm = { ...workDetailsForm, [field]: value };
        let currentErrors = { ...workDetailsErrors };

        // Clear designation if department changes
        if (field === 'department') {
            updatedForm.designation = '';
            // Clear designation error
            if (currentErrors.designation) {
                delete currentErrors.designation;
            }
        }

        // If General Manager and Management, clear reportee fields
        if (updatedForm.department === 'Management' && updatedForm.designation === 'General Manager') {
            updatedForm.primaryReportee = '';
            updatedForm.secondaryReportee = '';

            // Clear errors for these fields
            delete currentErrors.primaryReportee;
            delete currentErrors.secondaryReportee;
        }

        // Clear probation period if status changes from Probation
        if (field === 'status' && value !== 'Probation') {
            updatedForm.probationPeriod = null;
        }

        // If primary reportee is selected and matches secondary, clear secondary
        if (field === 'primaryReportee' && value && value === updatedForm.secondaryReportee) {
            updatedForm.secondaryReportee = '';
        }

        // If secondary reportee is selected and matches primary, clear it
        if (field === 'secondaryReportee' && value && value === updatedForm.primaryReportee) {
            updatedForm.secondaryReportee = '';
            if (currentErrors.secondaryReportee) {
                delete currentErrors.secondaryReportee;
            }
        }

        setWorkDetailsForm(updatedForm);

        // Real-time validation
        validateWorkDetailsField(field, value, updatedForm, currentErrors, setWorkDetailsErrors, employee);
    };

    const handleSubmit = async () => {
        if (!validateWorkDetailsForm(workDetailsForm, setWorkDetailsErrors, employee)) {
            return;
        }

        // Check for Data Cleanup: If changing to Permanent and has Visit Visa, delete it.
        const isBecomingPermanent = workDetailsForm.status === 'Permanent';
        const hasVisitVisa = employee?.visaDetails?.visit?.number;

        if (isBecomingPermanent && hasVisitVisa) {
            try {
                // Delete Visiting Visa details
                await axiosInstance.patch(`/Employee/visa/${employee._id || employee.id}`, {
                    visaType: 'visit',
                    visaNumber: '',
                    issueDate: null,
                    expiryDate: null,
                    sponsor: '',
                    visaCopy: null,
                    visaCopyName: '',
                    visaCopyMime: ''
                });
                // We don't need to show a success toast here as the main update will show one.
                // But we should know it happened.
                console.log('Visiting Visa data cleared due to status change to Permanent.');
            } catch (cleanupError) {
                console.error('Failed to clear visiting visa data:', cleanupError);
                // Optional: warn user? For now, we proceed with work details update.
            }
        }

        await onUpdate();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Work Details</h3>
                    <button
                        onClick={() => !updatingWorkDetails && onClose()}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className="space-y-3 pr-2 max-h-[70vh] overflow-y-auto modal-scroll">
                    <div className="space-y-3">
                        {/* Date of Joining - Read Only */}
                        {employee?.dateOfJoining && (
                            <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-gray-50">
                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                    Date of Joining
                                </label>
                                <div className="w-full md:flex-1 flex flex-col gap-1">
                                    <input
                                        type="text"
                                        value={formatDate(employee.dateOfJoining)}
                                        className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-gray-600 cursor-not-allowed"
                                        readOnly
                                        disabled
                                    />
                                </div>
                            </div>
                        )}

                        {/* Contract Joining Date */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                Contract Joining Date <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DatePicker
                                    value={workDetailsForm.contractJoiningDate ? new Date(workDetailsForm.contractJoiningDate).toISOString().split('T')[0] : ''}
                                    onChange={(val) => handleChange('contractJoiningDate', val)}
                                    className={`w-full ${workDetailsErrors.contractJoiningDate ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={updatingWorkDetails}
                                />
                                {workDetailsErrors.contractJoiningDate && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.contractJoiningDate}</span>
                                )}
                            </div>
                        </div>

                        {/* Department */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                Department <span className="text-red-500">*</span>
                            </label>
                            <div className="relative w-full md:flex-1 flex flex-col gap-1">
                                <DropdownWithDelete
                                    options={getAllDepartments()}
                                    value={workDetailsForm.department}
                                    onChange={(value) => handleDepartmentChange(value)}
                                    onDelete={canManageMetadata ? handleDeleteDepartment : undefined}
                                    onAdd={canManageMetadata ? () => setIsAddDeptModalOpen(true) : undefined}
                                    placeholder="Select Department"
                                    addNewLabel="+ Add New Department"
                                    disabled={updatingWorkDetails}
                                    error={!!workDetailsErrors.department}
                                />
                                {workDetailsErrors.department && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.department}</span>
                                )}
                            </div>
                        </div>

                        {/* Designation */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                Designation <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DropdownWithDelete
                                    options={workDetailsForm.department ? getDesignationsForDept(workDetailsForm.department) : []}
                                    value={workDetailsForm.designation}
                                    onChange={(value) => handleDesignationChange(value)}
                                    onDelete={canManageMetadata ? handleDeleteDesignation : undefined}
                                    onAdd={canManageMetadata ? () => setIsAddDesigModalOpen(true) : undefined}
                                    placeholder={workDetailsForm.department ? 'Select Designation' : 'Select Department first'}
                                    addNewLabel="+ Add New Designation"
                                    disabled={updatingWorkDetails || !workDetailsForm.department}
                                    error={!!workDetailsErrors.designation}
                                />
                                {workDetailsErrors.designation && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.designation}</span>
                                )}
                            </div>
                        </div>

                        {/* Work Status */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                Work Status <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <select
                                    value={workDetailsForm.status || 'Probation'}
                                    onChange={(e) => handleChange('status', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.status ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={updatingWorkDetails}
                                >
                                    {statusOptions
                                        .filter(option => ['Probation', 'Notice'].includes(option.value))
                                        .map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                                disabled={option.value === 'Notice' && (employee?.status === 'Probation')}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                </select>
                                {workDetailsErrors.status && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.status}</span>
                                )}
                            </div>
                        </div>


                        {/* Overtime Toggle */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">Overtime</label>
                            <div className="w-full md:flex-1 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleChange('overtime', !workDetailsForm.overtime)}
                                    disabled={updatingWorkDetails}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${workDetailsForm.overtime ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${workDetailsForm.overtime ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                                <span className="text-sm text-gray-700">{workDetailsForm.overtime ? 'Yes' : 'No'}</span>
                            </div>
                        </div>

                        {/* Conditional Reportee Fields */}
                        {!(workDetailsForm.department === 'Management' && workDetailsForm.designation === 'General Manager') && (
                            <>
                                {/* Primary Reportee */}
                                <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                        Primary Reportee <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <select
                                            value={workDetailsForm.primaryReportee || ''}
                                            onChange={(e) => handleChange('primaryReportee', e.target.value)}
                                            className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.primaryReportee ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                            disabled={updatingWorkDetails || reportingAuthorityLoading}
                                        >
                                            <option value="">{reportingAuthorityLoading ? 'Loading...' : 'Select primary reportee'}</option>
                                            {reportingAuthorityOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        {workDetailsErrors.primaryReportee && (
                                            <span className="text-xs text-red-500">{workDetailsErrors.primaryReportee}</span>
                                        )}
                                        {reportingAuthorityError && !workDetailsErrors.primaryReportee && (
                                            <span className="text-xs text-red-500">{reportingAuthorityError}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Secondary Reportee */}
                                <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                        Secondary Reportee
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <select
                                            value={workDetailsForm.secondaryReportee || ''}
                                            onChange={(e) => handleChange('secondaryReportee', e.target.value)}
                                            className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.secondaryReportee ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                            disabled={updatingWorkDetails || reportingAuthorityLoading}
                                        >
                                            <option value="">{reportingAuthorityLoading ? 'Loading...' : 'Select secondary reportee (optional)'}</option>
                                            {reportingAuthorityOptions
                                                .filter(option => option.value !== workDetailsForm.primaryReportee)
                                                .map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                        </select>
                                        {workDetailsErrors.secondaryReportee && (
                                            <span className="text-xs text-red-500">{workDetailsErrors.secondaryReportee}</span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 px-4 pt-4 border-t border-gray-100">
                    <button
                        onClick={() => !updatingWorkDetails && onClose()}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors disabled:opacity-50"
                        disabled={updatingWorkDetails}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                        disabled={updatingWorkDetails}
                    >
                        {updatingWorkDetails ? 'Updating...' : 'Update'}
                    </button>
                </div>
            </div>


            <AddDepartmentModal
                isOpen={isAddDeptModalOpen}
                onClose={() => setIsAddDeptModalOpen(false)}
                onDepartmentAdded={onDepartmentAdded}
            />

            <AddDesignationModal
                isOpen={isAddDesigModalOpen}
                onClose={() => setIsAddDesigModalOpen(false)}
                onDesignationAdded={onDesignationAdded}
                initialDepartment={workDetailsForm.department}
            />

            <AlertDialog open={deleteConfig.isOpen} onOpenChange={(open) => !open && setDeleteConfig(prev => ({ ...prev, isOpen: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            {deleteConfig.type === 'department' ? ' department' : ' designation'}
                            <span className="font-semibold text-black"> "{deleteConfig.item?.value}"</span>
                            and remove it from the system.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
