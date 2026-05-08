'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

export default function VehicleMortgageModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    asset,
}) {
    const { toast } = useToast();
    const REQUIRED_DOC_ROWS = ['Security Check Attachment', 'Schedule List Attachment'];
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        bankName: '',
        vehicleName: '',
        vehicleAmount: '',
        downPayment: '',
        interest: '',
        loanTenureMonths: '',
        startDate: '',
        endDate: '',
        monthlyPayment: '',
        balancePayment: '',
        processCharge: '',
        securityCheckAttachment: null,
        scheduleListAttachment: null,
        extraAttachments: REQUIRED_DOC_ROWS.map((docName) => ({ docName, file: null })),
    });
    const [errors, setErrors] = useState({});

    const fileToPayload = (file) => new Promise((resolve) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            resolve({
                name: file.name,
                data: base64,
                mimeType: file.type || 'application/octet-stream',
            });
        };
        reader.readAsDataURL(file);
    });

    const monthsBetweenDates = (startDate, endDate) => {
        if (!startDate || !endDate) return 0;
        const s = new Date(startDate);
        const e = new Date(endDate);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
        const yearDiff = e.getFullYear() - s.getFullYear();
        const monthDiff = e.getMonth() - s.getMonth();
        let total = yearDiff * 12 + monthDiff;
        if (e.getDate() < s.getDate()) total -= 1;
        return Math.max(total, 0);
    };

    const calculateMortgage = (data) => {
        const vehicleAmount = Number(data.vehicleAmount || 0);
        const downPayment = Number(data.downPayment || 0);
        const processCharge = Number(data.processCharge || 0);
        const interestRate = Number(data.interest || 0);
        const principal = Math.max(vehicleAmount - downPayment, 0);

        const dateMonths = monthsBetweenDates(data.startDate, data.endDate);
        const tenureMonths = Number(data.loanTenureMonths || 0);
        const totalMonths = dateMonths > 0 ? dateMonths : Math.max(tenureMonths, 0);
        if (totalMonths <= 0) return { monthly: '', balance: '', remainingMonths: 0 };

        const yearlyInterestPayment = (principal * interestRate) / 100;
        const yearCount = totalMonths / 12;
        const totalInterest = yearlyInterestPayment * yearCount;
        const totalPayable = principal + totalInterest + processCharge;
        const monthlyPayment = totalPayable / totalMonths;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = data.startDate ? new Date(data.startDate) : null;
        const end = data.endDate ? new Date(data.endDate) : null;
        if (start && !Number.isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
        if (end && !Number.isNaN(end.getTime())) end.setHours(0, 0, 0, 0);

        let remainingMonths = totalMonths;
        if (end && !Number.isNaN(end.getTime()) && end < today) {
            remainingMonths = 0;
        } else if (start && !Number.isNaN(start.getTime()) && start < today && end && !Number.isNaN(end.getTime())) {
            remainingMonths = monthsBetweenDates(today.toISOString().slice(0, 10), data.endDate);
        }
        remainingMonths = Math.max(remainingMonths, 0);

        const monthly = Number.isFinite(monthlyPayment) ? monthlyPayment.toFixed(2) : '';
        const remainingBalance = monthlyPayment * remainingMonths;
        const balance = Number.isFinite(remainingBalance) ? Math.max(remainingBalance, 0).toFixed(2) : '';
        return { monthly, balance, remainingMonths };
    };

    useEffect(() => {
        if (!isOpen) return;
        setFormData({
            bankName: asset?.mortgageBankName || '',
            vehicleName: asset?.mortgageVehicleName || asset?.name || '',
            vehicleAmount: asset?.mortgageAmount != null ? String(asset.mortgageAmount) : '',
            downPayment: asset?.downPayment != null ? String(asset.downPayment) : '',
            interest: asset?.interestRate != null ? String(asset.interestRate) : '',
            loanTenureMonths: asset?.loanTenureMonths != null ? String(asset.loanTenureMonths) : '',
            startDate: asset?.mortgageStartDate ? String(asset.mortgageStartDate).slice(0, 10) : '',
            endDate: asset?.mortgageEndDate ? String(asset.mortgageEndDate).slice(0, 10) : '',
            monthlyPayment: asset?.monthlyPayment != null ? String(asset.monthlyPayment) : '',
            balancePayment: asset?.balancePayment != null ? String(asset.balancePayment) : '',
            processCharge: asset?.processCharge != null ? String(asset.processCharge) : '',
            securityCheckAttachment: asset?.mortgageSecurityCheckAttachment || null,
            scheduleListAttachment: asset?.mortgageScheduleListAttachment || null,
            extraAttachments: (() => {
                const saved = Array.isArray(asset?.mortgageExtraAttachments) ? asset.mortgageExtraAttachments : [];
                const requiredRows = REQUIRED_DOC_ROWS.map((docName) => {
                    const match = saved.find((row) => String(row?.docName || '').toLowerCase().trim() === docName.toLowerCase());
                    return match ? { ...match, docName } : { docName, file: null };
                });
                const remaining = saved.filter(
                    (row) => !REQUIRED_DOC_ROWS.some((name) => name.toLowerCase() === String(row?.docName || '').toLowerCase().trim()),
                );
                return [...requiredRows, ...remaining];
            })(),
        });
        setErrors({});
    }, [isOpen, asset]);

    useEffect(() => {
        if (!isOpen) return;
        const calc = calculateMortgage(formData);
        if (calc.monthly === '' && calc.balance === '') {
            if (formData.monthlyPayment !== '' || formData.balancePayment !== '') {
                setFormData((prev) => ({ ...prev, monthlyPayment: '', balancePayment: '' }));
            }
            return;
        }
        if (formData.monthlyPayment !== calc.monthly || formData.balancePayment !== calc.balance) {
            setFormData((prev) => ({
                ...prev,
                monthlyPayment: calc.monthly,
                balancePayment: calc.balance,
            }));
        }
    }, [
        isOpen,
        formData.vehicleAmount,
        formData.interest,
        formData.downPayment,
        formData.processCharge,
        formData.startDate,
        formData.endDate,
        formData.loanTenureMonths,
        formData.monthlyPayment,
        formData.balancePayment,
    ]);

    if (!isOpen) return null;

    const loanAmountDisplay = (() => {
        const vehicleAmount = Number(formData.vehicleAmount || 0);
        const downPayment = Number(formData.downPayment || 0);
        const loanAmount = Math.max(vehicleAmount - downPayment, 0);
        return loanAmount.toFixed(2);
    })();
    const liveCalc = calculateMortgage(formData);
    const remainingMonthsDisplay = liveCalc.remainingMonths;

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const securityRow = formData.extraAttachments[0];
            const scheduleRow = formData.extraAttachments[1];
            const securityDocPayload = securityRow?.file?.data ? securityRow.file : await fileToPayload(securityRow?.file);
            const scheduleDocPayload = scheduleRow?.file?.data ? scheduleRow.file : await fileToPayload(scheduleRow?.file);
            const nextErrors = {};
            if (!securityDocPayload?.data) nextErrors.securityCheckAttachment = 'Security Check Attachment is required';
            if (!scheduleDocPayload?.data) nextErrors.scheduleListAttachment = 'Schedule List Attachment is required';
            if (Object.keys(nextErrors).length > 0) {
                setErrors(nextErrors);
                setLoading(false);
                return;
            }
            const extraAttachmentsPayload = [];
            for (const row of formData.extraAttachments) {
                const docName = String(row?.docName || '').trim();
                const fileObj = row?.file;
                if (!docName && !fileObj) continue;
                const normalizedFile = fileObj?.data ? fileObj : await fileToPayload(fileObj);
                extraAttachmentsPayload.push({
                    docName,
                    file: normalizedFile,
                });
            }

            const payload = {
                mortgageBankName: formData.bankName.trim(),
                mortgageVehicleName: formData.vehicleName.trim(),
                mortgageAmount: Number(formData.vehicleAmount || 0),
                downPayment: Number(formData.downPayment || 0),
                interestRate: Number(formData.interest || 0),
                loanTenureMonths: Number(formData.loanTenureMonths || 0),
                mortgageStartDate: formData.startDate || null,
                mortgageEndDate: formData.endDate || null,
                monthlyPayment: Number(liveCalc.monthly || 0),
                balancePayment: Number(liveCalc.balance || 0),
                processCharge: Number(formData.processCharge || 0),
                mortgageSecurityCheckAttachment: securityDocPayload,
                mortgageScheduleListAttachment: scheduleDocPayload,
                mortgageExtraAttachments: extraAttachmentsPayload,
                // Keep header mortgage line in sync.
                mortgageBank: formData.bankName.trim(),
            };
            await axiosInstance.put(`/AssetType/${assetId}`, payload);
            toast({ title: 'Saved', description: 'Mortgage details saved successfully.' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save mortgage details.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[680px] max-h-[85vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Mortgage Details</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-5 px-1 md:px-2 pt-5 pb-2 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Bank Name</label>
                            <input
                                value={formData.bankName}
                                onChange={(e) => setFormData((p) => ({ ...p, bankName: e.target.value }))}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Vehicle Name</label>
                            <input
                                value={formData.vehicleName}
                                onChange={(e) => setFormData((p) => ({ ...p, vehicleName: e.target.value }))}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Vehicle Amount</label>
                            <input type="number" min="0" value={formData.vehicleAmount} onChange={(e) => setFormData((p) => ({ ...p, vehicleAmount: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Loan Amount</label>
                            <input
                                type="number"
                                min="0"
                                value={loanAmountDisplay}
                                readOnly
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Down Payment</label>
                            <input type="number" min="0" value={formData.downPayment} onChange={(e) => setFormData((p) => ({ ...p, downPayment: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Interest</label>
                            <input type="number" min="0" step="0.01" value={formData.interest} onChange={(e) => setFormData((p) => ({ ...p, interest: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Loan Tenure (Months)</label>
                            <input type="number" min="0" value={formData.loanTenureMonths} onChange={(e) => setFormData((p) => ({ ...p, loanTenureMonths: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Start Date</label>
                            <DatePicker value={formData.startDate} onChange={(date) => setFormData((p) => ({ ...p, startDate: date || '' }))} placeholder="Select start date" className="w-full h-11 border-slate-200 bg-slate-50 text-slate-800" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">End Date</label>
                            <DatePicker value={formData.endDate} onChange={(date) => setFormData((p) => ({ ...p, endDate: date || '' }))} placeholder="Select end date" className="w-full h-11 border-slate-200 bg-slate-50 text-slate-800" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Monthly Payment</label>
                            <input type="number" min="0" value={formData.monthlyPayment} readOnly className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Balance Payment</label>
                            <input type="number" min="0" value={formData.balancePayment} readOnly className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none cursor-not-allowed" />
                            <p className="text-[11px] text-slate-500">Remaining months used: {remainingMonthsDisplay}</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Process Charge</label>
                            <input type="number" min="0" value={formData.processCharge} onChange={(e) => setFormData((p) => ({ ...p, processCharge: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none" />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="text-[13px] font-black text-slate-700 uppercase tracking-wide">Doc Name Attachment</h5>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setFormData((p) => ({
                                            ...p,
                                            extraAttachments: [...p.extraAttachments, { docName: '', file: null }],
                                        }))
                                    }
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-1.5"
                                >
                                    <Plus size={12} /> Add
                                </button>
                            </div>
                            {formData.extraAttachments.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                    <input
                                        type="text"
                                        value={row.docName || ''}
                                        onChange={(e) =>
                                            setFormData((p) => {
                                                const next = [...p.extraAttachments];
                                                next[idx] = { ...next[idx], docName: e.target.value };
                                                return { ...p, extraAttachments: next };
                                            })
                                        }
                                        readOnly={idx < 2}
                                        placeholder="Document name"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none"
                                    />
                                    <div>
                                        <input
                                            type="file"
                                            onChange={(e) =>
                                                setFormData((p) => {
                                                    const next = [...p.extraAttachments];
                                                    next[idx] = { ...next[idx], file: e.target.files?.[0] || null };
                                                    return { ...p, extraAttachments: next };
                                                })
                                            }
                                            className="w-full h-11 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none"
                                        />
                                        {row.file?.name ? <p className="text-[11px] text-slate-500 mt-1">{row.file.name}</p> : null}
                                        {idx === 0 && errors.securityCheckAttachment ? <p className="text-[11px] text-red-500 mt-1">{errors.securityCheckAttachment}</p> : null}
                                        {idx === 1 && errors.scheduleListAttachment ? <p className="text-[11px] text-red-500 mt-1">{errors.scheduleListAttachment}</p> : null}
                                    </div>
                                    {idx >= 2 ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFormData((p) => ({
                                                    ...p,
                                                    extraAttachments: p.extraAttachments.filter((_, i) => i !== idx),
                                                }))
                                            }
                                            className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    ) : (
                                        <div className="w-10 h-10" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-6 h-11 rounded-xl border border-slate-200 text-[13px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all disabled:opacity-60 min-w-[120px]"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
