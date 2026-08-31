'use client';

import { Wallet, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MAIN_POLICY_REQUIRED_MESSAGE } from '../utils/mainSalaryPolicy';

export default function SalaryPolicyRequiredModal({ open, onClose }) {
    const router = useRouter();
    if (!open) return null;

    function goToPolicy() {
        onClose?.();
        router.push('/HRM/Salary/salary-policy');
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/30"
                aria-label="Close"
                onClick={onClose}
            />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-100">
                <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            Salary policy
                        </p>
                        <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-800">
                            Update salary policy first
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="px-4 sm:px-5 py-4">
                    <p className="text-sm text-slate-600 leading-relaxed">{MAIN_POLICY_REQUIRED_MESSAGE}</p>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                        Set and save the main salary policy at least once, then you can enroll employees.
                    </p>
                </div>
                <div className="flex justify-end gap-2 px-4 sm:px-5 py-3 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={goToPolicy}
                        className="h-10 px-4 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold inline-flex items-center gap-2"
                    >
                        <Wallet size={16} />
                        Open salary policy
                    </button>
                </div>
            </div>
        </div>
    );
}
