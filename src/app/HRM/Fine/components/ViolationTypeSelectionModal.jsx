'use client';

import { X, Truck, ShieldCheck } from 'lucide-react';

export default function ViolationTypeSelectionModal({ isOpen, onClose, onSelect, onBack }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[500px] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onBack}
                            className="text-gray-400 hover:text-gray-600 transition-colors mr-2"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">Violation Type</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-6">
                    <button
                        onClick={() => onSelect('Vehicle Fine')}
                        className="flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-blue-100 hover:bg-blue-50 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Truck size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-800">Vehicle Fine</h4>
                            <p className="text-sm text-gray-500">Fines related to company vehicles.</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect('Safety Fine')}
                        className="flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-green-100 hover:bg-green-50 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-800">Safety Fine</h4>
                            <p className="text-sm text-gray-500">Fines related to safety protocol violations.</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
