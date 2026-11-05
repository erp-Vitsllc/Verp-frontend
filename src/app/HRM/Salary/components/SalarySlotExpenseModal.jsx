'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { mapZohoCustomerListRows } from '@/utils/zohoCustomers';
import { mapZohoVendors } from '@/utils/zohoVendors';
import { mapZohoLocations, mapZohoPaymentAccounts } from '@/utils/zohoVendorPayments';

const TAX_TREATMENTS = [
    { value: 'vat_registered', label: 'VAT Registered' },
    { value: 'vat_not_registered', label: 'VAT Not Registered' },
    { value: 'gcc_vat_registered', label: 'GCC VAT Registered' },
    { value: 'gcc_vat_not_registered', label: 'GCC VAT Not Registered' },
    { value: 'non_gcc', label: 'Non GCC' },
    { value: 'dz_vat_registered', label: 'Designated Zone - VAT Registered' },
    { value: 'dz_vat_not_registered', label: 'Designated Zone - VAT Not Registered' },
];

const PLACES = [
    { value: 'AB', label: 'Abu Dhabi' },
    { value: 'AJ', label: 'Ajman' },
    { value: 'DU', label: 'Dubai' },
    { value: 'FU', label: 'Fujairah' },
    { value: 'RA', label: 'Ras al-Khaimah' },
    { value: 'SH', label: 'Sharjah' },
    { value: 'UM', label: 'Umm al-Quwain' },
];

