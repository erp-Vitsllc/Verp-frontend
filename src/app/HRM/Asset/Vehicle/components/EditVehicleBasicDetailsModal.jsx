'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Eye } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { EMIRATES, parsePlateParts } from '../lib/vehiclePlateConfig';
import { computeDispositionBalanceInHand } from '../lib/soldDispositionMath';
import {
    getDefaultCurrentLoanAmount,
    getDefaultRegistrationExpense,
    loanAmountFromMortgage,
    registrationExpenseFromCard,
} from '../lib/vehicleDispositionFinancialDefaults';

const BASIC_DETAIL_DOC_TYPE = 'Basic Detail Attachment';

const PANEL_CLASS =
    'rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5 space-y-4 shadow-sm';

const normalizePlate = ({ code, digits }) => {
    const digitsOnly = String(digits || '').replace(/\D/g, '').slice(0, 6) || '1';
    const codePart = String(code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3);
    return codePart ? `${codePart} ${digitsOnly}` : digitsOnly;
};

const isBasicDetailDoc = (d) =>
    String(d?.type || '')
        .trim()
        .toLowerCase() === BASIC_DETAIL_DOC_TYPE.toLowerCase();

const newLocalId = () =>
    typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function EditVehicleBasicDetailsModal({
    isOpen,
    onClose,
    onSuccess,
    assetMongoId,
    asset,
    profileActivated = false,
    onOpenDispositionRequest,
    dispositionWorkflowStage = '',
    canOpenDispositionReview = false,
    onOpenDispositionReview,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        assetId: '',
        brand: '',
        name: '',
        modelYear: '',
        plateEmirate: 'Dubai',
        plateCode: '',
        plateDigits: '',
        assetValue: '',
        currentKilometer: '',
        vehicleDispositionStatus: 'active',
        soldValue: '',
        currentLoanAmount: '',
        balanceInHand: '',
        registrationExpense: '',
        otherExpense: '',
        totalLossValue: '',
        registrationExpiryDate: '',
        accidentReportUrl: '',
        accidentReportBase64: '',
        accidentReportFileName: '',
        accidentReportMime: '',
        basicDocRows: [],
    });

    const yearOptions = Array.from({ length: 41 }, (_, i) => String(new Date().getFullYear() - i));

    useEffect(() => {
        if (!isOpen || !asset) return;
        const { code, digits } = parsePlateParts(asset.plateNumber);
        const regExp = asset.registrationExpiryDate
            ? String(asset.registrationExpiryDate).substring(0, 10)
            : '';
        const basicDocRows = (asset.documents || []).filter(isBasicDetailDoc).map((d) => ({
            localId: String(d._id),
            _id: d._id,
            description: d.description || '',
            isExisting: true,
            attachmentUrl: typeof d.attachment === 'string' ? d.attachment : '',
            fileBase64: '',
            fileName: '',
            fileMime: '',
        }));
        setForm({
            assetId: asset.assetId || '',
            brand: (asset.typeId?.name || asset.type || '').trim(),
            name: asset.name || '',
            modelYear: asset.modelYear != null ? String(asset.modelYear) : '',
            plateEmirate: asset.plateEmirate || 'Dubai',
            plateCode: code,
            plateDigits: digits,
            assetValue:
                asset.assetValue != null && asset.assetValue !== ''
                    ? String(Math.round(Number(asset.assetValue)))
                    : '',
            currentKilometer:
                asset.currentKilometer != null && asset.currentKilometer !== ''
                    ? String(asset.currentKilometer)
                    : '0',
            vehicleDispositionStatus: asset.vehicleDispositionStatus || 'active',
            soldValue:
                asset.soldValue != null && asset.soldValue !== '' && !Number.isNaN(Number(asset.soldValue))
                    ? String(Math.round(Number(asset.soldValue)))
                    : '',
            currentLoanAmount: getDefaultCurrentLoanAmount(asset),
            registrationExpense: getDefaultRegistrationExpense(asset),
            otherExpense:
                asset.otherExpense != null && asset.otherExpense !== ''
                    ? String(Math.round(Number(asset.otherExpense)))
                    : '',
            balanceInHand: (() => {
                const disp = String(asset.vehicleDispositionStatus || 'active').toLowerCase();
                const other =
                    asset.otherExpense != null && asset.otherExpense !== ''
                        ? String(Math.round(Number(asset.otherExpense)))
                        : '';
                if (disp === 'sold') {
                    return String(
                        computeDispositionBalanceInHand(
                            asset.soldValue != null ? String(Math.round(Number(asset.soldValue))) : '',
                            getDefaultCurrentLoanAmount(asset),
                            getDefaultRegistrationExpense(asset),
                            other,
                        ),
                    );
                }
                if (disp === 'total loss') {
                    return String(
                        computeDispositionBalanceInHand(
                            asset.totalLossValue != null
                                ? String(Math.round(Number(asset.totalLossValue)))
                                : '',
                            getDefaultCurrentLoanAmount(asset),
                            getDefaultRegistrationExpense(asset),
                            other,
                        ),
                    );
                }
                return asset.balanceInHand != null && asset.balanceInHand !== ''
                    ? String(Math.abs(Math.round(Number(asset.balanceInHand))))
                    : '';
            })(),
            totalLossValue:
                asset.totalLossValue != null && asset.totalLossValue !== '' && !Number.isNaN(Number(asset.totalLossValue))
                    ? String(Math.round(Number(asset.totalLossValue)))
                    : '',
            registrationExpiryDate: regExp,
            accidentReportUrl: typeof asset.accidentReportAttachment === 'string' ? asset.accidentReportAttachment : '',
            accidentReportBase64: '',
            accidentReportFileName: '',
            accidentReportMime: '',
            basicDocRows,
        });
        setErrors({});
    }, [isOpen, asset]);

    const validate = () => {
        const e = {};
        if (!String(form.brand || '').trim()) e.brand = 'Brand is required';
        if (!String(form.name || '').trim()) e.name = 'Model is required';
        if (!form.modelYear) e.modelYear = 'Model year is required';
        if (!form.plateDigits || String(form.plateDigits).replace(/\D/g, '').length < 1) {
            e.plateDigits = 'Plate number is required';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const addBasicDocRow = () => {
        setForm((p) => ({
            ...p,
            basicDocRows: [
                ...p.basicDocRows,
                {
                    localId: newLocalId(),
                    _id: null,
                    description: '',
                    isExisting: false,
                    attachmentUrl: '',
                    fileBase64: '',
                    fileName: '',
                    fileMime: '',
                },
            ],
        }));
    };

    const updateBasicDocRow = (localId, patch) => {
        setForm((p) => ({
            ...p,
            basicDocRows: p.basicDocRows.map((r) => (r.localId === localId ? { ...r, ...patch } : r)),
        }));
    };

    const removeBasicDocRow = (localId) => {
        setForm((p) => ({
            ...p,
            basicDocRows: p.basicDocRows.filter((r) => r.localId !== localId),
        }));
    };

    const handleBasicDocFile = (localId, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            updateBasicDocRow(localId, {
                fileBase64: base64,
                fileName: file.name,
                fileMime: file.type || 'application/pdf',
            });
        };
        reader.readAsDataURL(file);
    };

    const handleAccidentReportFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
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

    const applyDispositionFinancialBalance = (prev, payoutKey, patch) => {
        const next = { ...prev, ...patch };
        return {
            ...next,
            balanceInHand: String(
                computeDispositionBalanceInHand(
                    next[payoutKey],
                    next.currentLoanAmount,
                    next.registrationExpense,
                    next.otherExpense,
                ),
            ),
        };
    };

    const handleSave = async (ev) => {
        ev.preventDefault();
        if (!validate() || !assetMongoId) return;
        try {
            setLoading(true);

            const payload = {
                name: form.name.trim(),
                type: form.brand.trim(),
                modelYear: form.modelYear,
                plateNumber: normalizePlate({ code: form.plateCode, digits: form.plateDigits }),
                plateEmirate: form.plateEmirate,
                assetValue: Number(String(form.assetValue).replace(/\D/g, '') || 0),
                currentKilometer: Number(String(form.currentKilometer).replace(/\D/g, '') || 0),
            };

            const assetDispSave = String(asset?.vehicleDispositionStatus || 'active').toLowerCase();

            if (assetDispSave === 'sold') {
                payload.soldValue = Number(String(form.soldValue).replace(/\D/g, '') || 0);
                payload.currentLoanAmount = Number(String(form.currentLoanAmount).replace(/\D/g, '') || 0);
                payload.registrationExpense = Number(String(form.registrationExpense).replace(/\D/g, '') || 0);
                payload.otherExpense = Number(String(form.otherExpense).replace(/\D/g, '') || 0);
                payload.balanceInHand = computeDispositionBalanceInHand(
                    form.soldValue,
                    form.currentLoanAmount,
                    form.registrationExpense,
                    form.otherExpense,
                );
            }

            if (assetDispSave === 'total loss') {
                payload.totalLossValue = Number(String(form.totalLossValue).replace(/\D/g, '') || 0);
                payload.currentLoanAmount = Number(String(form.currentLoanAmount).replace(/\D/g, '') || 0);
                payload.registrationExpense = Number(String(form.registrationExpense).replace(/\D/g, '') || 0);
                payload.otherExpense = Number(String(form.otherExpense).replace(/\D/g, '') || 0);
                payload.balanceInHand = computeDispositionBalanceInHand(
                    form.totalLossValue,
                    form.currentLoanAmount,
                    form.registrationExpense,
                    form.otherExpense,
                );
            }

            await axiosInstance.put(`/AssetType/${assetMongoId}`, payload);

            for (const row of form.basicDocRows) {
                if (row.isExisting || !row.fileBase64) continue;
                const desc = (row.description || '').trim() || row.fileName || 'Attachment';
                await axiosInstance.post(`/AssetItem/${assetMongoId}/document`, {
                    type: BASIC_DETAIL_DOC_TYPE,
                    description: desc,
                    document: {
                        name: row.fileName || 'document',
                        data: row.fileBase64,
                        mimeType: row.fileMime || 'application/pdf',
                    },
                });
            }

            toast({ title: 'Saved', description: 'Basic details updated.' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to save basic details.',
            });
        } finally {
            setLoading(false);
        }
    };

    const renderDocumentsBlock = () => (
        <div className="space-y-3 pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-widest">Documents</h4>
                <button
                    type="button"
                    onClick={addBasicDocRow}
                    disabled={loading}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1.5"
                >
                    <Plus size={14} /> Add
                </button>
            </div>
            <p className="text-[11px] text-slate-400">
                Doc name and file for each row. Saved as “{BASIC_DETAIL_DOC_TYPE}” on this vehicle.
            </p>
            <div className="space-y-3">
                {form.basicDocRows.map((row) => (
                    <div
                        key={row.localId}
                        className="flex flex-col md:flex-row gap-2 p-3 rounded-xl bg-white border border-slate-100 shadow-sm"
                    >
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                Doc name
                            </label>
                            <input
                                type="text"
                                value={row.description}
                                onChange={(e) =>
                                    updateBasicDocRow(row.localId, { description: e.target.value })
                                }
                                placeholder="Document name"
                                disabled={loading || row.isExisting}
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none disabled:opacity-70"
                            />
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                Attachment
                            </label>
                            {row.isExisting ? (
                                <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50">
                                    <span className="text-[11px] font-bold text-slate-600 truncate flex-1">
                                        {row.description || 'File'}
                                    </span>
                                    {row.attachmentUrl ? (
                                        <a
                                            href={row.attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 shrink-0 flex items-center gap-1 text-[11px] font-bold"
                                        >
                                            <Eye size={14} /> View
                                        </a>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="relative h-9 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
                                    <input
                                        type="file"
                                        onChange={(e) => handleBasicDocFile(row.localId, e)}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        disabled={loading}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    />
                                    <span className="text-[11px] font-bold text-slate-600 truncate">
                                        {row.fileName || 'Click to upload'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-end">
                            {!row.isExisting ? (
                                <button
                                    type="button"
                                    onClick={() => removeBasicDocRow(row.localId)}
                                    disabled={loading}
                                    className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100"
                                    title="Remove row"
                                >
                                    <Trash2 size={16} />
                                </button>
                            ) : (
                                <div className="w-9 h-9 shrink-0" aria-hidden />
                            )}
                        </div>
                    </div>
                ))}
                {form.basicDocRows.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No documents yet</p>
                        <p className="text-[10px] text-slate-400 mt-1">Use “Add” to upload a file.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const mortgageLoanDefault = loanAmountFromMortgage(asset);
    const registrationFeeDefault = registrationExpenseFromCard(asset);

    const loanBalanceRegFields = (payoutKey, payoutLabel) => {
        const loanFromMortgage =
            mortgageLoanDefault !== '' && String(form.currentLoanAmount) === String(mortgageLoanDefault);
        const regFromCard =
            registrationFeeDefault !== '' && form.registrationExpense === registrationFeeDefault;
        const balanceDisplay = String(
            computeDispositionBalanceInHand(
                form[payoutKey],
                form.currentLoanAmount,
                form.registrationExpense,
                form.otherExpense,
            ),
        );

        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                            Current loan amount (AED)
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={form.currentLoanAmount}
                            onChange={(e) =>
                                setForm((p) =>
                                    applyDispositionFinancialBalance(p, payoutKey, {
                                        currentLoanAmount: e.target.value.replace(/\D/g, '').slice(0, 12),
                                    }),
                                )
                            }
                            placeholder="0"
                            disabled={loading}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                        {loanFromMortgage ? (
                            <p className="text-[10px] text-slate-500 px-1">From mortgage loan amount.</p>
                        ) : null}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                            Balance in hand (AED) — auto
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={balanceDisplay}
                            readOnly
                            placeholder="0"
                            disabled={loading}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-800 cursor-not-allowed"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                            Registration expense (AED)
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={form.registrationExpense}
                            onChange={(e) =>
                                setForm((p) =>
                                    applyDispositionFinancialBalance(p, payoutKey, {
                                        registrationExpense: e.target.value.replace(/\D/g, '').slice(0, 12),
                                    }),
                                )
                            }
                            placeholder="0"
                            disabled={loading}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                        {regFromCard ? (
                            <p className="text-[10px] text-slate-500 px-1">From registration card value.</p>
                        ) : null}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                            Other expenses (AED)
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={form.otherExpense}
                            onChange={(e) =>
                                setForm((p) =>
                                    applyDispositionFinancialBalance(p, payoutKey, {
                                        otherExpense: e.target.value.replace(/\D/g, '').slice(0, 12),
                                    }),
                                )
                            }
                            placeholder="0"
                            disabled={loading}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800"
                        />
                    </div>
                </div>
                <p className="text-[11px] text-slate-500 px-1">
                    Balance in hand = |(current loan + registration expense + other expenses) − {payoutLabel}|.
                </p>
            </>
        );
    };

    if (!isOpen) return null;

    const assetDisp = String(asset?.vehicleDispositionStatus || 'active').toLowerCase();
    const isSold = assetDisp === 'sold';
    const isTotalLoss = assetDisp === 'total loss';
    const canEditDisposition =
        profileActivated && assetDisp === 'active' && !['pending_hr', 'pending_finance'].includes(
            String(dispositionWorkflowStage || '').toLowerCase(),
        );
    const dispositionPending = ['pending_hr', 'pending_finance'].includes(
        String(dispositionWorkflowStage || '').toLowerCase(),
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={loading ? undefined : onClose} />
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[720px] max-h-[90vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Edit basic details</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {!asset ? (
                    <p className="text-sm text-slate-500 py-8 text-center">Loading vehicle…</p>
                ) : (
                    <form onSubmit={handleSave} className="space-y-4 pt-4 overflow-y-auto flex-1 modal-scroll">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                Asset ID
                            </label>
                            <input
                                type="text"
                                value={form.assetId}
                                readOnly
                                disabled
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed"
                            />
                            <p className="text-[11px] text-slate-400 px-1">Asset ID cannot be changed.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                    Brand <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.brand}
                                    onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                                    placeholder="e.g. Toyota"
                                    disabled={loading}
                                    className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none ${errors.brand ? 'border-red-400' : ''}`}
                                />
                                {errors.brand && (
                                    <p className="text-[11px] font-medium text-red-500 px-1">{errors.brand}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                    Model <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Corolla"
                                    disabled={loading}
                                    className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none ${errors.name ? 'border-red-400' : ''}`}
                                />
                                {errors.name && (
                                    <p className="text-[11px] font-medium text-red-500 px-1">{errors.name}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1.5 md:col-span-1">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                    Emirate
                                </label>
                                <select
                                    value={form.plateEmirate}
                                    onChange={(e) => setForm((p) => ({ ...p, plateEmirate: e.target.value }))}
                                    disabled={loading}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                >
                                    {EMIRATES.map((em) => (
                                        <option key={em.value} value={em.value}>
                                            {em.value}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                    Plate code
                                </label>
                                <input
                                    type="text"
                                    value={form.plateCode}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            plateCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3),
                                        }))
                                    }
                                    placeholder="e.g. A"
                                    disabled={loading}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                    Plate number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.plateDigits}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            plateDigits: e.target.value.replace(/\D/g, '').slice(0, 6),
                                        }))
                                    }
                                    placeholder="Digits"
                                    disabled={loading}
                                    className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 ${errors.plateDigits ? 'border-red-400' : ''}`}
                                />
                                {errors.plateDigits && (
                                    <p className="text-[11px] font-medium text-red-500 px-1">{errors.plateDigits}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                    Model year <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.modelYear}
                                    onChange={(e) => setForm((p) => ({ ...p, modelYear: e.target.value }))}
                                    disabled={loading}
                                    className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none ${errors.modelYear ? 'border-red-400' : ''}`}
                                >
                                    <option value="">Select year</option>
                                    {yearOptions.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                                {errors.modelYear && (
                                    <p className="text-[11px] font-medium text-red-500 px-1">{errors.modelYear}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                    Current KM
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.currentKilometer}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            currentKilometer: e.target.value.replace(/\D/g, '').slice(0, 9),
                                        }))
                                    }
                                    placeholder="0"
                                    disabled={loading}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                Asset value (AED)
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.assetValue}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        assetValue: e.target.value.replace(/\D/g, '').slice(0, 12),
                                    }))
                                }
                                placeholder="0"
                                disabled={loading}
                                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                            />
                            <p className="text-[11px] text-slate-400 px-1">
                                Changing value may require administrator or Asset Controller rights.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div className="max-w-md space-y-1.5">
                                <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                    Status
                                </label>
                                {!profileActivated ? (
                                    <div className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 flex items-center text-sm font-semibold">
                                        Inactive
                                    </div>
                                ) : canEditDisposition ? (
                                    <select
                                        defaultValue="active"
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (v === 'sold' || v === 'total loss') {
                                                onOpenDispositionRequest?.(v);
                                                e.target.value = 'active';
                                            }
                                        }}
                                        disabled={loading}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    >
                                        <option value="active">Active</option>
                                        <option value="sold">Sold</option>
                                        <option value="total loss">Total loss</option>
                                    </select>
                                ) : (
                                    <div className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 flex items-center text-sm font-semibold capitalize">
                                        {isSold ? 'Sold' : isTotalLoss ? 'Total loss' : dispositionPending ? 'Active (request pending)' : 'Active'}
                                    </div>
                                )}
                                {dispositionPending && (
                                    <p className="text-[11px] text-amber-700 font-medium px-1">
                                        {String(dispositionWorkflowStage || '').toLowerCase() === 'pending_finance'
                                            ? 'After HR approval: either Accounts or Management submits once to finalize Sold / Total loss.'
                                            : 'A disposition request is in progress — use Review on the vehicle page header.'}
                                    </p>
                                )}
                                {dispositionPending && canOpenDispositionReview && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenDispositionReview?.()}
                                        className="mt-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black uppercase tracking-widest shadow-sm"
                                    >
                                        Review disposition
                                    </button>
                                )}
                                {dispositionPending && !canOpenDispositionReview && (
                                    <p className="text-[11px] text-slate-600 font-medium px-1 mt-1">
                                        If you are Accounts or Management, open this vehicle from the email link or use
                                        the bell (Pending requests). The assignee also sees a Review disposition button
                                        on the vehicle page under Basic details.
                                    </p>
                                )}
                            </div>

                            {isSold && (
                                <div className={PANEL_CLASS}>
                                    <div className="space-y-1.5 max-w-md">
                                        <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                            Sold value (AED) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={form.soldValue}
                                            onChange={(e) =>
                                                setForm((p) =>
                                                    applyDispositionFinancialBalance(p, 'soldValue', {
                                                        soldValue: e.target.value.replace(/\D/g, '').slice(0, 12),
                                                    }),
                                                )
                                            }
                                            placeholder="0"
                                            disabled={loading}
                                            className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 ${errors.soldValue ? 'border-red-400' : ''}`}
                                        />
                                        {errors.soldValue && (
                                            <p className="text-[11px] font-medium text-red-500 px-1">{errors.soldValue}</p>
                                        )}
                                    </div>
                                    {loanBalanceRegFields('soldValue', 'sold value')}
                                    {renderDocumentsBlock()}
                                </div>
                            )}

                            {isTotalLoss && (
                                <div className={PANEL_CLASS}>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                            Accident report
                                        </label>
                                        <div className="flex flex-wrap items-center gap-3 min-h-[2.75rem]">
                                            <div className="relative h-11 flex items-center rounded-xl border border-slate-200 bg-white px-4 min-w-[200px] flex-1">
                                                <input
                                                    type="file"
                                                    onChange={handleAccidentReportFile}
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    disabled={loading}
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                />
                                                <span className="text-[12px] font-bold text-slate-600 truncate">
                                                    {form.accidentReportFileName ||
                                                        (form.accidentReportUrl ? 'Replace file…' : 'Click to upload')}
                                                </span>
                                            </div>
                                            {form.accidentReportUrl && !form.accidentReportBase64 ? (
                                                <a
                                                    href={form.accidentReportUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 text-[12px] font-bold flex items-center gap-1 shrink-0"
                                                >
                                                    <Eye size={16} /> View current
                                                </a>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide px-1">
                                                Total loss value (AED) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={form.totalLossValue}
                                                onChange={(e) =>
                                                    setForm((p) =>
                                                        applyDispositionFinancialBalance(p, 'totalLossValue', {
                                                            totalLossValue: e.target.value
                                                                .replace(/\D/g, '')
                                                                .slice(0, 12),
                                                        }),
                                                    )
                                                }
                                                placeholder="0"
                                                disabled={loading}
                                                className={`w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 ${errors.totalLossValue ? 'border-red-400' : ''}`}
                                            />
                                            {errors.totalLossValue && (
                                                <p className="text-[11px] font-medium text-red-500 px-1">
                                                    {errors.totalLossValue}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {loanBalanceRegFields('totalLossValue', 'total loss value')}
                                    {renderDocumentsBlock()}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-6 h-11 rounded-xl border border-slate-200 text-[13px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 disabled:opacity-60"
                            >
                                {loading ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
