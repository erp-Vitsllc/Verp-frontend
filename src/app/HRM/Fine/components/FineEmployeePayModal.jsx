'use client';

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { FileText, Loader2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { resolveEmployeeFinePayableAmount } from '@/utils/finePayableAmount';
import {
    ERP_ATTACHMENT_ACCEPT,
    ERP_ATTACHMENT_HINT,
    validateErpUploadFile,
} from '@/utils/uploadFileTypes';

const COMPANY_IDS = new Set(['VEGA-HR-0000', 'VEGA_INTERNAL']);

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 8,
        borderColor: state.isFocused ? '#059669' : '#d1d5db',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(5, 150, 105, 0.2)' : 'none',
        backgroundColor: '#fff',
        fontSize: '13px',
        '&:hover': { borderColor: state.isFocused ? '#059669' : '#9ca3af' },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 100000 }),
};

const SOURCE_OPTIONS = [
    { value: 'Salary', label: 'Salary' },
    { value: 'Cash', label: 'Cash' },
];

function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
}

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function amountsMatch(a, b) {
    return Math.abs(roundMoney(a) - roundMoney(b)) <= 0.009;
}

function employeeParties(fine) {
    return (fine?.assignedEmployees || []).filter(
        (e) => e?.employeeId && !COMPANY_IDS.has(String(e.employeeId)),
    );
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

export default function FineEmployeePayModal({
    isOpen,
    onClose,
    onSuccess,
    fine,
    employeeId = '',
}) {
    const { toast } = useToast();
    const [paidById, setPaidById] = useState('');
    const [paymentDate, setPaymentDate] = useState(todayInputValue());
    const [paymentSource, setPaymentSource] = useState('');
    const [amountPay, setAmountPay] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const parties = useMemo(() => employeeParties(fine), [fine]);
    const paidByOptions = useMemo(
        () =>
            parties.map((p) => ({
                value: String(p.employeeId),
                label: `${p.employeeName || p.employeeId} (${p.employeeId})`,
            })),
        [parties],
    );

    const payAmount = useMemo(() => {
        if (!fine || !paidById) return 0;
        const payable = resolveEmployeeFinePayableAmount(fine, paidById);
        return roundMoney(Math.max(0, payable - (Number(fine.paidAmount) || 0)));
    }, [fine, paidById]);

    const enteredAmount = roundMoney(amountPay);
    const amountsEqual = Boolean(paidById) && payAmount > 0.01 && amountsMatch(enteredAmount, payAmount);
    const amountMismatch =
        String(amountPay || '').trim() !== '' && !amountsEqual;

    const canSubmit =
        Boolean(fine?._id) &&
        Boolean(paidById) &&
        Boolean(paymentDate) &&
        Boolean(paymentSource) &&
        Boolean(attachment?.name) &&
        amountsEqual &&
        !submitting;

    useEffect(() => {
        if (!isOpen) return;
        const preferred =
            String(employeeId || '').trim() ||
            parties[0]?.employeeId ||
            '';
        setPaidById(preferred);
        setPaymentDate(todayInputValue());
        setPaymentSource('');
        setAmountPay('');
        setAttachment(null);
        setSubmitting(false);
    }, [isOpen, employeeId, fine?._id]);

    if (!isOpen) return null;

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const check = validateErpUploadFile(file);
        if (!check.ok) {
            toast({
                variant: 'destructive',
                title: 'Invalid attachment',
                description: check.message,
            });
            return;
        }
        try {
            const data = await readFileAsDataUrl(file);
            setAttachment({
                name: file.name,
                mimeType: file.type || '',
                data: typeof data === 'string' ? data : '',
            });
        } catch {
            toast({
                variant: 'destructive',
                title: 'Attachment failed',
                description: 'Could not read the selected file.',
            });
        }
    };

    const handlePay = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            const res = await axiosInstance.post('/Payment', {
                paymentType: 'Fine',
                paidBy: paidById,
                amount: enteredAmount,
                status: 'Completed',
                paymentDate,
                paymentSource,
                attachment,
                relatedEntityType: 'Fine',
                relatedEntityId: fine._id,
                referenceId: fine.fineId,
                description: `Paid by employee · ${fine.fineId || ''}`.trim(),
                remarks: 'Employee pay — salary/cash, invoice emailed, no Zoho',
                employeePaySettlement: true,
            });
            toast({
                title: 'Payment recorded',
                description:
                    res.data?.message ||
                    'Invoice emailed to the fined employee.',
                variant: 'success',
                className: 'bg-green-50 border-green-200 text-green-800',
            });
            onSuccess?.();
            onClose?.();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Payment failed',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Could not record employee payment.',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const selectedPaidBy = paidByOptions.find((o) => o.value === paidById) || null;
    const selectedSource = SOURCE_OPTIONS.find((o) => o.value === paymentSource) || null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45">
            <div className="absolute inset-0" onClick={onClose} aria-hidden />
            <div className="relative w-full max-w-[560px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                        <h2 className="text-[16px] font-semibold text-gray-800">Pay by employee</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            {fine?.fineId || 'Fine'} · invoice emails the fined employee
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                            Pay amount <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            readOnly
                            value={payAmount > 0 ? payAmount.toFixed(2) : '0.00'}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">Employee fine pay amount (AED)</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                                Payment date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                                Source <span className="text-red-500">*</span>
                            </label>
                            <Select
                                instanceId="fine-employee-pay-source"
                                value={selectedSource}
                                onChange={(opt) => setPaymentSource(opt?.value || '')}
                                options={SOURCE_OPTIONS}
                                placeholder="Salary or Cash"
                                styles={selectStyles}
                                menuPortalTarget={
                                    typeof document !== 'undefined' ? document.body : null
                                }
                                menuPosition="fixed"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                            Amount pay <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">
                                AED
                            </span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amountPay}
                                onChange={(e) => setAmountPay(e.target.value)}
                                placeholder={payAmount > 0 ? payAmount.toFixed(2) : '0.00'}
                                className={`w-full pl-12 pr-3 py-2.5 rounded-lg border text-sm font-bold ${
                                    amountMismatch
                                        ? 'border-rose-300 bg-rose-50 text-rose-800'
                                        : 'border-gray-200 text-gray-900'
                                }`}
                            />
                        </div>
                        {amountMismatch ? (
                            <p className="text-[11px] font-semibold text-rose-600 mt-1">
                                Amount Pay must equal Pay Amount (AED {payAmount.toFixed(2)}).
                            </p>
                        ) : (
                            <p className="text-[11px] text-gray-400 mt-1">
                                Must match the employee fine pay amount exactly.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                            Paid by <span className="text-red-500">*</span>
                        </label>
                        <Select
                            instanceId="fine-employee-pay-paid-by"
                            value={selectedPaidBy}
                            onChange={(opt) => {
                                setPaidById(opt?.value || '');
                                setAmountPay('');
                            }}
                            options={paidByOptions}
                            placeholder="Select employee"
                            styles={selectStyles}
                            menuPortalTarget={
                                typeof document !== 'undefined' ? document.body : null
                            }
                            menuPosition="fixed"
                            isDisabled={paidByOptions.length <= 1}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                            Attachment <span className="text-red-500">*</span>
                        </label>
                        <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-gray-200 hover:border-emerald-400 cursor-pointer bg-gray-50">
                            <FileText size={16} className="text-gray-400" />
                            <span className="text-sm text-gray-600 truncate">
                                {attachment?.name || `Upload ${ERP_ATTACHMENT_HINT}`}
                            </span>
                            <input
                                type="file"
                                className="hidden"
                                accept={ERP_ATTACHMENT_ACCEPT}
                                onChange={handleFile}
                            />
                        </label>
                        {attachment?.name ? (
                            <button
                                type="button"
                                onClick={() => setAttachment(null)}
                                className="mt-1 text-[11px] font-semibold text-rose-600 hover:underline"
                            >
                                Remove file
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handlePay}
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                        {submitting ? 'Paying…' : 'Pay'}
                    </button>
                </div>
            </div>
        </div>
    );
}
