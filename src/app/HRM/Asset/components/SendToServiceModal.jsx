'use client';

import { useState, useRef } from 'react';
import { X, Upload, Wrench, FileText, Clock } from 'lucide-react';

const DURATION_OPTIONS = [
    '1 Day', '2 Days', '3 Days', '4 Days', '5 Days',
    '1 Week', '2 Weeks', '3 Weeks',
    '1 Month', '2 Months', '3 Months',
    'Custom'
];

export default function SendToServiceModal({ isOpen, onClose, onConfirm, assetName }) {
    const [serviceDuration, setServiceDuration] = useState('');
    const [customDuration, setCustomDuration] = useState('');
    const [serviceIssue, setServiceIssue] = useState('');
    const [invoice, setInvoice] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const invoiceRef = useRef(null);

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

    const handleInvoiceChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const parsed = await readFile(file);
        setInvoice(parsed);
    };

    const validate = () => {
        const errs = {};
        if (!serviceDuration) errs.serviceDuration = 'Service duration is required';
        if (serviceDuration === 'Custom' && !customDuration.trim()) errs.customDuration = 'Please specify the duration';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            await onConfirm({
                serviceDuration: serviceDuration === 'Custom' ? customDuration.trim() : serviceDuration,
                description: serviceIssue,
                invoice: invoice || undefined,
            });
            // Reset
            setServiceDuration('');
            setCustomDuration('');
            setServiceIssue('');
            setInvoice(null);
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
                        <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-white">
                            <Wrench size={16} />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-bold text-gray-900">Send to Service</h3>
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

                    {/* Service Duration */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Clock size={13} className="text-slate-500" />
                            Service Duration <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={serviceDuration}
                            onChange={(e) => {
                                setServiceDuration(e.target.value);
                                if (errors.serviceDuration) setErrors(p => ({ ...p, serviceDuration: '' }));
                            }}
                            className={`w-full h-11 px-4 rounded-xl border ${errors.serviceDuration ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 transition-all`}
                        >
                            <option value="">Select duration</option>
                            {DURATION_OPTIONS.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        {errors.serviceDuration && <p className="text-xs text-red-500">{errors.serviceDuration}</p>}

                        {serviceDuration === 'Custom' && (
                            <input
                                type="text"
                                placeholder="e.g. 10 days, 6 weeks..."
                                value={customDuration}
                                onChange={(e) => {
                                    setCustomDuration(e.target.value);
                                    if (errors.customDuration) setErrors(p => ({ ...p, customDuration: '' }));
                                }}
                                className={`mt-2 w-full h-11 px-4 rounded-xl border ${errors.customDuration ? 'border-red-400' : 'border-gray-200'} bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-slate-500/20`}
                            />
                        )}
                        {errors.customDuration && <p className="text-xs text-red-500">{errors.customDuration}</p>}
                    </div>

                    {/* Service Issue */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Service Issue</label>
                        <textarea
                            value={serviceIssue}
                            onChange={(e) => setServiceIssue(e.target.value)}
                            placeholder="Describe the issue or reason for service..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-slate-500/20 resize-none transition-all"
                        />
                    </div>

                    {/* Invoice */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Upload size={13} className="text-slate-500" />
                            Invoice / Service Report
                        </label>
                        <div
                            onClick={() => invoiceRef.current?.click()}
                            className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center gap-3 cursor-pointer hover:bg-gray-100 hover:border-slate-300 transition-all"
                        >
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <FileText size={14} className="text-amber-500" />
                            </div>
                            <span className="text-sm text-gray-500 truncate">
                                {invoice ? invoice.name : 'Click to upload invoice (PDF / image)'}
                            </span>
                        </div>
                        <input ref={invoiceRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleInvoiceChange} />
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
                        className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <Wrench size={14} />
                        {submitting ? 'Sending...' : 'Send to Service'}
                    </button>
                </div>
            </div>
        </div>
    );
}
