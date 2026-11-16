'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { dubaiDateKey, formatWorkOrderDate, nextWorkOrderNo } from './workOrderNumber';

const FOCUS =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';

const TYPES = ['Standalone', 'Main WO', 'Variation'];

const inputClass =
    'h-11 w-full rounded-xl border border-[#e5edf5] bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#2f6fed]';

export default function CreateWorkOrderModal({ existingNumbers, onClose, onCreated }) {
    const { toast } = useToast();
    const [workOrderNo, setWorkOrderNo] = useState(() => nextWorkOrderNo(existingNumbers));
    const [createdOn, setCreatedOn] = useState(() => dubaiDateKey());
    const [customer, setCustomer] = useState('');
    const [quotationRef, setQuotationRef] = useState('');
    const [lpoNo, setLpoNo] = useState('');
    const [type, setType] = useState('Standalone');
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const fallback = nextWorkOrderNo(existingNumbers);
        axiosInstance
            .get('/WorkOrder/next-no')
            .then((response) => {
                const nextNo = response.data?.workOrderNo;
                if (!cancelled && nextNo) setWorkOrderNo(nextNo);
                if (!cancelled && response.data?.createdOn) setCreatedOn(response.data.createdOn);
            })
            .catch(() => {
                if (!cancelled) setWorkOrderNo(fallback);
            });
        return () => {
            cancelled = true;
        };
    }, [existingNumbers]);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape' && !saving) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, saving]);

    const save = async (event) => {
        event.preventDefault();
        const name = customer.trim();
        if (name.length < 2) {
            toast({ title: 'Customer is required', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const response = await axiosInstance.post('/WorkOrder', {
                customer: name,
                quotationRef: quotationRef.trim(),
                lpoNo: lpoNo.trim(),
                type,
                value: value === '' ? 0 : Number(value),
            });
            const assigned = response.data?.workOrder?.workOrderNo || workOrderNo;
            toast({ title: 'Work order created', description: assigned });
            onCreated(response.data?.workOrder);
        } catch (error) {
            const message = error?.response?.data?.message || 'Could not create the work order';
            toast({ title: 'Could not save', description: message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/35 p-4 sm:items-center"
            onMouseDown={() => {
                if (!saving) onClose();
            }}
        >
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-wo-title"
                onSubmit={save}
                onMouseDown={(event) => event.stopPropagation()}
                className="w-full max-w-lg rounded-2xl border border-[#e6eef6] bg-white p-5 shadow-2xl"
            >
                <h3 id="create-wo-title" className="text-lg font-semibold text-slate-900">
                    Create Work Order
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                    The number and created date are filled in automatically.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="block text-[12px] font-medium text-slate-500" htmlFor="work-order-no">
                            Work Order No
                        </label>
                        <input
                            id="work-order-no"
                            value={workOrderNo}
                            readOnly
                            className="mt-1 h-12 w-full cursor-default rounded-xl border border-[#d7e6fb] bg-[#f4f8fd] px-3 text-lg font-bold tracking-tight text-[#2f6fed] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium text-slate-500" htmlFor="work-order-date">
                            Created Date
                        </label>
                        <input
                            id="work-order-date"
                            value={formatWorkOrderDate(createdOn)}
                            readOnly
                            className="mt-1 h-12 w-full cursor-default rounded-xl border border-[#d7e6fb] bg-[#f4f8fd] px-3 text-lg font-bold tracking-tight text-slate-800 outline-none"
                        />
                    </div>
                </div>

                <label className="mt-4 block text-[12px] font-medium text-slate-500" htmlFor="wo-customer">
                    Customer
                </label>
                <input
                    id="wo-customer"
                    value={customer}
                    onChange={(event) => setCustomer(event.target.value)}
                    className={`mt-1 ${inputClass} ${FOCUS}`}
                    autoFocus
                    maxLength={160}
                    required
                />

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="block text-[12px] font-medium text-slate-500" htmlFor="wo-quote">
                            Quotation Ref
                        </label>
                        <input
                            id="wo-quote"
                            value={quotationRef}
                            onChange={(event) => setQuotationRef(event.target.value)}
                            className={`mt-1 ${inputClass} ${FOCUS}`}
                            maxLength={60}
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium text-slate-500" htmlFor="wo-lpo">
                            LPO No
                        </label>
                        <input
                            id="wo-lpo"
                            value={lpoNo}
                            onChange={(event) => setLpoNo(event.target.value)}
                            className={`mt-1 ${inputClass} ${FOCUS}`}
                            maxLength={60}
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium text-slate-500" htmlFor="wo-type">
                            Type
                        </label>
                        <select
                            id="wo-type"
                            value={type}
                            onChange={(event) => setType(event.target.value)}
                            className={`mt-1 ${inputClass} ${FOCUS}`}
                        >
                            {TYPES.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium text-slate-500" htmlFor="wo-value">
                            Value (AED)
                        </label>
                        <input
                            id="wo-value"
                            type="number"
                            min="0"
                            step="0.01"
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            className={`mt-1 ${inputClass} ${FOCUS}`}
                        />
                    </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className={`rounded-xl border border-[#e5edf5] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 ${FOCUS}`}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className={`rounded-xl bg-[#2f6fed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                    >
                        {saving ? 'Saving…' : `Save ${workOrderNo}`}
                    </button>
                </div>
            </form>
        </div>
    );
}
