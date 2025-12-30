'use client';

import { X, AlertCircle, ShieldAlert } from 'lucide-react';

export default function FineTypeSelectionModal({ isOpen, onClose, onSelect }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[500px] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100">
                    <h3 className="text-[20px] font-semibold text-gray-800">Select Fine Category</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-6">
                    <button
                        onClick={() => onSelect('Violation')}
                        className="flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-red-100 hover:bg-red-50 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-800">Violation</h4>
                            <p className="text-sm text-gray-500">Fines related to policy violations or misconduct.</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect('Damage')}
                        className="flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-orange-100 hover:bg-orange-50 transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-800">Damage</h4>
                            <p className="text-sm text-gray-500">Fines related to property or asset damage.</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
