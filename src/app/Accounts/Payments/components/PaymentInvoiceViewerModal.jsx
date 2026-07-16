'use client';

import { FileText, X } from 'lucide-react';
import PaymentReceipt from '@/app/Accounts/Payments/components/PaymentReceipt';

/**
 * Modal that shows the Accounts Payments RECEIPT (same as Payments / salary invoice view).
 */
export default function PaymentInvoiceViewerModal({ payment, onClose }) {
    if (!payment) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="text-blue-600" size={20} />
                        Payment Invoice
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                        aria-label="Close"
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-100/50">
                    <PaymentReceipt payment={payment} />
                </div>
                <div className="p-6 bg-white border-t border-gray-100 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
