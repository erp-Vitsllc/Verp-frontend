'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, Users, Minus, Plus } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import Select from 'react-select';

export default function AddSafetyFineModal({ isOpen, onClose, onSuccess, employees = [], onBack, initialData, isResubmitting = false }) {
    const { toast } = useToast();
    const [totalFineAmount, setTotalFineAmount] = useState('');
    const [responsibleFor, setResponsibleFor] = useState('Employee');
    const [employeeAmount, setEmployeeAmount] = useState('');
    const [companyAmount, setCompanyAmount] = useState('');
    const [description, setDescription] = useState('');
    const [companyDescription, setCompanyDescription] = useState('');
    const [monthStart, setMonthStart] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
    const [payableDuration, setPayableDuration] = useState('1');
    const [selectedEmployees, setSelectedEmployees] = useState([]); // Array of employee objects { employeeId, employeeName, fineAmount, duration }
    const [serviceCharge, setServiceCharge] = useState('');
    const [formData, setFormData] = useState({
        attachment: null,
        attachmentBase64: '',
        attachmentName: '',
        attachmentMime: ''
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isManualEdit, setIsManualEdit] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const fileInputRef = useRef(null);


    // Populate data when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            // When editing, load the GRAND TOTAL fine amount
            setTotalFineAmount(String(initialData.fineAmount || ''));
            setResponsibleFor(initialData.responsibleFor || 'Employee');
            setEmployeeAmount(String(initialData.employeeAmount ?? ''));
            setCompanyAmount(String(initialData.companyAmount ?? ''));
            setServiceCharge(String(initialData.serviceCharge ?? ''));
            setDescription(initialData.description || '');
            setCompanyDescription(initialData.companyDescription || '');
            setMonthStart(initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7));
            setPayableDuration(String(initialData.payableDuration || '1'));

            // Handle attachment
            setFormData({
                attachment: null,
                attachmentBase64: '',
                attachmentName: initialData.attachment?.name || '',
                attachmentMime: ''
            });

            // Populate selectedEmployees
            // If editing, we reconstruct it as an array, filtering out the company share placeholder
            if (initialData.assignedEmployees && initialData.assignedEmployees.length > 0) {
                const realEmployees = initialData.assignedEmployees.filter(emp => emp.employeeId !== 'VEGA-HR-0000');
                setSelectedEmployees(realEmployees.map(emp => ({
                    employeeId: emp.employeeId,
                    employeeName: emp.employeeName || employees.find(e => e.employeeId === emp.employeeId)?.firstName || emp.employeeId,
                    // Use employeeAmount if available for the base individual amount, otherwise fallback to split the root employeeAmount
                    fineAmount: emp.employeeAmount || (initialData.employeeAmount ? (parseFloat(initialData.employeeAmount) / realEmployees.length).toFixed(2) : ((parseFloat(initialData.fineAmount) - parseFloat(initialData.serviceCharge || 0)) / realEmployees.length).toFixed(2)),
                    duration: emp.payableDuration || initialData.payableDuration || '1'
                })));
            } else if (initialData.employeeId && initialData.employeeId !== 'VEGA-HR-0000') {
                const empName = initialData.employeeName || employees.find(e => e.employeeId === initialData.employeeId)?.firstName || initialData.employeeId;
                setSelectedEmployees([{
                    employeeId: initialData.employeeId,
                    employeeName: empName,
                    fineAmount: initialData.employeeAmount || initialData.fineAmount || '0',
                    duration: initialData.payableDuration || '1'
                }]);
            }
        } else if (isOpen) {
            // Reset
            setTotalFineAmount('');
            setResponsibleFor('Employee');
            setEmployeeAmount('');
            setCompanyAmount('');
            setDescription('');
            setCompanyDescription('');
            setMonthStart(new Date().toISOString().split('T')[0].slice(0, 7));
            setPayableDuration('1');
            setServiceCharge('');
            setFormData({
                attachment: null, attachmentBase64: '', attachmentName: '', attachmentMime: ''
            });

        }
    }, [isOpen, initialData, employees]);

    // Fetch companies
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await axiosInstance.get('/Company');
                // The response might be { companies: [...] } or just [...]
                const data = response.data.companies || (Array.isArray(response.data) ? response.data : []);
                setCompanies(data);
                
                // If editing, set the selected company
                if (initialData?.company) {
                    setSelectedCompanyId(initialData.company._id || initialData.company);
                }
            } catch (error) {
                console.error("Error fetching companies:", error);
            }
        };
        if (isOpen) fetchCompanies();
    }, [isOpen, initialData]);

    // Filter out already selected employees for the dropdown
    // AND filter by company if selected
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

    // Recalculate fine amounts when total, responsible parties, or selected employees change
    useEffect(() => {
        if (initialData?._id) return; // Don't auto-recalc if in Edit mode to prevent overwriting custom values unless explicitly changed logic added

        const numEmps = selectedEmployees.length;
        if (numEmps === 0) return;

        let totalTarget = 0;
        if (responsibleFor === 'Employee') totalTarget = parseFloat(totalFineAmount) || 0;
        else if (responsibleFor === 'Employee & Company') totalTarget = parseFloat(employeeAmount) || 0;
        else totalTarget = 0; // Company only

        // Division Logic: Input is TOTAL amount
        const perEmpAmount = totalTarget / numEmps;

        setSelectedEmployees(prev => prev.map(emp => ({
            ...emp,
            fineAmount: perEmpAmount.toFixed(2),
            duration: payableDuration // Update duration when master changes
        })));
    }, [totalFineAmount, responsibleFor, employeeAmount, selectedEmployees.length, payableDuration]);

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

    const handleAddEmployee = (employeeId) => {
        if (!employeeId) return;
        const emp = employees.find(e => e.employeeId === employeeId);
        if (emp) {
            setSelectedEmployees(prev => [
                ...prev,
                {
                    employeeId: emp.employeeId,
                    employeeName: `${emp.firstName} ${emp.lastName}`,
                    fineAmount: '0.00',
                    duration: payableDuration // Use current global duration
                }
            ]);
        }
    };

    const handleRemoveEmployee = (employeeId) => {
        setSelectedEmployees(prev => prev.filter(e => e.employeeId !== employeeId));
        // Reset manual edit if no employees left
        if (selectedEmployees.length <= 1) setIsManualEdit(false);
    };

    const handleDurationChange = (employeeId, duration) => {
        setSelectedEmployees(prev => prev.map(e =>
            e.employeeId === employeeId ? { ...e, duration } : e
        ));
    };

    const handleAmountChange = (employeeId, amount) => {
        const serviceChargeValue = parseFloat(serviceCharge || 0);
        const grandTotal = parseFloat(totalFineAmount || 0);
        const baseTotal = grandTotal - serviceChargeValue;

        const totalTarget = (responsibleFor === 'Employee & Company')
            ? (parseFloat(employeeAmount) || 0)
            : baseTotal;

        setSelectedEmployees(prev => {
            const index = prev.findIndex(e => e.employeeId === employeeId);
            if (index === -1) return prev;

            // Sum all amounts before this one
            const sumBefore = prev.slice(0, index).reduce((acc, curr) => acc + (parseFloat(curr.fineAmount) || 0), 0);

            // New amount for the current employee
            const currentVal = parseFloat(amount) || 0;

            // Remaining amount to distribute to those BELOW
            const remaining = totalTarget - sumBefore - currentVal;
            const countBelow = prev.length - (index + 1);

            return prev.map((e, i) => {
                if (i < index) return e; // Keep previous as is
                if (i === index) return { ...e, fineAmount: amount };

                // Distribute remainder among those below
                const shareForBelow = countBelow > 0 ? (remaining / countBelow).toFixed(2) : e.fineAmount;
                return { ...e, fineAmount: shareForBelow };
            });
        });
    };

    const validateForm = () => {
        const newErrors = {};
        if (!totalFineAmount) newErrors.totalFineAmount = 'Total fine amount is required';
        if (!description || description.trim() === '') newErrors.description = 'Description is required';
        if (selectedEmployees.length === 0) {
            newErrors.employees = 'At least one employee must be selected';
        }

        const grandTotalInput = parseFloat(totalFineAmount) || 0;
        const scValue = parseFloat(serviceCharge || 0);
        const baseTotalAvailable = grandTotalInput - scValue;

        if (grandTotalInput > 0 && scValue >= grandTotalInput) {
            newErrors.serviceCharge = 'Service charge must be less than total fine amount';
        }

        const currentSelectedSum = selectedEmployees.reduce((sum, emp) => sum + (parseFloat(emp.fineAmount) || 0), 0);
        
        if (responsibleFor === 'Employee') {
            const expectedTotal = baseTotalAvailable;
            if (Math.abs(currentSelectedSum - expectedTotal) > 0.05) {
                newErrors.amountMismatch = `Sum of individual fines (AED ${currentSelectedSum.toFixed(2)}) must equal base fine amount (AED ${expectedTotal.toFixed(2)})`;
            }
        } else if (responsibleFor === 'Employee & Company') {
            if (!employeeAmount) newErrors.employeeAmount = 'Employee amount is required';
            if (!companyAmount) newErrors.companyAmount = 'Company amount is required';

            const empTarget = parseFloat(employeeAmount) || 0;
            const compTarget = parseFloat(companyAmount) || 0;

            if (Math.abs(baseTotalAvailable - (empTarget + compTarget)) > 0.01) {
                newErrors.employeeAmount = `Portions sum (AED ${(empTarget + compTarget).toFixed(2)}) must equal base amount (Total - Service Charge = AED ${baseTotalAvailable.toFixed(2)})`;
            }
        }

        if ((responsibleFor === 'Company' || responsibleFor === 'Employee & Company') && !selectedCompanyId) {
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

            const serviceChargeAmount = parseFloat(serviceCharge) || 0;
            const grandTotalFine = parseFloat(totalFineAmount) || 0;
            const baseFineAmount = grandTotalFine - serviceChargeAmount;

            let totalEmpAmount = 0;
            let totalCompAmount = 0;

            if (responsibleFor === 'Employee') {
                totalEmpAmount = baseFineAmount;
            } else if (responsibleFor === 'Company') {
                totalCompAmount = baseFineAmount;
            } else if (responsibleFor === 'Employee & Company') {
                totalEmpAmount = parseFloat(employeeAmount) || 0;
                totalCompAmount = parseFloat(companyAmount) || 0;
            }

            // Determine Company: Use selectedCompanyId if available
            let commonCompanyId = selectedCompanyId;
            if (!commonCompanyId && selectedEmployees.length > 0) {
                const firstEmpFull = employees.find(e => e.employeeId === selectedEmployees[0].employeeId);
                commonCompanyId = firstEmpFull?.company?._id || firstEmpFull?.company;
            }

            const companyDisplayName = companies.find(c => (c._id || c.id) === selectedCompanyId)?.name || initialData?.companyName || '';
            const commonData = {
                category: 'Violation',
                company: commonCompanyId,
                companyName: companyDisplayName,
                subCategory: 'Safety Fine',
                fineType: 'Safety Fine',
                responsibleFor: responsibleFor,
                description: description,
                companyDescription: companyDescription,
                fineStatus: isResubmitting ? 'Pending' : (initialData?._id ? initialData.fineStatus : 'Draft'),
                isBulk: true,
                monthStart: monthStart,
                fineAmount: grandTotalFine, // Total including service charge
                employeeAmount: totalEmpAmount,
                companyAmount: totalCompAmount,
                serviceCharge: serviceChargeAmount
            };

            // Prepare employees array with specific amounts
            let totalPartiesCount = selectedEmployees.length;
            if (responsibleFor === 'Employee & Company' || responsibleFor === 'Company') {
                totalPartiesCount += 1;
            }
            const scPerParty = totalPartiesCount > 0 ? (serviceChargeAmount / totalPartiesCount) : 0;
            
            const employeesPayload = [];
            
            // Add employees if not Company-only
            if (responsibleFor !== 'Company') {
                selectedEmployees.forEach(emp => {
                    const individualEmpAmount = parseFloat(emp.fineAmount) || 0;
                    const individualTotal = individualEmpAmount + scPerParty;

                    employeesPayload.push({
                        employeeId: emp.employeeId,
                        employeeName: emp.employeeName,
                        fineAmount: individualTotal.toFixed(2),
                        individualAmount: individualTotal.toFixed(2),
                        employeeAmount: individualEmpAmount.toFixed(2),
                        companyAmount: "0.00",
                        payableDuration: parseInt(emp.duration) || 1
                    });
                });
            }

            // Add company share record if Company is involved
            if (responsibleFor === 'Employee & Company' || responsibleFor === 'Company') {
                const individualCompBase = (responsibleFor === 'Company' ? baseFineFromInput : parseFloat(companyAmount) || 0);
                const individualTotal = individualCompBase + scPerParty;
                
                employeesPayload.push({
                    employeeId: 'VEGA-HR-0000',
                    employeeName: companyDisplayName || 'Vega Digital IT Solutions',
                    fineAmount: individualTotal.toFixed(2),
                    individualAmount: individualTotal.toFixed(2),
                    employeeAmount: individualCompBase.toFixed(2),
                    companyAmount: "0.00",
                    payableDuration: 1
                });
            }

            if (formData.attachmentBase64) {
                commonData.attachment = {
                    data: formData.attachmentBase64,
                    name: formData.attachmentName,
                    mimeType: formData.attachmentMime
                };
            }

            const payload = {
                ...commonData,
                employees: employeesPayload
            };

            if (initialData?._id) {
                if (isResubmitting) {
                    payload.fineStatus = 'Pending';
                    payload.resubmit = true;
                }
                await axiosInstance.put(`/Fine/${initialData._id}`, payload);
                toast({ title: "Success", description: "Safety fine updated successfully" });
            } else {
                await axiosInstance.post('/Fine', payload);
                toast({ title: "Success", description: "Safety fine submitted successfully" });
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Submission error:", error);
            const msg = error.response?.data?.message || "Submission failed";
            toast({ variant: "destructive", title: "Error", description: msg });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[850px] max-h-[90vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors mr-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">
                            {isResubmitting ? 'Resubmit Safety Fine' : (initialData?._id ? 'Edit Safety Fine' : 'Add Safety Fine')}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Total Fine Amount */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Total Fine Amount <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                value={totalFineAmount}
                                onChange={(e) => {
                                    setTotalFineAmount(e.target.value);
                                    if (errors.totalFineAmount) setErrors(prev => ({ ...prev, totalFineAmount: '' }));
                                }}
                                placeholder="0.00"
                                className={`w-full h-11 px-4 rounded-xl border ${errors.totalFineAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20`}
                            />
                            {errors.totalFineAmount && <p className="text-xs text-red-500 ml-1">{errors.totalFineAmount}</p>}
                        </div>

                        {/* Service Charge */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Service Charge</label>
                            <input
                                type="number"
                                value={serviceCharge}
                                onChange={(e) => setServiceCharge(e.target.value)}
                                placeholder="0.00"
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        {/* Responsible For */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Responsible For</label>
                            <select
                                value={responsibleFor}
                                onChange={(e) => setResponsibleFor(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="Employee">Employee</option>
                                <option value="Company">Company</option>
                                <option value="Employee & Company">Employee & Company</option>
                            </select>
                        </div>

                        {/* Split Amounts */}
                        {responsibleFor === 'Employee & Company' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Employee Portion <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        value={employeeAmount}
                                        onChange={(e) => setEmployeeAmount(e.target.value)}
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.employeeAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Company Portion <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        value={companyAmount}
                                        onChange={(e) => setCompanyAmount(e.target.value)}
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.companyAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Participant table etc remains same... */}
                    {/* ... (rest of the file) */}

                    {/* Company Dropdown (Conditional) */}
                    {(responsibleFor === 'Company' || responsibleFor === 'Employee & Company') && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Select Company <span className="text-red-500">*</span></label>
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

                    {/* Company Description - Conditional */}
                    {(responsibleFor === 'Company' || responsibleFor === 'Employee & Company') && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Company Description</label>
                            <textarea
                                value={companyDescription}
                                onChange={(e) => setCompanyDescription(e.target.value)}
                                placeholder="Explain why the company is bearing this cost..."
                                className="w-full h-24 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
                            />
                        </div>
                    )}

                    {/* Fine Description */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Fine Description <span className="text-red-500">*</span></label>
                        <textarea
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                            }}
                            placeholder="Provide details about the safety violation..."
                            className={`w-full h-24 px-4 py-3 rounded-xl border ${errors.description ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none transition-all`}
                        />
                        {errors.description && <p className="text-xs text-red-500 ml-1">{errors.description}</p>}
                    </div>

                    {/* Document Upload */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Document (Fine report upload)</label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                            <Upload className="text-gray-400 mb-2" size={24} />
                            <span className="text-sm text-gray-500">
                                {formData.attachment ? formData.attachmentName : 'Click to upload supporting report'}
                            </span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Payable Duration */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Fine Payable Duration</label>
                            <select
                                value={payableDuration}
                                onChange={(e) => setPayableDuration(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20"
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

                    {/* Add Employees Dropdown */}
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <Users size={18} className="text-blue-500" />
                                Assigned Employees
                            </label>
                            <div className="w-64">
                                <Select
                                    options={availableEmployees.map(emp => ({
                                        value: emp.employeeId,
                                        label: `${emp.employeeId} - ${emp.firstName} ${emp.lastName}`
                                    }))}
                                    value={null}
                                    onChange={(selectedOption) => {
                                        if (selectedOption) {
                                            handleAddEmployee(selectedOption.value);
                                        }
                                    }}
                                    placeholder="🔍 + Add Employee"
                                    isSearchable
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            height: '40px',
                                            minHeight: '40px',
                                            borderRadius: '0.5rem',
                                            borderColor: '#e5e7eb',
                                            backgroundColor: '#ffffff',
                                            boxShadow: 'none',
                                            '&:hover': { borderColor: '#cbd5e1' }
                                        }),
                                        menu: (base) => ({ ...base, zIndex: 50 })
                                    }}
                                />
                            </div>
                        </div>
                        {errors.employees && <p className="text-xs text-red-500 ml-1">{errors.employees}</p>}

                        {/* Employees Table */}
                        {selectedEmployees.length > 0 && (
                            <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50/50">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="px-4 py-3 font-semibold text-gray-700">Employee Name</th>
                                            <th className="px-4 py-3 font-semibold text-gray-700 text-center">Fine Amount (AED)</th>
                                            <th className="px-4 py-3 font-semibold text-gray-700 text-center">Duration</th>
                                            <th className="px-4 py-3 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 relative">
                                        {selectedEmployees.map((emp) => (
                                            <tr key={emp.employeeId} className="bg-white hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-4 font-medium text-gray-900 border-r border-gray-100">
                                                    {emp.employeeId} - {emp.employeeName}
                                                </td>
                                                <td className="px-4 py-4 text-center border-r border-gray-100">
                                                    <input
                                                        type="number"
                                                        value={emp.fineAmount}
                                                        onChange={(e) => handleAmountChange(emp.employeeId, e.target.value)}
                                                        className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 bg-white font-bold text-red-700 text-center outline-none focus:ring-2 focus:ring-red-500/20"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-center border-r border-gray-100">
                                                    <div className="inline-flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 p-1">
                                                        <input
                                                            type="number"
                                                            value={emp.duration}
                                                            onChange={(e) => handleDurationChange(emp.employeeId, e.target.value)}
                                                            className="w-12 text-center bg-transparent outline-none font-semibold text-gray-700"
                                                            min="1"
                                                            max="6"
                                                        />
                                                        <span className="text-[10px] text-gray-400 font-medium pr-1 uppercase">mos</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveEmployee(emp.employeeId)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

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
                                {(parseFloat(totalFineAmount || 0)).toLocaleString()}
                            </span>
                            <span className="text-[11px] font-bold text-blue-700 uppercase">AED</span>
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
                            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {submitting ? 'Saving...' : (initialData?._id ? 'Save Changes' : (isResubmitting ? 'Resubmit' : 'Save as Draft'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
