'use client';

import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, FileText, DollarSign } from 'lucide-react';

export default function MarkAsLiveModal({ isOpen, onClose, onConfirm, assetName }) {
    const [serviceReport, setServiceReport] = useState('');
    const [amount, setAmount] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const fileRef = useRef(null);

    if (!isOpen) return null;

    const readFile = (file) =>
        new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve({ data: base64, name: file.name, mimeType: file.type });
            };
            reader.readAsDataURL(file);
        });

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const parsed = await readFile(file);
        setAttachment(parsed);
    };

    const validate = () => {
        const errs = {};
        if (!serviceReport.trim()) errs.serviceReport = 'Service report is required';
        if (!amount || isNaN(amount)) errs.amount = 'Valid amount is required';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            await onConfirm({
                serviceReport,
                amount: parseFloat(amount),
                attachment: attachment || undefined,
            });
            // Reset
            setServiceReport('');
            setAmount('');
            setAttachment(null);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_30px_rgba(0,0,0,0.12)] w-full max-w-lg flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                            <CheckCircle size={16} />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-bold text-gray-900">Mark as Live</h3>
                            {assetName && (
                                <p className="text-[11px] text-slate-400 font-normal">{assetName}</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">

                    {/* Amount */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <DollarSign size={13} className="text-slate-500" />
                            Service Amount <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            placeholder="Enter service cost..."
                            value={amount}
                            onChange={(e) => {
                                setAmount(e.target.value);
                                if (errors.amount) setErrors(p => ({ ...p, amount: '' }));
                            }}
                            className={`w-full h-11 px-4 rounded-xl border ${errors.amount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all`}
                        />
                        {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                    </div>

                    {/* Service Report */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <FileText size={13} className="text-slate-500" />
                            Service Report <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={serviceReport}
                            onChange={(e) => {
                                setServiceReport(e.target.value);
                                if (errors.serviceReport) setErrors(p => ({ ...p, serviceReport: '' }));
                            }}
                            placeholder="Describe what was done during service..."
                            rows={4}
                            className={`w-full px-4 py-3 rounded-xl border ${errors.serviceReport ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all`}
                        />
                        {errors.serviceReport && <p className="text-xs text-red-500">{errors.serviceReport}</p>}
                    </div>

                    {/* Attachment */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Upload size={13} className="text-slate-500" />
                            Attachment
                        </label>
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center gap-3 cursor-pointer hover:bg-gray-100 hover:border-emerald-300 transition-all"
                        >
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                <FileText size={14} className="text-emerald-500" />
                            </div>
                            <span className="text-sm text-gray-500 truncate">
                                {attachment ? attachment.name : 'Click to upload report / invoice (PDF / image)'}
                            </span>
                        </div>
                        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <CheckCircle size={14} />
                        {submitting ? 'Completing...' : 'Complete & Mark Live'}
                    </button>
                </div>
            </div>
        </div>
    );
}
