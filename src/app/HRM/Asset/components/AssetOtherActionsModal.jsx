'use client';

import { X } from 'lucide-react';

/**
 * Secondary asset actions moved out of the main 2×3 header grid (OTHERS button).
 */
export default function AssetOtherActionsModal({ isOpen, onClose, actions = [] }) {
    if (!isOpen) return null;

    const visible = actions.filter((a) => a.visible !== false);

    return (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">Other actions</h2>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Additional asset operations</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
                    {visible.length === 0 ? (
                        <p className="col-span-full text-center text-sm text-slate-500 py-8">No additional actions available.</p>
                    ) : (
                        visible.map((action) => (
                            <button
                                key={action.key || action.label}
                                type="button"
                                disabled={action.disabled}
                                onClick={() => {
                                    if (action.disabled) return;
                                    action.onClick?.();
                                    onClose?.();
                                }}
                                className={`min-h-[52px] rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-wide text-center leading-tight transition-all
                                    ${action.disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400' : 'hover:opacity-90 hover:shadow-md active:scale-[0.98] text-slate-700 bg-[#dde5c8]'}`}
                            >
                                {action.loading ? 'Please wait…' : action.displayLabel || action.label}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
