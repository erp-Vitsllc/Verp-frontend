'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Banknote, FileText, Loader2, Plus, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import AddPaymentModal from '@/app/Accounts/Payments/components/AddPaymentModal';
import PaymentReceipt from '@/app/Accounts/Payments/components/PaymentReceipt';
import { FineFormCard, formatMoney } from '../../Fine/components/FineFormCardShared';
import { buildEntityPaymentSchedule } from '../utils/buildEntityPaymentSchedule';
import EntityPaymentScheduleBoxes from './EntityPaymentScheduleBoxes';
import {
    getPaymentAmountTextClass,
    getPaymentStatusBadgeClass,
    getPaymentStatusLabel,
    getPaymentStatusSurfaceClass,
    isPaymentCountableTowardPaid,
} from '@/utils/paymentStatusDisplay';

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
    const isEos = (fine.sourceOfIncome || 'Salary') === 'End of Service';
    return {
        employeeId,
        returnTo: pathname,
        paymentSource: isEos ? 'End of Benefits' : 'Salary',
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
                sourceOfIncome: fine.sourceOfIncome || 'Salary',
            },
        ],
    };
}

function formatPaymentSourceLabel(source) {
    if (source === 'End of Benefits') return 'End of Service';
    return source || 'Salary';
}

function PaymentList({ payments, onSelect, emptyMessage = 'No payment here' }) {
    if (!payments.length) {
        return <p className="text-sm text-gray-400 text-center py-4">{emptyMessage}</p>;
    }

    return (
        <div className="space-y-2">
            {payments.map((payment) => {
                const pid = payment.paymentId || payment._id;
                const statusLabel = getPaymentStatusLabel(payment.status);
                const surfaceClass = getPaymentStatusSurfaceClass(payment.status);
                const badgeClass = getPaymentStatusBadgeClass(payment.status);
                const amountClass = getPaymentAmountTextClass(payment.status);

                return (
                    <div
                        key={payment._id || pid}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(payment)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(payment);
                            }
                        }}
                        className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${surfaceClass}`}
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                    {pid || '—'}
                                </p>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${badgeClass}`}>
                                    {statusLabel}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {formatPaymentDate(payment.paymentDate || payment.createdAt)}
                                {' · '}
                                {formatPaymentSourceLabel(payment.paymentSource)}
                            </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <p className={`text-sm font-bold whitespace-nowrap ${amountClass}`}>
                                {formatMoney(payment.amount)} AED
                            </p>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(payment);
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
    );
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
    const salaryPayments = visiblePayments.filter(
        (p) => (p.paymentSource || 'Salary') === 'Salary'
    );
    const eosPayments = visiblePayments.filter((p) => p.paymentSource === 'End of Benefits');

    const schedulePayments = useMemo(
        () => visiblePayments.filter((p) => isPaymentCountableTowardPaid(p.status)),
        [visiblePayments]
    );

    const scheduleBoxes = useMemo(() => {
        if (!entityRecord) return [];
        return buildEntityPaymentSchedule({
            entityType,
            entity: entityRecord,
            payments: schedulePayments,
            employeeId,
        });
    }, [entityRecord, entityType, schedulePayments, employeeId]);

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
                {entityRecord && scheduleBoxes.length > 0 ? (
                    <EntityPaymentScheduleBoxes boxes={scheduleBoxes} />
                ) : null}

                {loading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Loading payments...
                    </div>
                ) : fetchError ? (
                    <p className="text-sm text-gray-400 text-center py-8">{fetchError}</p>
                ) : (
                    <div className="space-y-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                                Recorded Payments
                            </p>
                            {entityType === 'Fine' && (entityRecord?.sourceOfIncome || 'Salary') === 'End of Service' ? (
                                <PaymentList
                                    payments={eosPayments.length > 0 ? eosPayments : visiblePayments}
                                    onSelect={setSelectedInvoice}
                                    emptyMessage="No payments recorded yet"
                                />
                            ) : (
                                <>
                                    <PaymentList
                                        payments={salaryPayments}
                                        onSelect={setSelectedInvoice}
                                        emptyMessage="No payments recorded yet"
                                    />
                                    {eosPayments.length > 0 ? (
                                        <div className="mt-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
                                                End of Service
                                            </p>
                                            <PaymentList
                                                payments={eosPayments}
                                                onSelect={setSelectedInvoice}
                                            />
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
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
