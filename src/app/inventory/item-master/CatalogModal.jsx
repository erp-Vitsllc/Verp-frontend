'use client';

export default function CatalogModal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                    <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-700" aria-label="Close">
                        Close
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export const fieldClass = 'h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500';
export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';
