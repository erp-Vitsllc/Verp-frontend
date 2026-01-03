'use client';

import { useState, useRef } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddOtherDamageModal({ isOpen, onClose, onSuccess, employees = [], onBack }) {
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
        attachmentMime: ''
    });

    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [currentEmployeeId, setCurrentEmployeeId] = useState('');
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);

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
                employeeName: `${employee.firstName} ${employee.lastName}`
            }]);
            setCurrentEmployeeId('');
        }
    };

    const handleRemoveEmployee = (employeeId) => {
        setSelectedEmployees(prev => prev.filter(emp => emp.employeeId !== employeeId));
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

        if (formData.paidBy === 'Employee & Company') {
            if (!formData.employeeAmount) {
                newErrors.employeeAmount = 'Employee amount is required';
            }
            if (!formData.companyAmount) {
                newErrors.companyAmount = 'Company amount is required';
            }

            const total = parseFloat(formData.employeeAmount || 0) + parseFloat(formData.companyAmount || 0);
            if (Math.abs(total - parseFloat(formData.deductionAmount)) > 0.01) {
                newErrors.amountMismatch = 'Sum of employee and company amounts must equal total deduction amount';
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

            // Calculate amounts based on paidBy
            let employeeAmount = 0;
            let companyAmount = 0;

            if (formData.paidBy === 'Employee') {
                employeeAmount = parseFloat(formData.deductionAmount);
            } else if (formData.paidBy === 'Company') {
                companyAmount = parseFloat(formData.deductionAmount);
            } else if (formData.paidBy === 'Employee & Company') {
                employeeAmount = parseFloat(formData.employeeAmount);
                companyAmount = parseFloat(formData.companyAmount);
            }

            const payload = {
                category: 'Damage',
                subCategory: 'Other Damage',
                fineType: 'Other Damage',
                employeeId: selectedEmployees[0].employeeId, // Primary employee
                selectedEmployees: selectedEmployees,
                fineAmount: parseFloat(formData.deductionAmount),
                responsibleFor: formData.paidBy,
                employeeAmount: employeeAmount,
                companyAmount: companyAmount,
                description: formData.description,
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
            toast({ title: "Success", description: "Other damage fine submitted for approval" });
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
                        {/* Deduction Amount */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">
                                Deduction Amount <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.deductionAmount}
                                onChange={(e) => setFormData(prev => ({ ...prev, deductionAmount: e.target.value }))}
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
                                onChange={(e) => setFormData(prev => ({ ...prev, paidBy: e.target.value }))}
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
                                        onChange={(e) => setFormData(prev => ({ ...prev, employeeAmount: e.target.value }))}
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
                                        onChange={(e) => setFormData(prev => ({ ...prev, companyAmount: e.target.value }))}
                                        placeholder="0.00"
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.companyAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                    {errors.companyAmount && <p className="text-xs text-red-500 ml-1">{errors.companyAmount}</p>}
                                </div>
                                {errors.amountMismatch && <p className="text-xs text-red-500 col-span-full ml-1">{errors.amountMismatch}</p>}
                            </>
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
                            <div className="space-y-2 mt-4">
                                <p className="text-xs font-medium text-gray-600">Selected Employees:</p>
                                <div className="space-y-2">
                                    {selectedEmployees.map((emp) => (
                                        <div
                                            key={emp.employeeId}
                                            className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100"
                                        >
                                            <span className="text-sm text-gray-800">
                                                {emp.employeeId} - {emp.employeeName}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEmployee(emp.employeeId)}
                                                className="text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
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
                            {submitting ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
