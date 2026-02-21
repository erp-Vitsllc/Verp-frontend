'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { MonthYearPicker } from "@/components/ui/month-year-picker";

export default function AddOtherDamageModal({ isOpen, onClose, onSuccess, employees = [], onBack, initialData, isResubmitting = false }) {
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        description: '',
        deductionAmount: '',
        paidBy: 'Employee',
        employeeAmount: '',
        companyAmount: '',
        attachment: null,
        attachmentBase64: '',
        attachmentName: '',
        attachmentMime: '',
        companyDescription: ''
    });

    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [currentEmployeeId, setCurrentEmployeeId] = useState('');
    const [payableDuration, setPayableDuration] = useState('1');
    const [monthStart, setMonthStart] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [isManualEdit, setIsManualEdit] = useState(false);
    const fileInputRef = useRef(null);

    // Populate data when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                description: initialData.description || '',
                deductionAmount: initialData.fineAmount || '',
                paidBy: initialData.responsibleFor || 'Employee',
                employeeAmount: initialData.employeeAmount || '',
                companyAmount: initialData.companyAmount || '',
                companyDescription: initialData.companyDescription || '',
                attachment: null,
                attachmentBase64: '',
                attachmentName: initialData.attachment?.name || '',
                attachmentMime: ''
            });

            setMonthStart(initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7));
            setPayableDuration(String(initialData.payableDuration || '1'));

            // Populate selectedEmployees
            if (initialData.assignedEmployees && initialData.assignedEmployees.length > 0) {
                setSelectedEmployees(initialData.assignedEmployees.map(emp => ({
                    employeeId: emp.employeeId,
                    employeeName: emp.employeeName || employees.find(e => e.employeeId === emp.employeeId)?.firstName || emp.employeeId,
                    fineAmount: initialData.fineAmount, // Assuming uniform if not detailed
                    duration: emp.payableDuration || initialData.payableDuration || '1'
                })));
            } else if (initialData.employeeId) {
                const empName = initialData.employeeName || employees.find(e => e.employeeId === initialData.employeeId)?.firstName || initialData.employeeId;
                setSelectedEmployees([{
                    employeeId: initialData.employeeId,
                    employeeName: empName,
                    fineAmount: initialData.fineAmount || '0',
                    duration: initialData.payableDuration || '1'
                }]);
            }
        } else if (isOpen) {
            // Reset
            setFormData({
                description: '', deductionAmount: '', paidBy: 'Employee', employeeAmount: '', companyAmount: '',
                attachment: null, attachmentBase64: '', attachmentName: '', attachmentMime: '', companyDescription: ''
            });
            setSelectedEmployees([]);
            setCurrentEmployeeId('');
            setPayableDuration('1');
            setMonthStart(new Date().toISOString().split('T')[0].slice(0, 7));
        }
    }, [isOpen, initialData, employees]);

    // Recalculate fine amounts when total, paidBy, or selected employees change
    useEffect(() => {
        if (initialData?._id) return; // No auto-recalc on edit
        const count = selectedEmployees.length;
        if (count === 0) return;

        let totalEmployeeAmount = 0;
        if (formData.paidBy === 'Employee') {
            totalEmployeeAmount = parseFloat(formData.deductionAmount) || 0;
        } else if (formData.paidBy === 'Employee & Company') {
            totalEmployeeAmount = parseFloat(formData.employeeAmount) || 0;
        }

        const share = totalEmployeeAmount / count;

        setSelectedEmployees(prev => prev.map(emp => ({
            ...emp,
            fineAmount: share.toFixed(2)
        })));
    }, [formData.deductionAmount, formData.employeeAmount, formData.paidBy, selectedEmployees.length]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast({
                variant: "destructive",
                title: "Invalid File",
                description: "Only PDF and image files are allowed"
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setFormData(prev => ({
                ...prev,
                attachment: file,
                attachmentBase64: base64,
                attachmentName: file.name,
                attachmentMime: file.type || 'application/pdf'
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleAddEmployee = () => {
        if (!currentEmployeeId) {
            toast({ variant: "destructive", title: "Error", description: "Please select an employee" });
            return;
        }

        // Check if employee already added
        if (selectedEmployees.some(emp => emp.employeeId === currentEmployeeId)) {
            toast({ variant: "destructive", title: "Error", description: "Employee already added" });
            return;
        }

        const employee = employees.find(e => e.employeeId === currentEmployeeId);
        if (employee) {
            setSelectedEmployees(prev => [...prev, {
                employeeId: employee.employeeId,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                fineAmount: '0.00'
            }]);
            setCurrentEmployeeId('');
            if (errors.employees) setErrors(prev => ({ ...prev, employees: '' }));
        }
    };

    const handleRemoveEmployee = (employeeId) => {
        setSelectedEmployees(prev => prev.filter(emp => emp.employeeId !== employeeId));
    };

    const handleAmountChange = (employeeId, amount) => {
        let totalTarget = 0;
        if (formData.paidBy === 'Employee') {
            totalTarget = parseFloat(formData.deductionAmount) || 0;
        } else if (formData.paidBy === 'Employee & Company') {
            totalTarget = parseFloat(formData.employeeAmount) || 0;
        }

        setSelectedEmployees(prev => {
            const index = prev.findIndex(e => e.employeeId === employeeId);
            if (index === -1) return prev;

            const sumBefore = prev.slice(0, index).reduce((acc, curr) => acc + (parseFloat(curr.fineAmount) || 0), 0);
            const currentVal = parseFloat(amount) || 0;
            const remaining = totalTarget - sumBefore - currentVal;
            const countBelow = prev.length - (index + 1);

            return prev.map((e, i) => {
                if (i < index) return e;
                if (i === index) return { ...e, fineAmount: amount };

                const shareForBelow = countBelow > 0 ? (remaining / countBelow).toFixed(2) : e.fineAmount;
                return { ...e, fineAmount: shareForBelow };
            });
        });
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.description) {
            newErrors.description = 'Description is required';
        }
        if (!formData.deductionAmount) {
            newErrors.deductionAmount = 'Deduction amount is required';
        }
        if (selectedEmployees.length === 0) {
            newErrors.employees = 'At least one employee must be selected';
        }

        const totalInput = parseFloat(formData.deductionAmount) || 0;
        const currentSelectedSum = selectedEmployees.reduce((sum, emp) => sum + (parseFloat(emp.fineAmount) || 0), 0);

        if (formData.paidBy === 'Employee') {
            if (Math.abs(currentSelectedSum - totalInput) > 0.05) {
                newErrors.amountMismatch = `Sum of individual fines (AED ${currentSelectedSum.toFixed(2)}) must equal total deduction amount (AED ${totalInput.toFixed(2)})`;
            }
        } else if (formData.paidBy === 'Employee & Company') {
            if (!formData.employeeAmount) {
                newErrors.employeeAmount = 'Employee amount is required';
            }
            if (!formData.companyAmount) {
                newErrors.companyAmount = 'Company amount is required';
            }

            const empTarget = parseFloat(formData.employeeAmount) || 0;
            const compTarget = parseFloat(formData.companyAmount) || 0;

            if (Math.abs((empTarget + compTarget) - totalInput) > 0.01) {
                newErrors.amountMismatch = 'Sum of employee and company portions must equal total deduction amount';
            }

            if (Math.abs(currentSelectedSum - empTarget) > 0.05) {
                newErrors.amountMismatch = `Sum of individual employee fines (AED ${currentSelectedSum.toFixed(2)}) must equal employee portion (AED ${empTarget.toFixed(2)})`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setSubmitting(true);

            // Calculate total amounts based on paidBy
            let totalEmployeeAmount = 0;
            let totalCompanyAmount = 0;

            if (formData.paidBy === 'Employee') {
                totalEmployeeAmount = parseFloat(formData.deductionAmount);
            } else if (formData.paidBy === 'Company') {
                totalCompanyAmount = parseFloat(formData.deductionAmount);
            } else if (formData.paidBy === 'Employee & Company') {
                totalEmployeeAmount = parseFloat(formData.employeeAmount);
                totalCompanyAmount = parseFloat(formData.companyAmount);
            }

            const count = selectedEmployees.length;
            const perCompShare = count > 0 ? (totalCompanyAmount / count) : 0;

            const grandTotalFine = totalEmployeeAmount + totalCompanyAmount;

            const commonData = {
                category: 'Damage',
                subCategory: 'Other Damage',
                fineType: 'Other Damage',
                selectedEmployees: selectedEmployees,
                responsibleFor: formData.paidBy,
                description: formData.description,
                companyDescription: formData.companyDescription,
                fineStatus: 'Draft',
                isBulk: true,
                monthStart: monthStart,
                fineAmount: grandTotalFine,
                employeeAmount: totalEmployeeAmount,
                companyAmount: totalCompanyAmount
            };

            const employeesPayload = selectedEmployees.map(emp => {
                const individualEmpAmount = parseFloat(emp.fineAmount) || 0;
                return {
                    employeeId: emp.employeeId,
                    employeeName: emp.employeeName,
                    fineAmount: grandTotalFine.toFixed(2), // Contextual Grand Total
                    employeeAmount: individualEmpAmount.toFixed(2),
                    companyAmount: totalCompanyAmount.toFixed(2), // Contextual Total Company Amount
                    payableDuration: parseInt(payableDuration) || 1
                };
            });

            const payload = {
                ...commonData,
                employees: employeesPayload
            };

            if (formData.attachmentBase64) {
                payload.attachment = {
                    data: formData.attachmentBase64,
                    name: formData.attachmentName,
                    mimeType: formData.attachmentMime
                };
            }

            if (initialData?._id) {
                // Update Logic
                if (isResubmitting) {
                    payload.fineStatus = 'Pending';
                    payload.resubmit = true;
                }

                await axiosInstance.put(`/Fine/${initialData._id}`, payload);
                toast({
                    title: "Success",
                    description: isResubmitting ? "Fine resubmitted successfully" : "Fine updated successfully"
                });
            } else {
                // Create Logic
                await axiosInstance.post('/Fine', payload);
                toast({ title: "Success", description: "Other damage fine submitted for approval" });
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Submission failed"
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[700px] max-h-[90vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors mr-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">Add Other Damage</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5">
                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe the damage incident..."
                            rows={4}
                            className={`w-full px-4 py-3 rounded-xl border ${errors.description ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500/20 resize-none`}
                        />
                        {errors.description && <p className="text-xs text-red-500 ml-1">{errors.description}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Payable Duration */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Fine Payable Duration</label>
                            <select
                                value={payableDuration}
                                onChange={(e) => setPayableDuration(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500/20"
                            >
                                {[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                            </select>
                        </div>

                        {/* Month Start */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Month Start</label>
                            <MonthYearPicker
                                value={monthStart ? `${monthStart}-01` : undefined}
                                onChange={(dateStr) => {
                                    if (dateStr) {
                                        const yyyyMM = dateStr.slice(0, 7);
                                        setMonthStart(yyyyMM);
                                    }
                                }}
                                className="w-full bg-gray-50 border-gray-200"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Deduction Amount */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Deduction Amount (Total) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.deductionAmount}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, deductionAmount: e.target.value }));
                                    if (errors.deductionAmount) setErrors(prev => ({ ...prev, deductionAmount: '' }));
                                }}
                                placeholder="0.00"
                                className={`w-full h-11 px-4 rounded-xl border ${errors.deductionAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500/20`}
                            />
                            {errors.deductionAmount && <p className="text-xs text-red-500 ml-1">{errors.deductionAmount}</p>}
                        </div>

                        {/* Paid By */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Paid By</label>
                            <select
                                value={formData.paidBy}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => {
                                        const newState = { ...prev, paidBy: val };
                                        if (val === 'Employee & Company' && prev.deductionAmount) {
                                            const total = parseFloat(prev.deductionAmount);
                                            // No longer auto-filling portions with halves
                                        }
                                        return newState;
                                    });
                                }}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500/20"
                            >
                                <option value="Employee">Employee</option>
                                <option value="Company">Company</option>
                                <option value="Employee & Company">Employee & Company</option>
                            </select>
                        </div>

                        {/* Conditional Split Fields */}
                        {formData.paidBy === 'Employee & Company' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Employee Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.employeeAmount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => {
                                                return {
                                                    ...prev,
                                                    employeeAmount: val,
                                                };
                                            });
                                            if (errors.employeeAmount) setErrors(prev => ({ ...prev, employeeAmount: '' }));
                                            if (errors.amountMismatch) setErrors(prev => ({ ...prev, amountMismatch: '' }));
                                        }}
                                        placeholder="0.00"
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.employeeAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                    {errors.employeeAmount && <p className="text-xs text-red-500 ml-1">{errors.employeeAmount}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Company Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.companyAmount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => {
                                                return {
                                                    ...prev,
                                                    companyAmount: val,
                                                };
                                            });
                                            if (errors.companyAmount) setErrors(prev => ({ ...prev, companyAmount: '' }));
                                            if (errors.amountMismatch) setErrors(prev => ({ ...prev, amountMismatch: '' }));
                                        }}
                                        placeholder="0.00"
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.companyAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                    {errors.companyAmount && <p className="text-xs text-red-500 ml-1">{errors.companyAmount}</p>}
                                </div>
                                {errors.amountMismatch && <p className="text-xs text-red-500 col-span-full ml-1">{errors.amountMismatch}</p>}
                            </>

                        )}

                        {/* Company Description - Conditional */}
                        {(formData.paidBy === 'Company' || formData.paidBy === 'Employee & Company') && (
                            <div className="space-y-1.5 col-span-1 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Company Description</label>
                                <textarea
                                    value={formData.companyDescription}
                                    onChange={(e) => setFormData(prev => ({ ...prev, companyDescription: e.target.value }))}
                                    placeholder="Explain why the company is bearing this cost..."
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* Select Employees Section */}
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-800">
                            Select Employees <span className="text-red-500">*</span>
                        </h4>

                        <div className="flex gap-3">
                            <select
                                value={currentEmployeeId}
                                onChange={(e) => setCurrentEmployeeId(e.target.value)}
                                className="flex-1 h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-orange-500/20"
                            >
                                <option value="">Select Employee</option>
                                {employees.map(emp => (
                                    <option key={emp.employeeId} value={emp.employeeId}>
                                        {emp.employeeId} - {emp.firstName} {emp.lastName}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleAddEmployee}
                                className="h-11 px-4 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Add
                            </button>
                        </div>
                        {errors.employees && <p className="text-xs text-red-500 ml-1">{errors.employees}</p>}

                        {/* Selected Employees List */}
                        {selectedEmployees.length > 0 && (
                            <div className="space-y-4 mt-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Selected Employees:</p>
                                <div className="space-y-2">
                                    {selectedEmployees.map((emp) => (
                                        <div
                                            key={emp.employeeId}
                                            className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100 group hover:border-orange-200 transition-all shadow-sm"
                                        >
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm text-gray-800 font-semibold flex items-center gap-2">
                                                    {emp.employeeName}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium">Emp ID: {emp.employeeId}</span>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-end">
                                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-1">Fine Amount</label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-400">AED</span>
                                                        <input
                                                            type="number"
                                                            value={emp.fineAmount}
                                                            onChange={(e) => handleAmountChange(emp.employeeId, e.target.value)}
                                                            className="w-24 px-2 py-1.5 rounded-lg border border-orange-200 bg-white font-bold text-orange-700 text-right outline-none focus:ring-2 focus:ring-orange-500/20"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEmployee(emp.employeeId)}
                                                    className="text-gray-400 hover:text-red-500 hover:bg-white p-2 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Attachment */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Attachment</label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                            <Upload className="text-gray-400 mb-2" size={24} />
                            <span className="text-sm text-gray-500">
                                {formData.attachment ? formData.attachmentName : 'Click to upload supporting document'}
                            </span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    {/* Submit Section */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Saving...' : 'Save as Draft'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
