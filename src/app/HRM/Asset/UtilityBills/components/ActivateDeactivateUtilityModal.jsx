'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';

const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
    });
}

/**
 * Activate / Deactivate utility entry — mandatory reason, optional attachment, then HR approval.
 */
export default function ActivateDeactivateUtilityModal({
    isOpen,
    onClose,
    entry,
    targetStatus,
    onSubmit,
    saving = false,
}) {
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    const isActivate = targetStatus === 'Active';
    const title = isActivate ? 'Activate Utility' : 'Deactivate Utility';

    useEffect(() => {
        if (!isOpen) return;
        setReason('');
        setAttachment(null);
        setError('');
    }, [isOpen, entry?.id, targetStatus]);

    if (!isOpen || !entry) return null;

    const handleFile = async (fileList) => {
        const file = fileList?.[0];
        if (!file) return;
        if (file.size > MAX_ATTACHMENT_BYTES) {
            setError('Attachment must be 1.5 MB or smaller.');
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setAttachment({
                name: file.name,
                mime: file.type || 'application/octet-stream',
                dataUrl,
            });
            setError('');
        } catch {
            setError('Could not read the selected file.');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const text = String(reason || '').trim();
        if (text.length < 3) {
            setError('Reason is required (at least 3 characters).');
            return;
        }
        onSubmit?.({
            reason: text,
            attachment: attachment?.name && attachment?.dataUrl ? attachment : null,
            requestedStatus: targetStatus,
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="px-4 sm:px-5 py-4 space-y-4">
                        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-sm text-gray-600">
                            <p>
                                <span className="font-semibold text-gray-800">{entry.type}</span>
                                {entry.values?.accountNumber
                                    ? ` · Acc ${entry.values.accountNumber}`
                                    : ''}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                This will be sent to HR for approval. Status changes only after HR
                                approves.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    setError('');
                                }}
                                rows={3}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                                placeholder={
                                    isActivate
                                        ? 'Why should this utility be activated?'
                                        : 'Why should this utility be deactivated?'
                                }
                                disabled={saving}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Attachment
                            </label>
                            <input
                                ref={fileRef}
                                type="file"
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,image/*,application/pdf"
                                onChange={(e) => handleFile(e.target.files)}
                            />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={saving}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:bg-teal-50 hover:border-teal-300 px-3 py-2.5 text-sm font-medium text-gray-700"
                            >
                                <Paperclip size={16} />
                                {attachment?.name ? 'Change file' : 'Upload supporting file'}
                            </button>
                            {attachment?.name ? (
                                <p className="mt-1.5 text-xs text-teal-700 font-medium truncate">
                                    {attachment.name}
                                </p>
                            ) : (
                                <p className="mt-1.5 text-xs text-gray-400">Max 1.5 MB</p>
                            )}
                        </div>

                        {error ? (
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                        ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/80">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${
                                isActivate
                                    ? 'bg-teal-500 hover:bg-teal-600'
                                    : 'bg-amber-500 hover:bg-amber-600'
                            }`}
                        >
                            {saving ? 'Submitting…' : 'Submit to HR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
