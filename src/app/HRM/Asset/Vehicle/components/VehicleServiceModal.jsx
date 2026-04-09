'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Save, Settings, DollarSign, FileText, AlignLeft, Paperclip } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

const input = (err) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm font-semibold outline-none transition-all focus:ring-4 focus:ring-teal-500/10 ${err ? 'border-red-300' : 'border-gray-200 focus:border-[#00B5AD]'
    }`;

export default function VehicleServiceModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    presetServiceType = '',
    assignedEmployee = null
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const initialDate = new Date().toISOString().slice(0, 10);
    const [formData, setFormData] = useState({
        serviceType: presetServiceType || '',
        oilServiceTypeText: '',
        date: initialDate,
        amountMode: 'amount', // amount | warranty
        liableOn: 'company', // company | person
        liablePersonId: '',
        serviceIssue: '',
        value: '',
        tireNumber: '',
        currentKm: '',
        nextChangeKm: '',
        nextChangeMonth: '',
        accidentDate: '',
        policyReportDate: '',
        accidentOwner: '',
        accidentStatus: 'Active',
        insuranceApprovalStatus: '',
        attachmentName: '',
        attachmentBase64: '',
        attachmentMime: '',
        invoiceName: '',
        invoiceBase64: '',
        invoiceMime: '',
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            setFormData({
                serviceType: presetServiceType || '',
                oilServiceTypeText: '',
                date: new Date().toISOString().slice(0, 10),
                amountMode: 'amount',
                liableOn: 'company',
                liablePersonId: assignedEmployee?._id ? String(assignedEmployee._id) : '',
                serviceIssue: '',
                value: '',
                tireNumber: '',
                currentKm: '',
                nextChangeKm: '',
                nextChangeMonth: '',
                accidentDate: '',
                policyReportDate: '',
                accidentOwner: '',
                accidentStatus: 'Active',
                insuranceApprovalStatus: '',
                attachmentName: '',
                attachmentBase64: '',
                attachmentMime: '',
                invoiceName: '',
                invoiceBase64: '',
                invoiceMime: '',
            });
            setErrors({});
        }
    }, [isOpen, presetServiceType, assignedEmployee]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const response = await axiosInstance.get('/employee');
                if (!cancelled) setEmployees(response.data?.employees || []);
            } catch {
                if (!cancelled) setEmployees([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
    const isOilService = formData.serviceType === 'Oil Service';
    const isTireChange = formData.serviceType === 'Tire Change';
    const isMechanicalWork = formData.serviceType === 'Mechanical Work';
    const isBodyWork = formData.serviceType === 'Body Work';
    const isAccidentRepair = formData.serviceType === 'Accident Repair';
    const isCarWash = formData.serviceType === 'Car Wash';
    const requiresKmSchedule = isOilService || isTireChange || isCarWash;
    const requiresCurrentKmOnly = isMechanicalWork || isBodyWork;

    const licensedEmployees = useMemo(() => {
        const hasLicense = (emp) =>
            Boolean(
                emp?.drivingLicenceDetails?.number ||
                emp?.drivingLicenseDetails?.number ||
                emp?.drivingLicenceNo ||
                emp?.drivingLicenseNo
            );
        return (employees || []).filter(hasLicense);
    }, [employees]);

    const handleFileChange = (e, kind = 'attachment') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            if (kind === 'invoice') {
                setFormData(prev => ({
                    ...prev,
                    invoiceName: file.name,
                    invoiceBase64: base64,
                    invoiceMime: file.type || 'application/pdf'
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    attachmentName: file.name,
                    attachmentBase64: base64,
                    attachmentMime: file.type || 'application/pdf'
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    const validate = () => {
        const e = {};
        if (!formData.serviceType) e.serviceType = 'Service type is required';
        if (isOilService && !formData.oilServiceTypeText.trim()) e.oilServiceTypeText = 'Oil service type is required';
        if (!formData.date) e.date = 'Date is required';
        if (!formData.serviceIssue) e.serviceIssue = 'Service issue is required';
        if (formData.amountMode === 'amount' && !formData.value) e.value = 'Amount is required';
        if (isTireChange && !formData.tireNumber) e.tireNumber = 'Number is required';
        if (requiresCurrentKmOnly && !formData.currentKm) e.currentKm = 'Current KM is required';
        if ((isMechanicalWork || isBodyWork) && formData.liableOn === 'person' && !formData.liablePersonId) {
            e.liablePersonId = 'Please select the liable person';
        }
        if (requiresKmSchedule) {
            if (!formData.currentKm) e.currentKm = 'Current KM is required';
            if (!formData.nextChangeKm) e.nextChangeKm = 'Next change KM is required';
            if (!formData.nextChangeMonth) e.nextChangeMonth = 'Next change month is required';
        }
        if (isAccidentRepair) {
            if (!formData.accidentDate) e.accidentDate = 'Accident date is required';
            if (!formData.policyReportDate) e.policyReportDate = 'Policy report date is required';
            if (!formData.accidentOwner) e.accidentOwner = 'Accident owner is required';
            if (!formData.accidentStatus) e.accidentStatus = 'Accident status is required';
            if (formData.accidentStatus === 'Active' && !formData.insuranceApprovalStatus) {
                e.insuranceApprovalStatus = 'Insurance approval status is required when accident is active';
            }
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            const extraMeta = (isOilService || isTireChange || isCarWash)
                ? {
                    serviceSubtype: formData.serviceType,
                    oilServiceTypeText: isOilService ? formData.oilServiceTypeText.trim() : undefined,
                    amountMode: formData.amountMode,
                    tireNumber: isTireChange ? Number(formData.tireNumber || 0) : undefined,
                    currentKm: Number(formData.currentKm || 0),
                    nextChangeKm: Number(formData.nextChangeKm || 0),
                    nextChangeMonth: formData.nextChangeMonth
                }
                : null;
            const mechanicalMeta = isMechanicalWork
                ? {
                    amountMode: formData.amountMode,
                    currentKm: Number(formData.currentKm || 0),
                    liableOn: formData.liableOn,
                    liablePersonId: formData.liableOn === 'person' ? formData.liablePersonId : '',
                    attachmentName: formData.attachmentName || ''
                }
                : null;
            const bodyWorkMeta = isBodyWork
                ? {
                    amountMode: formData.amountMode,
                    currentKm: Number(formData.currentKm || 0),
                    liableOn: formData.liableOn,
                    liablePersonId: formData.liableOn === 'person' ? formData.liablePersonId : '',
                    attachmentName: formData.attachmentName || ''
                }
                : null;
            const accidentMeta = isAccidentRepair
                ? {
                    accidentDate: formData.accidentDate,
                    policyReportDate: formData.policyReportDate,
                    accidentOwner: formData.accidentOwner,
                    accidentStatus: formData.accidentStatus,
                    insuranceApprovalStatus:
                        formData.accidentStatus === 'Active' ? formData.insuranceApprovalStatus : '',
                    attachmentName: formData.attachmentName || ''
                }
                : null;

            await axiosInstance.post(`/AssetItem/${assetId}/service`, {
                serviceType: formData.serviceType,
                date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
                description: formData.serviceIssue,
                currentKm: (requiresKmSchedule || requiresCurrentKmOnly) ? Number(formData.currentKm || 0) : undefined,
                paidBy: (isMechanicalWork || isBodyWork) ? (formData.liableOn === 'person' ? 'Person' : 'Company') : undefined,
                value: formData.amountMode === 'warranty' ? 0 : Number(formData.value),
                remark: extraMeta
                    ? JSON.stringify(extraMeta)
                    : (
                        mechanicalMeta
                            ? JSON.stringify(mechanicalMeta)
                            : (bodyWorkMeta ? JSON.stringify(bodyWorkMeta) : (accidentMeta ? JSON.stringify(accidentMeta) : ''))
                    ),
                attachment: formData.attachmentBase64
                    ? {
                        name: formData.attachmentName,
                        data: formData.attachmentBase64,
                        mimeType: formData.attachmentMime
                    }
                    : null,
                invoice: formData.invoiceBase64
                    ? { name: formData.invoiceName, data: formData.invoiceBase64, mimeType: formData.invoiceMime }
                    : null,
            });
            toast({ title: 'Success', description: 'Service record added successfully' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.response?.data?.message || 'Failed to save service record' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-[#00B5AD]">
                            <Settings size={18} />
                        </div>
                        Add Service Record
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-8 py-7 max-h-[78vh] overflow-y-auto space-y-6">

                    {/* Row 1: Oil service type (oil only) + Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {isOilService && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Settings size={11} /> Oil Service Type
                                </label>
                                <input
                                    type="text"
                                    value={formData.oilServiceTypeText}
                                    onChange={(e) => set('oilServiceTypeText', e.target.value)}
                                    placeholder="Enter oil service type"
                                    className={input(errors.oilServiceTypeText)}
                                />
                                {errors.oilServiceTypeText && <p className="text-[10px] text-red-500 font-bold">{errors.oilServiceTypeText}</p>}
                            </div>
                        )}

                        <div className={`space-y-1.5 ${isOilService ? '' : 'md:col-span-2'}`}>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <FileText size={11} /> Date
                            </label>
                            <DatePicker
                                value={formData.date}
                                onChange={(v) => set('date', v || '')}
                                placeholder="Select service date"
                                className={input(errors.date || errors.serviceType)}
                            />
                            {errors.date && <p className="text-[10px] text-red-500 font-bold">{errors.date}</p>}
                            {errors.serviceType && <p className="text-[10px] text-red-500 font-bold">{errors.serviceType}</p>}
                        </div>
                    </div>

                    {/* Row 2: Amount / Warranty */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount Type</label>
                            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                    type="button"
                                    onClick={() => set('amountMode', 'amount')}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.amountMode === 'amount'
                                        ? 'bg-white text-[#00B5AD] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Amount
                                </button>
                                <button
                                    type="button"
                                    onClick={() => set('amountMode', 'warranty')}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.amountMode === 'warranty'
                                        ? 'bg-white text-[#00B5AD] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Warranty
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <DollarSign size={11} /> Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 select-none">AED</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.value}
                                    onChange={(e) => set('value', e.target.value)}
                                    placeholder={formData.amountMode === 'warranty' ? 'Covered by warranty' : '0.00'}
                                    disabled={formData.amountMode === 'warranty'}
                                    className={`${input(errors.value)} pl-14 ${formData.amountMode === 'warranty' ? 'opacity-60' : ''}`}
                                />
                            </div>
                            {errors.value && <p className="text-[10px] text-red-500 font-bold">{errors.value}</p>}
                        </div>
                    </div>

                    {/* Row 3: Oil/Tire schedule fields */}
                    {requiresKmSchedule && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {isTireChange && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Number</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.tireNumber}
                                        onChange={(e) => set('tireNumber', e.target.value)}
                                        placeholder="No. of tires"
                                        className={input(errors.tireNumber)}
                                    />
                                    {errors.tireNumber && <p className="text-[10px] text-red-500 font-bold">{errors.tireNumber}</p>}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current KM</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.currentKm}
                                    onChange={(e) => set('currentKm', e.target.value)}
                                    placeholder="Current kilometer"
                                    className={input(errors.currentKm)}
                                />
                                {errors.currentKm && <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Change KM</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.nextChangeKm}
                                    onChange={(e) => set('nextChangeKm', e.target.value)}
                                    placeholder="Next change kilometer"
                                    className={input(errors.nextChangeKm)}
                                />
                                {errors.nextChangeKm && <p className="text-[10px] text-red-500 font-bold">{errors.nextChangeKm}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Change Month</label>
                                <input
                                    type="month"
                                    value={formData.nextChangeMonth}
                                    onChange={(e) => set('nextChangeMonth', e.target.value)}
                                    className={input(errors.nextChangeMonth)}
                                />
                                {errors.nextChangeMonth && <p className="text-[10px] text-red-500 font-bold">{errors.nextChangeMonth}</p>}
                            </div>
                        </div>
                    )}

                    {/* Mechanical Work specific fields */}
                    {isMechanicalWork && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current KM</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.currentKm}
                                    onChange={(e) => set('currentKm', e.target.value)}
                                    placeholder="Current kilometer"
                                    className={input(errors.currentKm)}
                                />
                                {errors.currentKm && <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Liable On</label>
                                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                    <button
                                        type="button"
                                        onClick={() => set('liableOn', 'company')}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.liableOn === 'company'
                                            ? 'bg-white text-[#00B5AD] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Company
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            set('liableOn', 'person');
                                            if (!formData.liablePersonId && assignedEmployee?._id) {
                                                set('liablePersonId', String(assignedEmployee._id));
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.liableOn === 'person'
                                            ? 'bg-white text-[#00B5AD] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Person
                                    </button>
                                </div>
                            </div>
                            {formData.liableOn === 'person' && (
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Liable Person</label>
                                    <select
                                        value={formData.liablePersonId}
                                        onChange={(e) => set('liablePersonId', e.target.value)}
                                        className={input(errors.liablePersonId)}
                                    >
                                        <option value="">Select employee with driving license...</option>
                                        {licensedEmployees.map((emp) => (
                                            <option key={emp._id} value={emp._id}>
                                                {`${emp.firstName || ''} ${emp.lastName || ''}`.trim()}
                                                {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.liablePersonId && <p className="text-[10px] text-red-500 font-bold">{errors.liablePersonId}</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Body Work specific fields */}
                    {isBodyWork && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current KM</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.currentKm}
                                    onChange={(e) => set('currentKm', e.target.value)}
                                    placeholder="Current kilometer"
                                    className={input(errors.currentKm)}
                                />
                                {errors.currentKm && <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Liable On</label>
                                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                    <button
                                        type="button"
                                        onClick={() => set('liableOn', 'company')}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.liableOn === 'company'
                                            ? 'bg-white text-[#00B5AD] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Company
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            set('liableOn', 'person');
                                            if (!formData.liablePersonId && assignedEmployee?._id) {
                                                set('liablePersonId', String(assignedEmployee._id));
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.liableOn === 'person'
                                            ? 'bg-white text-[#00B5AD] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Person
                                    </button>
                                </div>
                            </div>
                            {formData.liableOn === 'person' && (
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Liable Person</label>
                                    <select
                                        value={formData.liablePersonId}
                                        onChange={(e) => set('liablePersonId', e.target.value)}
                                        className={input(errors.liablePersonId)}
                                    >
                                        <option value="">Select employee with driving license...</option>
                                        {licensedEmployees.map((emp) => (
                                            <option key={emp._id} value={emp._id}>
                                                {`${emp.firstName || ''} ${emp.lastName || ''}`.trim()}
                                                {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.liablePersonId && <p className="text-[10px] text-red-500 font-bold">{errors.liablePersonId}</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Accidental Repair specific fields */}
                    {isAccidentRepair && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accident Date</label>
                                <DatePicker
                                    value={formData.accidentDate}
                                    onChange={(v) => set('accidentDate', v || '')}
                                    placeholder="Select accident date"
                                    className={input(errors.accidentDate)}
                                />
                                {errors.accidentDate && <p className="text-[10px] text-red-500 font-bold">{errors.accidentDate}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Policy Report Date</label>
                                <DatePicker
                                    value={formData.policyReportDate}
                                    onChange={(v) => set('policyReportDate', v || '')}
                                    placeholder="Select policy report date"
                                    className={input(errors.policyReportDate)}
                                />
                                {errors.policyReportDate && <p className="text-[10px] text-red-500 font-bold">{errors.policyReportDate}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accident Owner</label>
                                <select
                                    value={formData.accidentOwner}
                                    onChange={(e) => set('accidentOwner', e.target.value)}
                                    className={input(errors.accidentOwner)}
                                >
                                    <option value="">Select owner...</option>
                                    <option value="Third Party">Third Party</option>
                                    <option value="Own Mistake">Own Mistake</option>
                                </select>
                                {errors.accidentOwner && <p className="text-[10px] text-red-500 font-bold">{errors.accidentOwner}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accident Status</label>
                                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                    <button
                                        type="button"
                                        onClick={() => set('accidentStatus', 'Active')}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.accidentStatus === 'Active'
                                            ? 'bg-white text-[#00B5AD] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Active
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => set('accidentStatus', 'Inactive')}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.accidentStatus === 'Inactive'
                                            ? 'bg-white text-[#00B5AD] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Inactive
                                    </button>
                                </div>
                                {errors.accidentStatus && <p className="text-[10px] text-red-500 font-bold">{errors.accidentStatus}</p>}
                            </div>
                            {formData.accidentStatus === 'Active' && (
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Insurance Approval Status</label>
                                    <select
                                        value={formData.insuranceApprovalStatus}
                                        onChange={(e) => set('insuranceApprovalStatus', e.target.value)}
                                        className={input(errors.insuranceApprovalStatus)}
                                    >
                                        <option value="">Select insurance approval status...</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                    {errors.insuranceApprovalStatus && <p className="text-[10px] text-red-500 font-bold">{errors.insuranceApprovalStatus}</p>}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <AlignLeft size={11} /> Description
                            </label>
                            <textarea
                                value={formData.serviceIssue}
                                onChange={(e) => set('serviceIssue', e.target.value)}
                                placeholder="Describe service details..."
                                rows={4}
                                className={`${input(errors.serviceIssue)} resize-none`}
                            />
                            {errors.serviceIssue && <p className="text-[10px] text-red-500 font-bold">{errors.serviceIssue}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Paperclip size={11} /> Attachment
                            </label>
                            <div className={`relative flex items-center justify-center w-full h-32 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${formData.attachmentName ? 'border-teal-300 bg-teal-50/30' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}`}>
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => handleFileChange(e, 'attachment')}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                />
                                <div className="text-center pointer-events-none">
                                    {formData.attachmentName ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <FileText className="text-[#00B5AD]" size={26} />
                                            <p className="text-xs font-black text-gray-700 max-w-[300px] truncate mt-1">{formData.attachmentName}</p>
                                            <p className="text-[10px] text-[#00B5AD] font-bold uppercase tracking-widest">Click to change</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-gray-300 shadow-sm border border-gray-100">
                                                <Paperclip size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Upload Attachment</p>
                                                <p className="text-[10px] text-gray-300 text-center mt-0.5">PDF, JPG, PNG</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Invoice (separate) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Paperclip size={11} /> Invoice
                        </label>
                        <div className={`relative flex items-center justify-center w-full h-28 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${formData.invoiceName ? 'border-teal-300 bg-teal-50/30' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}`}>
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => handleFileChange(e, 'invoice')}
                                accept=".pdf,.jpg,.jpeg,.png"
                            />
                            <div className="text-center pointer-events-none">
                                {formData.invoiceName ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <FileText className="text-[#00B5AD]" size={24} />
                                        <p className="text-xs font-black text-gray-700 max-w-[300px] truncate mt-1">{formData.invoiceName}</p>
                                        <p className="text-[10px] text-[#00B5AD] font-bold uppercase tracking-widest">Click to change</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1.5">
                                        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-gray-300 shadow-sm border border-gray-100">
                                            <Paperclip size={18} />
                                        </div>
                                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Upload Invoice</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-7 py-2.5 text-gray-500 hover:bg-gray-100 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-10 py-2.5 rounded-2xl bg-[#00B5AD] hover:bg-[#00928C] text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2.5 shadow-lg shadow-teal-100 transition-all disabled:opacity-50"
                        >
                            {loading
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={14} />
                            }
                            Save Service
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
