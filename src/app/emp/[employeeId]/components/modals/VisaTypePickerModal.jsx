'use client';

import { EMPLOYEE_VISA_TYPES } from '@/utils/employeeVisaValidation';

export default function VisaTypePickerModal({ isOpen, onClose, onSelect }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 p-6">
                <h3 className="text-xl font-semibold text-gray-800 text-center">Select Visa Type</h3>
                <p className="text-sm text-gray-500 text-center mt-1 mb-5">Choose the visa category to add</p>
                <div className="space-y-2">
                    {EMPLOYEE_VISA_TYPES.map((type) => (
                        <button
                            key={type.key}
                            type="button"
                            onClick={() => onSelect(type.key)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-blue-200 transition-colors"
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-5 w-full text-center text-sm font-semibold text-red-500 hover:text-red-600"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
