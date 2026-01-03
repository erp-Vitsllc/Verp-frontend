'use client';

import { useState, useRef } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddProjectDamageModal({ isOpen, onClose, onSuccess, employees = [], onBack }) {
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        projectId: '',
        projectName: '',
        engineerName: '',
        deductionAmount: '',
        reason: '',
        finePaidBy: 'Employee',
        employeeDeductionAmount: '',
        companyFineAmount: '',
        attachment: null,
        attachmentBase64: '',
        attachmentName: '',
        attachmentMime: ''
    });

    const [assignedEmployees, setAssignedEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [daysWorked, setDaysWorked] = useState('');
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
        if (!selectedEmployeeId) {
            toast({ variant: "destructive", title: "Error", description: "Please select an employee" });
            return;
        }
        if (!daysWorked || parseInt(daysWorked) <= 0) {
            toast({ variant: "destructive", title: "Error", description: "Please enter valid days worked" });
            return;
        }

        // Check if employee already added
        if (assignedEmployees.some(emp => emp.employeeId === selectedEmployeeId)) {
            toast({ variant: "destructive", title: "Error", description: "Employee already added" });
            return;
        }

        const employee = employees.find(e => e.employeeId === selectedEmployeeId);
        if (employee) {
            setAssignedEmployees(prev => [...prev, {
                employeeId: employee.employeeId,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                daysWorked: parseInt(daysWorked)
            }]);
            setSelectedEmployeeId('');
            setDaysWorked('');
        }
    };

    const handleRemoveEmployee = (employeeId) => {
        setAssignedEmployees(prev => prev.filter(emp => emp.employeeId !== employeeId));
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.deductionAmount) {
            newErrors.deductionAmount = 'Deduction amount is required';
        }
        if (!formData.reason) {
            newErrors.reason = 'Reason is required';
        }

        if (formData.finePaidBy === 'Employee & Company') {
            if (!formData.employeeDeductionAmount) {
                newErrors.employeeDeductionAmount = 'Employee deduction amount is required';
            }
            if (!formData.companyFineAmount) {
                newErrors.companyFineAmount = 'Company fine amount is required';
            }

            const total = parseFloat(formData.employeeDeductionAmount || 0) + parseFloat(formData.companyFineAmount || 0);
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

            // Calculate amounts based on finePaidBy
            let employeeAmount = 0;
            let companyAmount = 0;

            if (formData.finePaidBy === 'Employee') {
                employeeAmount = parseFloat(formData.deductionAmount);
            } else if (formData.finePaidBy === 'Company') {
                companyAmount = parseFloat(formData.deductionAmount);
            } else if (formData.finePaidBy === 'Employee & Company') {
                employeeAmount = parseFloat(formData.employeeDeductionAmount);
                companyAmount = parseFloat(formData.companyFineAmount);
            }

            const payload = {
                category: 'Damage',
                subCategory: 'Project Damage',
                fineType: 'Project Damage',
                employeeId: 'PENDING', // Will be updated when projects are built
                projectId: formData.projectId || null,
                projectName: formData.projectName || 'N/A',
                engineerName: formData.engineerName || 'N/A',
                assignedEmployees: assignedEmployees,
                fineAmount: parseFloat(formData.deductionAmount),
                responsibleFor: formData.finePaidBy,
                employeeAmount: employeeAmount,
                companyAmount: companyAmount,
                description: formData.reason,
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
            toast({ title: "Success", description: "Project damage submitted for approval" });
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
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[800px] max-h-[90vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors mr-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">Add Project Damage</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden pr-2 space-y-5">
                    {/* Project Information Note */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <div className="text-amber-500 mt-0.5">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </div>
                        <p className="text-sm text-amber-700 leading-relaxed">
                            <span className="font-semibold text-amber-800">Note:</span> Projects are not yet built in the system. The project dropdown will be enabled once the project management module is complete.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Project Selection */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Project</label>
                            <select
                                value={formData.projectId}
                                onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                                disabled
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 outline-none cursor-not-allowed"
                            >
                                <option value="">None (Projects not built yet)</option>
                            </select>
                        </div>

                        {/* Engineer Name */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Engineer Name</label>
                            <input
                                type="text"
                                value={formData.engineerName}
                                readOnly
                                placeholder="Auto-filled based on project"
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 outline-none cursor-not-allowed"
                            />
                        </div>

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
                                className={`w-full h-11 px-4 rounded-xl border ${errors.deductionAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500/20`}
                            />
                            {errors.deductionAmount && <p className="text-xs text-red-500 ml-1">{errors.deductionAmount}</p>}
                        </div>

                        {/* Fine Paid By */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Fine Paid By</label>
                            <select
                                value={formData.finePaidBy}
                                onChange={(e) => setFormData(prev => ({ ...prev, finePaidBy: e.target.value }))}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500/20"
                            >
                                <option value="Employee">Employee</option>
                                <option value="Company">Company</option>
                                <option value="Employee & Company">Employee & Company</option>
                            </select>
                        </div>

                        {/* Conditional Split Fields */}
                        {formData.finePaidBy === 'Employee & Company' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Employee Deduction Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.employeeDeductionAmount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, employeeDeductionAmount: e.target.value }))}
                                        placeholder="0.00"
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.employeeDeductionAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                    {errors.employeeDeductionAmount && <p className="text-xs text-red-500 ml-1">{errors.employeeDeductionAmount}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">
                                        Company Fine Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.companyFineAmount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, companyFineAmount: e.target.value }))}
                                        placeholder="0.00"
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.companyFineAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                    {errors.companyFineAmount && <p className="text-xs text-red-500 ml-1">{errors.companyFineAmount}</p>}
                                </div>
                                {errors.amountMismatch && <p className="text-xs text-red-500 col-span-full ml-1">{errors.amountMismatch}</p>}
                            </>
                        )}
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder="Describe the damage and reason for deduction..."
                            rows={4}
                            className={`w-full px-4 py-3 rounded-xl border ${errors.reason ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500/20 resize-none`}
                        />
                        {errors.reason && <p className="text-xs text-red-500 ml-1">{errors.reason}</p>}
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

                    {/* Add More Employees Section */}
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-800">Add Employees Who Worked on Project</h4>

                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2">
                                    <select
                                        value={selectedEmployeeId}
                                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500/20"
                                    >
                                        <option value="">Select Employee</option>
                                        {employees.map(emp => (
                                            <option key={emp.employeeId} value={emp.employeeId}>
                                                {emp.employeeId} - {emp.firstName} {emp.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        value={daysWorked}
                                        onChange={(e) => setDaysWorked(e.target.value)}
                                        placeholder="Days worked"
                                        className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500/20"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddEmployee}
                                className="w-full h-11 px-4 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                Add Employee
                            </button>
                        </div>

                        {/* Assigned Employees List */}
                        {assignedEmployees.length > 0 && (
                            <div className="space-y-2 mt-4">
                                <p className="text-xs font-medium text-gray-600">Assigned Employees:</p>
                                <div className="space-y-2">
                                    {assignedEmployees.map((emp) => (
                                        <div
                                            key={emp.employeeId}
                                            className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-100"
                                        >
                                            <span className="text-sm text-gray-800">
                                                {emp.employeeName} <span className="text-purple-600 font-medium">({emp.daysWorked} days)</span>
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
                            className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
