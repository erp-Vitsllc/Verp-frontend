'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axiosInstance from '@/utils/axios';
import DropdownWithDelete from '@/components/ui/DropdownWithDelete';
import AddDepartmentModal from '@/app/HRM/Department/components/AddDepartmentModal';
import AddDesignationModal from '@/app/HRM/Designation/components/AddDesignationModal';
import AddWorkLocationModal from '@/app/HRM/WorkLocation/components/AddWorkLocationModal';
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
import {
    normalizeCompanyEmail,
    validateCompanyEmail,
    validateDateOfJoining,
    validateEmployeeWorkDetailsForm,
    validatePrimaryReportee,
    validateReportingAuthority,
    validateSecondaryReportee,
    validateWorkCompany,
    validateWorkDepartment,
    validateWorkDesignation,
    validateWorkStatus,
    validateContractJoiningDate,
    calculateRemainingProbation,
    formatRemainingProbation,
    normalizeDateForPicker,
    resolveContractJoiningDate,
} from '@/utils/employeeWorkDetailsValidation';
import {
    buildWorkStatusExitDropdownOptions,
    formatNoticeExitDate,
    formatWorkStatusDisplay,
    resolveWorkStatusDropdownValue,
} from '@/utils/employeeWorkStatus';

const validateWorkDetailsField = (field, value, form, errors, setErrors, employee) => {
    const newErrors = { ...errors };
    const employeeRecordId = employee?._id || employee?.id || '';
    const employeeEmployeeId = employee?.employeeId || '';
    let result = { isValid: true, error: '' };

    if (field === 'companyEmail') result = validateCompanyEmail(value);
    else if (field === 'dateOfJoining') result = validateDateOfJoining(value, { dateOfBirth: employee?.dateOfBirth });
    else if (field === 'contractJoiningDate') result = validateContractJoiningDate(value, form.dateOfJoining);
    else if (field === 'company') result = validateWorkCompany(value);
    else if (field === 'department') result = validateWorkDepartment(value);
    else if (field === 'designation') result = validateWorkDesignation(value);
    else if (field === 'status') result = validateWorkStatus(value);
    else if (field === 'reportingAuthority') result = validateReportingAuthority(value, { employeeRecordId, employeeEmployeeId });
    else if (field === 'primaryReportee') result = validatePrimaryReportee(value, { employeeRecordId, employeeEmployeeId, department: form.department });
    else if (field === 'secondaryReportee') result = validateSecondaryReportee(value, { primaryReportee: form.primaryReportee, employeeRecordId, employeeEmployeeId });

    if (!result.isValid) newErrors[field] = result.error;
    else delete newErrors[field];

    setErrors(newErrors);
};

const validateWorkDetailsForm = (form, setErrors, employee) => {
    const errors = validateEmployeeWorkDetailsForm(form, { employee });
    setErrors(errors);
    return Object.keys(errors).length === 0;
};

import { useRouter } from 'next/navigation';
import { isAdmin, isPortalSuperUser } from '@/utils/permissions';
import {
    invalidateWorkLocationsCache,
    normalizeWorkLocationKey,
} from '@/utils/workLocations';

let workDetailsCatalogCache = null;
let workDetailsCatalogInflight = null;

async function loadWorkDetailsCatalog() {
    if (workDetailsCatalogCache) return workDetailsCatalogCache;
    if (!workDetailsCatalogInflight) {
        workDetailsCatalogInflight = Promise.all([
            axiosInstance.get('/Department', { skipToast: true }),
            axiosInstance.get('/Designation', { skipToast: true }),
            axiosInstance.get('/Company', { skipToast: true }),
            axiosInstance.get('/WorkLocation', { skipToast: true }),
        ])
            .then(([deptRes, desigRes, companyRes, locRes]) => {
                const fetchedCompanies = companyRes.data.companies || companyRes.data;
                workDetailsCatalogCache = {
                    departments: deptRes.data || [],
                    designations: desigRes.data || [],
                    companies: Array.isArray(fetchedCompanies) ? fetchedCompanies : [],
                    workLocations: locRes.data?.workLocations || locRes.data || [],
                };
                return workDetailsCatalogCache;
            })
            .finally(() => {
                workDetailsCatalogInflight = null;
            });
    }
    return workDetailsCatalogInflight;
}

