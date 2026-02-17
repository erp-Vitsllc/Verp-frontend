'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from "@/components/ui/date-picker";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

export default function AddFineModal({ isOpen, onClose, onSuccess, employees = [], initialData = {}, isResubmitting = false }) {
    const { toast } = useToast();
    const [selectedFineType, setSelectedFineType] = useState(initialData?.fineType || '');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState((initialData?.assignedEmployees && initialData.assignedEmployees[0]?.employeeId) || initialData?.employeeId || '');
    // Helper to determine count (default 1)
    const getCount = () => initialData?.assignedEmployees?.length || 1;

    const [formData, setFormData] = useState({
        fineAmount: '',
        description: '',
        remarks: '',
        awardedDate: new Date().toISOString().split('T')[0],
        payableDuration: '1',
        monthStart: new Date().toISOString().split('T')[0].slice(0, 7),
        responsibleFor: 'Employee',
        employeeAmount: '',
        companyAmount: '',
        serviceCharge: '',
        attachment: null,
        attachmentBase64: '',
        attachmentName: '',
        attachmentMime: '',
        resubmitComment: ''
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [generatedFineId, setGeneratedFineId] = useState('');
    const fileInputRef = useRef(null);

    // Populate or Reset data when modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialData && (initialData._id || initialData.fineId)) {
                const count = initialData.assignedEmployees?.length || 1;
                setSelectedFineType(initialData.fineType || '');
                setSelectedEmployeeId((initialData.assignedEmployees && initialData.assignedEmployees[0]?.employeeId) || initialData.employeeId || '');
                setFormData({
                    fineAmount: initialData.fineAmount ? (parseFloat(initialData.fineAmount) / count).toFixed(2) : '',
                    description: initialData.description || '',
                    remarks: initialData.remarks || '',
                    awardedDate: initialData.awardedDate ? new Date(initialData.awardedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    payableDuration: String(initialData.payableDuration || '1'),
                    monthStart: initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7),
                    responsibleFor: initialData.responsibleFor || 'Employee',
                    employeeAmount: initialData.employeeAmount ? (parseFloat(initialData.employeeAmount) / count).toFixed(2) : '',
                    companyAmount: initialData.companyAmount ? (parseFloat(initialData.companyAmount) / count).toFixed(2) : '',
                    serviceCharge: initialData.serviceCharge ? (parseFloat(initialData.serviceCharge) / count).toFixed(2) : '',
                    attachment: null,
                    attachmentBase64: '',
                    attachmentName: initialData.attachment?.name || '',
                    attachmentMime: initialData.attachment?.mimeType || '',
                    resubmitComment: ''
                });
            } else {
                setSelectedFineType('');
                setSelectedEmployeeId('');
                setFormData({
                    fineAmount: '',
                    description: '',
                    remarks: '',
                    awardedDate: new Date().toISOString().split('T')[0],
                    payableDuration: '1',
                    monthStart: new Date().toISOString().split('T')[0].slice(0, 7),
                    responsibleFor: 'Employee',
                    employeeAmount: '',
                    companyAmount: '',
                    serviceCharge: '',
                    attachment: null,
                    attachmentBase64: '',
                    attachmentName: '',
                    attachmentMime: '',
                    resubmitComment: ''
                });
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setFormData(prev => ({
                ...prev,
                attachment: null,
                attachmentBase64: '',
                attachmentName: '',
                attachmentMime: ''
            }));
            return;
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setErrors(prev => ({ ...prev, attachment: 'Only PDF, JPEG, or PNG file formats are allowed' }));
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

        if (errors.attachment) {
            setErrors(prev => ({ ...prev, attachment: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!selectedEmployeeId) {
            newErrors.employeeId = 'Please select an employee';
        }

        if (!selectedFineType) {
            newErrors.fineType = 'Please select a fine type';
        }

        if (!formData.fineAmount || String(formData.fineAmount).trim() === '') {
            newErrors.fineAmount = 'Fine amount is required';
        } else if (isNaN(formData.fineAmount) || parseFloat(formData.fineAmount) <= 0) {
            newErrors.fineAmount = 'Please enter a valid amount';
        }

        if (isResubmitting && (!formData.resubmitComment || formData.resubmitComment.trim() === '')) {
            newErrors.resubmitComment = 'Resubmission comment is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            setSubmitting(true);

            // Convert Per-Person Inputs back to Totals for the Backend
            const totalFine = parseFloat(formData.fineAmount);
            const totalEmp = (formData.responsibleFor === 'Company' ? 0 : parseFloat(formData.employeeAmount || formData.fineAmount));
            const totalComp = (formData.responsibleFor === 'Employee' ? 0 : parseFloat(formData.companyAmount || 0));

            const payload = {
                isBulk: true,
                employees: [{
                    employeeId: selectedEmployeeId,
                    daysWorked: 0
                }],
                fineType: selectedFineType,
                fineAmount: totalFine,
                fineStatus: isResubmitting ? 'Pending' : (initialData?.fineStatus || 'Draft'),
                description: formData.description,
                remarks: formData.remarks,
                awardedDate: formData.awardedDate,
                payableDuration: parseInt(formData.payableDuration),
                monthStart: formData.monthStart,
                responsibleFor: formData.responsibleFor,
                employeeAmount: totalEmp,
                companyAmount: totalComp,
                totalEmployeeFineAmount: totalFine - totalComp, // Explicitly store total fine - company share
                serviceCharge: parseFloat(formData.serviceCharge || 0),
                category: initialData.category || 'Other',
                subCategory: initialData.subCategory || selectedFineType || '',
                resubmit: isResubmitting,
                resubmitComment: formData.resubmitComment
            };

            if (formData.attachmentBase64) {
                payload.attachment = {
                    data: formData.attachmentBase64,
                    name: formData.attachmentName,
                    mimeType: formData.attachmentMime
                };
            }

            let response;
            if (initialData && (initialData._id || initialData.fineId)) {
                // UPDATE Mode
                const fineId = initialData._id || initialData.fineId;
                response = await axiosInstance.put(`/Fine/${fineId}`, payload);
            } else {
                // CREATE Mode
                response = await axiosInstance.post('/Fine', payload);
            }

            const fineId = response.data?.fine?.fineId || '';
            setGeneratedFineId(fineId);

            toast({
                variant: "default",
                title: "Success",
                description: isResubmitting ? "Fine resubmitted successfully." : `Fine ${initialData?._id ? 'updated' : 'drafted'} successfully.`
            });

            setTimeout(() => {
                resetForm();
                if (onSuccess) onSuccess();
                onClose();
            }, 2000);
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || "Failed to add fine";
            toast({
                variant: "destructive",
                title: "Error",
                description: errorMessage
            });
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setSelectedFineType('');
        setSelectedEmployeeId('');
        setFormData({
            fineAmount: '',
            description: '',
            remarks: '',
            awardedDate: new Date().toISOString().split('T')[0],
            attachment: null,
            attachmentBase64: '',
            attachmentName: '',
            attachmentBase64: '',
            attachmentName: '',
            attachmentMime: '',
            serviceCharge: ''
        });
        setErrors({});
        setGeneratedFineId('');
    };

    const handleClose = () => {
        if (!submitting) {
            resetForm();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[90vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">{isResubmitting ? 'Resubmit Fine' : 'Add Fine'}</h3>
                    <button
                        onClick={handleClose}
                        disabled={submitting}
                        className="absolute right-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-2 space-y-4 mt-4">
                    {/* Employee Selection */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Employee <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => {
                                    setSelectedEmployeeId(e.target.value);
                                    if (errors.employeeId) setErrors(prev => ({ ...prev, employeeId: '' }));
                                }}
                                className={`w-full h-10 px-3 rounded-xl border ${errors.employeeId ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                                disabled={submitting}
                            >
                                <option value="">Select Employee</option>
                                {employees.map((emp) => (
                                    <option key={emp.employeeId} value={emp.employeeId}>
                                        {emp.employeeId} - {emp.firstName} {emp.lastName}
                                    </option>
                                ))}
                            </select>
                            {errors.employeeId && <p className="text-xs text-red-500">{errors.employeeId}</p>}
                        </div>
                    </div>

                    {/* Fine Type */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Fine Type <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <select
                                value={selectedFineType}
                                onChange={(e) => {
                                    setSelectedFineType(e.target.value);
                                    if (errors.fineType) setErrors(prev => ({ ...prev, fineType: '' }));
                                }}
                                className={`w-full h-10 px-3 rounded-xl border ${errors.fineType ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                                disabled={submitting}
                            >
                                <option value="">Select Fine Type</option>
                                <option value="Attendance">Attendance</option>
                                <option value="Misconduct">Misconduct</option>
                                <option value="Performance">Performance</option>
                                <option value="Damage to Property">Damage to Property</option>
                                <option value="Safety Violation">Safety Violation</option>
                                <option value="Other">Other</option>
                            </select>
                            {errors.fineType && <p className="text-xs text-red-500">{errors.fineType}</p>}
                        </div>
                    </div>

                    {/* Fine Amount */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Employee Fine Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="number"
                                value={formData.fineAmount}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, fineAmount: e.target.value }));
                                    if (errors.fineAmount) setErrors(prev => ({ ...prev, fineAmount: '' }));
                                }}
                                placeholder="Enter fine amount"
                                className={`w-full h-10 px-3 rounded-xl border ${errors.fineAmount ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                                disabled={submitting}
                            />
                            {errors.fineAmount && <p className="text-xs text-red-500">{errors.fineAmount}</p>}
                        </div>
                    </div>

                    {/* Responsible For */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Responsible For
                        </label>
                        <div className="w-full md:flex-1">
                            <select
                                value={formData.responsibleFor}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        responsibleFor: val,
                                        employeeAmount: val === 'Company' ? '0' : (prev.employeeAmount || prev.fineAmount),
                                        companyAmount: val === 'Employee' ? '0' : (prev.companyAmount || '0')
                                    }));
                                }}
                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                disabled={submitting}
                            >
                                <option value="Employee">Employee</option>
                                <option value="Company">Company</option>
                                <option value="Employee & Company">Employee & Company</option>
                            </select>
                        </div>
                    </div>

                    {/* Split Amounts (Conditional) */}
                    {formData.responsibleFor === 'Employee & Company' && (
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1 flex flex-col gap-1.5 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white font-medium text-xs">
                                <label className="text-gray-500">Employee Portion</label>
                                <input
                                    type="number"
                                    value={formData.employeeAmount}
                                    onChange={(e) => setFormData(prev => ({ ...prev, employeeAmount: e.target.value }))}
                                    className="bg-transparent border-none outline-none text-blue-600 font-bold"
                                />
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white font-medium text-xs">
                                <label className="text-gray-500">Company Portion</label>
                                <input
                                    type="number"
                                    value={formData.companyAmount}
                                    onChange={(e) => setFormData(prev => ({ ...prev, companyAmount: e.target.value }))}
                                    className="bg-transparent border-none outline-none text-gray-600 font-bold"
                                />
                            </div>
                        </div>
                    )}

                    {/* Service Charge */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Service Charge (Optional)
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="number"
                                value={formData.serviceCharge}
                                onChange={(e) => setFormData(prev => ({ ...prev, serviceCharge: e.target.value }))}
                                placeholder="Enter service charge"
                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                disabled={submitting}
                            />
                        </div>
                    </div>

                    {/* Awarded Date */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Fine Date
                        </label>
                        <div className="w-full md:flex-1">
                            <DatePicker
                                value={formData.awardedDate}
                                onChange={(date) => setFormData(prev => ({ ...prev, awardedDate: date }))}
                                className="bg-[#F7F9FC] border-[#E5E7EB]"
                                disabled={submitting}
                            />
                        </div>
                    </div>

                    {/* Monthly Deduction Duration */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Monthly Deduction Duration
                        </label>
                        <div className="w-full md:flex-1">
                            <select
                                value={formData.payableDuration}
                                onChange={(e) => setFormData(prev => ({ ...prev, payableDuration: e.target.value }))}
                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                disabled={submitting}
                            >
                                {[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Month Start */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Month Start
                        </label>
                        <div className="w-full md:flex-1">
                            <MonthYearPicker
                                value={formData.monthStart ? `${formData.monthStart}-01` : undefined}
                                onChange={(dateStr) => {
                                    if (dateStr) {
                                        const yyyyMM = dateStr.slice(0, 7);
                                        setFormData(prev => ({ ...prev, monthStart: yyyyMM }));
                                    }
                                }}
                                className="w-full bg-[#F7F9FC] border-[#E5E7EB]"
                                disabled={submitting}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Description
                        </label>
                        <div className="w-full md:flex-1">
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Provide more details about the fine..."
                                className="w-full h-24 px-3 py-2 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                                disabled={submitting}
                            />
                        </div>
                    </div>

                    {/* Attachment */}
                    <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Attachment
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileChange}
                                className={`w-full h-10 px-3 rounded-xl border ${errors.attachment ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2`}
                                disabled={submitting}
                            />
                            {errors.attachment && <p className="text-xs text-red-500">{errors.attachment}</p>}
                            {formData.attachmentName && (
                                <div className="text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                    Selected: {formData.attachmentName}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Resubmit Highlights */}
                    {isResubmitting && (
                        <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Resubmit Comment <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1">
                                <textarea
                                    value={formData.resubmitComment}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, resubmitComment: e.target.value }));
                                        if (errors.resubmitComment) setErrors(prev => ({ ...prev, resubmitComment: '' }));
                                    }}
                                    placeholder="Explain changes or give context for resubmission..."
                                    className={`w-full h-24 px-3 py-2 rounded-xl border ${errors.resubmitComment ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none shadow-sm`}
                                    disabled={submitting}
                                />
                                {errors.resubmitComment && <p className="text-xs text-red-500 mt-1">{errors.resubmitComment}</p>}
                            </div>
                        </div>
                    )}

                    {/* Submit Section */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={submitting}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {submitting ? 'Saving...' : (isResubmitting ? 'Resubmit' : (initialData && (initialData._id || initialData.fineId) ? 'Save Changes' : 'Save as Draft'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
