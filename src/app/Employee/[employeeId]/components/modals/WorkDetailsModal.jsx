'use client';

import { departmentOptions, statusOptions, getDesignationOptions } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';

// Validate individual work details field
const validateWorkDetailsField = (field, value, form, errors, setErrors) => {
    const newErrors = { ...errors };
    let error = '';

    if (field === 'department') {
        if (!value || value.trim() === '') {
            error = 'Department is required';
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
    } else if (field === 'probationPeriod') {
        if (form.status === 'Probation') {
            if (!value && value !== 0) {
                error = 'Probation Period is required when Work Status is Probation';
            } else if (value !== null && value !== '' && (!/^\d+$/.test(String(value)) || parseInt(value) <= 0)) {
                error = 'Probation Period must be a positive number';
            }
        }
    } else if (field === 'primaryReportee') {
        if (!value || value.trim() === '') {
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
const validateWorkDetailsForm = (form, setErrors) => {
    const errors = {};

    // Department validation
    if (!form.department || form.department.trim() === '') {
        errors.department = 'Department is required';
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

    // Probation Period validation (conditional)
    if (form.status === 'Probation') {
        if (!form.probationPeriod && form.probationPeriod !== 0) {
            errors.probationPeriod = 'Probation Period is required when Work Status is Probation';
        } else if (form.probationPeriod !== null && form.probationPeriod !== '' && (!/^\d+$/.test(String(form.probationPeriod)) || parseInt(form.probationPeriod) <= 0)) {
            errors.probationPeriod = 'Probation Period must be a positive number';
        }
    }

    // Primary Reportee validation
    if (!form.primaryReportee || form.primaryReportee.trim() === '') {
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

    const handleChange = (field, value) => {
        const updatedForm = { ...workDetailsForm, [field]: value };

        // Clear designation if department changes
        if (field === 'department') {
            updatedForm.designation = '';
            // Clear designation error
            if (workDetailsErrors.designation) {
                setWorkDetailsErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.designation;
                    return newErrors;
                });
            }
        }

        // Clear probation period if status changes from Probation
        if (field === 'status' && value !== 'Probation') {
            updatedForm.probationPeriod = null;
            // Clear probation period error when status changes
            if (workDetailsErrors.probationPeriod) {
                setWorkDetailsErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.probationPeriod;
                    return newErrors;
                });
            }
        }

        // If primary reportee is selected and matches secondary, clear secondary
        if (field === 'primaryReportee' && value && value === updatedForm.secondaryReportee) {
            updatedForm.secondaryReportee = '';
        }

        // If secondary reportee is selected and matches primary, clear it
        if (field === 'secondaryReportee' && value && value === updatedForm.primaryReportee) {
            updatedForm.secondaryReportee = '';
            if (workDetailsErrors.secondaryReportee) {
                setWorkDetailsErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.secondaryReportee;
                    return newErrors;
                });
            }
        }

        setWorkDetailsForm(updatedForm);

        // Real-time validation
        validateWorkDetailsField(field, value, updatedForm, workDetailsErrors, setWorkDetailsErrors);
    };

    const handleSubmit = async () => {
        if (!validateWorkDetailsForm(workDetailsForm, setWorkDetailsErrors)) {
            return;
        }
        await onUpdate();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => !updatingWorkDetails && onClose()}></div>
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

                        {/* Department */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                Department <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <select
                                    value={workDetailsForm.department || ''}
                                    onChange={(e) => handleChange('department', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.department ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={updatingWorkDetails}
                                >
                                    <option value="">Select Department</option>
                                    {departmentOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
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
                                <select
                                    value={workDetailsForm.designation || ''}
                                    onChange={(e) => handleChange('designation', e.target.value)}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.designation ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={updatingWorkDetails || !workDetailsForm.department}
                                >
                                    <option value="">{workDetailsForm.department ? 'Select Designation' : 'Select Department first'}</option>
                                    {workDetailsForm.department && getDesignationOptions(workDetailsForm.department).map((designation) => (
                                        <option key={designation} value={designation}>
                                            {designation}
                                        </option>
                                    ))}
                                </select>
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
                                    {statusOptions.map((option) => (
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

                        {/* Probation Period - only show when status is Probation */}
                        {workDetailsForm.status === 'Probation' && (
                            <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                    Probation Period (Months)
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="w-full md:flex-1 flex flex-col gap-1">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={workDetailsForm.probationPeriod || ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            // Only allow digits
                                            if (value === '' || /^\d+$/.test(value)) {
                                                handleChange('probationPeriod', value === '' ? null : parseInt(value));
                                            }
                                        }}
                                        onInput={(e) => {
                                            // Restrict to digits only
                                            e.target.value = e.target.value.replace(/[^\d]/g, '');
                                        }}
                                        className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${workDetailsErrors.probationPeriod ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                        placeholder="Enter probation period in months"
                                        disabled={updatingWorkDetails}
                                    />
                                    {workDetailsErrors.probationPeriod && (
                                        <span className="text-xs text-red-500">{workDetailsErrors.probationPeriod}</span>
                                    )}
                                </div>
                            </div>
                        )}

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
        </div>
    );
}

