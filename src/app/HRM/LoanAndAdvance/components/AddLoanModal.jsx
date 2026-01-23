'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import axiosInstance from '@/utils/axios';

export default function AddLoanModal({ isOpen, onClose, onSuccess, employees = [], initialData = null }) {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        employeeId: '',
        type: 'Loan', // Loan or Advance
        amount: '',
        duration: '', // months
        reason: ''
    });

    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [errors, setErrors] = useState({});
    const [eligibilityWarning, setEligibilityWarning] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [maxDuration, setMaxDuration] = useState(12);

    // Reset or Populate when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit Mode
                setFormData({
                    employeeId: initialData.employeeId || '',
                    type: initialData.type || 'Loan',
                    amount: initialData.amount || '',
                    duration: initialData.duration || '',
                    reason: initialData.reason || ''
                });

                // Set selected employee manually if employees list is available
                if (employees.length > 0 && initialData.employeeId) {
                    const employee = employees.find(e => e.employeeId === initialData.employeeId);
                    if (employee) {
                        setSelectedEmployee(employee);
                        // Manually trigger eligibility check but don't reset form logic
                        checkEligibility(employee, initialData.type || 'Loan');
                    }
                }
            } else {
                // New Mode
                setFormData({
                    employeeId: '',
                    type: 'Loan',
                    amount: '',
                    duration: '',
                    reason: ''
                });
                setSelectedEmployee(null);
                setErrors({});
                setEligibilityWarning('');
            }
        }
    }, [isOpen, initialData, employees]);

    // Handle Employee Selection & Eligibility Logic
    const handleEmployeeChange = (empId) => {
        const employee = employees.find(e => e.employeeId === empId);

        // Reset employee-specific fields but keep type
        setFormData(prev => ({ ...prev, employeeId: empId, amount: '', duration: '', reason: '' }));
        setSelectedEmployee(employee);
        setErrors({});
        setEligibilityWarning('');
        setMaxDuration(12);

        if (!employee) return;

        // Check eligibility based on current type (Loan vs Advance)
        checkEligibility(employee, formData.type);
    };

    // Re-check when type changes
    useEffect(() => {
        if (selectedEmployee) {
            setFormData(prev => ({ ...prev, amount: '', duration: '' }));
            checkEligibility(selectedEmployee, formData.type);
        }
    }, [formData.type]);

    const checkEligibility = (employee, type) => {
        setEligibilityWarning('');
        let newMaxDuration = 12;

        // Common Check: Status (Notice)
        if (employee.status === 'Notice') {
            setEligibilityWarning(`Employee is in 'Notice' period and cannot apply for a loan/advance.`);
            return;
        }

        // Check: Probation (Block Loan only, Allow Advance)
        if (employee.status === 'Probation' && type === 'Loan') {
            setEligibilityWarning(`Employee is in 'Probation' period and cannot apply for a loan.`);
            return;
        }

        // Advance Specific Checks
        if (type === 'Advance') {
            newMaxDuration = 3;

            // Rule: Probation -> Max 1 Month Duration
            if (employee.status === 'Probation') {
                newMaxDuration = 1;
            }

            // 1. Check if Visit Visa
            if (employee.visaType === 'Visit') {
                setEligibilityWarning('Employees on Visit Visa cannot apply for an Advance.');
                return;
            }

            // 2. Visa Expiry Check & Duration Clamp
            if (employee.visaExpiry) {
                const expiryDate = new Date(employee.visaExpiry);
                const today = new Date();
                const monthsUntilExpiry = (expiryDate.getFullYear() - today.getFullYear()) * 12 + (expiryDate.getMonth() - today.getMonth());

                if (monthsUntilExpiry < 1) {
                    setEligibilityWarning('Visa expires in less than 1 month. Cannot apply for an Advance.');
                    return;
                }

                // Clamp max duration if visa expires sooner than standard advance duration
                // OR if probation restricted it to 1
                if (monthsUntilExpiry < newMaxDuration) {
                    newMaxDuration = Math.max(1, monthsUntilExpiry);
                }
            }
        }
        // Loan Specific Checks
        else {
            // 2. Check Visa Expiry (> 3 months required for Loan)
            if (employee.visaExpiry) {
                const expiryDate = new Date(employee.visaExpiry);
                const today = new Date();
                const monthsUntilExpiry = (expiryDate.getFullYear() - today.getFullYear()) * 12 + (expiryDate.getMonth() - today.getMonth());

                if (monthsUntilExpiry < 3) {
                    setEligibilityWarning('Visa expires in less than 3 months. Cannot apply for a Loan.');
                    return;
                }

                // 3. Set Max Duration based on Visa Expiry
                // Max duration is (Visa Expiry Months - 2), capped at 12.
                const adjustedMax = monthsUntilExpiry - 2;
                newMaxDuration = Math.min(12, Math.max(1, adjustedMax));
            }
        }

        setMaxDuration(newMaxDuration);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.employeeId) newErrors.employeeId = 'Please select an employee';
        if (!formData.type) newErrors.type = 'Please select a type';
        if (!formData.reason) newErrors.reason = 'Reason is mandatory';

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
                    // Max: Next Month Salary (100% of Salary)
                    maxAmount = salary;
                } else {
                    // Max: Salary * 3
                    maxAmount = salary * 3;
                }

                if (amount > maxAmount) {
                    newErrors.amount = `Maximum allowed amount is ${maxAmount.toLocaleString()} (${formData.type === 'Advance' ? '1x Salary' : '3x Salary'})`;
                }
            }
        }

        if (!formData.duration) {
            newErrors.duration = 'Duration is required';
        }

        // Blocking warning prevens submission
        if (eligibilityWarning) return false;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setSubmitting(true);

            // Prepare Payload
            const payload = {
                employeeId: formData.employeeId,
                employeeObjectId: selectedEmployee.employeeObjectId, // Ensure this property exists from getLoanEligibleEmployees
                type: formData.type,
                amount: parseFloat(formData.amount),
                duration: parseInt(formData.duration),
                reason: formData.reason
            };

            if (initialData && (initialData.id || initialData._id)) {
                // Edit Mode - Update Existing
                const loanId = initialData.id || initialData._id;
                await axiosInstance.put(`/Employee/loans/${loanId}`, payload);

                toast({
                    title: "Success",
                    description: `${formData.type} request updated successfully.`
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-[22px] shadow-xl w-full max-w-[600px] p-6 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Add Loan / Advance</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">

                    {/* Employee Select */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Select Employee <span className="text-red-500">*</span></label>
                        <select
                            value={formData.employeeId}
                            onChange={(e) => handleEmployeeChange(e.target.value)}
                            className={`w-full h-10 px-3 rounded-xl border ${errors.employeeId ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        >
                            <option value="">Select Employee</option>
                            {employees.map(emp => (
                                <option key={emp.employeeId} value={emp.employeeId}>
                                    {emp.employeeId} - {emp.name}
                                </option>
                            ))}
                        </select>
                        {errors.employeeId && <p className="text-xs text-red-500">{errors.employeeId}</p>}
                    </div>

                    {/* Eligibility Warning */}
                    {eligibilityWarning && (
                        <div className="flex items-start gap-2 bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <p>{eligibilityWarning}</p>
                        </div>
                    )}

                    {/* Type Select */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Type <span className="text-red-500">*</span></label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            disabled={!!eligibilityWarning}
                        >
                            <option value="Loan">Loan</option>
                            <option value="Advance">Advance</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                                disabled={!!eligibilityWarning}
                            />
                            {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                            {selectedEmployee && !eligibilityWarning && (
                                <p className="text-xs text-gray-500">Max: {(selectedEmployee.salary * 3).toLocaleString()}</p>
                            )}
                        </div>

                        {/* Duration */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Duration (Months) <span className="text-red-500">*</span></label>
                            <select
                                value={formData.duration}
                                onChange={(e) => {
                                    setFormData({ ...formData, duration: e.target.value });
                                    if (errors.duration) setErrors({ ...errors, duration: '' });
                                }}
                                className={`w-full h-10 px-3 rounded-xl border ${errors.duration ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                                disabled={!!eligibilityWarning}
                            >
                                <option value="">Select Duration</option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                    <option key={month} value={month} disabled={month > maxDuration}>
                                        {month} Month{month > 1 ? 's' : ''}
                                    </option>
                                ))}
                            </select>
                            {errors.duration && <p className="text-xs text-red-500">{errors.duration}</p>}
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Reason <span className="text-red-500">*</span></label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => {
                                setFormData({ ...formData, reason: e.target.value });
                                if (errors.reason) setErrors({ ...errors, reason: '' });
                            }}
                            className={`w-full h-24 px-3 py-2 rounded-xl border ${errors.reason ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all`}
                            placeholder="Reason for loan..."
                            disabled={!!eligibilityWarning}
                        />
                        {errors.reason && <p className="text-xs text-red-500">{errors.reason}</p>}
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
                            type="submit"
                            disabled={submitting || !!eligibilityWarning}
                            className="px-6 py-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
