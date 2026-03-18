'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import Select from 'react-select';

export default function AddProjectDamageModal({ isOpen, onClose, onSuccess, employees = [], onBack, initialData, isResubmitting = false }) {
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        serviceCharge: '',
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
        attachmentMime: '',
        companyDescription: ''
    });

    const [assignedEmployees, setAssignedEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [daysWorked, setDaysWorked] = useState('');
    const [payableDuration, setPayableDuration] = useState('1');
    const [monthStart, setMonthStart] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
    const [searchQuery, setSearchQuery] = useState('');
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const fileInputRef = useRef(null);


    const filteredEmployees = useMemo(() => {
        const selectedIds = assignedEmployees.map(emp => emp.employeeId);
        let base = employees.filter(emp => !selectedIds.includes(emp.employeeId));
        if (searchQuery) {
            base = base.filter(e => 
                (e.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                (e.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                (e.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return base;
    }, [employees, assignedEmployees, searchQuery]);

    // Populate data when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                projectId: initialData.projectId || '',
                projectName: initialData.projectName || '',
                engineerName: initialData.engineerName || '',
                // When editing, load the GRAND TOTAL deduction amount
                deductionAmount: String(initialData.fineAmount || ''),
                reason: initialData.description || '',
                finePaidBy: initialData.responsibleFor || 'Employee',
                employeeDeductionAmount: String(initialData.employeeAmount ?? ''),
                companyFineAmount: String(initialData.companyAmount ?? ''),
                companyDescription: initialData.companyDescription || '',
                attachment: null,
                attachmentBase64: '',
                attachmentName: initialData.attachment?.name || '',
                attachmentMime: '',
                serviceCharge: String(initialData.serviceCharge || '')
            });
            setMonthStart(initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7));
            setPayableDuration(String(initialData.payableDuration || '1'));

            // Populate assignedEmployees
            let emps = [];
            if (initialData.assignedEmployees && initialData.assignedEmployees.length > 0) {
                // Filter out company record from the table view
                const realEmployees = initialData.assignedEmployees.filter(emp => emp.employeeId !== 'VEGA-HR-0000');
                emps = realEmployees.map(emp => ({
                    employeeId: emp.employeeId,
                    employeeName: emp.employeeName || employees.find(e => e.employeeId === emp.employeeId)?.firstName || emp.employeeId,
                    daysWorked: emp.daysWorked || '0',
                    deductionAmount: emp.employeeAmount ?? emp.fineAmount ?? emp.individualAmount ?? emp.deductionAmount ?? (initialData.employeeAmount ? (parseFloat(initialData.employeeAmount) / realEmployees.length).toFixed(2) : (parseFloat(initialData.fineAmount) / realEmployees.length).toFixed(2)),
                    duration: emp.payableDuration || initialData.payableDuration || '1'
                }));
            } else if (initialData.employeeId && initialData.employeeId !== 'VEGA-HR-0000') {
                const empName = initialData.employeeName || employees.find(e => e.employeeId === initialData.employeeId)?.firstName || initialData.employeeId;
                emps = [{
                    employeeId: initialData.employeeId,
                    employeeName: empName,
                    daysWorked: '0',
                    deductionAmount: initialData.fineAmount || '0',
                    duration: initialData.payableDuration || '1'
                }];
            }
            setAssignedEmployees(emps);

        } else if (isOpen) {
            setFormData({
                projectId: '', projectName: '', engineerName: '', deductionAmount: '',
                reason: '', finePaidBy: 'Employee', employeeDeductionAmount: '', companyFineAmount: '',
                attachment: null, attachmentBase64: '', attachmentName: '', attachmentMime: '', companyDescription: '',
                serviceCharge: ''
            });
            setAssignedEmployees([]);
            setSelectedEmployeeId('');
            setDaysWorked('');
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

        const count = assignedEmployees.length;
        if (count === 0) return;

        let totalEmployeeAmount = 0;
        if (formData.finePaidBy === 'Employee') {
            totalEmployeeAmount = parseFloat(formData.deductionAmount) || 0;
        } else if (formData.finePaidBy === 'Employee & Company') {
            totalEmployeeAmount = parseFloat(formData.employeeDeductionAmount) || 0;
        }

        const share = totalEmployeeAmount / count;

        setAssignedEmployees(prev => prev.map(emp => ({
            ...emp,
            fineAmount: share.toFixed(2)
        })));
    }, [formData.deductionAmount, formData.employeeDeductionAmount, formData.finePaidBy, assignedEmployees.length, initialData?._id]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

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

        const employee = employees.find(e => e.employeeId === selectedEmployeeId);
        if (employee) {
            const empCompanyId = employee.company?._id || employee.company;

            setAssignedEmployees(prev => [...prev, {
                employeeId: employee.employeeId,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                daysWorked: parseInt(daysWorked),
                fineAmount: '0.00'
            }]);
            setSelectedEmployeeId('');
            setDaysWorked('');
        }
    };

    const handleRemoveEmployee = (employeeId) => {
        setAssignedEmployees(prev => prev.filter(emp => emp.employeeId !== employeeId));
    };

    const handleAmountChange = (employeeId, amount) => {
        let totalTarget = 0;
        if (formData.finePaidBy === 'Employee') {
            totalTarget = parseFloat(formData.deductionAmount) || 0;
        } else if (formData.finePaidBy === 'Employee & Company') {
            totalTarget = parseFloat(formData.employeeDeductionAmount) || 0;
        }

        setAssignedEmployees(prev => {
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

        if (!formData.projectId) newErrors.projectId = 'Project is required';
        if (!formData.deductionAmount) newErrors.deductionAmount = 'Deduction amount is required';
        if (!formData.reason) newErrors.reason = 'Reason is required';
        if (assignedEmployees.length === 0) newErrors.assignedEmployees = 'At least one employee must be assigned';

        // Same company validation removed per user request

        const totalInput = parseFloat(formData.deductionAmount) || 0;
        const currentSelectedSum = assignedEmployees.reduce((sum, emp) => sum + (parseFloat(emp.fineAmount) || 0), 0);

        if (formData.finePaidBy === 'Employee') {
            if (Math.abs(currentSelectedSum - totalInput) > 0.05) {
                newErrors.amountMismatch = `Sum of individual fines (AED ${currentSelectedSum.toFixed(2)}) must equal total deduction amount (AED ${totalInput.toFixed(2)})`;
            }
        } else if (formData.finePaidBy === 'Employee & Company') {
            if (!formData.employeeDeductionAmount) newErrors.employeeDeductionAmount = 'Employee deduction amount is required';
            if (!formData.companyFineAmount) newErrors.companyFineAmount = 'Company fine amount is required';

            const empTarget = parseFloat(formData.employeeDeductionAmount) || 0;
            const compTarget = parseFloat(formData.companyFineAmount) || 0;
            const serviceChargeAmount = parseFloat(formData.serviceCharge) || 0;

            // Single validation: Total Fine Amount must equal Service Charge + Employee Portion + Company Portion
            const expectedTotal = serviceChargeAmount + empTarget + compTarget;
            if (Math.abs(totalInput - expectedTotal) > 0.01) {
                newErrors.deductionAmount = `Total deduction amount (AED ${totalInput.toFixed(2)}) must equal service charge (AED ${serviceChargeAmount.toFixed(2)}) + employee portion (AED ${empTarget.toFixed(2)}) + company portion (AED ${compTarget.toFixed(2)}) = AED ${expectedTotal.toFixed(2)}`;
            }
        }

        if ((formData.finePaidBy === 'Company' || formData.finePaidBy === 'Employee & Company') && !selectedCompanyId) {
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
            const totalEmpAmount = formData.finePaidBy === 'Company' ? 0 : (formData.finePaidBy === 'Employee' ? baseFineAmount : (parseFloat(formData.employeeDeductionAmount) || 0));
            const totalCompAmount = formData.finePaidBy === 'Employee' ? 0 : (formData.finePaidBy === 'Company' ? baseFineAmount : (parseFloat(formData.companyFineAmount) || 0));

            // Determine Company
            let commonCompanyId = selectedCompanyId;
            if (!commonCompanyId && assignedEmployees.length > 0) {
                const firstEmpFull = employees.find(e => e.employeeId === assignedEmployees[0].employeeId);
                commonCompanyId = firstEmpFull?.company?._id || firstEmpFull?.company;
            }

            const commonData = {
                category: 'Damage',
                company: commonCompanyId,
                subCategory: 'Project Damage',
                fineType: 'Project Damage',
                projectId: formData.projectId || null,
                projectName: formData.projectName || 'N/A',
                engineerName: formData.engineerName || 'N/A',
                assignedEmployees: assignedEmployees,
                responsibleFor: formData.finePaidBy,
                description: formData.reason,
                companyDescription: formData.companyDescription,
                fineStatus: isResubmitting ? 'Pending' : (initialData?._id ? initialData.fineStatus : 'Draft'),
                isBulk: true,
                monthStart: monthStart,
                serviceCharge: serviceChargeAmount,
                fineAmount: grandTotalFine,
                employeeAmount: totalEmpAmount,
                companyAmount: totalCompAmount
            };

            // Service charge is divided equally among ALL parties
            const totalPartiesCount = assignedEmployees.length + (formData.finePaidBy === 'Employee & Company' ? 1 : 0);
            const scPerParty = totalPartiesCount > 0 ? (serviceChargeAmount / totalPartiesCount) : 0;
            
            const employeesPayload = assignedEmployees.map(emp => {
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
            if (formData.finePaidBy === 'Employee & Company') {
                const individualCompBase = parseFloat(companyAmount) || 0;
                const individualTotal = individualCompBase + scPerParty;
                
                employeesPayload.push({
                    employeeId: 'VEGA-HR-0000',
                    employeeName: 'Vega Digital IT Solutions',
                    fineAmount: individualTotal.toFixed(2),
                    individualAmount: individualTotal.toFixed(2),
                    employeeAmount: individualCompBase.toFixed(2),
                    companyAmount: "0.00",
                    payableDuration: 1
                });
            }

            const payload = { ...commonData, employees: employeesPayload };
            if (formData.attachmentBase64) {
                payload.attachment = {
                    data: formData.attachmentBase64,
                    name: formData.attachmentName,
                    mimeType: formData.attachmentMime
                };
            }

            if (initialData?._id) {
                if (isResubmitting) { payload.fineStatus = 'Pending'; payload.resubmit = true; }
                await axiosInstance.put(`/Fine/${initialData._id}`, payload);
                toast({ title: "Success", description: "Project fine updated successfully" });
            } else {
                await axiosInstance.post('/Fine', payload);
                toast({ title: "Success", description: "Project damage submitted for approval" });
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error.response?.data?.message || "Submission failed" });
        } finally {
            setSubmitting(false);
        }
    };

    const PROJECTS = [
        { id: 'P001', name: 'Skyline Tower Construction', engineer: 'Eng. Ahmed Al-Mansouri' },
        { id: 'P002', name: 'Palm Jumeirah Villa Renovation', engineer: 'Eng. Sarah Jenkins' },
        { id: 'P003', name: 'Downtown Metro Extension', engineer: 'Eng. Mohammed Fayed' },
        { id: 'P004', name: 'Desert Solar Park Phase 2', engineer: 'Eng. Rajesh Kumar' }
    ];

    const handleProjectChange = (e) => {
        const projectId = e.target.value;
        const project = PROJECTS.find(p => p.id === projectId);
        setFormData(prev => ({ ...prev, projectId, projectName: project ? project.name : '', engineerName: project ? project.engineer : '' }));
        if (errors.projectId) setErrors(prev => ({ ...prev, projectId: '' }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[800px] h-[90vh] p-6 md:p-8 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors mr-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">
                            {isResubmitting ? 'Resubmit Project Damage' : (initialData?._id ? 'Edit Project Damage' : 'Add Project Damage')}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Project <span className="text-red-500">*</span></label>
                            <select value={formData.projectId} onChange={handleProjectChange} className={`w-full h-11 px-4 rounded-xl border ${errors.projectId ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500/20`}>
                                <option value="">Select Project</option>
                                {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            {errors.amountMismatch && <p className="text-xs text-red-500 p-2 bg-red-50 rounded-lg">{errors.amountMismatch}</p>}
                        </div>

                    {/* Company Dropdown (Conditional) */}
                    {(formData.finePaidBy === 'Company' || formData.finePaidBy === 'Employee & Company') && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Select Company <span className="text-red-500">*</span></label>
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => {
                                    setSelectedCompanyId(e.target.value);
                                    if (errors.company) setErrors(prev => ({ ...prev, company: '' }));
                                }}
                                className={`w-full h-11 px-4 rounded-xl border ${errors.company ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all`}
                            >
                                <option value="">Select Company</option>
                                {companies.map(comp => (
                                    <option key={comp._id} value={comp._id}>{comp.name}</option>
                                ))}
                            </select>
                            {errors.company && <p className="text-xs text-red-500 ml-1">{errors.company}</p>}
                        </div>
                    )}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Engineer Name</label>
                            <input type="text" value={formData.engineerName} readOnly className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Deduction Amount (Total) <span className="text-red-500">*</span></label>
                            <input type="number" value={formData.deductionAmount} onChange={(e) => setFormData(prev => ({ ...prev, deductionAmount: e.target.value }))} className={`w-full h-11 px-4 rounded-xl border ${errors.deductionAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`} />
                            {errors.deductionAmount && <p className="text-xs text-red-500 ml-1">{errors.deductionAmount}</p>}
                        </div>


                        <div className="space-y-1.5 ">
                            <label className="text-sm font-medium text-gray-700">Service Charge</label>
                            <input
                                type="number"
                                value={formData.serviceCharge}
                                onChange={(e) => setFormData(p => ({ ...p, serviceCharge: e.target.value }))}
                                placeholder="0.00"
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Fine Paid By</label>

                            <select value={formData.finePaidBy} onChange={(e) => setFormData(prev => ({ ...prev, finePaidBy: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none">
                                <option value="Employee">Employee</option><option value="Company">Company</option><option value="Employee & Company">Employee & Company</option>
                            </select>
                        </div>
                    </div>

                    {formData.finePaidBy === 'Employee & Company' && (
                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Employee Portion</label>
                                <input type="number" value={formData.employeeDeductionAmount} onChange={(e) => setFormData(prev => ({ ...prev, employeeDeductionAmount: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Company Portion</label>
                                <input type="number" value={formData.companyFineAmount} onChange={(e) => setFormData(prev => ({ ...prev, companyFineAmount: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none" />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Fine Payable Duration</label>
                            <select value={payableDuration} onChange={(e) => setPayableDuration(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none">
                                {[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Month Start</label>
                            <MonthYearPicker value={monthStart ? `${monthStart}-01` : undefined} onChange={(d) => d && setMonthStart(d.slice(0, 7))} className="w-full bg-gray-50" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Reason <span className="text-red-500">*</span></label>
                        <textarea value={formData.reason} onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))} rows={2} className={`w-full px-4 py-3 rounded-xl border ${errors.reason ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none resize-none`} />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-800">Assign Employees</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                                <Select
                                    options={employees.map(emp => ({
                                        value: emp.employeeId,
                                        label: `${emp.employeeId} - ${emp.firstName} ${emp.lastName}`
                                    }))}
                                    value={
                                        selectedEmployeeId
                                            ? { 
                                                value: selectedEmployeeId, 
                                                label: employees.find(e => e.employeeId === selectedEmployeeId) 
                                                    ? `${selectedEmployeeId} - ${employees.find(e => e.employeeId === selectedEmployeeId).firstName} ${employees.find(e => e.employeeId === selectedEmployeeId).lastName}` 
                                                    : selectedEmployeeId 
                                            }
                                            : null
                                    }
                                    onChange={(selectedOption) => {
                                        setSelectedEmployeeId(selectedOption ? selectedOption.value : '');
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
                                            borderColor: '#e5e7eb',
                                            backgroundColor: '#f9fafb',
                                            boxShadow: 'none',
                                            '&:hover': { borderColor: '#cbd5e1' }
                                        }),
                                        menu: (base) => ({ ...base, zIndex: 50 })
                                    }}
                                />
                            </div>
                            <input type="number" value={daysWorked} onChange={(e) => setDaysWorked(e.target.value)} placeholder="Days" className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none" />
                        </div>
                        <button type="button" onClick={handleAddEmployee} className="w-full h-11 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"><Plus size={18} /> Add Employee</button>

                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {assignedEmployees.map((emp) => (
                                <div key={emp.employeeId} className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-100">
                                    <div className="flex flex-col"><span className="text-sm font-semibold">{emp.employeeName}</span><span className="text-[10px] text-gray-400">{emp.employeeId} | {emp.daysWorked} days</span></div>
                                    <div className="flex items-center gap-3">
                                        <input type="number" value={emp.fineAmount} onChange={(e) => handleAmountChange(emp.employeeId, e.target.value)} className="w-20 px-2 py-1 rounded border border-purple-200 text-right outline-none text-sm font-bold" />
                                        <button type="button" onClick={() => handleRemoveEmployee(emp.employeeId)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Total Summary */}
                    <div className="flex items-center justify-between p-4 bg-purple-50/50 rounded-2xl border border-purple-100 shadow-sm mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-0.5">Summary</span>
                            <span className="text-xs text-purple-600 font-medium italic">
                                Total payable amount (Fine + Service Charge)
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-purple-900">
                                {(parseFloat(formData.deductionAmount || 0)).toLocaleString()}
                            </span>
                            <span className="text-[11px] font-bold text-purple-700 uppercase">AED</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50">
                            {submitting ? 'Saving...' : (initialData?._id ? 'Save Changes' : (isResubmitting ? 'Resubmit' : 'Save as Draft'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
