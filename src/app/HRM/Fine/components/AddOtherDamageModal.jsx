'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import Select from 'react-select';
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
        companyDescription: '',
        serviceCharge: ''
    });

    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [currentEmployeeId, setCurrentEmployeeId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [payableDuration, setPayableDuration] = useState('1');
    const [monthStart, setMonthStart] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
    const [selectedCompanyId, setSelectedCompanyId] = useState('');

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [companies, setCompanies] = useState([]);
    const fileInputRef = useRef(null);


    // Filter available employees
    const availableEmployees = useMemo(() => {
        const selectedIds = selectedEmployees.map(emp => emp.employeeId);
        let base = employees.filter(emp => !selectedIds.includes(emp.employeeId));
        if (searchQuery) {
            base = base.filter(e => 
                (e.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                (e.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                (e.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return base;
    }, [employees, selectedEmployees, searchQuery]);

    // Populate data when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                description: initialData.description || '',
                // When editing, load the GRAND TOTAL deduction amount
                deductionAmount: String(initialData.fineAmount || ''),
                paidBy: initialData.responsibleFor || 'Employee',
                employeeAmount: String(initialData.employeeAmount ?? ''),
                companyAmount: String(initialData.companyAmount ?? ''),
                companyDescription: initialData.companyDescription || '',
                attachment: null,
                attachmentBase64: '',
                attachmentName: initialData.attachment?.name || '',
                attachmentMime: '',
                serviceCharge: String(initialData.serviceCharge || '')
            });
            setMonthStart(initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7));
            setPayableDuration(String(initialData.payableDuration || '1'));

            let emps = [];
            if (initialData.assignedEmployees && initialData.assignedEmployees.length > 0) {
                // Filter out company record from the table view
                const realEmployees = initialData.assignedEmployees.filter(emp => emp.employeeId !== 'VEGA-HR-0000');
                emps = realEmployees.map(emp => ({
                    employeeId: emp.employeeId,
                    employeeName: emp.employeeName || employees.find(e => e.employeeId === emp.employeeId)?.firstName || emp.employeeId,
                    // Prefer employeeAmount (base) or fineAmount for per-person input; fallback to split
                    fineAmount: emp.employeeAmount ?? emp.fineAmount ?? emp.individualAmount ?? (initialData.employeeAmount ? (parseFloat(initialData.employeeAmount) / realEmployees.length).toFixed(2) : (parseFloat(initialData.fineAmount) / realEmployees.length).toFixed(2)),
                    duration: emp.payableDuration || initialData.payableDuration || '1'
                }));
            } else if (initialData.employeeId && initialData.employeeId !== 'VEGA-HR-0000') {
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
                attachment: null, attachmentBase64: '', attachmentName: '', attachmentMime: '', companyDescription: '',
                serviceCharge: ''
            });
            setSelectedEmployees([]);
            setCurrentEmployeeId('');
            setSearchQuery('');
            setPayableDuration('1');
            setMonthStart(new Date().toISOString().split('T')[0].slice(0, 7));

        }
    }, [isOpen, initialData, employees]);

    // Fetch companies
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await axiosInstance.get('/Company');
                const data = response.data.companies || (Array.isArray(response.data) ? response.data : []);
                setCompanies(data);
                if (initialData?.company) {
                    setSelectedCompanyId(initialData.company._id || initialData.company);
                }
            } catch (error) {
                console.error("Error fetching companies:", error);
            }
        };
        if (isOpen) fetchCompanies();
    }, [isOpen, initialData]);

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

        // Same company validation removed per user request

        const totalInput = parseFloat(formData.deductionAmount) || 0;
        const currentSum = selectedEmployees.reduce((s, e) => s + (parseFloat(e.fineAmount) || 0), 0);

        if (formData.paidBy === 'Employee') {
            if (Math.abs(currentSum - totalInput) > 0.05) newErrors.amountMismatch = `Sum mismatch (AED ${currentSum.toFixed(2)} vs AED ${totalInput.toFixed(2)})`;
        } else if (formData.paidBy === 'Employee & Company') {
            if (!formData.employeeAmount) newErrors.employeeAmount = 'Employee amount is required';
            if (!formData.companyAmount) newErrors.companyAmount = 'Company amount is required';
            const empTarget = parseFloat(formData.employeeAmount) || 0;
            const compTarget = parseFloat(formData.companyAmount) || 0;
            const serviceChargeAmount = parseFloat(formData.serviceCharge) || 0;
            
            // Single validation: Total Fine Amount must equal Service Charge + Employee Portion + Company Portion
            const expectedTotal = serviceChargeAmount + empTarget + compTarget;
            if (Math.abs(totalInput - expectedTotal) > 0.01) {
                newErrors.deductionAmount = `Total deduction amount (AED ${totalInput.toFixed(2)}) must equal service charge (AED ${serviceChargeAmount.toFixed(2)}) + employee portion (AED ${empTarget.toFixed(2)}) + company portion (AED ${compTarget.toFixed(2)}) = AED ${expectedTotal.toFixed(2)}`;
            }
        }

        if ((formData.paidBy === 'Company' || formData.paidBy === 'Employee & Company') && !selectedCompanyId) {
            newErrors.company = 'Company selection is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setSubmitting(true);
            const serviceChargeAmount = parseFloat(formData.serviceCharge || 0);
            const grandTotalFine = parseFloat(formData.deductionAmount) || 0;
            const baseFineAmount = grandTotalFine - serviceChargeAmount;

            // Use the base portion values directly from individual fields if in split mode
            // or calculate from total if in simple mode
            const totalEmpAmount = formData.paidBy === 'Company' ? 0 : (formData.paidBy === 'Employee' ? baseFineAmount : (parseFloat(formData.employeeAmount) || 0));
            const totalCompAmount = formData.paidBy === 'Employee' ? 0 : (formData.paidBy === 'Company' ? baseFineAmount : (parseFloat(formData.companyAmount) || 0));

            // Determine Company
            let commonCompanyId = selectedCompanyId;
            if (!commonCompanyId && selectedEmployees.length > 0) {
                const firstEmpFull = employees.find(e => e.employeeId === selectedEmployees[0].employeeId);
                commonCompanyId = firstEmpFull?.company?._id || firstEmpFull?.company;
            }

            const companyName = companies.find(c => (c._id || c.id) === selectedCompanyId)?.name || initialData?.companyName || '';
            const payload = {
                category: 'Damage',
                company: commonCompanyId,
                companyName: companyName || undefined,
                subCategory: 'Other Damage',
                fineType: 'Other Damage',
                assignedEmployees: selectedEmployees, responsibleFor: formData.paidBy,
                description: formData.description, companyDescription: formData.companyDescription,
                fineStatus: isResubmitting ? 'Pending' : (initialData?._id ? initialData.fineStatus : 'Draft'), isBulk: true, monthStart, 
                fineAmount: grandTotalFine,
                employeeAmount: totalEmpAmount,
                companyAmount: totalCompAmount,
                serviceCharge: serviceChargeAmount,
                employees: (() => {
                    // Service charge is divided equally among ALL parties
                    const totalPartiesCount = selectedEmployees.length + (formData.paidBy === 'Employee & Company' ? 1 : 0);
                    const scPerParty = totalPartiesCount > 0 ? (serviceChargeAmount / totalPartiesCount) : 0;
                    
                    const list = selectedEmployees.map(emp => {
                        // Individual base amount (without service charge)
                        const individualBaseAmount = parseFloat(emp.fineAmount) || 0;
                        // Individual total = base amount + service charge share
                        const individualTotal = individualBaseAmount + scPerParty;
                        
                        return {
                            employeeId: emp.employeeId,
                            employeeName: emp.employeeName,
                            fineAmount: individualTotal.toFixed(2), // Total includes service charge share
                            individualAmount: individualTotal.toFixed(2), // Include service charge share
                            employeeAmount: individualBaseAmount.toFixed(2), // Base employee amount
                            companyAmount: "0.00",
                            payableDuration: parseInt(payableDuration) || 1
                        };
                    });

                    // Add company share record if "Employee & Company"
                    if (formData.paidBy === 'Employee & Company') {
                        const individualCompBase = parseFloat(compAmt) || 0;
                        const individualTotal = individualCompBase + scPerParty;
                        
                        list.push({
                            employeeId: 'VEGA-HR-0000',
                            employeeName: 'Vega Digital IT Solutions',
                            fineAmount: individualTotal.toFixed(2),
                            individualAmount: individualTotal.toFixed(2),
                            employeeAmount: individualCompBase.toFixed(2),
                            companyAmount: "0.00",
                            payableDuration: 1
                        });
                    }
                    return list;
                })()
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
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Service Charge</label>
                            <input
                                type="number"
                                value={formData.serviceCharge}
                                onChange={(e) => setFormData(p => ({ ...p, serviceCharge: e.target.value }))}
                                placeholder="0.00"
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                            />
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
                        <label className="text-sm font-semibold">Assign Employee(s) <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Select
                                    options={availableEmployees.map(emp => ({
                                        value: emp.employeeId,
                                        label: `${emp.employeeId} - ${emp.firstName} ${emp.lastName}`
                                    }))}
                                    value={
                                        currentEmployeeId
                                            ? { 
                                                value: currentEmployeeId, 
                                                label: employees.find(e => e.employeeId === currentEmployeeId) 
                                                    ? `${currentEmployeeId} - ${employees.find(e => e.employeeId === currentEmployeeId).firstName} ${employees.find(e => e.employeeId === currentEmployeeId).lastName}` 
                                                    : currentEmployeeId 
                                            }
                                            : null
                                    }
                                    onChange={(selectedOption) => {
                                        setCurrentEmployeeId(selectedOption ? selectedOption.value : '');
                                        if (errors.selectedEmployees) setErrors(prev => ({ ...prev, selectedEmployees: '' }));
                                    }}
                                    placeholder="🔍 Select Employee..."
                                    isClearable
                                    isSearchable
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            height: '44px',
                                            minHeight: '44px',
                                            borderRadius: '0.75rem',
                                            borderColor: errors.selectedEmployees ? '#f87171' : '#e5e7eb',
                                            backgroundColor: '#f9fafb',
                                            boxShadow: 'none',
                                            '&:hover': { borderColor: '#cbd5e1' }
                                        }),
                                        menu: (base) => ({ ...base, zIndex: 50 })
                                    }}
                                />
                            </div>
                            <button type="button" onClick={handleAddEmployee} className="h-11 px-6 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-700 transition-colors shadow-sm">Add</button>
                        </div>
                        {errors.selectedEmployees && <p className="text-xs text-red-500">{errors.selectedEmployees}</p>}
                        {errors.amountMismatch && <p className="text-xs text-red-500 p-2 bg-red-50 rounded-lg">{errors.amountMismatch}</p>}
                    </div>

                    {/* Company Dropdown (Conditional) */}
                    {(formData.paidBy === 'Company' || formData.paidBy === 'Employee & Company') && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Select Company <span className="text-red-500">*</span></label>
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => {
                                    setSelectedCompanyId(e.target.value);
                                    if (errors.company) setErrors(prev => ({ ...prev, company: '' }));
                                }}
                                className={`w-full h-11 px-4 rounded-xl border ${errors.company ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                            >
                                <option value="">Select Company</option>
                                {companies.map(comp => (
                                    <option key={comp._id} value={comp._id}>{comp.name}</option>
                                ))}
                            </select>
                            {errors.company && <p className="text-xs text-red-500 ml-1">{errors.company}</p>}
                        </div>
                    )}

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

                    {/* Total Summary */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200 shadow-sm mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Summary</span>
                            <span className="text-xs text-gray-600 font-medium italic">
                                Total payable amount (Fine + Service Charge)
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-gray-900">
                                {(parseFloat(formData.deductionAmount || 0)).toLocaleString()}
                            </span>
                            <span className="text-[11px] font-bold text-gray-700 uppercase">AED</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-gray-200 font-medium">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-medium shadow-sm">
                            {submitting ? 'Saving...' : (initialData?._id ? 'Save Changes' : (isResubmitting ? 'Resubmit' : 'Save as Draft'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const ArrowBackSVG = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>);
