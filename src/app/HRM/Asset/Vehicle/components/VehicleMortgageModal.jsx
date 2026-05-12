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
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        bankName: '',
        vehicleName: '',
        vehicleValue: '',
        loanAmount: '',
        interest: '',
        loanTenureMonths: '',
        startDate: '',
        endDate: '',
        downPayment: '',
        totalInterest: '',
        totalPayable: '',
        monthlyEMI: '',
        processCharge: '',
        balancePayable: '',
        extraAttachments: [],
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
        const vehicleValue = Number(data.vehicleValue || 0);
        const loanAmount = Number(data.loanAmount || 0);
        const interestRate = Number(data.interest || 0);
        const tenureMonths = Number(data.loanTenureMonths || 0);

        // 1. Year = Tenure / 12
        const yearCount = tenureMonths / 12;

        // 2. Total Interest = (Loan Amount * Interest / 100) * Year
        const totalInterest = (loanAmount * (interestRate / 100)) * yearCount;

        // 3. Total Payment = Loan Amount + Total Interest
        const totalPayable = loanAmount + totalInterest;

        // 4. Monthly EMI = Total Payment / Tenure
        const monthlyEMI = tenureMonths > 0 ? totalPayable / tenureMonths : 0;

        // 5. Down Payment = Vehicle Value - Loan Amount
        const downPayment = Math.max(vehicleValue - loanAmount, 0);

        // 6. Balance Payable = Monthly EMI * Remaining Months
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = data.startDate ? new Date(data.startDate) : null;
        const end = data.endDate ? new Date(data.endDate) : null;
        if (start && !Number.isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
        if (end && !Number.isNaN(end.getTime())) end.setHours(0, 0, 0, 0);

        let remainingMonths = 0;
        if (end && !Number.isNaN(end.getTime())) {
            if (end < today) {
                remainingMonths = 0;
            } else {
                const effectiveStart = (start && start > today) ? start : today;
                remainingMonths = monthsBetweenDates(effectiveStart.toISOString().slice(0, 10), data.endDate);
            }
        }
        remainingMonths = Math.max(remainingMonths, 0);

        const balancePayable = monthlyEMI * remainingMonths;

        return {
            totalInterest: Number.isFinite(totalInterest) ? totalInterest.toFixed(2) : '0.00',
            totalPayable: Number.isFinite(totalPayable) ? totalPayable.toFixed(2) : '0.00',
            monthlyEMI: Number.isFinite(monthlyEMI) ? monthlyEMI.toFixed(2) : '0.00',
            downPayment: Number.isFinite(downPayment) ? downPayment.toFixed(2) : '0.00',
            balancePayable: Number.isFinite(balancePayable) ? balancePayable.toFixed(2) : '0.00',
            remainingMonths
        };
    };

    useEffect(() => {
        if (!isOpen) return;
        
        // Auto-fill logic: 
        // 1. If mortgage details were previously saved, use them.
        // 2. Otherwise, pull defaults from the vehicle asset profile.
        const defaultVehicleValue = asset?.mortgageAmount || asset?.assetValue || '';
        const defaultVehicleName = asset?.mortgageVehicleName || asset?.name || '';

        setFormData({
            bankName: asset?.mortgageBankName || '',
            vehicleName: String(defaultVehicleName),
            vehicleValue: String(defaultVehicleValue),
            loanAmount: asset?.loanAmount != null ? String(asset.loanAmount) : '',
            interest: asset?.interestRate != null ? String(asset.interestRate) : '',
            loanTenureMonths: asset?.loanTenureMonths != null ? String(asset.loanTenureMonths) : '',
            startDate: asset?.mortgageStartDate ? String(asset.mortgageStartDate).slice(0, 10) : '',
            endDate: asset?.mortgageEndDate ? String(asset.mortgageEndDate).slice(0, 10) : '',
            downPayment: asset?.downPayment != null ? String(asset.downPayment) : '',
            totalInterest: asset?.totalInterest != null ? String(asset.totalInterest) : '',
            totalPayable: asset?.totalPayable != null ? String(asset.totalPayable) : '',
            monthlyEMI: asset?.monthlyPayment != null ? String(asset.monthlyPayment) : '',
            balancePayable: asset?.balancePayment != null ? String(asset.balancePayment) : '',
            processCharge: asset?.processCharge != null ? String(asset.processCharge) : '',
            extraAttachments: Array.isArray(asset?.mortgageExtraAttachments) ? asset.mortgageExtraAttachments : [],
        });
        setErrors({});
    }, [isOpen, asset]);

    useEffect(() => {
        if (!isOpen) return;
        
        // 1. First, determine the Auto-calculated End Date
        let autoEndDate = formData.endDate;
        if (formData.startDate && formData.loanTenureMonths) {
            const start = new Date(formData.startDate);
            if (!Number.isNaN(start.getTime())) {
                const end = new Date(start);
                // For a 12 month loan starting Jan 1, the 12th month is Dec.
                // So we add (tenure - 1) months.
                const tenure = Number(formData.loanTenureMonths);
                if (tenure > 0) {
                    end.setMonth(end.getMonth() + (tenure - 1));
                }
                autoEndDate = end.toISOString().slice(0, 10);
            }
        }

        // 2. Calculate mortgage fields using the updated end date
        const calc = calculateMortgage({ ...formData, endDate: autoEndDate });
        
        setFormData((prev) => ({
            ...prev,
            totalInterest: calc.totalInterest,
            totalPayable: calc.totalPayable,
            monthlyEMI: calc.monthlyEMI,
            downPayment: calc.downPayment,
            balancePayable: calc.balancePayable,
            endDate: autoEndDate,
        }));
    }, [
        isOpen,
        formData.vehicleValue,
        formData.loanAmount,
        formData.interest,
        formData.loanTenureMonths,
        formData.startDate,
    ]);

    if (!isOpen) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setErrors({});
            const extraAttachmentsPayload = [];
            for (const row of formData.extraAttachments) {
                const docName = String(row?.docName || '').trim();
                const fileObj = row?.file;
                if (!docName && !fileObj) continue;
                // If it's already a saved attachment (has data or url but is an object), or if it's a new File
                const normalizedFile = fileObj?.data ? fileObj : await fileToPayload(fileObj);
                extraAttachmentsPayload.push({
                    docName,
                    file: normalizedFile,
                });
            }

            const calc = calculateMortgage(formData);

            const payload = {
                mortgageBankName: formData.bankName.trim(),
                mortgageVehicleName: formData.vehicleName.trim(),
                mortgageAmount: Number(formData.vehicleValue || 0),
                loanAmount: Number(formData.loanAmount || 0),
                interestRate: Number(formData.interest || 0),
                loanTenureMonths: Number(formData.loanTenureMonths || 0),
                mortgageStartDate: formData.startDate || null,
                mortgageEndDate: formData.endDate || null,
                downPayment: Number(calc.downPayment),
                totalInterest: Number(calc.totalInterest),
                totalPayable: Number(calc.totalPayable),
                monthlyPayment: Number(calc.monthlyEMI),
                balancePayment: Number(calc.balancePayable),
                processCharge: Number(formData.processCharge || 0),
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
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[720px] max-h-[90vh] p-6 md:p-8 flex flex-col">
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

                <form onSubmit={handleSave} className="space-y-5 px-1 md:px-2 pt-5 pb-2 flex-1 overflow-y-auto modal-scroll">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Row 1 */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Bank Name</label>
                            <input
                                value={formData.bankName}
                                onChange={(e) => setFormData((p) => ({ ...p, bankName: e.target.value }))}
                                placeholder="Enter bank name"
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Vehicle Name</label>
                            <input
                                value={formData.vehicleName}
                                readOnly
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-500 outline-none cursor-not-allowed"
                            />
                        </div>

                        {/* Row 2 */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Vehicle Value</label>
                            <input 
                                type="number" 
                                min="0" 
                                value={formData.vehicleValue} 
                                onChange={(e) => setFormData((p) => ({ ...p, vehicleValue: e.target.value }))} 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Loan Amount</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.loanAmount}
                                onChange={(e) => setFormData((p) => ({ ...p, loanAmount: e.target.value }))}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>

                        {/* Row 3 */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Loan Interest (%)</label>
                            <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                value={formData.interest} 
                                onChange={(e) => setFormData((p) => ({ ...p, interest: e.target.value }))} 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Loan Tenure (Months)</label>
                            <input 
                                type="number" 
                                min="0" 
                                value={formData.loanTenureMonths} 
                                onChange={(e) => setFormData((p) => ({ ...p, loanTenureMonths: e.target.value }))} 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                            />
                            {formData.loanTenureMonths > 0 && (
                                <p className="text-[10px] text-slate-500 mt-1 font-medium">Approx. {(Number(formData.loanTenureMonths) / 12).toFixed(1)} Years</p>
                            )}
                        </div>

                        {/* Row 4 */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Down Payment</label>
                            <input 
                                type="number" 
                                value={formData.downPayment} 
                                readOnly 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none cursor-not-allowed font-semibold" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Total Interest</label>
                            <input 
                                type="number" 
                                value={formData.totalInterest} 
                                readOnly 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none cursor-not-allowed font-semibold" 
                            />
                        </div>

                        {/* Row 5 */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Total Loan Payable</label>
                            <input 
                                type="number" 
                                value={formData.totalPayable} 
                                readOnly 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-blue-600 outline-none cursor-not-allowed font-bold" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Monthly EMI</label>
                            <input 
                                type="number" 
                                value={formData.monthlyEMI} 
                                readOnly 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-rose-600 outline-none cursor-not-allowed font-bold" 
                            />
                        </div>

                        {/* Row 6 */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Loan Start Date</label>
                            <DatePicker value={formData.startDate} onChange={(date) => setFormData((p) => ({ ...p, startDate: date || '' }))} placeholder="Select start date" className="w-full h-11 border-slate-200 bg-slate-50 text-slate-800" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Loan End Date</label>
                            <DatePicker value={formData.endDate} onChange={(date) => setFormData((p) => ({ ...p, endDate: date || '' }))} placeholder="Select end date" className="w-full h-11 border-slate-200 bg-slate-50 text-slate-800" />
                        </div>

                        {/* Row 7 */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Process Charge</label>
                            <input 
                                type="number" 
                                min="0" 
                                value={formData.processCharge} 
                                onChange={(e) => setFormData((p) => ({ ...p, processCharge: e.target.value }))} 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Balance Payable</label>
                            <input 
                                type="number" 
                                value={formData.balancePayable} 
                                readOnly 
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none cursor-not-allowed font-semibold" 
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="text-[13px] font-black text-slate-700 uppercase tracking-wide">Document Attachments</h5>
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
                                    </div>
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