export default function WorkDetailsModal({
    isOpen,
    onClose,
    initialForm,
    onUpdate,
    employee,
    reportingAuthorityOptions,
    reportingAuthorityLoading,
    reportingAuthorityError,
    onEmployeeRefresh,
    viewerIsDesignatedFlowchartHr = false,
}) {
    const router = useRouter();
    const { toast } = useToast();

    const [form, setForm] = useState(initialForm || {});
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && initialForm) {
            setForm(initialForm);
            setErrors({});
            setSuspendOpen(false);
        }
        if (!isOpen) {
            setShowLeftUserChecklist(false);
            setLeftUserChecked({});
            setSuspendOpen(false);
        }
    }, [isOpen, initialForm]);

    useEffect(() => {
        if (!isOpen) return;
        setCanSuspendAttendance(isPortalSuperUser());
    }, [isOpen]);

    const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
    const [isAddDesigModalOpen, setIsAddDesigModalOpen] = useState(false);
    const [isAddWorkLocationModalOpen, setIsAddWorkLocationModalOpen] = useState(false);
    const [deptModalInitialName, setDeptModalInitialName] = useState('');
    const [desigModalInitialName, setDesigModalInitialName] = useState('');
    const [workLocationModalInitialName, setWorkLocationModalInitialName] = useState('');
    const [leftUserChecks, setLeftUserChecks] = useState([]);
    const [leftUserChecksLoading, setLeftUserChecksLoading] = useState(false);
    const [leftUserChecked, setLeftUserChecked] = useState({});
    const [markingLeftUser, setMarkingLeftUser] = useState(false);
    const [showLeftUserChecklist, setShowLeftUserChecklist] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [workLocations, setWorkLocations] = useState([]);
    const [assignedEmployees, setAssignedEmployees] = useState([]);
    const [isEmployeesListModalOpen, setIsEmployeesListModalOpen] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [canSuspendAttendance, setCanSuspendAttendance] = useState(false);
    const [suspendOpen, setSuspendOpen] = useState(false);
    const [suspendSaving, setSuspendSaving] = useState(false);
    const [suspendForm, setSuspendForm] = useState({ mode: 'range', fromDate: '', untilDate: '', description: '' });
    const [suspendFiles, setSuspendFiles] = useState([]);

    // State for delete confirmation
    const [deleteConfig, setDeleteConfig] = useState({
        isOpen: false,
        type: '', // 'department' | 'designation' | 'workLocation'
        item: null
    });

    /** Same users who can quick-add catalog rows may delete non-system rows. */
    const canDeleteCatalogItems = !submitting;
    const canManageWorkLocations = isAdmin() && !submitting;

    const canEditWorkStatus = isAdmin() || Boolean(viewerIsDesignatedFlowchartHr);
    const canEditContractJoiningDate = Boolean(viewerIsDesignatedFlowchartHr);
    const willApplyLeftUserImmediately = Boolean(viewerIsDesignatedFlowchartHr);

    const closeLeftUserChecklist = () => {
        if (markingLeftUser) return;
        setShowLeftUserChecklist(false);
        setLeftUserChecked({});
    };

    const openLeftUserChecklist = async () => {
        const employeeKey = employee?._id || employee?.id || employee?.employeeId;
        if (!employeeKey || employee?.status === 'Left User') return;

        setShowLeftUserChecklist(true);
        setLeftUserChecked({});
        setLeftUserChecksLoading(true);
        try {
            const res = await axiosInstance.get(`/Employee/${employeeKey}/left-user-eligibility`);
            setLeftUserChecks(Array.isArray(res.data?.checks) ? res.data.checks : []);
        } catch (error) {
            setLeftUserChecks([]);
            toast({
                variant: 'destructive',
                title: 'Could not load Left User checks',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setLeftUserChecksLoading(false);
        }
    };

    const leftUserReadyToConfirm =
        !leftUserChecksLoading &&
        leftUserChecks.length > 0 &&
        leftUserChecks.every((check) => {
            if (!check?.manual && !check?.passed) return false;
            return Boolean(leftUserChecked[check.code]);
        });

    const toggleLeftUserCheck = (check) => {
        if (markingLeftUser || leftUserChecksLoading) return;
        if (!check?.manual && !check?.passed) return;
        setLeftUserChecked((prev) => ({
            ...prev,
            [check.code]: !prev[check.code],
        }));
    };

    const handleMarkLeftUser = async () => {
        const employeeKey = employee?._id || employee?.id || employee?.employeeId;
        if (!employeeKey || !leftUserReadyToConfirm) return;

        setMarkingLeftUser(true);
        try {
            const res = await axiosInstance.post(`/Employee/${employeeKey}/mark-left-user`, {
                gratuityPaidConfirmed: true,
            });
            const isQueued =
                res.data?.queuedForHrApproval === true ||
                String(res.data?.message || '').toLowerCase().includes('queued for hr');

            if (isQueued) {
                toast({
                    title: 'Sent to HR for approval',
                    description:
                        'HR has been notified by email and a dashboard task was created. Work status stays unchanged until HR accepts.',
                });
                if (typeof onEmployeeRefresh === 'function') {
                    await onEmployeeRefresh(true);
                }
                onClose();
                return;
            }

            toast({
                title: 'Marked as Left User',
                description: res.data?.message || 'Employee work status updated. Reloading page…',
            });
            onClose();
            if (typeof window !== 'undefined') {
                window.location.reload();
                return;
            }
            if (typeof onEmployeeRefresh === 'function') {
                await onEmployeeRefresh(true);
            }
        } catch (error) {
            const blockers = error.response?.data?.blockers;
            toast({
                variant: 'destructive',
                title: 'Cannot mark as Left User',
                description: error.response?.data?.message || 'Failed to update work status.',
            });
            if (Array.isArray(error.response?.data?.checks)) {
                setLeftUserChecks(error.response.data.checks);
                setLeftUserChecked({});
            }
            if (Array.isArray(blockers) && blockers.length > 0) {
                setShowLeftUserChecklist(true);
            }
        } finally {
            setMarkingLeftUser(false);
        }
    };

    const handleWorkStatusChange = async (value) => {
        if (value === 'Left User') {
            void openLeftUserChecklist();
            return;
        }
        if (value === 'Termination' || value === 'Resignation') {
            toast({
                variant: 'destructive',
                title: 'Option disabled',
                description: `${value} is disabled for now.`,
            });
            return;
        }
        if (value === 'Probation' || value === 'Permanent') {
            handleChange('status', value);
        }
    };

    const workStatusExitOptions = useMemo(
        () => buildWorkStatusExitDropdownOptions({
            isAlreadyLeftUser: employee?.status === 'Left User',
            isAdmin: canEditWorkStatus,
        }),
        [employee?.status, canEditWorkStatus],
    );

    const workStatusDropdownValue = resolveWorkStatusDropdownValue(employee, form.status);
    const workStatusDropdownDisabled =
        !canEditWorkStatus ||
        submitting ||
        markingLeftUser;

    // Fetch Departments, Designations and Companies once per session (cached)
    useEffect(() => {
        if (!isOpen) return undefined;

        let cancelled = false;
        loadWorkDetailsCatalog()
            .then(({ departments, designations, companies, workLocations: locations }) => {
                if (cancelled) return;
                setDepartments(departments);
                setDesignations(designations);
                setCompanies(companies);
                setWorkLocations(Array.isArray(locations) ? locations : []);
            })
            .catch((error) => {
                if (!cancelled) {
                    console.error('Failed to fetch departments/designations/companies', error);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    // Enforce Probation status if employee has a Visiting Visa
    useEffect(() => {
        if (isOpen && employee?.visaDetails?.visit?.number) {
            setForm(prev => {
                if (prev.status !== 'Probation') {
                    return { ...prev, status: 'Probation' };
                }
                return prev;
            });
            // Clear any status errors
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.status;
                return newErrors;
            });
        }
    }, [isOpen, employee?.visaDetails?.visit?.number]);

    const activeCompanies = useMemo(
        () => companies.filter((c) => String(c.status || 'Active').toLowerCase() === 'active'),
        [companies],
    );

    const reportingToOptions = useMemo(() => {
        const selfId = String(employee?._id || employee?.id || '');
        return (reportingAuthorityOptions || []).filter((opt) => String(opt.value) !== selfId);
    }, [reportingAuthorityOptions, employee]);

    const remainingProbationDisplay = useMemo(() => {
        if (form.status !== 'Probation') return null;
        const info = calculateRemainingProbation({
            status: form.status,
            contractJoiningDate: form.contractJoiningDate || resolveContractJoiningDate(employee),
            probationPeriod: form.probationPeriod || employee?.probationPeriod || 6,
            employee,
        });
        return formatRemainingProbation(info);
    }, [form.status, form.probationPeriod, form.contractJoiningDate, employee]);

    const effectiveContractJoiningDate = resolveContractJoiningDate(employee);

    const departmentOptions = useMemo(
        () => [...departments]
            .filter((d) => String(d.status || 'Active').toLowerCase() === 'active')
            .sort((a, b) => {
                if (a.name === 'Management') return -1;
                if (b.name === 'Management') return 1;
                return a.name.localeCompare(b.name);
            })
            .map((d) => ({ value: d.name, label: d.name, _id: d._id, isSystem: d.isSystem })),
        [departments],
    );

    const designationOptions = useMemo(() => {
        const dept = String(form.department || '').trim().toLowerCase();
        return designations
            .filter((d) => String(d.status || 'Active').toLowerCase() === 'active')
            .filter((d) => !dept || !d.department || String(d.department).trim().toLowerCase() === dept)
            .sort((a, b) => {
                if (a.name === 'General Manager') return -1;
                if (b.name === 'General Manager') return 1;
                return a.name.localeCompare(b.name);
            })
            .map((d) => ({ value: d.name, label: d.name, _id: d._id, department: d.department, isSystem: d.isSystem }));
    }, [designations, form.department]);

    const workLocationOptions = useMemo(() => {
        const source = workLocations.length
            ? workLocations
            : [
                { key: 'office', label: 'Office', isSystem: true, status: 'Active', sortOrder: 0 },
                { key: 'site', label: 'Site', isSystem: true, status: 'Active', sortOrder: 1 },
            ];
        const rows = [...source]
            .filter((row) => String(row.status || 'Active').toLowerCase() === 'active')
            .sort((a, b) => {
                const orderA = Number(a.sortOrder);
                const orderB = Number(b.sortOrder);
                if (Number.isFinite(orderA) && Number.isFinite(orderB) && orderA !== orderB) {
                    return orderA - orderB;
                }
                if (a.key === 'office') return -1;
                if (b.key === 'office') return 1;
                if (a.key === 'site') return -1;
                if (b.key === 'site') return 1;
                return String(a.label || '').localeCompare(String(b.label || ''));
            })
            .map((row) => ({
                value: row.key,
                label: row.label,
                _id: row._id,
                isSystem: Boolean(row.isSystem) || row.key === 'office' || row.key === 'site',
            }));

        const currentKey = normalizeWorkLocationKey(form.staffType);
        if (currentKey && !rows.some((row) => row.value === currentKey)) {
            rows.unshift({
                value: currentKey,
                label: currentKey === 'site' ? 'Site' : currentKey === 'office' ? 'Office' : currentKey,
                isSystem: true,
            });
        }
        return rows;
    }, [workLocations, form.staffType]);

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
                if (form.department === item.value) {
                    handleChange('department', '');
                }
                toast({
                    title: "Department Deleted",
                    description: `Department "${item.value}" has been deleted successfully.`,
                });
            } else if (type === 'designation') {
                await axiosInstance.delete(`/Designation/${item._id}`);
                setDesignations(prev => prev.filter(d => d._id !== item._id));
                if (form.designation === item.value) {
                    handleChange('designation', '');
                }
                toast({
                    title: "Designation Deleted",
                    description: `Designation "${item.value}" has been deleted successfully.`,
                });
            } else if (type === 'workLocation') {
                await axiosInstance.delete(`/WorkLocation/${item._id}`);
                setWorkLocations((prev) => prev.filter((d) => d._id !== item._id));
                workDetailsCatalogCache = null;
                invalidateWorkLocationsCache();
                if (form.staffType === item.value) {
                    handleChange('staffType', 'office');
                }
                toast({
                    title: 'Work location deleted',
                    description: `"${item.label || item.value}" has been removed from the dropdown.`,
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

    const handleDeleteWorkLocation = (option) => {
        if (!option?._id || option.isSystem) return;
        setDeleteConfig({
            isOpen: true,
            type: 'workLocation',
            item: { ...option },
        });
    };

    const onWorkLocationAdded = (created) => {
        if (!created?.key) return;
        setWorkLocations((prev) => [...prev, created]);
        workDetailsCatalogCache = null;
        invalidateWorkLocationsCache();
        handleChange('staffType', created.key);
    };

    const handleQuickAddWorkLocation = async (name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        try {
            const response = await axiosInstance.post('/WorkLocation', { name: trimmed });
            onWorkLocationAdded(response.data);
            toast({
                title: 'Work location added',
                description: `"${trimmed}" is now available in the list.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not add work location',
                description: error.response?.data?.message || 'Failed to add work location.',
            });
        }
    };

    const openAddWorkLocationModal = (initialName = '') => {
        setWorkLocationModalInitialName(initialName);
        setIsAddWorkLocationModalOpen(true);
    };

    const handleDepartmentChange = (value) => {
        if (value === 'add_new_department') {
            openAddDepartmentModal('');
            return;
        }
        handleChange('department', value);
    };

    const handleDesignationChange = (value) => {
        if (value === 'add_new_designation') {
            openAddDesignationModal('');
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

    const handleQuickAddDepartment = async (name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        try {
            const response = await axiosInstance.post('/Department', { name: trimmed });
            onDepartmentAdded(response.data);
            toast({
                title: 'Department added',
                description: `"${trimmed}" is now available in the list.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not add department',
                description: error.response?.data?.message || 'Failed to add department.',
            });
        }
    };

    const handleQuickAddDesignation = async (name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        const department = String(form.department || '').trim() || 'General';
        try {
            const response = await axiosInstance.post('/Designation', { name: trimmed, department });
            onDesignationAdded(response.data);
            toast({
                title: 'Designation added',
                description: `"${trimmed}" is now available in the list.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not add designation',
                description: error.response?.data?.message || 'Failed to add designation.',
            });
        }
    };

    const openAddDepartmentModal = (initialName = '') => {
        setDeptModalInitialName(initialName);
        setIsAddDeptModalOpen(true);
    };

    const openAddDesignationModal = (initialName = '') => {
        setDesigModalInitialName(initialName);
        setIsAddDesigModalOpen(true);
    };


    const companyOptions = useMemo(
        () => activeCompanies.map((c) => ({ value: c._id, label: c.name })),
        [activeCompanies],
    );

    const secondaryReporteeOptions = useMemo(
        () => reportingToOptions.filter((option) => option.value !== form.primaryReportee),
        [reportingToOptions, form.primaryReportee],
    );

    const handleChange = (field, value) => {
        let processedValue = value;
        if (field === 'companyEmail') processedValue = normalizeCompanyEmail(value);
        let updatedForm = { ...form, [field]: processedValue };

        if (field === 'primaryReportee' && value && value === updatedForm.secondaryReportee) {
            updatedForm.secondaryReportee = '';
        }
        if (field === 'secondaryReportee' && value && value === updatedForm.primaryReportee) {
            updatedForm.secondaryReportee = '';
        }

        if (field === 'status' && value === 'Probation' && employee?.status === 'Left User') {
            const todayStr = new Date().toISOString().split('T')[0];
            updatedForm = {
                ...updatedForm,
                dateOfJoining: todayStr,
                probationPeriod: 6
            };
            // Clear errors for status, dateOfJoining
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.status;
                delete newErrors.dateOfJoining;
                return newErrors;
            });
        }

        setForm(updatedForm);
        if (field === 'status' && value === 'Probation' && employee?.status === 'Left User') {
            return;
        }
        validateWorkDetailsField(field, processedValue, updatedForm, { ...errors }, setErrors, employee);
    };

    const attendanceSuspended = String(employee?.attendanceAccountStatus || 'active') === 'suspended';
    const attendanceWindow = employee?.attendanceSuspension || {};

    const activateAttendance = async () => {
        if (!canSuspendAttendance || suspendSaving) return;
        const employeeId = employee?._id || employee?.id;
        if (!employeeId) return;
        setSuspendSaving(true);
        try {
            await axiosInstance.post(`/Employee/${employeeId}/attendance-suspension`, { action: 'activate' });
            toast({ title: 'Attendance is active' });
            if (onEmployeeRefresh) await onEmployeeRefresh();
        } catch (err) {
            toast({
                title: 'Could not activate attendance',
                description: err?.response?.data?.message || 'Try again.',
                variant: 'destructive',
            });
        } finally {
            setSuspendSaving(false);
        }
    };

    const submitAttendanceSuspension = async () => {
        if (!canSuspendAttendance || suspendSaving) return;
        const employeeId = employee?._id || employee?.id;
        if (!employeeId) return;
        const permanent = suspendForm.mode === 'permanent';
        const fromDate = String(suspendForm.fromDate || '').trim();
        const untilDate = permanent ? '' : String(suspendForm.untilDate || '').trim();
        const description = String(suspendForm.description || '').trim();
        if (!fromDate || description.length < 3 || (!permanent && (!untilDate || untilDate < fromDate))) {
            return;
        }
        setSuspendSaving(true);
        try {
            const attachments = await Promise.all(suspendFiles.map((file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({
                    name: file.name,
                    mimeType: file.type,
                    data: String(reader.result || ''),
                });
                reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
                reader.readAsDataURL(file);
            })));
            await axiosInstance.post(`/Employee/${employeeId}/attendance-suspension`, {
                mode: permanent ? 'permanent' : 'range',
                fromDate,
                untilDate,
                description,
                attachments,
            });
            toast({ title: 'Attendance suspended' });
            setSuspendOpen(false);
            setSuspendFiles([]);
            if (onEmployeeRefresh) await onEmployeeRefresh();
        } catch (err) {
            toast({
                title: 'Could not suspend attendance',
                description: err?.response?.data?.message || 'Try again.',
                variant: 'destructive',
            });
        } finally {
            setSuspendSaving(false);
        }
    };

    const suspendPermanent = suspendForm.mode === 'permanent';
    const suspendFromDate = String(suspendForm.fromDate || '').trim();
    const suspendToDate = String(suspendForm.untilDate || '').trim();
    const suspendReason = String(suspendForm.description || '').trim();
    const suspendFormReady = Boolean(
        suspendReason.length >= 3 &&
        suspendFromDate &&
        (suspendPermanent || (suspendToDate && suspendToDate >= suspendFromDate)),
    );

    const handleSubmit = async () => {
        if (!validateWorkDetailsForm(form, setErrors, employee)) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Please check the form for errors."
            });
            return;
        }

        setSubmitting(true);
        try {
            await onUpdate({ ...form });
        } catch {
            /* parent shows toast */
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Work Details</h3>
                    <button
                        onClick={() => !submitting && onClose()}
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
                                    value={form.companyEmail || ''}
                                    onChange={(e) => handleChange('companyEmail', e.target.value)}
                                    maxLength={100}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${errors.companyEmail ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'
                                        }`}
                                    placeholder="e.g. john.doe@company.com"
                                />
                                {errors.companyEmail && (
                                    <span className="text-xs text-red-500">{errors.companyEmail}</span>
                                )}
                                <span className="text-xs text-gray-500">
                                    Optional for profile activation, but required for ERP login, assets, tasks, and emails.
                                </span>
                            </div>
                        </div>

                        {/* Date of Joining */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Date of Joining <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DatePicker
                                    value={form.dateOfJoining ? new Date(form.dateOfJoining).toISOString().split('T')[0] : ''}
                                    onChange={(val) => handleChange('dateOfJoining', val)}
                                    className={`w-full ${errors.dateOfJoining ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={submitting}
                                    disabledDays={{ after: new Date() }}
                                />
                                {errors.dateOfJoining && (
                                    <span className="text-xs text-red-500">{errors.dateOfJoining}</span>
                                )}
                            </div>
                        </div>

                        {/* Contract Joining Date — auto from first visa; only flowchart HR can edit */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Contract Joining Date
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DatePicker
                                    value={normalizeDateForPicker(
                                        canEditContractJoiningDate
                                            ? (form.contractJoiningDate || effectiveContractJoiningDate)
                                            : effectiveContractJoiningDate,
                                    )}
                                    onChange={(val) => {
                                        if (!canEditContractJoiningDate) return;
                                        handleChange('contractJoiningDate', val);
                                    }}
                                    className={`w-full ${
                                        canEditContractJoiningDate
                                            ? (errors.contractJoiningDate ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]')
                                            : 'bg-gray-50 border-[#E5E7EB] cursor-not-allowed opacity-90'
                                    }`}
                                    disabled={submitting || !canEditContractJoiningDate}
                                    disabledDays={canEditContractJoiningDate ? { after: new Date() } : undefined}
                                />
                                {errors.contractJoiningDate && (
                                    <span className="text-xs text-red-500">{errors.contractJoiningDate}</span>
                                )}
                                <span className="text-xs text-gray-500">
                                    Auto-filled from the first Employment or Spouse visa issue date. Only flowchart HR can edit this date. Visit visa and renewals do not change this date.
                                </span>
                            </div>
                        </div>

                        {/* Company */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Company <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DropdownWithDelete
                                    options={companyOptions}
                                    value={typeof form.company === 'object' ? form.company?._id : (form.company || '')}
                                    onChange={(value) => handleChange('company', value)}
                                    placeholder="Select Company"
                                    disabled={submitting}
                                    error={!!errors.company}
                                />
                                {errors.company && (
                                    <span className="text-xs text-red-500">{errors.company}</span>
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
                                    options={departmentOptions}
                                    value={form.department}
                                    onChange={(value) => handleDepartmentChange(value)}
                                    onDelete={canDeleteCatalogItems ? handleDeleteDepartment : undefined}
                                    onAdd={!submitting ? () => openAddDepartmentModal('') : undefined}
                                    onQuickAddFromSearch={!submitting ? handleQuickAddDepartment : undefined}
                                    placeholder="Select Department"
                                    addNewLabel="+ Add New Department"
                                    disabled={submitting}
                                    error={!!errors.department}
                                />
                                {errors.department && (
                                    <span className="text-xs text-red-500">{errors.department}</span>
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
                                    options={designationOptions}
                                    value={form.designation}
                                    onChange={(value) => handleDesignationChange(value)}
                                    onDelete={canDeleteCatalogItems ? handleDeleteDesignation : undefined}
                                    onAdd={!submitting ? () => openAddDesignationModal('') : undefined}
                                    onQuickAddFromSearch={!submitting ? handleQuickAddDesignation : undefined}
                                    placeholder="Select Designation"
                                    addNewLabel="+ Add New Designation"
                                    disabled={submitting}
                                    error={!!errors.designation}
                                />
                                {errors.designation && (
                                    <span className="text-xs text-red-500">{errors.designation}</span>
                                )}
                            </div>
                        </div>

                        {/* Work Status */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Work Status <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-2">
                                <DropdownWithDelete
                                    options={workStatusExitOptions}
                                    value={workStatusDropdownValue}
                                    onChange={handleWorkStatusChange}
                                    placeholder={formatWorkStatusDisplay(employee) || 'Select work status'}
                                    disabled={workStatusDropdownDisabled}
                                    error={!!errors.status}
                                />
                                {employee?.status === 'Notice' && formatNoticeExitDate(employee) && (
                                    <p className="text-xs text-gray-500">
                                        Exit date: {formatNoticeExitDate(employee)}
                                    </p>
                                )}
                                {errors.status && (
                                    <span className="text-xs text-red-500">{errors.status}</span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Attendance
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!canSuspendAttendance || suspendSaving) return;
                                            if (attendanceSuspended) {
                                                activateAttendance();
                                                return;
                                            }
                                            setSuspendForm({
                                                fromDate: attendanceWindow.fromDate || '',
                                                untilDate: attendanceWindow.untilDate || '',
                                                description: attendanceWindow.description || '',
                                            });
                                            setSuspendOpen(true);
                                        }}
                                        disabled={!canSuspendAttendance || suspendSaving}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${attendanceSuspended ? 'bg-slate-700' : 'bg-gray-300'} ${!canSuspendAttendance ? 'cursor-not-allowed opacity-70' : ''}`}
                                        title={canSuspendAttendance ? 'Suspend attendance' : 'Only the portal super user can change this'}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${attendanceSuspended ? 'translate-x-6' : 'translate-x-1'}`}
                                        />
                                    </button>
                                    <span className="text-sm text-gray-700">
                                        {attendanceSuspended ? 'Suspended' : 'Active'}
                                    </span>
                                </div>
                                {attendanceSuspended && (attendanceWindow.fromDate || attendanceWindow.untilDate) ? (
                                    <p className="text-xs text-slate-600">
                                        {attendanceWindow.mode === 'permanent'
                                            ? `From ${attendanceWindow.fromDate || '—'}`
                                            : `${attendanceWindow.fromDate || '—'} to ${attendanceWindow.untilDate || '—'}`}
                                        {attendanceWindow.description ? ` · ${attendanceWindow.description}` : ''}
                                    </p>
                                ) : null}
                                {!canSuspendAttendance ? (
                                    <p className="text-xs text-gray-400">Only the portal super user can suspend attendance.</p>
                                ) : null}
                            </div>
                        </div>

                        {form.status === 'Probation' && employee?.status === 'Left User' && (
                            <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                    Probation Duration <span className="text-red-500">*</span>
                                </label>
                                <div className="w-full md:flex-1 flex flex-col gap-1">
                                    <DropdownWithDelete
                                        options={[
                                            { value: '0', label: '0 Months (No Probation)' },
                                            { value: '1', label: '1 Month' },
                                            { value: '2', label: '2 Months' },
                                            { value: '3', label: '3 Months' },
                                            { value: '4', label: '4 Months' },
                                            { value: '5', label: '5 Months' },
                                            { value: '6', label: '6 Months' },
                                        ]}
                                        value={String(form.probationPeriod !== undefined && form.probationPeriod !== null ? form.probationPeriod : '6')}
                                        onChange={(val) => handleChange('probationPeriod', Number(val))}
                                        placeholder="Select Probation Duration"
                                        disabled={submitting}
                                    />
                                    <span className="text-xs text-gray-500">
                                        Select the probation duration for reactivation (0 to 6 months).
                                    </span>
                                </div>
                            </div>
                        )}

                        {form.status === 'Probation' && employee?.status !== 'Left User' && remainingProbationDisplay && (
                            <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                    Remaining Probation
                                </label>
                                <div className="w-full md:flex-1">
                                    <input
                                        type="text"
                                        value={remainingProbationDisplay}
                                        readOnly
                                        disabled
                                        className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-gray-100 text-gray-600 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Work Location — admin-managed categories (Attendance / Leave grouping) */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Work Location <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DropdownWithDelete
                                    options={workLocationOptions}
                                    value={normalizeWorkLocationKey(form.staffType)}
                                    onChange={(value) => handleChange('staffType', value)}
                                    onDelete={canManageWorkLocations ? handleDeleteWorkLocation : undefined}
                                    onAdd={canManageWorkLocations ? () => openAddWorkLocationModal('') : undefined}
                                    onQuickAddFromSearch={canManageWorkLocations ? handleQuickAddWorkLocation : undefined}
                                    placeholder="Select Work Location"
                                    addNewLabel="+ Add Work Location"
                                    disabled={submitting}
                                />
                                <p className="mt-1.5 text-xs text-gray-400">
                                    Active employees appear under this group on the Attendance page.
                                    {canManageWorkLocations
                                        ? ' You can add or remove categories from this dropdown.'
                                        : ''}
                                </p>
                            </div>
                        </div>

                        {/* Overtime Toggle */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Overtime <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleChange('overtime', !form.overtime)}
                                    disabled={submitting}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.overtime ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.overtime ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                                <span className="text-sm text-gray-700">{form.overtime ? 'Yes' : 'No'}</span>
                            </div>
                        </div>

                        {/* Primary Reportee */}
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 md:pt-2">
                                Primary Reportee <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <DropdownWithDelete
                                    options={reportingToOptions}
                                    value={form.primaryReportee || ''}
                                    onChange={(value) => handleChange('primaryReportee', value)}
                                    placeholder={reportingAuthorityLoading ? 'Loading...' : 'Select primary reportee'}
                                    disabled={submitting || reportingAuthorityLoading}
                                    error={!!errors.primaryReportee}
                                />
                                {errors.primaryReportee && (
                                    <span className="text-xs text-red-500">{errors.primaryReportee}</span>
                                )}
                                {reportingAuthorityError && !errors.primaryReportee && (
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
                                <DropdownWithDelete
                                    options={secondaryReporteeOptions}
                                    value={form.secondaryReportee || ''}
                                    onChange={(value) => handleChange('secondaryReportee', value)}
                                    placeholder={reportingAuthorityLoading ? 'Loading...' : 'Select secondary reportee (optional)'}
                                    disabled={submitting || reportingAuthorityLoading}
                                    error={!!errors.secondaryReportee}
                                />
                                {errors.secondaryReportee && (
                                    <span className="text-xs text-red-500">{errors.secondaryReportee}</span>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 px-4 pt-4 border-t border-gray-100">
                    <button
                        onClick={() => !submitting && onClose()}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors disabled:opacity-50"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                        disabled={submitting}
                    >
                        {submitting ? 'Updating...' : 'Update'}
                    </button>
                </div>
            </div>

            {suspendOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Close suspend attendance"
                        className="absolute inset-0 bg-black/45"
                        onClick={() => !suspendSaving && setSuspendOpen(false)}
                    />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-800">Set as Suspended</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {suspendPermanent
                                    ? 'From the start date, punch in, punch out, and mark attendance stay blocked until attendance is activated again. Saved attendance is not changed.'
                                    : 'Punch in, punch out, and mark attendance stay blocked from the start date through the to date. Saved attendance is not changed.'}
                            </p>
                        </div>
                        <div className="px-5 py-4 overflow-y-auto space-y-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Suspension</label>
                                <div className="grid grid-cols-2 rounded-xl border border-gray-200 p-1 bg-gray-50">
                                    <button
                                        type="button"
                                        onClick={() => setSuspendForm((prev) => ({ ...prev, mode: 'permanent', untilDate: '' }))}
                                        className={`h-9 rounded-lg text-sm font-medium ${suspendPermanent ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        Permanent
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSuspendForm((prev) => ({ ...prev, mode: 'range' }))}
                                        className={`h-9 rounded-lg text-sm font-medium ${!suspendPermanent ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        Time range
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    From date <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                    value={suspendForm.fromDate}
                                    onChange={(value) => setSuspendForm((prev) => ({ ...prev, fromDate: value || '' }))}
                                    placeholder="Select from date"
                                />
                            </div>
                            {!suspendPermanent && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">
                                            To date <span className="text-red-500">*</span>
                                        </label>
                                        <DatePicker
                                            value={suspendForm.untilDate}
                                            onChange={(value) => setSuspendForm((prev) => ({ ...prev, untilDate: value || '' }))}
                                            placeholder="Select to date"
                                        />
                                        {suspendForm.fromDate && suspendForm.untilDate && suspendForm.untilDate < suspendForm.fromDate ? (
                                            <p className="mt-1 text-xs text-red-500">To date must be on or after the from date.</p>
                                        ) : null}
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={suspendForm.description}
                                    onChange={(event) => setSuspendForm((prev) => ({ ...prev, description: event.target.value }))}
                                    rows={3}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                                    placeholder="Why this employee is suspended"
                                />
                                {suspendReason.length > 0 && suspendReason.length < 3 ? (
                                    <p className="mt-1 text-xs text-red-500">Enter a reason of at least 3 characters.</p>
                                ) : null}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Attachment <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                                    onChange={(event) => {
                                        const picked = Array.from(event.target.files || []);
                                        const next = [...suspendFiles];
                                        for (const file of picked) {
                                            if (next.length >= 5) break;
                                            const okType = /pdf|jpeg|png|jpg/i.test(file.type) || /\.(pdf|jpe?g|png)$/i.test(file.name);
                                            if (!okType) {
                                                toast({ title: 'File type not allowed', description: 'Use PDF, JPG, or PNG.', variant: 'destructive' });
                                                continue;
                                            }
                                            if (file.size > 10 * 1024 * 1024) {
                                                toast({ title: 'File too large', description: `${file.name} is over 10MB.`, variant: 'destructive' });
                                                continue;
                                            }
                                            next.push(file);
                                        }
                                        setSuspendFiles(next);
                                        event.target.value = '';
                                    }}
                                    className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700"
                                />
                                <p className="mt-1 text-xs text-gray-400">PDF, JPG, or PNG. Up to 5 files, 10MB each. You can leave this empty.</p>
                                {suspendFiles.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-sm text-gray-700">
                                        {suspendFiles.map((file, index) => (
                                            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                                                <span className="truncate">{file.name}</span>
                                                <button
                                                    type="button"
                                                    className="text-xs text-red-600"
                                                    onClick={() => setSuspendFiles((prev) => prev.filter((_, i) => i !== index))}
                                                >
                                                    Remove
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => !suspendSaving && setSuspendOpen(false)}
                                disabled={suspendSaving}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitAttendanceSuspension}
                                disabled={suspendSaving || !suspendFormReady}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {suspendSaving ? 'Updating…' : 'Set as suspended'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AddDepartmentModal
                isOpen={isAddDeptModalOpen}
                onClose={() => {
                    setIsAddDeptModalOpen(false);
                    setDeptModalInitialName('');
                }}
                onDepartmentAdded={onDepartmentAdded}
                initialName={deptModalInitialName}
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
                onClose={() => {
                    setIsAddDesigModalOpen(false);
                    setDesigModalInitialName('');
                }}
                onDesignationAdded={onDesignationAdded}
                initialDepartment={form.department}
                initialName={desigModalInitialName}
            />

            <AddWorkLocationModal
                isOpen={isAddWorkLocationModalOpen}
                onClose={() => {
                    setIsAddWorkLocationModalOpen(false);
                    setWorkLocationModalInitialName('');
                }}
                onWorkLocationAdded={onWorkLocationAdded}
                initialName={workLocationModalInitialName}
            />

            <AlertDialog open={deleteConfig.isOpen} onOpenChange={(open) => !open && setDeleteConfig(prev => ({ ...prev, isOpen: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            {deleteConfig.type === 'department'
                                ? ' department'
                                : deleteConfig.type === 'workLocation'
                                  ? ' work location'
                                  : ' designation'}
                            <span className="font-semibold text-black"> "{deleteConfig.item?.label || deleteConfig.item?.value}"</span>
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

            {showLeftUserChecklist && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Close Left User checklist"
                        className="absolute inset-0 bg-black/45"
                        onClick={closeLeftUserChecklist}
                    />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-800">Set as Left User</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Tick every condition. A condition that is not clear stays locked until it is resolved.
                            </p>
                        </div>
                        <div className="px-5 py-4 overflow-y-auto space-y-2">
                            {leftUserChecksLoading ? (
                                <p className="text-sm text-gray-500">Checking this employee…</p>
                            ) : leftUserChecks.length === 0 ? (
                                <p className="text-sm text-red-600">Clearance checks could not be loaded.</p>
                            ) : (
                                leftUserChecks.map((check) => {
                                    const locked = !check.manual && !check.passed;
                                    const checked = Boolean(leftUserChecked[check.code]);
                                    return (
                                        <label
                                            key={check.code}
                                            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${locked ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'} ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 h-4 w-4"
                                                checked={checked}
                                                disabled={locked || markingLeftUser}
                                                onChange={() => toggleLeftUserCheck(check)}
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-sm text-gray-800">{check.label}</span>
                                                {locked && check.message ? (
                                                    <span className="mt-1 block text-xs text-amber-800">{check.message}</span>
                                                ) : null}
                                                {check.manual ? (
                                                    <span className="mt-1 block text-xs text-gray-500">
                                                        Tick this after gratuity is paid. This is confirmed manually.
                                                    </span>
                                                ) : null}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                            <p className="text-xs text-gray-500 pt-1">
                                {willApplyLeftUserImmediately
                                    ? 'As HR, this applies immediately. After that, this employee stays off salary, task, and employee lists unless the employee list filter is Left User.'
                                    : 'HR will be notified by email and a dashboard task. After approval, this employee stays off salary, task, and employee lists unless the employee list filter is Left User.'}
                            </p>
                        </div>
                        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeLeftUserChecklist}
                                disabled={markingLeftUser}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleMarkLeftUser()}
                                disabled={!leftUserReadyToConfirm || markingLeftUser}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {markingLeftUser ? 'Updating…' : 'Set Left User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body,
    );
}
