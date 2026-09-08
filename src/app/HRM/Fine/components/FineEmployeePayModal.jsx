'use client';

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { FileText, Loader2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    resolveCompanyFinePayableAmount,
    resolveEmployeeFinePayableAmount,
} from '@/utils/finePayableAmount';
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

function isCompanyParty(party) {
    if (!party) return false;
    const id = String(party.employeeId || '');
    const name = String(party.employeeName || '').trim();
    return COMPANY_IDS.has(id) || name === 'Vega Digital IT Solutions';
}

function settleParties(fine) {
    return (fine?.assignedEmployees || []).filter(
        (e) => e?.employeeId && e.employeeId !== 'PENDING',
    );
}

function partyShare(fine, party) {
    if (isCompanyParty(party)) {
        return roundMoney(resolveCompanyFinePayableAmount(fine, party));
    }
    return roundMoney(resolveEmployeeFinePayableAmount(fine, party.employeeId));
}

function partyRemaining(fine, party) {
    const share = partyShare(fine, party);
    const alreadyPaid = Number(party.paidAmount || 0) || 0;
    return roundMoney(Math.max(0, share - alreadyPaid));
}

function partyLabel(party) {
    if (isCompanyParty(party)) {
        return party.employeeName || 'Company';
    }
    const name = String(party.employeeName || '').trim() || party.employeeId;
    return `${name} (${party.employeeId})`;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

function buildPartyRows(fine) {
    return settleParties(fine).map((party, index) => {
        const remaining = partyRemaining(fine, party);
        return {
            key: `${party.employeeId}-${party.fineRecordId || party.fineId || index}`,
            partyId: String(party.employeeId),
            partyFineId: party.fineId || '',
            fineRecordId: party.fineRecordId || '',
            name: partyLabel(party),
            isCompany: isCompanyParty(party),
            remaining,
            paidById: String(party.employeeId),
            amountPay: remaining > 0.01 ? remaining.toFixed(2) : '',
        };
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
    const [partyRows, setPartyRows] = useState([]);
    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [paymentDate, setPaymentDate] = useState(todayInputValue());
    const [paymentSource, setPaymentSource] = useState('');
    const [amountPay, setAmountPay] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const parties = useMemo(() => settleParties(fine), [fine]);
    const isGroupPay = parties.length > 1;
    const finedEmployeeId = useMemo(
        () => String(employeeId || parties.find((p) => !isCompanyParty(p))?.employeeId || parties[0]?.employeeId || '').trim(),
        [employeeId, parties],
    );

    const paidByOptions = useMemo(() => {
        const options = [];
        const seen = new Set();
        const add = (value, label) => {
            const id = String(value || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            options.push({ value: id, label });
        };

        parties.forEach((p) => add(p.employeeId, partyLabel(p)));
        (employeeOptions || []).forEach((emp) => {
            const id = String(emp.employeeId || '').trim();
            if (!id || COMPANY_IDS.has(id)) return;
            const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || id;
            add(id, `${name} (${id})`);
        });
        return options;
    }, [employeeOptions, parties]);

    const payAmount = useMemo(() => {
        if (!fine || !finedEmployeeId) return 0;
        const payable = COMPANY_IDS.has(finedEmployeeId)
            ? resolveCompanyFinePayableAmount(fine)
            : resolveEmployeeFinePayableAmount(fine, finedEmployeeId);
        const party = parties.find((p) => String(p.employeeId) === finedEmployeeId);
        const alreadyPaid = Number(party?.paidAmount || fine.paidAmount || 0) || 0;
        return roundMoney(Math.max(0, payable - alreadyPaid));
    }, [fine, finedEmployeeId, parties]);

    const payableGroupRows = partyRows.filter((row) => row.remaining > 0.01);
    const groupRowsValid = payableGroupRows.length > 0 && payableGroupRows.every((row) => (
        Boolean(row.paidById) && amountsMatch(row.amountPay, row.remaining)
    ));
    const groupAmountMismatch = partyRows.some((row) => (
        row.remaining > 0.01 &&
        String(row.amountPay || '').trim() !== '' &&
        !amountsMatch(row.amountPay, row.remaining)
    ));

    const enteredAmount = roundMoney(amountPay);
    const amountsEqual = Boolean(paidById) && payAmount > 0.01 && amountsMatch(enteredAmount, payAmount);
    const amountMismatch =
        String(amountPay || '').trim() !== '' && !amountsEqual;

    const canSubmit = isGroupPay
        ? Boolean(fine?._id) &&
            Boolean(paymentDate) &&
            Boolean(paymentSource) &&
            Boolean(attachment?.name) &&
            groupRowsValid &&
            !submitting
        : Boolean(fine?._id) &&
            Boolean(paidById) &&
            Boolean(paymentDate) &&
            Boolean(paymentSource) &&
            Boolean(attachment?.name) &&
            amountsEqual &&
            !submitting;

    useEffect(() => {
        if (!isOpen) return;
        setPaidById(finedEmployeeId);
        setPartyRows(buildPartyRows(fine));
        setPaymentDate(todayInputValue());
        setPaymentSource('');
        setAmountPay('');
        setAttachment(null);
        setSubmitting(false);
    }, [isOpen, finedEmployeeId, fine?._id]);

    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        axiosInstance
            .get('/Employee', { params: { limit: 1000 }, skipToast: true })
            .then((res) => {
                if (cancelled) return;
                const list = res.data?.employees || res.data || [];
                setEmployeeOptions(Array.isArray(list) ? list : []);
            })
            .catch(() => {
                if (!cancelled) setEmployeeOptions([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const updatePartyRow = (key, patch) => {
        setPartyRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    };

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

    const postPartyPayment = async (row, amount) => {
        return axiosInstance.post('/Payment', {
            paymentType: 'Fine',
            paidBy: row.paidById,
            amount,
            status: 'Completed',
            paymentDate,
            paymentSource,
            attachment,
            relatedEntityType: 'Fine',
            relatedEntityId: row.fineRecordId || fine._id,
            referenceId: row.partyFineId || fine.fineId,
            description: `Paid by employee · ${row.partyFineId || fine.fineId || ''}`.trim(),
            remarks: 'Employee pay — salary/cash, no Zoho',
            employeePaySettlement: true,
            settleEmployeeId: row.partyId,
        });
    };

    const handlePay = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            if (isGroupPay) {
                for (const row of payableGroupRows) {
                    await postPartyPayment(row, roundMoney(row.amountPay));
                }
                toast({
                    title: 'Payments recorded',
                    description: `${payableGroupRows.length} party payment${payableGroupRows.length === 1 ? '' : 's'} recorded.`,
                    variant: 'success',
                    className: 'bg-green-50 border-green-200 text-green-800',
                });
            } else {
                await postPartyPayment(
                    {
                        paidById,
                        partyId: finedEmployeeId,
                        fineRecordId: '',
                        partyFineId: fine.fineId,
                    },
                    enteredAmount,
                );
                toast({
                    title: 'Payment recorded',
                    description: 'Fine payment recorded.',
                    variant: 'success',
                    className: 'bg-green-50 border-green-200 text-green-800',
                });
            }
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
            <div className={`relative w-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden ${isGroupPay ? 'max-w-[720px]' : 'max-w-[560px]'}`}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                    <div>
                        <h2 className="text-[16px] font-semibold text-gray-800">Pay by employee</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            {fine?.fineId || 'Fine'}
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
                    {isGroupPay ? (
                        <div>
                            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] gap-3 mb-2">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                    Paid by <span className="text-red-500">*</span>
                                </p>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                    Amount to pay <span className="text-red-500">*</span>
                                </p>
                            </div>
                            <div className="space-y-2">
                                {partyRows.map((row) => {
                                    const selected = paidByOptions.find((o) => o.value === row.paidById) || {
                                        value: row.paidById,
                                        label: row.name,
                                    };
                                    const rowMismatch =
                                        row.remaining > 0.01 &&
                                        String(row.amountPay || '').trim() !== '' &&
                                        !amountsMatch(row.amountPay, row.remaining);
                                    const alreadyPaid = row.remaining <= 0.01;
                                    return (
                                        <div
                                            key={row.key}
                                            className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] gap-3 items-start"
                                        >
                                            <Select
                                                instanceId={`fine-employee-pay-paid-by-${row.key}`}
                                                value={selected}
                                                onChange={(opt) => updatePartyRow(row.key, { paidById: opt?.value || '' })}
                                                options={paidByOptions}
                                                placeholder="Search employee"
                                                isSearchable
                                                isDisabled={alreadyPaid}
                                                styles={selectStyles}
                                                menuPortalTarget={
                                                    typeof document !== 'undefined' ? document.body : null
                                                }
                                                menuPosition="fixed"
                                            />
                                            <div>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">
                                                        AED
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={alreadyPaid ? '0.00' : row.amountPay}
                                                        readOnly={alreadyPaid}
                                                        onChange={(e) => updatePartyRow(row.key, { amountPay: e.target.value })}
                                                        className={`w-full pl-12 pr-3 py-2.5 rounded-lg border text-sm font-bold ${
                                                            alreadyPaid
                                                                ? 'border-gray-200 bg-gray-50 text-gray-400'
                                                                : rowMismatch
                                                                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                                                                    : 'border-gray-200 text-gray-900'
                                                        }`}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1">
                                                    {alreadyPaid
                                                        ? `${row.name} · already paid`
                                                        : `${row.name} · share AED ${row.remaining.toFixed(2)}`}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {groupAmountMismatch ? (
                                <p className="text-[11px] font-semibold text-rose-600 mt-2">
                                    Each Amount to pay must match that party’s remaining share.
                                </p>
                            ) : (
                                <p className="text-[11px] text-gray-400 mt-2">
                                    One row per employee and company on this fine. Shares are filled automatically.
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
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
                                    onChange={(opt) => setPaidById(opt?.value || '')}
                                    options={paidByOptions}
                                    placeholder="Search employee"
                                    isSearchable
                                    isClearable
                                    styles={selectStyles}
                                    menuPortalTarget={
                                        typeof document !== 'undefined' ? document.body : null
                                    }
                                    menuPosition="fixed"
                                />
                            </div>
                        </>
                    )}

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
