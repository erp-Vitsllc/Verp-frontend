'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    Crosshair,
    ExternalLink,
    Loader2,
    Plus,
    Send,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';

function formatCompactMoney(amount, currency = 'AED') {
    const value = Number(amount);
    const code = String(currency || 'AED').trim() || 'AED';
    if (!Number.isFinite(value)) return `${code}0.00`;
    return `${code}${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function humanizeType(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase())
        .trim();
}

function activityTitle(item) {
    const description = String(item?.description || '').trim();
    if (description) return description;

    const operation = humanizeType(item?.operationType);
    const txn = humanizeType(item?.transactionType);
    if (operation && txn) return `${operation} ${txn}`;
    if (operation) return operation;
    if (txn) return txn;
    return 'Activity';
}

function DetailRow({ label, value, hint }) {
    if (!value && value !== 0) return null;
    return (
        <div className="grid grid-cols-[1fr_1.15fr] gap-3 py-2.5 border-b border-slate-100 last:border-0">
            <dt className="text-[13px] text-slate-500 flex items-center gap-1">
                {label}
                {hint ? (
                    <span
                        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 text-[9px] text-slate-400"
                        title={hint}
                    >
                        i
                    </span>
                ) : null}
            </dt>
            <dd className="text-[13px] font-medium text-slate-800 text-right break-words">
                {value}
            </dd>
        </div>
    );
}

export default function VendorSidePanel({
    open,
    onClose,
    vendor,
    loading = false,
    fallbackName = '',
}) {
    const [tab, setTab] = useState('details');
    const [activities, setActivities] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [activityError, setActivityError] = useState('');
    const [comment, setComment] = useState('');
    const [savingComment, setSavingComment] = useState(false);

    const vendorId = String(vendor?.contact_id || '').trim();

    const loadActivity = useCallback(async () => {
        if (!vendorId) {
            setActivities([]);
            return;
        }
        setLoadingActivity(true);
        setActivityError('');
        try {
            const response = await axiosInstance.get(
                `/zoho/vendors/${encodeURIComponent(vendorId)}/comments`,
                { skipToast: true, timeout: 60000 },
            );
            setActivities(Array.isArray(response?.data?.data) ? response.data.data : []);
        } catch (err) {
            setActivities([]);
            setActivityError(
                err?.response?.data?.message ||
                    err?.message ||
                    'Failed to load vendor activity',
            );
        } finally {
            setLoadingActivity(false);
        }
    }, [vendorId]);

    useEffect(() => {
        if (open) setTab('details');
    }, [open, vendor?.contact_id]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open || tab !== 'activity' || !vendorId) return;
        void loadActivity();
    }, [open, tab, vendorId, loadActivity]);

    const displayName = useMemo(() => {
        return (
            String(vendor?.contact_name || '').trim() ||
            String(vendor?.company_name || '').trim() ||
            String(fallbackName || '').trim() ||
            'Vendor'
        );
    }, [vendor, fallbackName]);

    const initial = displayName.charAt(0).toUpperCase() || 'V';
    const currency = vendor?.currency_code || 'AED';

    const contactRows = [
        { label: 'Currency', value: currency },
        {
            label: 'Payment Terms',
            value: vendor?.payment_terms_label || '',
        },
        {
            label: 'Portal Status',
            value: vendor?.portal_status || (vendor?.is_portal_enabled ? 'Enabled' : 'Disabled'),
        },
        {
            label: 'Vendor Language',
            value: vendor?.language_code_formatted || '',
            hint: 'Language used for vendor communications in Zoho.',
        },
        {
            label: 'Tax Treatment',
            value: vendor?.tax_treatment_formatted || vendor?.tax_treatment || '',
        },
        {
            label: 'TRN',
            value: vendor?.tax_reg_no || '',
        },
        {
            label: 'Member State',
            value: vendor?.place_of_contact_formatted || vendor?.place_of_contact || '',
        },
    ].filter((row) => row.value);

    const handleAddComment = async (event) => {
        event.preventDefault();
        const text = String(comment || '').trim();
        if (!vendorId || !text || savingComment) return;

        setSavingComment(true);
        setActivityError('');
        try {
            await axiosInstance.post(
                `/zoho/vendors/${encodeURIComponent(vendorId)}/comments`,
                { description: text },
                { skipToast: true },
            );
            setComment('');
            await loadActivity();
        } catch (err) {
            setActivityError(
                err?.response?.data?.message ||
                    err?.message ||
                    'Failed to add comment',
            );
        } finally {
            setSavingComment(false);
        }
    };

    if (!open) return null;

    return (
        <>
            <button
                type="button"
                aria-label="Close vendor panel"
                className="fixed inset-0 z-[60] bg-slate-900/20"
                onClick={onClose}
            />
            <aside
                className="fixed top-0 right-0 z-[70] flex h-full w-full max-w-[380px] flex-col border-l border-slate-200 bg-white shadow-2xl"
                style={{ animation: 'vendorPanelIn 180ms ease-out' }}
                role="dialog"
                aria-modal="true"
                aria-label="Vendor details"
            >
                <style>{`
                    @keyframes vendorPanelIn {
                        from { transform: translateX(100%); opacity: 0.85; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                `}</style>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pt-5 pb-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                            {initial}
                        </div>
                        <div className="min-w-0 pt-0.5">
                            <div className="flex items-center gap-1.5">
                                <h2 className="truncate text-lg font-bold text-slate-900">
                                    {displayName}
                                </h2>
                                {vendorId ? (
                                    <Link
                                        href={`/Accounts/Vendors?vendorId=${encodeURIComponent(vendorId)}`}
                                        className="inline-flex text-slate-400 hover:text-blue-600"
                                        title="Open vendor"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <ExternalLink size={15} />
                                    </Link>
                                ) : null}
                            </div>
                            {vendor?.company_name && vendor.company_name !== displayName ? (
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                    {vendor.company_name}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {vendorId ? (
                            <Link
                                href={`/Accounts/Vendors?vendorId=${encodeURIComponent(vendorId)}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"
                                title="View in Vendors module"
                            >
                                <Plus size={16} />
                            </Link>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-6 border-b border-slate-200 px-5">
                    {[
                        { id: 'details', label: 'Details' },
                        { id: 'activity', label: 'Activity Log' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setTab(item.id)}
                            className={`relative -mb-px py-3 text-sm font-semibold transition-colors ${
                                tab === item.id
                                    ? 'text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {item.label}
                            {tab === item.id ? (
                                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600" />
                            ) : null}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading && !vendor ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                            <Loader2 size={18} className="animate-spin" />
                            Loading vendor…
                        </div>
                    ) : tab === 'activity' ? (
                        <div className="space-y-4">
                            <form onSubmit={handleAddComment} className="space-y-2">
                                <textarea
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                    rows={3}
                                    placeholder="Add an internal comment…"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                    disabled={!vendorId || savingComment}
                                />
                                <button
                                    type="submit"
                                    disabled={!vendorId || !comment.trim() || savingComment}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {savingComment ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Send size={14} />
                                    )}
                                    Add Comment
                                </button>
                            </form>

                            {activityError ? (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                    {activityError}
                                </div>
                            ) : null}

                            {loadingActivity ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                                    <Loader2 size={16} className="animate-spin" />
                                    Loading activity…
                                </div>
                            ) : !activities.length ? (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                                    No recent activity for this vendor.
                                </div>
                            ) : (
                                <ol className="relative space-y-0 border-l border-slate-200 ml-2">
                                    {activities.map((item, index) => (
                                        <li
                                            key={item.id || `${item.date}-${index}`}
                                            className="relative pl-5 pb-5 last:pb-0"
                                        >
                                            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500 shadow" />
                                            <p className="text-sm font-semibold text-slate-800 leading-snug">
                                                {activityTitle(item)}
                                            </p>
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                {[
                                                    item.commentedBy,
                                                    item.dateDescription || item.date,
                                                    item.time,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <p className="text-[11px] font-medium leading-snug text-slate-500">
                                            Outstanding Payables
                                        </p>
                                        <AlertTriangle
                                            size={14}
                                            className="mt-0.5 shrink-0 text-amber-500"
                                        />
                                    </div>
                                    <p className="text-sm font-bold tabular-nums text-slate-900">
                                        {formatCompactMoney(
                                            vendor?.outstanding_payable_amount,
                                            currency,
                                        )}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <p className="text-[11px] font-medium leading-snug text-slate-500">
                                            Unused Credits
                                        </p>
                                        <Crosshair
                                            size={14}
                                            className="mt-0.5 shrink-0 text-emerald-500"
                                        />
                                    </div>
                                    <p className="text-sm font-bold tabular-nums text-slate-900">
                                        {formatCompactMoney(
                                            vendor?.unused_credits_payable_amount,
                                            currency,
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h3 className="mb-1 text-sm font-bold text-slate-800">
                                    Contact Details
                                </h3>
                                {contactRows.length ? (
                                    <dl>
                                        {contactRows.map((row) => (
                                            <DetailRow
                                                key={row.label}
                                                label={row.label}
                                                value={row.value}
                                                hint={row.hint}
                                            />
                                        ))}
                                    </dl>
                                ) : (
                                    <p className="py-4 text-sm text-slate-400">
                                        No contact details available.
                                    </p>
                                )}
                            </div>

                            {vendor?.email || vendor?.phone || vendor?.billing_address_text ? (
                                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs text-slate-600 space-y-2">
                                    {vendor?.email ? (
                                        <p>
                                            <span className="font-semibold text-slate-500">
                                                Email:{' '}
                                            </span>
                                            {vendor.email}
                                        </p>
                                    ) : null}
                                    {vendor?.phone ? (
                                        <p>
                                            <span className="font-semibold text-slate-500">
                                                Phone:{' '}
                                            </span>
                                            {vendor.phone}
                                        </p>
                                    ) : null}
                                    {vendor?.billing_address_text ? (
                                        <div>
                                            <p className="mb-0.5 font-semibold text-slate-500">
                                                Billing Address
                                            </p>
                                            <p className="whitespace-pre-line leading-relaxed">
                                                {vendor.billing_address_text}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
