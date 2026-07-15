'use client';

import { Upload, X } from 'lucide-react';

/**
 * Upload source picker — Use previous (above) or New upload.
 * Rendered as a fixed modal so table overflow cannot clip it.
 */
export default function AttachmentSourceModal({
    isOpen,
    onClose,
    onUsePrevious,
    onUseNew,
    previousLabel = '',
    previousAvailable = false,
    accountNo = '',
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/45">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Upload attachment</h2>
                        {accountNo ? (
                            <p className="text-xs text-gray-500 mt-0.5">Account {accountNo}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-2">
                    <button
                        type="button"
                        disabled={!previousAvailable}
                        onClick={onUsePrevious}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <p className="text-sm font-semibold text-gray-800">Upload previous</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            {previousLabel || 'Use file from the row above'}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={onUseNew}
                        className="w-full text-left px-4 py-3 rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-50 transition-colors"
                    >
                        <p className="text-sm font-semibold text-teal-800 inline-flex items-center gap-1.5">
                            <Upload size={14} strokeWidth={2.25} />
                            Upload new
                        </p>
                        <p className="text-[11px] text-teal-700/80 mt-0.5">
                            Pick a file from this device
                        </p>
                    </button>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
