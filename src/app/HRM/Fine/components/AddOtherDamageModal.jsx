'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
    const [selectedCompanyId, setSelectedCompanyId] = useState('');

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);


    // Filter available employees
    const availableEmployees = useMemo(() => {
        const selectedIds = selectedEmployees.map(emp => emp.employeeId);
        return employees.filter(emp => !selectedIds.includes(emp.employeeId));
    }, [employees, selectedEmployees]);

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

            let emps = [];
            if (initialData.assignedEmployees && initialData.assignedEmployees.length > 0) {
                emps = initialData.assignedEmployees.map(emp => ({
                    employeeId: emp.employeeId,
                    employeeName: emp.employeeName || employees.find(e => e.employeeId === emp.employeeId)?.firstName || emp.employeeId,
                    fineAmount: initialData.fineAmount,
                    duration: emp.payableDuration || initialData.payableDuration || '1'
                }));
            } else if (initialData.employeeId) {
                const empName = initialData.employeeName || employees.find(e => e.employeeId === initialData.employeeId)?.firstName || initialData.employeeId;
                emps = [{
                    employeeId: initialData.employeeId,
                    employeeName: empName,
                    fineAmount: initialData.fineAmount || '0',
                    duration: initialData.payableDuration || '1'
                }];
            }
            setSelectedEmployees(emps);
        } else if (isOpen) {
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

    // Recalculate fine amounts
    useEffect(() => {
        if (initialData?._id) return;
        const count = selectedEmployees.length;
        if (count === 0) return;
        let totalEmployeeAmount = 0;
        if (formData.paidBy === 'Employee') totalEmployeeAmount = parseFloat(formData.deductionAmount) || 0;
        else if (formData.paidBy === 'Employee & Company') totalEmployeeAmount = parseFloat(formData.employeeAmount) || 0;
        const share = totalEmployeeAmount / count;

        setSelectedEmployees(prev => prev.map(emp => ({ ...emp, fineAmount: share.toFixed(2), duration: payableDuration })));
    }, [formData.deductionAmount, formData.employeeAmount, formData.paidBy, selectedEmployees.length, payableDuration, initialData?._id]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setFormData(prev => ({ ...prev, attachment: file, attachmentBase64: base64, attachmentName: file.name, attachmentMime: file.type || 'application/pdf' }));
        };
        reader.readAsDataURL(file);
    };

    const handleAddEmployee = () => {
        if (!currentEmployeeId) return;
        const employee = employees.find(e => e.employeeId === currentEmployeeId);
        if (employee) {
            const empCompanyId = employee.company?._id || employee.company;
            setSelectedEmployees(prev => [...prev, {
                employeeId: employee.employeeId,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                fineAmount: '0.00',
                duration: payableDuration
            }]);
            setCurrentEmployeeId('');
        }
    };

    const handleRemoveEmployee = (id) => setSelectedEmployees(prev => prev.filter(e => e.employeeId !== id));

    const handleAmountChange = (id, val) => {
        let totalTarget = formData.paidBy === 'Employee' ? (parseFloat(formData.deductionAmount) || 0) : (parseFloat(formData.employeeAmount) || 0);
        setSelectedEmployees(prev => {
            const idx = prev.findIndex(e => e.employeeId === id);
            if (idx === -1) return prev;
            const sumBefore = prev.slice(0, idx).reduce((s, c) => s + (parseFloat(c.fineAmount) || 0), 0);
            const remaining = totalTarget - sumBefore - (parseFloat(val) || 0);
            const countBelow = prev.length - (idx + 1);
            return prev.map((e, i) => {
                if (i < idx) return e;
                if (i === idx) return { ...e, fineAmount: val };
                return { ...e, fineAmount: countBelow > 0 ? (remaining / countBelow).toFixed(2) : e.fineAmount };
            });
        });
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.deductionAmount) newErrors.deductionAmount = 'Enter total deduction amount';
        if (!formData.description) newErrors.description = 'Description is required';
        if (selectedEmployees.length === 0) newErrors.selectedEmployees = 'Select at least one employee';

        // Check if all assigned employees belong to the same company
        const companiesInGroup = new Set(selectedEmployees.map(se => {
            const emp = employees.find(e => e.employeeId === se.employeeId);
            return String(emp?.company?._id || emp?.company || '');
        }));

        if (companiesInGroup.size > 1) {
            newErrors.selectedEmployees = 'All employees in a group fine must belong to the same company.';
        }

        const totalInput = parseFloat(formData.deductionAmount) || 0;
        const currentSum = selectedEmployees.reduce((s, e) => s + (parseFloat(e.fineAmount) || 0), 0);

        if (formData.paidBy === 'Employee') {
            if (Math.abs(currentSum - totalInput) > 0.05) newErrors.amountMismatch = `Sum mismatch (AED ${currentSum.toFixed(2)} vs AED ${totalInput.toFixed(2)})`;
        } else if (formData.paidBy === 'Employee & Company') {
            if (!formData.employeeAmount) newErrors.employeeAmount = 'Employee amount is required';
            if (!formData.companyAmount) newErrors.companyAmount = 'Company amount is required';
            const empTarget = parseFloat(formData.employeeAmount) || 0;
            const compTarget = parseFloat(formData.companyAmount) || 0;
            if (Math.abs((empTarget + compTarget) - totalInput) > 0.01) newErrors.amountMismatch = 'Sum mismatch';
            if (Math.abs(currentSum - empTarget) > 0.05) newErrors.amountMismatch = `Sum of individual employee fines (AED ${currentSum.toFixed(2)}) must equal AED ${empTarget.toFixed(2)}`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setSubmitting(true);
            let empAmt = 0, compAmt = 0;
            if (formData.paidBy === 'Employee') empAmt = parseFloat(formData.deductionAmount);
            else if (formData.paidBy === 'Company') compAmt = parseFloat(formData.deductionAmount);
            else if (formData.paidBy === 'Employee & Company') {
                empAmt = parseFloat(formData.employeeAmount);
                compAmt = parseFloat(formData.companyAmount);
            }
            const grandTotal = empAmt + compAmt;

            // Determine Company from first employee
            const firstEmpFull = employees.find(e => e.employeeId === selectedEmployees[0].employeeId);
            const commonCompanyId = firstEmpFull?.company?._id || firstEmpFull?.company;

            const payload = {
                category: 'Damage',
                company: commonCompanyId,
                subCategory: 'Other Damage',
                assignedEmployees: selectedEmployees, responsibleFor: formData.paidBy,
                description: formData.description, companyDescription: formData.companyDescription,
                fineStatus: 'Draft', isBulk: true, monthStart, fineAmount: grandTotal,
                employeeAmount: empAmt, companyAmount: compAmt,
                employees: selectedEmployees.map(emp => {
                    const individualShare = parseFloat(emp.fineAmount) || 0;
                    return {
                        employeeId: emp.employeeId,
                        employeeName: emp.employeeName,
                        fineAmount: individualShare.toFixed(2),
                        employeeAmount: individualShare.toFixed(2),
                        companyAmount: "0.00",
                        payableDuration: parseInt(payableDuration) || 1
                    };
                })
            };
            if (formData.attachmentBase64) payload.attachment = { data: formData.attachmentBase64, name: formData.attachmentName, mimeType: formData.attachmentMime };

            if (initialData?._id) {
                if (isResubmitting) { payload.fineStatus = 'Pending'; payload.resubmit = true; }
                await axiosInstance.put(`/Fine/${initialData._id}`, payload);
                toast({ title: "Success", description: "Fine updated successfully" });
            } else {
                await axiosInstance.post('/Fine', payload);
                toast({ title: "Success", description: "Other Damage fine submitted for approval" });
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error.response?.data?.message || "Failed" });
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[700px] max-h-[90vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2"><button onClick={onBack} className="text-gray-400 hover:text-gray-600"><ArrowBackSVG /></button><h3 className="text-[20px] font-semibold text-gray-800">Add Other Damage</h3></div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5 text-gray-700">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5 ">
                            <label className="text-sm font-medium">Fine Amount (Total) <span className="text-red-500">*</span></label>
                            <input type="number" value={formData.deductionAmount} onChange={(e) => setFormData(p => ({ ...p, deductionAmount: e.target.value }))} className={`w-full h-11 px-4 rounded-xl border ${errors.deductionAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Fine Paid By</label>
                            <select value={formData.paidBy} onChange={(e) => setFormData(p => ({ ...p, paidBy: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50">
                                <option value="Employee">Employee</option><option value="Company">Company</option><option value="Employee & Company">Employee & Company</option>
                            </select>
                        </div>
                    </div>

                    {formData.paidBy === 'Employee & Company' && (
                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5"><label className="text-sm font-medium">Employee Amount</label><input type="number" value={formData.employeeAmount} onChange={(e) => setFormData(p => ({ ...p, employeeAmount: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200" /></div>
                            <div className="space-y-1.5"><label className="text-sm font-medium">Company Amount</label><input type="number" value={formData.companyAmount} onChange={(e) => setFormData(p => ({ ...p, companyAmount: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200" /></div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1.5"><label className="text-sm font-medium">Payable Duration</label><select value={payableDuration} onChange={(e) => setPayableDuration(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50">{[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}</select></div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">Month Start</label><MonthYearPicker value={monthStart ? `${monthStart}-01` : undefined} onChange={(d) => d && setMonthStart(d.slice(0, 7))} className="w-full" /></div>
                    </div>

                    <div className="space-y-1.5"><label className="text-sm font-medium">Description</label><textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} className={`w-full px-4 py-3 rounded-xl border ${errors.description ? 'border-red-400' : 'border-gray-200'} bg-gray-50 resize-none`} /></div>
                    <div className="space-y-1.5"><label className="text-sm font-medium">Attachment</label><div onClick={() => fileInputRef.current?.click()} className="w-full p-4 rounded-xl border-2 border-dashed border-gray-100 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100"><Upload className="text-gray-400 mb-2" size={24} /><span className="text-xs text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-full px-2">{formData.attachment ? formData.attachmentName : 'Upload document'}</span><input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} /></div></div>

                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <label className="text-sm font-semibold">Assign Employee(s)</label>
                        <div className="flex gap-2">
                            <select value={currentEmployeeId} onChange={(e) => setCurrentEmployeeId(e.target.value)} className={`flex-1 h-11 px-4 rounded-xl border ${errors.selectedEmployees ? 'border-red-400' : 'border-gray-200'} bg-gray-50`}>
                                <option value="">Select Employee</option>
                                {availableEmployees.map(e => <option key={e.employeeId} value={e.employeeId}>{e.employeeId} - {e.firstName} {e.lastName}</option>)}
                            </select>
                            <button type="button" onClick={handleAddEmployee} className="h-11 px-6 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-700 transition-colors shadow-sm">Add</button>
                        </div>
                        {errors.selectedEmployees && <p className="text-xs text-red-500">{errors.selectedEmployees}</p>}
                        {errors.amountMismatch && <p className="text-xs text-red-500 p-2 bg-red-50 rounded-lg">{errors.amountMismatch}</p>}

                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {selectedEmployees.map((emp) => (
                                <div key={emp.employeeId} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="flex flex-col"><span className="text-sm font-bold">{emp.employeeName}</span><span className="text-[10px] text-gray-400">{emp.employeeId}</span></div>
                                    <div className="flex items-center gap-3">
                                        <input type="number" value={emp.fineAmount} onChange={(e) => handleAmountChange(emp.employeeId, e.target.value)} className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-right text-sm font-bold" />
                                        <button type="button" onClick={() => handleRemoveEmployee(emp.employeeId)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-gray-200 font-medium">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-medium shadow-sm">{submitting ? 'Saving...' : 'Save as Draft'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const ArrowBackSVG = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>);
