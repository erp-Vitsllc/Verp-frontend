'use client';

import React from 'react';
import { AlertCircle, RefreshCw, XCircle, FileText } from 'lucide-react';
import { formatZohoDocumentNumber } from '@/utils/zohoDocumentNumber';

/**
 * Modal to ask HR for confirmation when editing an already-billed fine in Zoho.
 * Provides two choices:
 * 1. "Update Zoho" -> sends updateZoho: true (edits bill & payments in Zoho Books)
 * 2. "No Update" -> sends updateZoho: false (edits local ERP fine record only)
 */
export default function ZohoUpdateConfirmModal({
    isOpen,
    billNumber,
    record,
    onConfirmUpdate,
    onConfirmNoUpdate,
    onCancel,
    submitting = false,
}) {
    if (!isOpen) return null;

    const docNo = record ? formatZohoDocumentNumber(record) : (billNumber ? String(billNumber).trim() : '');
    const hasDocNo = Boolean(docNo && docNo !== '—');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 border border-slate-100/80 transform transition-all scale-100 space-y-5">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 mx-auto shadow-sm">
                    <AlertCircle className="w-7 h-7" />
                </div>

                <div className="text-center space-y-1.5">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                        Update Zoho Books Record?
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed px-2">
                        This fine is already billed in Zoho Books. Would you like to update the corresponding Bill and Payment details in Zoho Books as well?
                    </p>
                </div>

                {hasDocNo ? (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>Zoho Document Serial No.</span>
                        </div>
                        <div className="text-base font-extrabold text-blue-700 font-mono tracking-wide">
                            {docNo}
                        </div>
                        {billNumber && billNumber !== docNo ? (
                            <div className="text-[11px] text-slate-500 font-mono">
                                Bill #{billNumber}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <div className="space-y-2.5 pt-1">
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onConfirmUpdate}
                        className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                    >
                        {submitting ? (
                            <span className="flex items-center gap-2 text-white">
                                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                                <span className="text-white">Updating Zoho Books...</span>
                            </span>
                        ) : (
                            <>
                                <RefreshCw className="w-4.5 h-4.5 text-white" />
                                <span className="text-white">Update Zoho Bill & Payments</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onConfirmNoUpdate}
                        className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                        <XCircle className="w-4 h-4 text-slate-500" />
                        <span>No Update (Save ERP Only)</span>
                    </button>

                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onCancel}
                        className="w-full py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
