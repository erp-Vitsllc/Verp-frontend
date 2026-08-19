'use client';

import { CalendarDays, ShieldCheck, X } from 'lucide-react';

export default function LeaveRequestTypeModal({ isOpen, submitting = false, icon = null, onClose, onSelect }) {
    if (!isOpen) return null;

    const options = [
        {
            key: 'annual',
            label: 'Annual leave request',
            description: 'Full-day leave from date to date',
            Icon: CalendarDays,
            wrap: 'bg-indigo-50 text-indigo-600',
            border: 'hover:border-indigo-200',
        },
        {
            key: 'authorized',
            label: 'Authorized leave request',
            description: 'Full or half day authorized leave',
            Icon: ShieldCheck,
            wrap: 'bg-blue-50 text-blue-600',
            border: 'hover:border-blue-200',
        },
    ];

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={onClose}
                disabled={submitting}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        {icon}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Request</p>
                            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Leave</h2>
                            <p className="text-sm text-slate-500 mt-1">Choose the type of leave request</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-3">
                    {options.map((opt) => {
                        const OptionIcon = opt.Icon;
                        return (
                            <button
                                key={opt.key}
                                type="button"
                                disabled={submitting}
                                onClick={() => onSelect?.(opt.key)}
                                className={`w-full flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3.5 text-left transition-all ${opt.border} hover:bg-white hover:shadow-sm disabled:opacity-60`}
                            >
                                <span
                                    className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${opt.wrap}`}
                                >
                                    <OptionIcon size={20} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-slate-900">{opt.label}</span>
                                    <span className="block text-xs text-slate-500 mt-0.5">{opt.description}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