const fieldClass = 'h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function emptyLine() {
    return {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId: '',
        accountName: '',
        notes: '',
        taxId: '',
        amount: '',
    };
}

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function formatAmount(value) {
    return money(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mapTaxes(taxes) {
    if (!Array.isArray(taxes)) return [];
    return taxes.map((tax) => {
        const id = String(tax?.tax_id || tax?.id || '').trim();
        if (!id) return null;
        const name = String(tax?.tax_name || tax?.name || id).trim();
        const percent = tax?.tax_percentage ?? tax?.percentage;
        const label = percent == null || percent === '' ? name : `${name} [${percent}%]`;
        return { id, label };
    }).filter(Boolean);
}

function Field({ label, required, children }) {
    return (
        <div className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[160px_minmax(0,420px)] sm:gap-4">
            <span className="text-[13px] text-slate-700">
                {label}{required ? <span className="ml-0.5 text-red-500">*</span> : null}
            </span>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

export default function SalarySlotExpenseModal({ open, monthKey, paymentId, onClose, onSaved }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [organizations, setOrganizations] = useState([]);
    const [organizationId, setOrganizationId] = useState('');
    const [support, setSupport] = useState(null);
    const [lines, setLines] = useState([]);
    const [files, setFiles] = useState([]);
    const [form, setForm] = useState({
        locationId: '',
        date: todayKey(),
        paidThroughAccountId: '',
        vendorId: '',
        taxTreatment: 'vat_registered',
        placeOfSupply: 'DU',
        isInclusiveTax: false,
        referenceNumber: '',
        customerId: '',
    });

    useEffect(() => {
        if (!open || !monthKey || !paymentId) return undefined;
        let cancelled = false;
        setLoading(true);
        setFiles([]);
        setSupport(null);
        (async () => {
            try {
                const res = await axiosInstance.get(
                    `/Employee/salary-register/${monthKey}/payments/${paymentId}/expense`,
                    { skipToast: true, timeout: 120000 },
                );
                if (cancelled) return;
                const orgs = Array.isArray(res.data?.organizations) ? res.data.organizations : [];
                const nextLines = (Array.isArray(res.data?.lines) ? res.data.lines : []).map((line, index) => ({
                    key: `emp-${line.employeeId || index}`,
                    accountId: line.accountId || '',
                    accountName: line.accountName || '',
                    notes: line.notes || line.name || '',
                    taxId: '',
                    amount: line.amount || '',
                }));
                setOrganizations(orgs);
                setOrganizationId(String(res.data?.organizationId || orgs[0]?.organizationId || ''));
                setLines(nextLines.length ? nextLines : [emptyLine()]);
                setForm((prev) => ({
                    ...prev,
                    date: todayKey(),
                    referenceNumber: String(res.data?.referenceNumber || ''),
                }));
            } catch (error) {
                if (!cancelled) {
                    toast({
                        title: 'Could not open Update payment',
                        description: error?.response?.data?.message || error?.message || 'Expense data failed to load.',
                        variant: 'destructive',
                    });
                    onClose?.();
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, monthKey, paymentId]);

    useEffect(() => {
        if (!open || !organizationId) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const params = { organizationId };
                const [supportRes, vendorRes, customerRes] = await Promise.all([
                    axiosInstance.get('/zoho/expenses/support', { params, skipToast: true, timeout: 120000 }),
                    axiosInstance.get('/zoho/vendors', { params: { ...params, sync: 'false' }, skipToast: true, timeout: 120000 }).catch(() => null),
                    axiosInstance.get('/zoho/customers', { params: { ...params, sync: 'false' }, skipToast: true, timeout: 120000 }).catch(() => null),
                ]);
                if (cancelled) return;
                const data = supportRes?.data?.data || {};
                const locations = mapZohoLocations(data.locations);
                const primary = locations.find((row) => row.isPrimary) || locations[0];
                setSupport({
                    accounts: mapZohoPaymentAccounts(data.accounts),
                    paidThrough: mapZohoPaymentAccounts(data.paidThroughAccounts || data.accounts),
                    locations,
                    taxes: mapTaxes(data.taxes),
                    vendors: mapZohoVendors(vendorRes?.data?.data),
                    customers: mapZohoCustomerListRows(customerRes?.data?.data).filter((row) => row.id),
                });
                setForm((prev) => ({
                    ...prev,
                    locationId: prev.locationId || primary?.id || '',
                }));
            } catch (error) {
                if (!cancelled) {
                    toast({
                        title: 'Could not load Zoho accounts',
                        description: error?.response?.data?.message || error?.message || 'Try the other company.',
                        variant: 'destructive',
                    });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, organizationId]);

    const accounts = support?.accounts || [];
    const total = useMemo(
        () => lines.reduce((sum, line) => sum + money(line.amount), 0),
        [lines],
    );
    const activeOrg = organizations.find((org) => org.organizationId === organizationId) || null;

    function accountChoices(line) {
        if (line.accountId && !accounts.some((row) => row.id === line.accountId)) {
            return [{ id: line.accountId, name: line.accountName || line.accountId, type: 'Salary' }, ...accounts];
        }
        return accounts;
    }

    function grouped(rows) {
        const groups = new Map();
        for (const row of rows) {
            const type = row.type || 'Other';
            if (!groups.has(type)) groups.set(type, []);
            groups.get(type).push(row);
        }
        return [...groups.entries()];
    }

    function updateLine(key, patch) {
        setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    }

    function onFiles(event) {
        const picked = Array.from(event.target.files || []);
        const next = [...files];
        for (const file of picked) {
            if (next.length >= 5) break;
            if (file.size > 10 * 1024 * 1024) {
                toast({ title: 'File too large', description: `${file.name} is over 10MB.`, variant: 'destructive' });
                continue;
            }
            next.push(file);
        }
        setFiles(next);
        event.target.value = '';
    }

    async function save(event) {
        event.preventDefault();
        if (saving) return;
        if (!organizationId) {
            toast({ title: 'Choose a Zoho company', variant: 'destructive' });
            return;
        }
        if (!form.paidThroughAccountId) {
            toast({ title: 'Paid Through is required', variant: 'destructive' });
            return;
        }
        if (!form.taxTreatment || !form.placeOfSupply) {
            toast({ title: 'Tax treatment and place of supply are required', variant: 'destructive' });
            return;
        }
        const lineItems = lines
            .map((line) => ({
                accountId: line.accountId,
                notes: line.notes,
                taxId: line.taxId,
                amount: money(line.amount),
            }))
            .filter((line) => line.accountId || line.amount || line.notes);
        if (lineItems.some((line) => !line.accountId || !(line.amount > 0))) {
            toast({
                title: 'Each row needs an expense account and an amount',
                variant: 'destructive',
            });
            return;
        }
        const payload = {
            organizationId,
            organizationLabel: activeOrg?.label || '',
            date: form.date,
            paidThroughAccountId: form.paidThroughAccountId,
            vendorId: form.vendorId,
            taxTreatment: form.taxTreatment,
            placeOfSupply: form.placeOfSupply,
            isInclusiveTax: form.isInclusiveTax,
            referenceNumber: form.referenceNumber,
            locationId: form.locationId,
            customerId: form.customerId,
            currencyCode: 'AED',
            lineItems: lineItems.map((line) => ({
                account_id: line.accountId,
                description: line.notes,
                tax_id: line.taxId,
                amount: line.amount,
            })),
        };
        const body = new FormData();
        body.append('payload', JSON.stringify(payload));
        files.forEach((file) => body.append('attachments', file));
        setSaving(true);
        try {
            const res = await axiosInstance.post(
                `/Employee/salary-register/${monthKey}/payments/${paymentId}/expense`,
                body,
                { timeout: 120000 },
            );
            toast({ title: 'Expense saved in Zoho', description: res.data?.message || 'This slot is updated.' });
            onSaved?.(res.data?.payment);
            onClose?.();
        } catch (error) {
            toast({
                title: 'Zoho expense failed',
                description: error?.response?.data?.message || error?.message || 'Could not save the expense.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
            <form onSubmit={save} className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <h2 className="text-lg font-semibold text-slate-900">Record Expense</h2>
                    <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading the slot expense…
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <Field label="Zoho company" required>
                            <select
                                className={fieldClass}
                                value={organizationId}
                                onChange={(event) => setOrganizationId(event.target.value)}
                            >
                                <option value="">Select company</option>
                                {organizations.map((org) => (
                                    <option key={org.organizationId} value={org.organizationId}>{org.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Location">
                            <select className={fieldClass} value={form.locationId} onChange={(event) => setForm((prev) => ({ ...prev, locationId: event.target.value }))}>
                                <option value="">Select location</option>
                                {(support?.locations || []).map((row) => (
                                    <option key={row.id} value={row.id}>{row.name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Date" required>
                            <input type="date" className={fieldClass} value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
                        </Field>
                        <Field label="Paid Through" required>
                            <select className={fieldClass} value={form.paidThroughAccountId} onChange={(event) => setForm((prev) => ({ ...prev, paidThroughAccountId: event.target.value }))}>
                                <option value="">Select an account</option>
                                {grouped(support?.paidThrough || []).map(([type, rows]) => (
                                    <optgroup key={type} label={type}>
                                        {rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                        </Field>
                        <Field label="Vendor">
                            <select className={fieldClass} value={form.vendorId} onChange={(event) => setForm((prev) => ({ ...prev, vendorId: event.target.value }))}>
                                <option value="">Select a vendor</option>
                                {(support?.vendors || []).map((row) => (
                                    <option key={row.id} value={row.id}>{row.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Tax Treatment" required>
                            <select className={fieldClass} value={form.taxTreatment} onChange={(event) => setForm((prev) => ({ ...prev, taxTreatment: event.target.value }))}>
                                {TAX_TREATMENTS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Place of Supply" required>
                            <select className={fieldClass} value={form.placeOfSupply} onChange={(event) => setForm((prev) => ({ ...prev, placeOfSupply: event.target.value }))}>
                                {PLACES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Amounts are">
                            <div className="flex gap-4 text-sm text-slate-700">
                                <label className="inline-flex items-center gap-2">
                                    <input type="radio" checked={form.isInclusiveTax} onChange={() => setForm((prev) => ({ ...prev, isInclusiveTax: true }))} />
                                    Tax Inclusive
                                </label>
                                <label className="inline-flex items-center gap-2">
                                    <input type="radio" checked={!form.isInclusiveTax} onChange={() => setForm((prev) => ({ ...prev, isInclusiveTax: false }))} />
                                    Tax Exclusive
                                </label>
                            </div>
                        </Field>

                        <div className="overflow-x-auto rounded-lg border">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-red-600">
                                    <tr>
                                        <th className="px-3 py-2">Expense account</th>
                                        <th className="px-3 py-2">Notes</th>
                                        <th className="px-3 py-2">Tax</th>
                                        <th className="px-3 py-2 text-right">Amount</th>
                                        <th className="px-2 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line) => (
                                        <tr key={line.key} className="border-t">
                                            <td className="px-2 py-2">
                                                <select
                                                    className={fieldClass}
                                                    value={line.accountId}
                                                    onChange={(event) => {
                                                        const accountId = event.target.value;
                                                        const account = accountChoices(line).find((row) => row.id === accountId);
                                                        updateLine(line.key, { accountId, accountName: account?.name || '' });
                                                    }}
                                                >
                                                    <option value="">Select an account</option>
                                                    {grouped(accountChoices(line)).map(([type, rows]) => (
                                                        <optgroup key={type} label={type}>
                                                            {rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    className={fieldClass}
                                                    maxLength={500}
                                                    placeholder="Max. 500 characters"
                                                    value={line.notes}
                                                    onChange={(event) => updateLine(line.key, { notes: event.target.value })}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <select className={fieldClass} value={line.taxId} onChange={(event) => updateLine(line.key, { taxId: event.target.value })}>
                                                    <option value="">Select a Tax</option>
                                                    {(support?.taxes || []).map((tax) => (
                                                        <option key={tax.id} value={tax.id}>{tax.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    className={`${fieldClass} text-right`}
                                                    inputMode="decimal"
                                                    value={line.amount}
                                                    onChange={(event) => updateLine(line.key, { amount: event.target.value })}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <button
                                                    type="button"
                                                    className="text-slate-400 hover:text-red-600"
                                                    aria-label="Remove row"
                                                    onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== line.key) : prev))}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                                <Plus className="h-4 w-4" /> Add New Row
                            </button>
                            <div className="text-sm font-semibold text-slate-800">
                                Expense Total (AED) <span className="ml-6 tabular-nums">{formatAmount(total)}</span>
                            </div>
                        </div>
                        <Field label="Reference#">
                            <input className={fieldClass} value={form.referenceNumber} onChange={(event) => setForm((prev) => ({ ...prev, referenceNumber: event.target.value }))} />
                        </Field>
                        <Field label="Serial No" required>
                            <input className={`${fieldClass} bg-slate-50`} readOnly value="" placeholder="Auto-generated on save" />
                        </Field>
                        <Field label="Customer Name">
                            <select className={fieldClass} value={form.customerId} onChange={(event) => setForm((prev) => ({ ...prev, customerId: event.target.value }))}>
                                <option value="">Select or add a customer</option>
                                {(support?.customers || []).map((row) => (
                                    <option key={row.id} value={row.id}>{row.name}</option>
                                ))}
                            </select>
                        </Field>
                        <div className="rounded-lg border border-dashed border-slate-300 p-4">
                            <p className="text-sm font-medium text-slate-700">Drag or drop your receipts</p>
                            <p className="text-xs text-slate-400">Maximum file size allowed is 10MB. Up to 5 files.</p>
                            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                <Upload className="h-4 w-4" /> Upload your files
                                <input type="file" multiple className="hidden" onChange={onFiles} />
                            </label>
                            {files.length ? (
                                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                                    {files.map((file, index) => (
                                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                                            <span className="truncate">{file.name}</span>
                                            <button type="button" className="text-red-600" onClick={() => setFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}>
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    </div>
                )}
                <div className="flex flex-wrap gap-2 border-t px-5 py-4">
                    <button type="submit" disabled={saving || loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                        Cancel
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
