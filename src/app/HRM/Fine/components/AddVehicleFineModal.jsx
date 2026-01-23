'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddVehicleFineModal({ isOpen, onClose, onSuccess, employees = [], onBack }) {
    const { toast } = useToast();
    const [vehicles, setVehicles] = useState([
        { id: 'v1', name: 'Toyota Corolla' },
        { id: 'v2', name: 'Honda Civic' },
        { id: 'v3', name: 'Hyundai i20' },
        { id: 'v4', name: 'Kia Seltos' },
        { id: 'v5', name: 'Tesla Model 3' }
    ]); // Dummy Assets for now
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [employeeName, setEmployeeName] = useState('');

    const [formData, setFormData] = useState({
        fineAmount: '',
        responsibleFor: 'Employee',
        employeeAmount: '',
        companyAmount: '',
        payableDuration: '1',
        monthStart: new Date().toISOString().split('T')[0].slice(0, 7), // YYYY-MM
        description: '',
        attachment: null,
        attachmentBase64: '',
        attachmentName: '',
        attachmentMime: '',
        companyDescription: ''
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    // Auto-fill employee name when employee is selected
    useEffect(() => {
        if (selectedEmployeeId) {
            const emp = employees.find(e => e.employeeId === selectedEmployeeId);
            if (emp) {
                setEmployeeName(`${emp.firstName} ${emp.lastName}`);
            }
        } else {
            setEmployeeName('');
        }
    }, [selectedEmployeeId, employees]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
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

    const validateForm = () => {
        const newErrors = {};
        if (!selectedEmployeeId) newErrors.employeeId = 'Employee is required';
        if (!formData.fineAmount) newErrors.fineAmount = 'Deduction amount is required';

        if (formData.responsibleFor === 'Employee & Company') {
            if (!formData.employeeAmount) newErrors.employeeAmount = 'Employee amount is required';
            if (!formData.companyAmount) newErrors.companyAmount = 'Company amount is required';

            const total = parseFloat(formData.employeeAmount) + parseFloat(formData.companyAmount);
            if (Math.abs(total - parseFloat(formData.fineAmount)) > 0.01) {
                newErrors.amountMismatch = 'Sum of employee and company amounts must equal total fine amount';
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
            const payload = {
                isBulk: true, // Treat as bulk (group of 1) to use consistent backend logic
                employees: [{
                    employeeId: selectedEmployeeId,
                    employeeName: employeeName,
                    daysWorked: 0
                }],
                category: 'Violation',
                subCategory: 'Vehicle Fine',
                fineType: 'Vehicle Fine',
                fineAmount: parseFloat(formData.fineAmount),
                responsibleFor: formData.responsibleFor,
                employeeAmount: formData.responsibleFor === 'Company' ? 0 : (formData.responsibleFor === 'Employee' ? parseFloat(formData.fineAmount) : parseFloat(formData.employeeAmount)),
                companyAmount: formData.responsibleFor === 'Employee' ? 0 : (formData.responsibleFor === 'Company' ? parseFloat(formData.fineAmount) : parseFloat(formData.companyAmount)),
                payableDuration: parseInt(formData.payableDuration),
                monthStart: formData.monthStart,
                monthStart: formData.monthStart,
                vehicleId: selectedVehicleId,
                description: formData.description,
                companyDescription: formData.companyDescription,
                fineStatus: 'Pending'
            };

            if (formData.attachmentBase64) {
                payload.attachment = {
                    data: formData.attachmentBase64,
                    name: formData.attachmentName,
                    mimeType: formData.attachmentMime
                };
            }

            await axiosInstance.post('/Fine', payload);
            toast({ title: "Success", description: "Vehicle fine submitted for approval" });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error.response?.data?.message || "Submission failed" });
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
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">Add Vehicle Fine</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Vehicle Selection */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Vehicle</label>
                            <select
                                value={selectedVehicleId}
                                onChange={(e) => setSelectedVehicleId(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            >
                                <option value="">Select Vehicle</option>
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>

                        {/* Employee Selection */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Employee <span className="text-red-500">*</span></label>
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className={`w-full h-11 px-4 rounded-xl border ${errors.employeeId ? 'border-red-400' : 'border-gray-200'} bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none`}
                            >
                                <option value="">Select Employee</option>
                                {employees.map(emp => (
                                    <option key={emp.employeeId} value={emp.employeeId}>
                                        {emp.employeeId} - {emp.firstName} {emp.lastName}
                                    </option>
                                ))}
                            </select>
                            {errors.employeeId && <p className="text-xs text-red-500 ml-1">{errors.employeeId}</p>}
                        </div>

                        {/* Employee Name Auto-fill */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Employee Name</label>
                            <input
                                type="text"
                                value={employeeName}
                                readOnly
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 outline-none cursor-not-allowed"
                            />
                        </div>

                        {/* Deduction Amount */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Employee Fine Amount <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                value={formData.fineAmount}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => {
                                        const newState = { ...prev, fineAmount: val };
                                        if (prev.responsibleFor === 'Employee & Company' && val) {
                                            const total = parseFloat(val);
                                            newState.employeeAmount = (total / 2).toFixed(2);
                                            newState.companyAmount = (total / 2).toFixed(2);
                                        }
                                        return newState;
                                    });
                                }}
                                placeholder="0.00"
                                className={`w-full h-11 px-4 rounded-xl border ${errors.fineAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20`}
                            />
                            {errors.fineAmount && <p className="text-xs text-red-500 ml-1">{errors.fineAmount}</p>}
                        </div>

                        {/* Responsible For */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Responsible For</label>
                            <select
                                value={formData.responsibleFor}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => {
                                        const newState = { ...prev, responsibleFor: val };
                                        if (val === 'Employee & Company' && prev.fineAmount) {
                                            const total = parseFloat(prev.fineAmount);
                                            newState.employeeAmount = (total / 2).toFixed(2);
                                            newState.companyAmount = (total / 2).toFixed(2);
                                        }
                                        return newState;
                                    });
                                }}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="Employee">Employee</option>
                                <option value="Company">Company</option>
                                <option value="Employee & Company">Employee & Company</option>
                            </select>
                        </div>

                        {/* Responsible For - Extra Fields */}
                        {formData.responsibleFor === 'Employee & Company' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Employee Amount <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        value={formData.employeeAmount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => {
                                                const total = parseFloat(prev.fineAmount) || 0;
                                                const empAmt = parseFloat(val) || 0;
                                                return {
                                                    ...prev,
                                                    employeeAmount: val,
                                                    companyAmount: (total - empAmt).toFixed(2)
                                                };
                                            });
                                        }}
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.employeeAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Company Amount <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        value={formData.companyAmount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => {
                                                const total = parseFloat(prev.fineAmount) || 0;
                                                const compAmt = parseFloat(val) || 0;
                                                return {
                                                    ...prev,
                                                    companyAmount: val,
                                                    employeeAmount: (total - compAmt).toFixed(2)
                                                };
                                            });
                                        }}
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.companyAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                </div>
                                {errors.amountMismatch && <p className="text-xs text-red-500 col-span-full ml-1">{errors.amountMismatch}</p>}
                            </>

                        )}

                        {/* Company Description - Conditional */}
                        {(formData.responsibleFor === 'Company' || formData.responsibleFor === 'Employee & Company') && (
                            <div className="space-y-1.5 col-span-1 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Company Description</label>
                                <textarea
                                    value={formData.companyDescription}
                                    onChange={(e) => setFormData(prev => ({ ...prev, companyDescription: e.target.value }))}
                                    placeholder="Explain why the company is bearing this cost..."
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                                />
                            </div>
                        )}

                        {/* Payable Duration */}
                        {formData.responsibleFor !== 'Company' && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Fine Payable Duration</label>
                                <select
                                    value={formData.payableDuration}
                                    onChange={(e) => setFormData(prev => ({ ...prev, payableDuration: e.target.value }))}
                                    className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    {[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Month Start */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Month Start</label>
                            <input
                                type="month"
                                value={formData.monthStart}
                                onChange={(e) => setFormData(prev => ({ ...prev, monthStart: e.target.value }))}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
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
                            className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {submitting ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
