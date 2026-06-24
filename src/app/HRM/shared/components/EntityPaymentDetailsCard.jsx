'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Banknote, FileText, Loader2, Plus, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import AddPaymentModal from '@/app/Accounts/Payments/components/AddPaymentModal';
import PaymentReceipt from '@/app/Accounts/Payments/components/PaymentReceipt';
import { FineFormCard, formatMoney } from '../../Fine/components/FineFormCardShared';

function formatPaymentDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

async function fetchEntityPayments({ entityType, referenceId }) {
    const params = { limit: 50 };

    if (entityType === 'Fine') {
        params.referenceId = referenceId;
        params.relatedEntityType = 'Fine';
    } else {
        params.referenceId = referenceId;
        params.relatedEntityType = 'Loan';
        params.paymentType = entityType === 'Advance' ? 'Advance' : 'Loan';
    }

    const response = await axiosInstance.get('/Payment', { params });
    const list = response.data?.payments || (Array.isArray(response.data) ? response.data : []);

    return list.sort((a, b) => {
        const ta = new Date(a.paymentDate || a.createdAt || 0).getTime();
        const tb = new Date(b.paymentDate || b.createdAt || 0).getTime();
        return tb - ta;
    });
}

function buildFinePrefill(fine, employeeId, balance, pathname) {
    return {
        employeeId,
        returnTo: pathname,
        fines: [
            {
                _id: fine._id,
                fineId: fine.fineId,
                fineAmount: fine.fineAmount || fine.totalFineAmount,
                balance,
                employeeShare: balance,
                paidAmount: fine.paidAmount || 0,
                monthStart: fine.monthStart,
                payableDuration: fine.payableDuration,
                assignedEmployees: fine.assignedEmployees,
                fineType: fine.fineType,
                category: fine.category,
                serviceCharge: fine.serviceCharge,
                companyAmount: fine.companyAmount,
                employeeAmount: fine.employeeAmount,
                responsibleFor: fine.responsibleFor,
            },
        ],
    };
}

function buildLoanPrefill(loan, balance, pathname) {
    return {
        employeeId: loan.employeeId,
        returnTo: pathname,
        balance,
        loan: {
            _id: loan._id || loan.id,
            id: loan._id || loan.id,
            loanId: loan.loanId,
            amount: loan.amount,
            paidAmount: loan.paidAmount || 0,
            duration: loan.duration,
            monthStart: loan.monthStart,
            type: loan.type,
            employeeId: loan.employeeId,
        },
    };
}

export default function EntityPaymentDetailsCard({
    entityType = 'Loan',
    referenceId,
    relatedEntityId,
    totalPayable = 0,
    paidAmount = 0,
    typeLabel = 'Record',
    entityRecord = null,
    employeeId = '',
    isPayable = true,
    onPaymentSuccess,
}) {
    const pathname = usePathname();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [paymentPrefill, setPaymentPrefill] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const loadPayments = useCallback(async () => {
        if (!referenceId && !relatedEntityId) {
            setPayments([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setFetchError('');

        try {
            const list = await fetchEntityPayments({ entityType, referenceId, relatedEntityId });
            setPayments(list);
        } catch {
            setPayments([]);
            setFetchError('Unable to load payment records.');
        } finally {
            setLoading(false);
        }
    }, [entityType, referenceId, relatedEntityId]);

    useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    const total = Number(totalPayable) || 0;
    const paid = Number(paidAmount) || 0;
    const remaining = Math.max(0, total - paid);

    const visiblePayments = payments.filter(
        (p) => !['Rejected', 'Cancelled', 'Failed'].includes(p.status)
    );

    const canPay = isPayable && remaining > 0.01 && Boolean(entityRecord);

    const handleOpenPayModal = () => {
        if (!entityRecord) return;

        if (entityType === 'Fine') {
            setPaymentPrefill(buildFinePrefill(entityRecord, employeeId, remaining, pathname));
        } else {
            setPaymentPrefill(buildLoanPrefill(entityRecord, remaining, pathname));
        }
        setIsPayModalOpen(true);
    };

    const handlePaymentSuccess = async () => {
        setIsPayModalOpen(false);
        setPaymentPrefill(null);
        await loadPayments();
        onPaymentSuccess?.();
    };

    const payButton = canPay ? (
        <button
            type="button"
            onClick={handleOpenPayModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
        >
            <Plus size={14} />
            Pay
        </button>
    ) : null;

    return (
        <>
            <FineFormCard
                icon={Banknote}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                title="Payment Details"
                subtitle={`Payments recorded against this ${typeLabel.toLowerCase()}`}
                headerAction={payButton}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading payments...
                    </div>
                ) : fetchError ? (
                    <p className="text-sm text-gray-400 text-center py-8">{fetchError}</p>
                ) : visiblePayments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No payment here</p>
                ) : (
                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                        {visiblePayments.map((payment) => {
                            const pid = payment.paymentId || payment._id;

                            return (
                                <div
                                    key={payment._id || pid}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedInvoice(payment)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedInvoice(payment);
                                        }
                                    }}
                                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">
                                            {pid || '—'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {formatPaymentDate(payment.paymentDate || payment.createdAt)}
                                            {' · '}
                                            {payment.paymentSource || 'Salary'}
                                            {' · '}
                                            {payment.status || 'Pending'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <p className="text-sm font-bold text-red-600 whitespace-nowrap">
                                            {formatMoney(payment.amount)} AED
                                        </p>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedInvoice(payment);
                                            }}
                                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap inline-flex items-center gap-1"
                                        >
                                            <FileText size={13} />
                                            Invoice
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </FineFormCard>

            <AddPaymentModal
                isOpen={isPayModalOpen}
                onClose={() => {
                    setIsPayModalOpen(false);
                    setPaymentPrefill(null);
                }}
                onSuccess={handlePaymentSuccess}
                prefill={paymentPrefill}
            />

            {selectedInvoice && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="text-blue-600" size={20} />
                                Payment Invoice
                            </h3>
                            <button
                                type="button"
                                onClick={() => setSelectedInvoice(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-100/50">
                            <PaymentReceipt payment={selectedInvoice} />
                        </div>
                        <div className="p-6 bg-white border-t border-gray-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedInvoice(null)}
                                className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
