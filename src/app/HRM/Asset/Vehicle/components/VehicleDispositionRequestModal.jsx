'use client';

import { useEffect, useState } from 'react';
import { X, Eye } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { computeDispositionBalanceInHand } from '../lib/soldDispositionMath';
import {
    getDefaultCurrentLoanAmount,
    getDefaultRegistrationExpense,
    loanAmountFromMortgage,
    registrationExpenseFromCard,
} from '../lib/vehicleDispositionFinancialDefaults';
import { PDF_FILE_ACCEPT, isPdfUploadFile } from '../utils/vehicleDocumentCardRows';

const PANEL_CLASS =
    'rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5 space-y-4 shadow-sm';

export default function VehicleDispositionRequestModal({
    isOpen,
    onClose,
    onSuccess,
    assetMongoId,
    asset,
    targetStatus,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        soldValue: '',
        totalLossValue: '',
        currentLoanAmount: '',
        balanceInHand: '',
        registrationExpense: '',
        otherExpense: '',
        note: '',
        accidentReportUrl: '',
        accidentReportBase64: '',
        accidentReportFileName: '',
        accidentReportMime: '',
    });

    const isSold = targetStatus === 'sold';
    const isTotalLoss = targetStatus === 'total loss';

    const payoutValue = isSold ? form.soldValue : form.totalLossValue;

    useEffect(() => {
        if (!isOpen || !asset) return;
        const loanDefault = getDefaultCurrentLoanAmount(asset);
        const regExpNum = getDefaultRegistrationExpense(asset);
        const otherExpNum =
            asset.otherExpense != null && asset.otherExpense !== ''
                ? String(Math.round(Number(asset.otherExpense)))
                : '';
        const soldVal =
            asset.soldValue != null && !Number.isNaN(Number(asset.soldValue))
                ? String(Math.round(Number(asset.soldValue)))
                : '';
        const totalLossVal =
            asset.totalLossValue != null && !Number.isNaN(Number(asset.totalLossValue))
                ? String(Math.round(Number(asset.totalLossValue)))
                : '';
        const payoutForInit = isSold ? soldVal : totalLossVal;
        setForm({
            soldValue: soldVal,
            totalLossValue: totalLossVal,
            currentLoanAmount: loanDefault,
            balanceInHand: String(
                computeDispositionBalanceInHand(
                    payoutForInit,
                    loanDefault,
                    regExpNum,
                    otherExpNum,
                ),
            ),
            registrationExpense: regExpNum,
            otherExpense: otherExpNum,
            note: '',
            accidentReportUrl:
                typeof asset.accidentReportAttachment === 'string' ? asset.accidentReportAttachment : '',
            accidentReportBase64: '',
            accidentReportFileName: '',
            accidentReportMime: '',
        });
    }, [isOpen, asset, isSold, isTotalLoss]);

    const handleAccidentReportFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!isPdfUploadFile(file)) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Only PDF files are allowed.',
            });
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            setForm((p) => ({
                ...p,
                accidentReportBase64: base64,
                accidentReportFileName: file.name,
                accidentReportMime: file.type || 'application/pdf',
            }));
        };
        reader.readAsDataURL(file);
    };

    const patchDispositionBalance = (prev, patch) => {
        const next = { ...prev, ...patch };
        const payout = isSold ? next.soldValue : next.totalLossValue;
        return {
            ...next,
            balanceInHand: String(
                computeDispositionBalanceInHand(
                    payout,
                    next.currentLoanAmount,
                    next.registrationExpense,
                    next.otherExpense,
                ),
            ),
        };
    };

    const handleSend = async () => {
        if (!assetMongoId || !targetStatus) return;
        if (isSold && !String(form.soldValue).replace(/\D/g, '')) {
            toast({ variant: 'destructive', title: 'Required', description: 'Sold value is required.' });
            return;
        }
        if (isTotalLoss && !String(form.totalLossValue).replace(/\D/g, '')) {
            toast({ variant: 'destructive', title: 'Required', description: 'Total loss value is required.' });
            return;
        }
        try {
            setLoading(true);
            const payout = isSold ? form.soldValue : form.totalLossValue;
            const balance = computeDispositionBalanceInHand(
                payout,
                form.currentLoanAmount,
                form.registrationExpense,
                form.otherExpense,
            );
            const payload = {
                targetStatus,
                soldValue: isSold ? form.soldValue : undefined,
                totalLossValue: isTotalLoss ? form.totalLossValue : undefined,
                currentLoanAmount: form.currentLoanAmount,
                balanceInHand: String(balance),
                registrationExpense: form.registrationExpense,
                otherExpense: form.otherExpense,
                note: form.note,
            };
            if (isTotalLoss && form.accidentReportBase64) {
                payload.accidentReportDocument = {
                    data: form.accidentReportBase64,
                    name: form.accidentReportFileName || 'accident-report',
                    mimeType: form.accidentReportMime || 'application/pdf',
                };
            }
            await axiosInstance.post(`/AssetItem/${assetMongoId}/submit-vehicle-disposition-request`, payload);
            toast({
                title: 'Request sent',
                description: 'HR will review this request. You will be notified when it is approved or rejected.',
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to send request.',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const mortgageLoanDefault = loanAmountFromMortgage(asset);
    const registrationFeeDefault = registrationExpenseFromCard(asset);
    const loanFromMortgage =
        mortgageLoanDefault !== '' && String(form.currentLoanAmount) === String(mortgageLoanDefault);
    const regFromCard =
        registrationFeeDefault !== '' && form.registrationExpense === registrationFeeDefault;
    const balanceAuto = computeDispositionBalanceInHand(
        payoutValue,
        form.currentLoanAmount,
        form.registrationExpense,
        form.otherExpense,
    );
    const payoutLabel = isSold ? 'sold value' : 'total loss value';

    const title = isSold ? 'Request — Sold' : 'Request — Total loss';

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={loading ? undefined : onClose} />
            <div className="relative bg-white rounded-[22px] shadow-xl w-full max-w-[640px] max-h-[90vh] flex flex-col p-6 md:p-8">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[20px] font-semibold text-gray-800">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 pt-4 space-y-4 modal-scroll">
                    <p className="text-sm text-slate-600">
                        Complete the details below and send to <strong>HR</strong>. After HR approval, either{' '}
                        <strong>Accounts</strong> or <strong>Management</strong> may submit once — that completes the
                        disposition (vehicle marked Sold or Total loss, both tasks cleared, company notified).
                    </p>

                    <div className={PANEL_CLASS}>
                        {isTotalLoss ? (
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                    Accident report
                                </label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="relative h-11 flex items-center rounded-xl border border-slate-200 bg-white px-4 min-w-[200px] flex-1">
                                        <input
                                            type="file"
                                            onChange={handleAccidentReportFile}
                                            accept={PDF_FILE_ACCEPT}
                                            disabled={loading}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        />
                                        <span className="text-[12px] font-bold text-slate-600 truncate">
                                            {form.accidentReportFileName ||
                                                (form.accidentReportUrl ? 'Replace file…' : 'Upload')}
                                        </span>
                                    </div>
                                    {form.accidentReportUrl && !form.accidentReportBase64 ? (
                                        <a
                                            href={form.accidentReportUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 text-[12px] font-bold flex items-center gap-1"
                                        >
                                            <Eye size={16} /> View current
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        {isSold ? (
                            <div className="space-y-1.5 max-w-md">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                    Sold value (AED) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.soldValue}
                                    onChange={(e) =>
                                        setForm((p) =>
                                            patchDispositionBalance(p, {
                                                soldValue: e.target.value.replace(/\D/g, '').slice(0, 12),
                                            }),
                                        )
                                    }
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white"
                                    disabled={loading}
                                />
                            </div>
                        ) : null}

                        {isTotalLoss ? (
                            <div className="space-y-1.5 max-w-md">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                    Total loss value (AED) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.totalLossValue}
                                    onChange={(e) =>
                                        setForm((p) =>
                                            patchDispositionBalance(p, {
                                                totalLossValue: e.target.value.replace(/\D/g, '').slice(0, 12),
                                            }),
                                        )
                                    }
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white"
                                    disabled={loading}
                                />
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                    Current loan amount (AED)
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.currentLoanAmount}
                                    onChange={(e) =>
                                        setForm((p) =>
                                            patchDispositionBalance(p, {
                                                currentLoanAmount: e.target.value.replace(/\D/g, '').slice(0, 12),
                                            }),
                                        )
                                    }
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white"
                                    disabled={loading}
                                />
                                {loanFromMortgage ? (
                                    <p className="text-[10px] text-slate-500">From mortgage loan amount.</p>
                                ) : null}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                    Balance in hand (AED) — auto
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={String(balanceAuto)}
                                    readOnly
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-100 cursor-not-allowed"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                    Registration expense (AED)
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.registrationExpense}
                                    onChange={(e) =>
                                        setForm((p) =>
                                            patchDispositionBalance(p, {
                                                registrationExpense: e.target.value.replace(/\D/g, '').slice(0, 12),
                                            }),
                                        )
                                    }
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white"
                                    disabled={loading}
                                />
                                {regFromCard ? (
                                    <p className="text-[10px] text-slate-500">From registration card value.</p>
                                ) : null}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                    Other expenses (AED)
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.otherExpense}
                                    onChange={(e) =>
                                        setForm((p) =>
                                            patchDispositionBalance(p, {
                                                otherExpense: e.target.value.replace(/\D/g, '').slice(0, 12),
                                            }),
                                        )
                                    }
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-500">
                            Balance in hand = |(current loan + registration expense + other expenses) − {payoutLabel}|.
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                                Note (optional)
                            </label>
                            <textarea
                                value={form.note}
                                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value.slice(0, 2000) }))}
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm"
                                disabled={loading}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-6 h-11 rounded-xl border border-slate-200 text-[13px] font-black uppercase text-slate-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={loading}
                        className="px-8 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-black uppercase shadow-lg disabled:opacity-60"
                    >
                        {loading ? 'Sending…' : 'Send request'}
                    </button>
                </div>
            </div>
        </div>
    );
}
