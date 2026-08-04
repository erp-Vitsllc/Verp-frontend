'use client';

import { X } from 'lucide-react';

/**
 * Simple choice picker for Asset History header actions (Transfer / Return).
 */
export default function AssetHeaderChoiceModal({
    isOpen,
    onClose,
    title = 'Choose action',
    subtitle = '',
    options = [],
}) {
    if (!isOpen) return null;

    const visible = (options || []).filter((o) => o && o.visible !== false);

    return (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">{title}</h2>
                        {subtitle ? (
                            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{subtitle}</p>
                        ) : null}
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
                <div className="p-5 grid grid-cols-1 gap-3">
                    {visible.length === 0 ? (
                        <p className="text-center text-sm text-slate-500 py-8">No actions available.</p>
                    ) : (
                        visible.map((opt) => (
                            <button
                                key={opt.key || opt.label}
                                type="button"
                                disabled={opt.disabled}
                                onClick={() => {
                                    if (opt.disabled) return;
                                    opt.onClick?.();
                                    onClose?.();
                                }}
                                className={`min-h-[52px] rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-wide text-center leading-tight transition-all ${
                                    opt.disabled
                                        ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400'
                                        : 'hover:opacity-90 hover:shadow-md active:scale-[0.98] text-slate-700 bg-[#dde5c8]'
                                }`}
                            >
                                {opt.displayLabel || opt.label}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
