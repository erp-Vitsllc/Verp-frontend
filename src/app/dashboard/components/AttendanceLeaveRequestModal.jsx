'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Paperclip, X } from 'lucide-react';
import { ERP_ATTACHMENT_ACCEPT, ERP_ATTACHMENT_HINT, guardAttachmentFileChange, validateErpUploadFile } from '@/utils/uploadFileTypes';

const LEAVE_OPTIONS = [
    {
        key: 'sick_leave',
        label: 'Sick Leave',
        swatch: 'bg-[#22C55E]',
        selected: 'border-[#22C55E] bg-emerald-50/80',
    },
    {
        key: 'on_leave',
        label: 'Other leave',
        swatch: 'bg-[#6366F1]',
        selected: 'border-[#6366F1] bg-indigo-50/80',
    },
];

export default function AttendanceLeaveRequestModal({
    isOpen,
    dateKey,
    currentLabel = 'Unauthorized Leave',
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const fileRef = useRef(null);
    const [selectedKey, setSelectedKey] = useState('');
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setSelectedKey('');
        setReason('');
        setAttachment(null);
        setLocalError('');
    }, [isOpen, dateKey]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (submitting) return;
        onClose?.();
    };

    const handleAttachmentChange = (event) => {
        const result = guardAttachmentFileChange(event, (_, file) => {
            setAttachment(file);
            if (file) setLocalError('');
        });
        if (result?.blocked) setLocalError(result.message);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedKey) {
            setLocalError('Select a leave type.');
            return;
        }
        const trimmed = String(reason || '').trim();
        if (!trimmed) {
            setLocalError('Description is required.');
            return;
        }
        if (!attachment?.name) {
            setLocalError('Attachment is required.');
            return;
        }
        const attachmentCheck = validateErpUploadFile(attachment);
        if (!attachmentCheck.ok) {
            setLocalError(attachmentCheck.message);
            return;
        }
        setLocalError('');
        const opt = LEAVE_OPTIONS.find((o) => o.key === selectedKey);
        onSubmit?.({
            requestedStatusKey: selectedKey,
            requestedStatusLabel: opt?.label || selectedKey,
            reason: trimmed,
            attachmentName: attachment.name,
        });
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={handleClose}
                disabled={submitting}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                            Request leave status
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {dateKey}
                            <span className="mx-1.5 text-slate-300">·</span>
                            Currently <span className="text-slate-700">{currentLabel}</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
                            Leave type
                        </p>
                        <div className="space-y-2">
                            {LEAVE_OPTIONS.map((opt) => {
                                const active = selectedKey === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => setSelectedKey(opt.key)}
                                        className={`w-full flex items-center gap-3 h-12 px-3.5 rounded-xl border text-left transition-all disabled:opacity-50 ${
                                            active
                                                ? `${opt.selected} shadow-sm`
                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span
                                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${opt.swatch}`}
                                        />
                                        <span
                                            className={`flex-1 text-sm font-medium ${
                                                active ? 'text-slate-900' : 'text-slate-700'
                                            }`}
                                        >
                                            {opt.label}
                                        </span>
                                        {active ? (
                                            <span className="h-5 w-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center shrink-0">
                                                <Check size={12} strokeWidth={3} />
                                            </span>
                                        ) : (
                                            <span className="h-5 w-5 rounded-full border border-slate-200 shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <label className="block">
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Description
                        </span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            required
                            placeholder="Briefly explain why you need this leave status…"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-y min-h-[88px]"
                        />
                    </label>

                    <div>
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Attachment
                        </span>
                        <input
                            ref={fileRef}
                            type="file"
                            accept={ERP_ATTACHMENT_ACCEPT}
                            className="hidden"
                            onChange={handleAttachmentChange}
                        />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="w-full flex items-center gap-3 h-12 px-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-400 transition-colors text-left"
                        >
                            <span className="h-8 w-8 rounded-lg bg-white border border-slate-200 inline-flex items-center justify-center text-slate-500 shrink-0">
                                <Paperclip size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-slate-800 truncate">
                                    {attachment ? attachment.name : 'Choose a file'}
                                </span>
                                <span className="block text-xs text-slate-400 mt-0.5">
                                    {attachment ? 'Click to change' : `Required · ${ERP_ATTACHMENT_HINT}`}
                                </span>
                            </span>
                        </button>
                    </div>

                    {localError || error ? (
                        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                            {localError || error}
                        </p>
                    ) : null}

                    <div className="flex items-center gap-2.5 pt-1 pb-1">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={handleClose}
                            className="flex-1 h-11 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                        >
                            {submitting ? 'Sending…' : 'Send to reportee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
