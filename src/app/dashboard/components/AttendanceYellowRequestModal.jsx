'use client';

import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { ERP_ATTACHMENT_ACCEPT, ERP_ATTACHMENT_HINT, guardAttachmentFileChange, validateErpUploadFile } from '@/utils/uploadFileTypes';

export default function AttendanceYellowRequestModal({
    isOpen,
    dateKey,
    currentLabel = 'Late / Early / Mispunch',
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const fileRef = useRef(null);
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [localError, setLocalError] = useState('');

    if (!isOpen) return null;

    const handleAttachmentChange = (event) => {
        const result = guardAttachmentFileChange(event, (_, file) => {
            setAttachment(file);
            if (file) setLocalError('');
        });
        if (result?.blocked) setLocalError(result.message);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = String(reason || '').trim();
        if (!trimmed) {
            setLocalError('Reason is required.');
            return;
        }
        if (attachment) {
            const check = validateErpUploadFile(attachment);
            if (!check.ok) {
                setLocalError(check.message);
                return;
            }
        }
        setLocalError('');
        onSubmit?.({
            reason: trimmed,
            attachmentName: attachment?.name || '',
        });
    };

    const handleClose = () => {
        if (submitting) return;
        setReason('');
        setAttachment(null);
        setLocalError('');
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={handleClose}
                disabled={submitting}
            />
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Clarify yellow day</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {dateKey} · {currentLabel}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    <p className="text-xs text-slate-500">
                        Send reason and attachment to your primary reportee. If confirmed, this day
                        becomes Present (green).
                    </p>

                    <label className="block">
                        <span className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Reason
                        </span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            required
                            placeholder="Explain the late / early / mispunch…"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 resize-y min-h-[80px]"
                        />
                    </label>

                    <div>
                        <span className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Attachment
                        </span>
                        <input
                            ref={fileRef}
                            type="file"
                            accept={ERP_ATTACHMENT_ACCEPT}
                            className="hidden"
                            onChange={handleAttachmentChange}
                        />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100"
                            >
                                <Paperclip size={14} className="text-slate-500" />
                                {attachment ? 'Change file' : 'Choose file'}
                            </button>
                            <span className="text-xs text-slate-500 truncate max-w-[10rem]">
                                {attachment ? attachment.name : ERP_ATTACHMENT_HINT}
                            </span>
                        </div>
                    </div>

                    {localError || error ? (
                        <p className="text-xs text-rose-500">{localError || error}</p>
                    ) : null}

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={handleClose}
                            className="flex-1 h-10 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 h-10 rounded-xl text-sm font-semibold text-slate-900 bg-[#F1C40F] hover:bg-[#e3b70e] disabled:opacity-50"
                        >
                            {submitting ? 'Sending…' : 'Send to reportee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
