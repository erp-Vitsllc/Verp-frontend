'use client';

import { X, ArrowRightLeft, UserRound, CalendarClock } from 'lucide-react';

export default function TransferChoiceModal({ isOpen, onClose, onSelectLeaveEos, onSelectAssignee }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Transfer</h2>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Choose transfer type</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 grid grid-cols-1 gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            onSelectLeaveEos();
                            onClose();
                        }}
                        className="flex items-center gap-4 p-4 border-2 border-slate-100 rounded-2xl hover:border-amber-300 hover:bg-amber-50/50 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-105 transition-transform">
                            <CalendarClock size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">Transfer for Leave / End of Service</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Send asset to store — requires approval from the other party</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            onSelectAssignee();
                            onClose();
                        }}
                        className="flex items-center gap-4 p-4 border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition-transform">
                            <UserRound size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">Transfer Assignee</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Reassign this asset to another employee</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
