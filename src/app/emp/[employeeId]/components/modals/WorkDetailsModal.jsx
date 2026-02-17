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
import NoticeRequestModal from './NoticeRequestModal';

// Validate individual work details field
const validateWorkDetailsField = (field, value, form, errors, setErrors, employee) => {
    const newErrors = { ...errors };
    let error = '';

    if (field === 'department') {
        if (!value || value.trim() === '') {
            error = 'Department is required';
        }
    } else if (field === 'dateOfJoining') {
        if (!value || value.trim() === '') {
            error = 'Date of Joining is required';
        } else {
            const joiningDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            joiningDate.setHours(0, 0, 0, 0);

            if (joiningDate > today) {
                error = 'Date of Joining cannot be in the future';
            } else {
                // Cross-validate with contractJoiningDate
                const contractDateValue = form.contractJoiningDate || employee?.contractJoiningDate;
                if (contractDateValue) {
                    const contractDate = new Date(contractDateValue);
                    contractDate.setHours(0, 0, 0, 0);
                    if (contractDate < joiningDate) {
                        // If contract date is now invalid, we should probably set an error on it
                        // but here we just return error for the field being changed
                        error = 'Date of Joining cannot be after Contract Joining Date';
                    }
                }
            }
        }
    } else if (field === 'contractJoiningDate') {
        if (!value || value.trim() === '') {
            error = 'Contract Joining Date is required';
        } else {
            const contractDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            contractDate.setHours(0, 0, 0, 0);

            if (contractDate > today) {
                error = 'Contract Joining Date cannot be in the future';
            } else {
                const joiningDateValue = form.dateOfJoining || employee?.dateOfJoining;
                if (joiningDateValue) {
                    const joiningDate = new Date(joiningDateValue);
                    joiningDate.setHours(0, 0, 0, 0);

                    if (contractDate < joiningDate) {
                        error = 'Contract Joining Date cannot be before Date of Joining';
                    }
                }
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
        const dept = form.department?.trim().toLowerCase();
        // Exempt if department is management, regardless of designation
        const isExempt = dept === 'management';

        if (!isExempt && (!value || value.trim() === '')) {
            error = 'Primary Reportee is required';
        }
    } else if (field === 'company') {
        if (!value || value.trim() === '') {
            error = 'Company is required';
        }
    }
    // Secondary Reportee is optional - no validation needed

    if (field === 'companyEmail') {
        if (value && value.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value.trim())) {
                error = 'Please enter a valid email address';
            }
        }
    }

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

    // Date of Joining validation
    if (!form.dateOfJoining || form.dateOfJoining.trim() === '') {
        errors.dateOfJoining = 'Date of Joining is required';
    } else {
        const joiningDate = new Date(form.dateOfJoining);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        joiningDate.setHours(0, 0, 0, 0);
        if (joiningDate > today) {
            errors.dateOfJoining = 'Date of Joining cannot be in the future';
        }
    }

    // Contract Joining Date validation
    if (!form.contractJoiningDate || form.contractJoiningDate.trim() === '') {
        errors.contractJoiningDate = 'Contract Joining Date is required';
    } else {
        const contractDate = new Date(form.contractJoiningDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        contractDate.setHours(0, 0, 0, 0);

        if (contractDate > today) {
            errors.contractJoiningDate = 'Contract Joining Date cannot be in the future';
        } else if ((form.dateOfJoining) || (employee && employee.dateOfJoining)) {
            const joiningDate = new Date(form.dateOfJoining || employee.dateOfJoining);
            joiningDate.setHours(0, 0, 0, 0);

            if (contractDate < joiningDate) {
                errors.contractJoiningDate = 'Contract Joining Date cannot be before Date of Joining';
            }
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

    // Company validation
    if (!form.company || (typeof form.company === 'string' && form.company.trim() === '')) {
        errors.company = 'Company is required';
    }

    // Primary Reportee validation
    const dept = form.department?.trim().toLowerCase();
    // Exempt if department is management, regardless of designation
    const isExempt = dept === 'management';



    if (!isExempt && (!form.primaryReportee || form.primaryReportee.trim() === '')) {
        errors.primaryReportee = 'Primary Reportee is required';
    }

    // Company Email validation
    if (form.companyEmail && form.companyEmail.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(form.companyEmail.trim())) {
            errors.companyEmail = 'Please enter a valid email address';
        }
    }

    // Secondary Reportee is optional - no validation needed


    setErrors(errors);
    return Object.keys(errors).length === 0;
};

import { useRouter } from 'next/navigation';

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
    const router = useRouter();
    if (!isOpen) return null;

    const { toast } = useToast();

    const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
    const [isAddDesigModalOpen, setIsAddDesigModalOpen] = useState(false);
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [assignedEmployees, setAssignedEmployees] = useState([]);
    const [isEmployeesListModalOpen, setIsEmployeesListModalOpen] = useState(false);
    const [companies, setCompanies] = useState([]);

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

    // Fetch Departments, Designations and Companies on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, desigRes, companyRes] = await Promise.all([
                    axiosInstance.get('/Department'),
                    axiosInstance.get('/Designation'),
                    axiosInstance.get('/Company')
                ]);
                setDepartments(deptRes.data);
                setDesignations(desigRes.data);
                const fetchedCompanies = companyRes.data.companies || companyRes.data;
                setCompanies(Array.isArray(fetchedCompanies) ? fetchedCompanies : []);
            } catch (error) {
                console.error("Failed to fetch departments/designations/companies", error);
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

    // Get all designations sorted
    const getAllDesignations = () => {
        return designations
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
        // Don't rely on department filtering for ID lookup if possible, or use option._id directly
        if (!desigName) return;

        const desigId = option._id || designations.find(d => d.name === desigName)?._id;
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
            const errorMessage = error.response?.data?.message || `Failed to delete ${type}. Please try again.`;
            const employees = error.response?.data?.employees || [];

            if (employees.length > 0) {
                setAssignedEmployees(employees);
                toast({
                    title: "Deletion Failed",
                    description: (
                        <div className="flex flex-col gap-2">
                            <p>{errorMessage}</p>
                            <button
                                onClick={() => setIsEmployeesListModalOpen(true)}
                                className="text-blue-500 hover:text-blue-700 font-bold text-sm underline text-left w-fit"
                            >
                                See Employees
                            </button>
                        </div>
                    ),
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Deletion Failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }
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
        // Intercept Notice status selection
        if (field === 'status' && value === 'Notice' && employee?.status !== 'Notice') {
            setIsNoticeModalOpen(true);
            return;
        }

        const updatedForm = { ...workDetailsForm, [field]: value };
        let currentErrors = { ...workDetailsErrors };

        // Do NOT clear designation if department changes (decoupled)
        // if (field === 'department') { ... }

        // If Management department, clear reportee fields
        const currentDept = updatedForm.department?.trim().toLowerCase();

        if (currentDept === 'management') {
            updatedForm.primaryReportee = ''; // Clear selection
            updatedForm.secondaryReportee = '';

            // Clear errors for these fields immediately if they exist
            if (currentErrors.primaryReportee) delete currentErrors.primaryReportee;
            if (currentErrors.secondaryReportee) delete currentErrors.secondaryReportee;
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

        // CRITICAL: Intercept Primary Reportee selection
        // Check if the selected reportee has a company email
        if (field === 'primaryReportee' && value) {
            const selectedOption = reportingAuthorityOptions.find(opt => opt.value === value);
            if (selectedOption && !selectedOption.email) {
                // Formatting name from label "Name (Designation)" -> "Name"
                let employeeName = selectedOption.label;
                const parenIndex = employeeName.indexOf('(');
                if (parenIndex > 0) {
                    employeeName = employeeName.substring(0, parenIndex).trim();
                }

                toast({
                    variant: "destructive",
                    title: "Cannot Select Reportee",
                    description: `Cannot select ${employeeName} as they do not have a company email address.`
                });
                return; // Prevent update
            }
        }

        setWorkDetailsForm(updatedForm);

        // Real-time validation
        validateWorkDetailsField(field, value, updatedForm, currentErrors, setWorkDetailsErrors, employee);
    };

    const handleSubmit = async () => {
        console.log("Handle Submit Triggered"); // DEBUG LOG
        if (!validateWorkDetailsForm(workDetailsForm, setWorkDetailsErrors, employee)) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Please check the form for errors."
            });
            console.log("Validation Failed"); // DEBUG LOG
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
                        {/* Company Email ID */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Company Email ID
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="email"
                                    value={workDetailsForm.companyEmail || ''}
                                    onChange={(e) => handleChange('companyEmail', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.companyEmail ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'
                                        }`}
                                    placeholder="e.g. john.doe@company.com"
                                />
                                {workDetailsErrors.companyEmail && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.companyEmail}</span>
                                )}
                            </div>
                        </div>

                        {/* Date of Joining */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Date of Joining <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DatePicker
                                    value={workDetailsForm.dateOfJoining ? new Date(workDetailsForm.dateOfJoining).toISOString().split('T')[0] : ''}
                                    onChange={(val) => handleChange('dateOfJoining', val)}
                                    className={`w-full ${workDetailsErrors.dateOfJoining ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={updatingWorkDetails}
                                    disabledDays={{ after: new Date() }}
                                />
                                {workDetailsErrors.dateOfJoining && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.dateOfJoining}</span>
                                )}
                            </div>
                        </div>

                        {/* Contract Joining Date */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Contract Joining Date <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DatePicker
                                    value={workDetailsForm.contractJoiningDate ? new Date(workDetailsForm.contractJoiningDate).toISOString().split('T')[0] : ''}
                                    onChange={(val) => handleChange('contractJoiningDate', val)}
                                    className={`w-full ${workDetailsErrors.contractJoiningDate ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={updatingWorkDetails}
                                    disabledDays={{ after: new Date() }}
                                />
                                {workDetailsErrors.contractJoiningDate && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.contractJoiningDate}</span>
                                )}
                            </div>
                        </div>

                        {/* Company */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Company <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <select
                                    value={typeof workDetailsForm.company === 'object' ? workDetailsForm.company?._id : (workDetailsForm.company || '')}
                                    onChange={(e) => handleChange('company', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.company ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'
                                        }`}
                                    disabled={updatingWorkDetails}
                                >
                                    <option value="">Select Company</option>
                                    {companies.map((company) => (
                                        <option key={company._id} value={company._id}>
                                            {company.name}
                                        </option>
                                    ))}
                                </select>
                                {workDetailsErrors.company && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.company}</span>
                                )}
                            </div>
                        </div>

                        {/* Department */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
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
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Designation <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DropdownWithDelete
                                    options={getAllDesignations()}
                                    value={workDetailsForm.designation}
                                    onChange={(value) => handleDesignationChange(value)}
                                    onDelete={canManageMetadata ? handleDeleteDesignation : undefined}
                                    onAdd={canManageMetadata ? () => setIsAddDesigModalOpen(true) : undefined}
                                    placeholder="Select Designation"
                                    addNewLabel="+ Add New Designation"
                                    disabled={updatingWorkDetails}
                                    error={!!workDetailsErrors.designation}
                                />
                                {workDetailsErrors.designation && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.designation}</span>
                                )}
                            </div>
                        </div>

                        {/* Work Status */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Work Status <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                {employee?.status === 'Notice' ? (
                                    <input
                                        type="text"
                                        value="Notice"
                                        disabled
                                        className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-gray-100 text-gray-500 cursor-not-allowed"
                                    />
                                ) : (
                                    <select
                                        value={workDetailsForm.status || 'Probation'}
                                        onChange={(e) => handleChange('status', e.target.value)}
                                        className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.status ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                        disabled={updatingWorkDetails}
                                    >
                                        {statusOptions
                                            .filter(option => {
                                                // Logic:
                                                // If current is Probation: Show Probation, Notice
                                                // If current is Permanent: Show Permanent, Notice
                                                // Always allow staying on current status
                                                // And allow Notice (checked in handleChange)

                                                const currentStatus = employee?.status || 'Probation';
                                                if (currentStatus === 'Probation') {
                                                    return ['Probation', 'Notice'].includes(option.value);
                                                } else if (currentStatus === 'Permanent') {
                                                    return ['Permanent', 'Notice'].includes(option.value);
                                                }
                                                // Fallback for other statuses or admin overrides - maybe show all or restricted
                                                return ['Probation', 'Permanent', 'Notice'].includes(option.value);
                                            })
                                            .map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                    </select>
                                )}
                                {workDetailsErrors.status && (
                                    <span className="text-xs text-red-500">{workDetailsErrors.status}</span>
                                )}
                            </div>
                        </div>


                        {/* Overtime Toggle */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">Overtime</label>
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
                        {!(workDetailsForm.department?.trim().toLowerCase() === 'management') && (
                            <>
                                {/* Primary Reportee */}
                                <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
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
                                <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
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

            <NoticeRequestModal
                isOpen={isNoticeModalOpen}
                onClose={() => setIsNoticeModalOpen(false)}
                employeeId={employee?._id || employee?.id}
                onSuccess={() => {
                    // Maybe close WorkDetailsModal too?
                    setIsNoticeModalOpen(false);
                    onClose();
                }}
            />

            {/* Employees List Modal */}
            {isEmployeesListModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEmployeesListModalOpen(false)}></div>
                    <div className="relative bg-white rounded-[22px] shadow-2xl w-full max-w-[500px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-800">Assigned Employees</h3>
                            <button
                                onClick={() => setIsEmployeesListModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden space-y-3 min-h-[200px]">
                            {assignedEmployees.length > 0 ? (
                                assignedEmployees.map((emp) => (
                                    <div
                                        key={emp.id}
                                        onClick={() => {
                                            const nameSlug = emp.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                            router.push(`/emp/${emp.id}${nameSlug ? `.${nameSlug}` : ''}`);
                                        }}
                                        className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer group transition-all"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                                {emp.name}
                                            </span>
                                            <span className="text-xs font-medium text-gray-500 font-mono tracking-tight">
                                                {emp.id}
                                            </span>
                                        </div>
                                        <div className="p-2 bg-gray-50 text-gray-400 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9 18l6-6-6-6"></path>
                                            </svg>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 border border-gray-100">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">No employees found in this list.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                            <p className="text-[11px] text-gray-400 font-medium">Click an employee to view their full profile.</p>
                        </div>
                    </div>
                </div>
            )}

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
