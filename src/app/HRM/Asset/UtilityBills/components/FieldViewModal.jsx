'use client';

import { X } from 'lucide-react';

export default function FieldViewModal({ isOpen, onClose, title = 'Details', fields = [] }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="px-4 sm:px-5 py-4 overflow-y-auto space-y-3">
                    {fields.map((f) => (
                        <div key={f.key || f.label} className="border-b border-gray-50 pb-3 last:border-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                {f.label}
                            </p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                                {f.value || '—'}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
