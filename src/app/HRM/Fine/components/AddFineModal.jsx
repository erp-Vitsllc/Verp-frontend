'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from "@/components/ui/date-picker";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

// Reusable searchable employee dropdown
function SearchableEmployeeSelect({ employees, value, onChange, disabled, hasError }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return employees.filter(e =>
            (e.firstName + ' ' + e.lastName).toLowerCase().includes(q) ||
            (e.employeeId || '').toLowerCase().includes(q)
        );
    }, [employees, query]);

    const selected = employees.find(e => e.employeeId === value);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) { setOpen(o => !o); setQuery(''); } }}
                className={`w-full h-10 px-3 rounded-xl border ${
                    hasError ? 'border-red-400' : 'border-[#E5E7EB]'
                } bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all flex items-center justify-between gap-2 text-sm`}
            >
                <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
                    {selected ? `${selected.employeeId} - ${selected.firstName} ${selected.lastName}` : 'Select Employee'}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    {/* Search box */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <Search size={14} className="text-gray-400 shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by name or ID..."
                            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                        />
                    </div>
                    {/* Options list */}
                    <ul className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-gray-400 italic">No employees found</li>
                        ) : filtered.map(emp => (
                            <li
                                key={emp.employeeId}
                                onClick={() => { onChange(emp.employeeId); setOpen(false); setQuery(''); }}
                                className={`px-4 py-2.5 text-sm cursor-pointer flex items-center gap-2 hover:bg-blue-50 transition-colors ${
                                    emp.employeeId === value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'
                                }`}
                            >
                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {(emp.firstName || 'E').charAt(0)}
                                </span>
                                <span>{emp.firstName} {emp.lastName}</span>
                                <span className="ml-auto text-[10px] text-gray-400 font-mono">{emp.employeeId}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

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
        resubmitComment: '',
        companyId: ''
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
                    // When editing, load the GRAND TOTAL fine amount
                    fineAmount: String(initialData.fineAmount || ''),
                    description: initialData.description || '',
                    remarks: initialData.remarks || '',
                    awardedDate: initialData.awardedDate ? new Date(initialData.awardedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    payableDuration: String(initialData.payableDuration || '1'),
                    monthStart: initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7),
                    responsibleFor: initialData.responsibleFor || 'Employee',
                    employeeAmount: initialData.employeeAmount || '',
                    companyAmount: initialData.companyAmount || '',
                    serviceCharge: initialData.serviceCharge || '',
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

    // Show all employees
    const filteredEmployees = useMemo(() => employees, [employees]);

    if (!isOpen) return null;

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

        if (!formData.description || formData.description.trim() === '') {
            newErrors.description = 'Description is required';
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

            const serviceChargeAmount = parseFloat(formData.serviceCharge || 0);
            const grandTotalFine = parseFloat(formData.fineAmount);
            const baseFineAmount = grandTotalFine - serviceChargeAmount;

            const totalEmp = (formData.responsibleFor === 'Company' ? 0 : (formData.responsibleFor === 'Employee' ? baseFineAmount : parseFloat(formData.employeeAmount)));
            const totalComp = (formData.responsibleFor === 'Employee' ? 0 : (formData.responsibleFor === 'Company' ? baseFineAmount : parseFloat(formData.companyAmount)));

            const selectedEmp = employees.find(e => e.employeeId === selectedEmployeeId);
            const empCompanyId = selectedEmp?.company?._id || selectedEmp?.company;

            const totalPartiesCount = (formData.responsibleFor === 'Employee & Company') ? 2 : 1;
            const scPerParty = totalPartiesCount > 0 ? (serviceChargeAmount / totalPartiesCount) : 0;

            const employeesPayload = [];
            if (formData.responsibleFor !== 'Company') {
                employeesPayload.push({
                    employeeId: selectedEmployeeId,
                    employeeName: selectedEmployeeName,
                    employeeAmount: totalEmp.toFixed(2),
                    individualAmount: (totalEmp + scPerParty).toFixed(2),
                    fineAmount: (totalEmp + scPerParty).toFixed(2),
                    daysWorked: 0
                });
            }
            if (formData.responsibleFor === 'Employee & Company' || formData.responsibleFor === 'Company') {
                employeesPayload.push({
                    employeeId: 'VEGA-HR-0000',
                    employeeName: 'Vega Digital IT Solutions',
                    employeeAmount: totalComp.toFixed(2),
                    individualAmount: (totalComp + scPerParty).toFixed(2),
                    fineAmount: (totalComp + scPerParty).toFixed(2),
                    daysWorked: 0
                });
            }

            const payload = {
                isBulk: true,
                company: empCompanyId, // Include company from employee
                employees: employeesPayload,
                fineType: selectedFineType,
                fineAmount: grandTotalFine,
                fineStatus: isResubmitting ? 'Pending' : (initialData?._id || initialData?.fineId ? initialData.fineStatus : 'Draft'),
                description: formData.description,
                remarks: formData.remarks,
                awardedDate: formData.awardedDate,
                payableDuration: parseInt(formData.payableDuration),
                monthStart: formData.monthStart,
                responsibleFor: formData.responsibleFor,
                employeeAmount: totalEmp,
                companyAmount: totalComp,
                totalEmployeeFineAmount: totalFine - totalComp, // Explicitly store total fine - company share
                serviceCharge: serviceChargeAmount,
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
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {isResubmitting ? 'Resubmit Fine' : (initialData?._id || initialData?.fineId ? 'Edit Fine' : 'Add Fine')}
                    </h3>
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
                            <SearchableEmployeeSelect
                                employees={filteredEmployees}
                                value={selectedEmployeeId}
                                onChange={(empId) => {
                                    setSelectedEmployeeId(empId);
                                    if (errors.employeeId) setErrors(prev => ({ ...prev, employeeId: '' }));
                                }}
                                disabled={submitting}
                                hasError={!!errors.employeeId}
                            />
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
                            Description <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <textarea
                                value={formData.description}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, description: e.target.value }));
                                    if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                                }}
                                placeholder="Provide more details about the fine..."
                                className={`w-full h-24 px-3 py-2 rounded-xl border ${errors.description ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none`}
                                disabled={submitting}
                            />
                            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
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

                    {/* Total Summary */}
                    <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-0.5">Summary</span>
                            <span className="text-xs text-blue-600 font-medium italic">
                                Total payable amount (Fine + Service Charge)
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-blue-900">
                                {(parseFloat(formData.fineAmount || 0)).toLocaleString()}
                            </span>
                            <span className="text-[11px] font-bold text-blue-700 uppercase">AED</span>
                        </div>
                    </div>

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
