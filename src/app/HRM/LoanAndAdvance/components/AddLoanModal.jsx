'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, AlertCircle } from 'lucide-react';
import Select from 'react-select';
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { useToast } from '@/hooks/use-toast';
import axiosInstance from '@/utils/axios';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';
import {
    canCreateLoan,
    canCreateAdvance,
    getDefaultLoanAdvanceType,
} from '../utils/loanPermissionAccess';
import { getStoredUser, isActiveFlowchartHrUser } from '../utils/isFlowchartHrUser';

const VISA_LT_3_MONTHS_BLOCK_MSG =
    'Visa expires in less than 3 months. Cannot apply for a Loan.';
const VISA_LT_3_MONTHS_CONFIRM_MSG =
    'Visa expires in less than 3 months. Do you want to proceed?';
const VISA_REPAYMENT_LIMIT_MSG =
    'Repayment period exceeds visa expiry limit (Expiry - 2 months). Please reduce duration or change start date.';

export default function AddLoanModal({
    isOpen,
    onClose,
    onSuccess,
    employees = [],
    existingLoans = [],
    initialData = null,
    isResubmitting = false,
    scheduleOnlyEdit = false,
    employeeDetails = null,
}) {
    const { toast } = useToast();
    const allowLoanType = canCreateLoan() || (Boolean(initialData) && initialData?.type === 'Loan');
    const allowAdvanceType = canCreateAdvance() || (Boolean(initialData) && initialData?.type === 'Advance');
    const defaultType = getDefaultLoanAdvanceType();
    const [formData, setFormData] = useState({
        employeeId: '',
        type: defaultType,
        amount: '',
        duration: '', // months
        reason: '',
        monthStart: new Date().toISOString().split('T')[0].slice(0, 7) // Default to current month
    });

    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [errors, setErrors] = useState({});
    const [eligibilityWarning, setEligibilityWarning] = useState('');
    /** Soft visa warning — hard-blocks non-flowchart-HR; flowchart HR confirms via dialog. */
    const [visaEligibilityWarning, setVisaEligibilityWarning] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dateWarning, setDateWarning] = useState('');
    const [maxDuration, setMaxDuration] = useState(6);
    const [isFlowchartHr, setIsFlowchartHr] = useState(false);
    const [flowchartHrResolved, setFlowchartHrResolved] = useState(false);
    const isFlowchartHrRef = useRef(false);
    const flowchartHrResolvedRef = useRef(false);
    const [visaConfirmOpen, setVisaConfirmOpen] = useState(false);
    const [visaConfirmMessages, setVisaConfirmMessages] = useState([]);
    const [pendingForcedStatus, setPendingForcedStatus] = useState(null);

    // Reset or Populate when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    employeeId: initialData.employeeId || '',
                    type: initialData.type || 'Loan',
                    amount: initialData.amount || '',
                    duration: initialData.duration || '',
                    reason: initialData.reason || '',
                    monthStart: initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7),
                });

                if (scheduleOnlyEdit && employeeDetails) {
                    const salary =
                        employeeDetails.monthlySalary ||
                        employeeDetails.totalSalary ||
                        employeeDetails.salary ||
                        0;
                    let visaExpiry = null;
                    let visaType = null;
                    if (employeeDetails.visaDetails) {
                        if (employeeDetails.visaDetails.employment?.expiryDate) {
                            visaType = 'Employment';
                            visaExpiry = employeeDetails.visaDetails.employment.expiryDate;
                        } else if (employeeDetails.visaDetails.spouse?.expiryDate) {
                            visaType = 'Spouse';
                            visaExpiry = employeeDetails.visaDetails.spouse.expiryDate;
                        } else if (employeeDetails.visaDetails.visit?.expiryDate) {
                            visaType = 'Visit';
                            visaExpiry = employeeDetails.visaDetails.visit.expiryDate;
                        }
                    }
                    setSelectedEmployee({
                        employeeId: employeeDetails.employeeId || initialData.employeeId,
                        employeeObjectId: employeeDetails._id,
                        name: `${employeeDetails.firstName || ''} ${employeeDetails.lastName || ''}`.trim() || initialData.applicantName,
                        status: employeeDetails.status,
                        salary,
                        visaExpiry,
                        visaType,
                    });
                    if (initialData.type === 'Loan' && visaExpiry) {
                        const expiryDate = new Date(visaExpiry);
                        const today = new Date();
                        const monthsUntilExpiry =
                            (expiryDate.getFullYear() - today.getFullYear()) * 12 +
                            (expiryDate.getMonth() - today.getMonth());
                        const adjustedMax = monthsUntilExpiry - 2;
                        setMaxDuration(Math.min(6, Math.max(1, adjustedMax)));
                    } else if (initialData.type === 'Advance') {
                        setMaxDuration(1);
                    }
                } else if (employees.length > 0 && initialData.employeeId) {
                    const employee = employees.find((e) => e.employeeId === initialData.employeeId);
                    if (employee) {
                        setSelectedEmployee(employee);
                        checkEligibility(employee, initialData.type || 'Loan');
                    }
                }
            } else {
                // New Mode
                setFormData({
                    employeeId: '',
                    type: getDefaultLoanAdvanceType(),
                    amount: '',
                    duration: '',
                    reason: '',
                    monthStart: new Date().toISOString().split('T')[0].slice(0, 7)
                });
                setSelectedEmployee(null);
                setErrors({});
                setEligibilityWarning('');
                setVisaEligibilityWarning('');
                setDateWarning('');
                setVisaConfirmOpen(false);
                setVisaConfirmMessages([]);
                setPendingForcedStatus(null);
            }
        }
    }, [isOpen, initialData, employees, scheduleOnlyEdit, employeeDetails]);

    // Resolve whether the current user is Flowchart HR (visa override privilege).
    useEffect(() => {
        if (!isOpen) {
            setIsFlowchartHr(false);
            isFlowchartHrRef.current = false;
            setFlowchartHrResolved(false);
            flowchartHrResolvedRef.current = false;
            return;
        }
        let cancelled = false;
        setFlowchartHrResolved(false);
        flowchartHrResolvedRef.current = false;
        (async () => {
            try {
                const user = getStoredUser();
                const { data } = await axiosInstance.get('/Flowchart');
                const rows = Array.isArray(data) ? data : data?.responsibilities || [];
                const isHr = isActiveFlowchartHrUser(user, rows);
                if (!cancelled) {
                    isFlowchartHrRef.current = isHr;
                    setIsFlowchartHr(isHr);
                    flowchartHrResolvedRef.current = true;
                    setFlowchartHrResolved(true);
                }
            } catch {
                if (!cancelled) {
                    isFlowchartHrRef.current = false;
                    setIsFlowchartHr(false);
                    flowchartHrResolvedRef.current = true;
                    setFlowchartHrResolved(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    // Re-run eligibility once flowchart HR status is known (async).
    useEffect(() => {
        if (!isOpen || !flowchartHrResolved || !selectedEmployee || scheduleOnlyEdit) return;
        checkEligibility(selectedEmployee, formData.type);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only when HR flag resolves
    }, [isFlowchartHr, flowchartHrResolved]);

    // If Create Loan / Create Advance permission changes, drop unavailable type from the toggle.
    useEffect(() => {
        if (!isOpen || initialData) return;
        if (formData.type === 'Loan' && !allowLoanType && allowAdvanceType) {
            setFormData((prev) => ({ ...prev, type: 'Advance' }));
        } else if (formData.type === 'Advance' && !allowAdvanceType && allowLoanType) {
            setFormData((prev) => ({ ...prev, type: 'Loan' }));
        }
    }, [isOpen, initialData, formData.type, allowLoanType, allowAdvanceType]);

    // Handle Employee Selection & Eligibility Logic
    const employeeSelectOptions = useMemo(
        () =>
            (employees || []).map((emp) => ({
                value: emp.employeeId,
                label: `${emp.employeeId} - ${emp.name || ''}`.trim(),
                employee: emp,
            })),
        [employees],
    );

    const selectedEmployeeOption =
        employeeSelectOptions.find((opt) => opt.value === formData.employeeId) || null;

    const employeeSelectStyles = useMemo(
        () => ({
            control: (base, state) => ({
                ...base,
                minHeight: 40,
                height: 40,
                borderRadius: 12,
                borderColor: errors.employeeId
                    ? '#ef4444'
                    : state.isFocused
                      ? '#3b82f6'
                      : '#e5e7eb',
                backgroundColor: '#f9fafb',
                boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.45)' : 'none',
                '&:hover': {
                    borderColor: errors.employeeId ? '#ef4444' : '#d1d5db',
                },
            }),
            valueContainer: (base) => ({
                ...base,
                padding: '0 12px',
            }),
            input: (base) => ({
                ...base,
                margin: 0,
                padding: 0,
            }),
            indicatorsContainer: (base) => ({
                ...base,
                height: 38,
            }),
            menu: (base) => ({
                ...base,
                borderRadius: 12,
                overflow: 'hidden',
                zIndex: 60,
            }),
            menuPortal: (base) => ({
                ...base,
                zIndex: 70,
            }),
            option: (base, state) => ({
                ...base,
                fontSize: 14,
                backgroundColor: state.isSelected
                    ? '#3b82f6'
                    : state.isFocused
                      ? '#eff6ff'
                      : 'white',
                color: state.isSelected ? 'white' : '#111827',
            }),
            singleValue: (base) => ({
                ...base,
                fontSize: 14,
                color: '#374151',
            }),
            placeholder: (base) => ({
                ...base,
                fontSize: 14,
                color: '#9ca3af',
            }),
        }),
        [errors.employeeId],
    );

    const handleEmployeeChange = (empId) => {
        if (scheduleOnlyEdit) return;
        const employee = employees.find(e => e.employeeId === empId);

        // Reset employee-specific fields but keep type
        // Set default duration to 1 if Advance
        const defaultDuration = formData.type === 'Advance' ? 1 : '';
        setFormData(prev => ({ ...prev, employeeId: empId, amount: '', duration: defaultDuration, reason: '' }));
        setSelectedEmployee(employee);
        setErrors({});
        setEligibilityWarning('');
        setVisaEligibilityWarning('');
        setMaxDuration(6);

        if (!employee) return;

        // Check eligibility based on current type (Loan vs Advance)
        checkEligibility(employee, formData.type);
    };

    // Re-check when type changes
    useEffect(() => {
        if (scheduleOnlyEdit) return;
        const defaultDuration = formData.type === 'Advance' ? 1 : '';
        if (selectedEmployee) {
            setFormData(prev => ({ ...prev, amount: '', duration: defaultDuration }));
            checkEligibility(selectedEmployee, formData.type);
        } else {
            setFormData(prev => ({ ...prev, duration: defaultDuration }));
        }
    }, [formData.type]);

    // Live check for Date + Duration vs Visa Expiry
    useEffect(() => {
        if (!selectedEmployee?.visaExpiry || !formData.monthStart || !formData.duration) {
            setDateWarning('');
            return;
        }

        const start = new Date(formData.monthStart + '-01'); // YYYY-MM-01
        const duration = parseInt(formData.duration);

        // Calculate Repayment End Date (Start + Duration)
        const endOfRepayment = new Date(start);
        endOfRepayment.setMonth(endOfRepayment.getMonth() + duration);

        const visaExpiry = new Date(selectedEmployee.visaExpiry);
        const safeLimit = new Date(visaExpiry);
        safeLimit.setMonth(safeLimit.getMonth() - 2);
        // Logic: Expiry - 2 months. 

        if (endOfRepayment > safeLimit && formData.type !== 'Advance') {
            setDateWarning(VISA_REPAYMENT_LIMIT_MSG);
        } else {
            setDateWarning('');
        }
    }, [formData.monthStart, formData.duration, selectedEmployee, formData.type]);

    const checkEligibility = (employee, type) => {
        setEligibilityWarning('');
        setVisaEligibilityWarning('');
        setErrors(prev => {
            const newErrs = { ...prev };
            if (newErrs.employeeId && newErrs.employeeId.includes('active or pending')) {
                delete newErrs.employeeId;
            }
            return newErrs;
        });
        let newMaxDuration = 12;
        const flowchartHr = isFlowchartHrRef.current;
        const hrResolved = flowchartHrResolvedRef.current;

        // Check if employee already has an active or pending loan/advance of the SAME type
        if (existingLoans && existingLoans.length > 0) {
            const hasActiveOfType = existingLoans.some(l =>
                l.employeeId === employee.employeeId &&
                l.type === type &&
                l.activeStatus !== 'Closed' &&
                l.applicationStatus !== 'Rejected' &&
                (!initialData || (l.id !== initialData.id && l._id !== initialData._id)) // Exclude current if editing
            );

            if (hasActiveOfType) {
                const message = `Employee already has an active or pending ${type}.`;
                setEligibilityWarning(message);
                setErrors(prev => ({ ...prev, employeeId: message }));
                return;
            }
        }

        // Common Check: Status (Notice)
        if (employee.status?.toLowerCase() === 'notice') {
            setEligibilityWarning(`Employee is in 'Notice' period and cannot apply for a loan/advance.`);
            return;
        }

        // Check: Probation (Block Loan only, Allow Advance)
        if (employee.status?.toLowerCase() === 'probation' && type === 'Loan') {
            setEligibilityWarning(`Employee is in 'Probation' period and cannot apply for a loan.`);
            return;
        }

        // Advance Specific Checks
        if (type === 'Advance') {
            newMaxDuration = 1; // Force 1 month for Advance as requested

            // 1. Check if Visit Visa
            if (employee.visaType === 'Visit') {
                setEligibilityWarning('Employees on Visit Visa cannot apply for an Advance.');
                return;
            }

            // Note: Visa Expiry Check removed for Advance as requested
        }
        // Loan Specific Checks
        else {
            // 2. Check Visa Expiry (> 3 months required for Loan)
            if (employee.visaExpiry) {
                const expiryDate = new Date(employee.visaExpiry);
                const today = new Date();
                const monthsUntilExpiry = (expiryDate.getFullYear() - today.getFullYear()) * 12 + (expiryDate.getMonth() - today.getMonth());

                if (monthsUntilExpiry < 3) {
                    // Flowchart HR: soft warning → confirm on submit. Others: hard block.
                    // Until HR status resolves, keep soft so we don't flash a false hard-block.
                    if (flowchartHr || !hrResolved) {
                        setVisaEligibilityWarning(VISA_LT_3_MONTHS_CONFIRM_MSG);
                    } else {
                        setEligibilityWarning(VISA_LT_3_MONTHS_BLOCK_MSG);
                        return;
                    }
                }

                // 3. Set Max Duration based on Visa Expiry
                // Max duration is (Visa Expiry Months - 2), capped at 6.
                // Flowchart HR may select beyond this; confirmation covers the waiver.
                const adjustedMax = monthsUntilExpiry - 2;
                newMaxDuration = Math.min(6, Math.max(1, adjustedMax));
            }
        }

        setMaxDuration(newMaxDuration);
    };

    const collectVisaConfirmMessages = () => {
        const messages = [];
        if (visaEligibilityWarning) messages.push(visaEligibilityWarning);
        if (dateWarning) messages.push(dateWarning);
        return messages;
    };

    const validateForm = ({ bypassVisa = false } = {}) => {
        const newErrors = {};
        const canVisaOverride = isFlowchartHrRef.current;

        if (scheduleOnlyEdit) {
            if (formData.type !== 'Advance' && !formData.duration) {
                newErrors.duration = 'Duration is required';
            }
            if (!formData.monthStart) newErrors.monthStart = 'Deduction start is required';
            if (dateWarning && !(bypassVisa && canVisaOverride)) {
                if (canVisaOverride) {
                    // Handled by confirmation dialog in handleSubmit
                    setErrors(newErrors);
                    return Object.keys(newErrors).length === 0 ? 'needs_visa_confirm' : false;
                }
                toast({
                    variant: 'destructive',
                    title: 'Invalid Dates',
                    description: dateWarning,
                });
                return false;
            }
            setErrors(newErrors);
            return Object.keys(newErrors).length === 0;
        }

        if (!formData.employeeId) newErrors.employeeId = 'Please select an employee';
        if (!formData.type) newErrors.type = 'Please select a type';
        if (!formData.reason) {
            newErrors.reason = 'Reason is mandatory';
        } else if (String(formData.reason).trim().length > 50) {
            newErrors.reason = 'Reason must be 50 characters or less';
        }

        if (!formData.amount) {
            newErrors.amount = 'Amount is required';
        } else {
            const amount = parseFloat(formData.amount);
            if (isNaN(amount) || amount <= 0) {
                newErrors.amount = 'Invalid amount';
            } else if (selectedEmployee) {
                const salary = selectedEmployee.salary || 0;
                let maxAmount = 0;

                if (formData.type === 'Advance') {
                    // Max: 50% of Salary
                    maxAmount = salary / 2;
                } else {
                    // Max: Salary * 3
                    maxAmount = salary * 3;
                }

                if (amount > maxAmount) {
                    newErrors.amount = `Maximum allowed amount is ${maxAmount.toLocaleString()} (${formData.type === 'Advance' ? '50% of Salary' : '3x Salary'})`;
                }
            }
        }

        if (!formData.duration) {
            newErrors.duration = 'Duration is required';
        }

        if (eligibilityWarning) {
            toast({
                variant: "destructive",
                title: "Ineligible Request",
                description: eligibilityWarning
            });
            return false;
        }

        const visaMessages = collectVisaConfirmMessages();
        if (visaMessages.length > 0 && !(bypassVisa && canVisaOverride)) {
            if (!flowchartHrResolvedRef.current) {
                toast({
                    title: 'Please wait',
                    description: 'Checking flowchart HR permissions…',
                });
                return false;
            }
            if (canVisaOverride) {
                setErrors(newErrors);
                if (Object.keys(newErrors).length > 0) return false;
                return 'needs_visa_confirm';
            }
            toast({
                variant: "destructive",
                title: visaEligibilityWarning ? "Ineligible Request" : "Invalid Dates",
                description: visaMessages[0],
            });
            return false;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const submitLoanRequest = async (forcedStatus = null) => {
        try {
            setSubmitting(true);

            if (scheduleOnlyEdit && initialData && (initialData.id || initialData._id)) {
                const loanId = initialData.id || initialData._id;
                await axiosInstance.put(`/Employee/loans/${loanId}`, {
                    duration: parseInt(formData.duration, 10) || 1,
                    monthStart: formData.monthStart,
                    scheduleOnlyEdit: true,
                });
                toast({
                    title: 'Success',
                    description: 'Repayment schedule updated successfully.',
                    className: 'bg-green-50 border-green-200 text-green-800',
                });
                onSuccess();
                onClose();
                return;
            }

            const targetStatus = forcedStatus || (initialData?.status || 'Draft');

            // Prepare Payload
            const payload = {
                employeeObjectId: selectedEmployee.employeeObjectId || selectedEmployee._id, // Support both formats
                employeeId: formData.employeeId,
                type: formData.type,
                amount: parseFloat(formData.amount),
                duration: parseInt(formData.duration),
                reason: formData.reason,
                monthStart: formData.monthStart,
                status: targetStatus,
                resubmit: isResubmitting
            };

            if (initialData && (initialData.id || initialData._id)) {
                // Edit Mode - Update Existing
                const loanId = initialData.id || initialData._id;
                await axiosInstance.put(`/Employee/loans/${loanId}`, payload);

                toast({
                    title: "Success",
                    description: isResubmitting ? `${formData.type} request resubmitted successfully.` : `${formData.type} request updated successfully.`
                });
            } else {
                // New Mode - Create
                await axiosInstance.post('/Employee/request-loan', payload);

                toast({
                    title: "Success",
                    description: `${formData.type} application submitted check email in Outlook.`
                });
            }

            onSuccess();
            onClose();

        } catch (error) {
            console.error("Loan Request Error:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to submit application"
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e, forcedStatus = null) => {
        if (e) e.preventDefault();

        const result = validateForm();
        if (result === false) return;

        if (result === 'needs_visa_confirm') {
            setVisaConfirmMessages(collectVisaConfirmMessages());
            setPendingForcedStatus(forcedStatus);
            setVisaConfirmOpen(true);
            return;
        }

        await submitLoanRequest(forcedStatus);
    };

    const handleVisaConfirmOk = async () => {
        setVisaConfirmOpen(false);
        const forcedStatus = pendingForcedStatus;
        setPendingForcedStatus(null);
        setVisaConfirmMessages([]);
        const result = validateForm({ bypassVisa: true });
        if (result === false) return;
        await submitLoanRequest(forcedStatus);
    };

    if (!isOpen) return null;

    const modalTitle = scheduleOnlyEdit
        ? `Edit ${formData.type === 'Advance' ? 'Advance' : 'Loan'} Schedule`
        : isResubmitting
          ? 'Resubmit Loan / Advance'
          : initialData
            ? `Edit ${formData.type === 'Advance' ? 'Advance' : 'Loan'}`
            : 'Add Loan / Advance';

    // Schedule-only edit locks identity fields; eligibility warnings must NOT lock the form
    // so users can switch Type / Employee when a check fails.
    const identityLocked = scheduleOnlyEdit;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-[22px] shadow-xl w-full max-w-[600px] p-6 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800">{modalTitle}</h3>
                        {scheduleOnlyEdit && initialData?.loanId && (
                            <p className="text-xs text-gray-500 mt-1">{initialData.loanId}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">

                    {/* Type Select — Loan / Advance options follow Create Loan / Create Advance permissions */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Type <span className="text-red-500">*</span></label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            disabled={identityLocked || (!allowLoanType && !allowAdvanceType)}
                            className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {allowLoanType ? <option value="Loan">Loan</option> : null}
                            {allowAdvanceType ? <option value="Advance">Salary Advance</option> : null}
                        </select>
                        {!allowLoanType && !allowAdvanceType ? (
                            <p className="text-xs text-red-500">You do not have permission to create a loan or advance.</p>
                        ) : null}
                    </div>

                    {/* Employee Select — searchable by ID or name */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Select Employee <span className="text-red-500">*</span></label>
                        <Select
                            instanceId="add-loan-employee-select"
                            options={employeeSelectOptions}
                            value={selectedEmployeeOption}
                            onChange={(opt) => handleEmployeeChange(opt?.value || '')}
                            isDisabled={identityLocked}
                            isClearable={!identityLocked}
                            isSearchable
                            placeholder="Search employee ID or name…"
                            noOptionsMessage={({ inputValue }) =>
                                inputValue ? `No employee matching “${inputValue}”` : 'No employees'
                            }
                            filterOption={(option, input) => {
                                const q = String(input || '').trim().toLowerCase();
                                if (!q) return true;
                                const emp = option.data?.employee || {};
                                const hay = [
                                    option.label,
                                    emp.employeeId,
                                    emp.name,
                                    emp.firstName,
                                    emp.lastName,
                                ]
                                    .filter(Boolean)
                                    .join(' ')
                                    .toLowerCase();
                                return hay.includes(q);
                            }}
                            styles={employeeSelectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                            classNamePrefix="loan-emp-select"
                        />
                        {errors.employeeId && <p className="text-xs text-red-500">{errors.employeeId}</p>}
                    </div>

                    {/* Eligibility Warning (hard blocks) */}
                    {eligibilityWarning && (
                        <div className="flex items-start gap-2 bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <p>{eligibilityWarning}</p>
                        </div>
                    )}

                    {/* Visa soft warning for flowchart HR (confirmed on submit) */}
                    {!eligibilityWarning && visaEligibilityWarning && (
                        <div className="flex items-start gap-2 bg-amber-50 text-amber-800 p-3 rounded-xl text-sm border border-amber-100">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <p>
                                {visaEligibilityWarning}
                                {isFlowchartHr
                                    ? ' Click Save to confirm.'
                                    : !flowchartHrResolved
                                      ? ' Checking HR permissions…'
                                      : ''}
                            </p>
                        </div>
                    )}

                    {/* Amount */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Amount <span className="text-red-500">*</span></label>
                        <input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => {
                                setFormData({ ...formData, amount: e.target.value });
                                if (errors.amount) setErrors({ ...errors, amount: '' });
                            }}
                            className={`w-full h-10 px-3 rounded-xl border ${errors.amount ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                            placeholder="Enter amount"
                            disabled={identityLocked}
                        />
                        {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                        {selectedEmployee && (
                            <p className="text-xs text-gray-500">
                                Max: {(formData.type === 'Advance' ? selectedEmployee.salary / 2 : selectedEmployee.salary * 3).toLocaleString()}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Duration - Hidden if Advance (Always 1 month) */}
                        {formData.type !== 'Advance' && (
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Duration (Months) <span className="text-red-500">*</span></label>
                                <select
                                    value={formData.duration}
                                    onChange={(e) => {
                                        setFormData({ ...formData, duration: e.target.value });
                                        if (errors.duration) setErrors({ ...errors, duration: '' });
                                    }}
                                    className={`w-full h-10 px-3 rounded-xl border ${errors.duration ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                                >
                                    <option value="">Select Duration</option>
                                    {Array.from({ length: 6 }, (_, i) => i + 1).map(month => {
                                        const overVisaLimit = month > maxDuration && !isFlowchartHr;
                                        return (
                                        <option
                                            key={month}
                                            value={month}
                                            disabled={overVisaLimit}
                                            title={overVisaLimit ? "Cannot select duration due to visa expiry limits (2 months buffer required)" : ""}
                                        >
                                            {month} Month{month > 1 ? 's' : ''} {month > maxDuration ? '(Visa Limit)' : ''}
                                        </option>
                                        );
                                    })}
                                </select>
                                {errors.duration && <p className="text-xs text-red-500">{errors.duration}</p>}
                                {maxDuration < 6 && (
                                    <p className="text-[10px] text-amber-600 mt-1">
                                        * Max duration limited to {maxDuration} months due to visa expiry.
                                        {isFlowchartHr ? ' Flowchart HR may override after confirmation.' : ''}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Month Start */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Deduction Start <span className="text-red-500">*</span></label>
                            <MonthYearPicker
                                value={formData.monthStart ? `${formData.monthStart}-01` : undefined}
                                onChange={(dateStr) => {
                                    if (dateStr) {
                                        const yyyyMM = dateStr.slice(0, 7);
                                        setFormData(prev => ({ ...prev, monthStart: yyyyMM }));
                                    }
                                }}
                                className="w-full bg-gray-50 border-gray-200"
                            />
                            {dateWarning && (
                                <div className={`flex items-center gap-1.5 text-[10px] mt-1.5 font-medium p-1.5 rounded-lg border ${
                                    isFlowchartHr
                                        ? 'text-amber-700 bg-amber-50/50 border-amber-100'
                                        : 'text-red-500 bg-red-50/50 border-red-100'
                                }`}>
                                    <AlertCircle size={10} className="shrink-0" />
                                    <p className="leading-tight">
                                        {dateWarning}
                                        {isFlowchartHr ? ' Confirm on save to proceed.' : ''}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Reason <span className="text-red-500">*</span></label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => {
                                const next = e.target.value.slice(0, 50);
                                setFormData({ ...formData, reason: next });
                                if (errors.reason) setErrors({ ...errors, reason: '' });
                            }}
                            maxLength={50}
                            className={`w-full h-24 px-3 py-2 rounded-xl border ${errors.reason ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all`}
                            placeholder="Reason for loan (max 50 characters)..."
                            disabled={identityLocked}
                        />
                        <div className="flex items-center justify-between gap-2">
                            {errors.reason ? (
                                <p className="text-xs text-red-500">{errors.reason}</p>
                            ) : (
                                <p className="text-xs text-gray-400">Max 50 characters</p>
                            )}
                            <p className="text-xs text-gray-400 shrink-0">
                                {String(formData.reason || '').length}/50
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                if (scheduleOnlyEdit) {
                                    handleSubmit(e);
                                    return;
                                }
                                handleSubmit(
                                    e,
                                    isResubmitting
                                        ? 'Pending'
                                        : initialData?.status === 'Draft' || !initialData
                                          ? 'Draft'
                                          : initialData.status,
                                );
                            }}
                            disabled={submitting}
                            className="px-8 py-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                        >
                            {submitting ? 'Saving...' : scheduleOnlyEdit ? 'Save Schedule' : isResubmitting ? 'Resubmit' : 'Save'}
                        </button>
                    </div>

                </form>
            </div>

            <ConfirmAlertDialog
                open={visaConfirmOpen}
                onOpenChange={(open) => {
                    setVisaConfirmOpen(open);
                    if (!open) {
                        setPendingForcedStatus(null);
                        setVisaConfirmMessages([]);
                    }
                }}
                title="Visa expiry warning"
                description={
                    visaConfirmMessages.length
                        ? `${visaConfirmMessages.join('\n\n')}\n\nDo you want to proceed?`
                        : 'Visa expires in less than 3 months. Do you want to proceed?'
                }
                confirmLabel="OK"
                cancelLabel="Cancel"
                onConfirm={handleVisaConfirmOk}
            />
        </div>
    );
}
