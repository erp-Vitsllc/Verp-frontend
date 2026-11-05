'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const inputClass = 'w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500';
const cellInput = 'w-full min-w-[140px] rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500';

function emptyLine() {
    return {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        accountId: '',
        accountName: '',
        description: '',
        contactId: '',
        debit: '',
        credit: '',
    };
}

function todayIso() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function formatAmount(value) {
    return money(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeZohoLabel(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findZohoAccount(accounts, label) {
    const target = normalizeZohoLabel(label);
    if (!target || target === 'no category') return null;
    const rows = (Array.isArray(accounts) ? accounts : []).map((account) => ({
        id: String(account?.account_id || account?.id || '').trim(),
        name: String(account?.account_name || account?.name || '').trim(),
    })).filter((row) => row.id && row.name);
    const exact = rows.filter((row) => normalizeZohoLabel(row.name) === target);
    if (exact.length) return exact[0];
    const parts = target.split(' ').filter((part) => part.length > 1);
    if (!parts.length) return null;
    const partial = rows.filter((row) => parts.every((part) => normalizeZohoLabel(row.name).includes(part)));
    return partial.length === 1 ? partial[0] : null;
}

function assignSalaryJournalAccounts(lines, accounts) {
    return (lines || []).map((line) => {
        if (String(line?.accountId || '').trim()) return line;
        const labels = line?.kind === 'employee'
            ? [line.accountName, line.personName]
            : (line?.kind === 'category' && String(line.accountName || '').trim() !== 'No category'
                ? [line.accountName]
                : []);
        for (const label of labels) {
            const match = findZohoAccount(accounts, label);
            if (match) return { ...line, accountId: match.id, accountName: match.name };
        }
        return line;
    });
}

function linesForNote(lines, note) {
    const payroll = String(note || '').trim();
    return (lines || []).map((line) => {
        if (line.descriptionEdited) return line;
        if (line.kind === 'employee' || line.kind === 'category') {
            return { ...line, description: payroll };
        }
        return line;
    });
}

function blankForm(org, monthKey, monthLabel) {
    const lines = Array.isArray(org?.lines) && org.lines.length ? org.lines.map((line) => ({ ...line })) : [emptyLine(), emptyLine()];
    return {
        locationId: '',
        journalDate: todayIso(),
        reverseDate: '',
        publishReverseOnly: false,
        journalNumber: '',
        referenceNumber: monthKey || '',
        notes: monthLabel ? `Salary payroll ${monthLabel}` : 'Salary payroll',
        reportingMethod: 'both',
        currencyId: '',
        lines,
        files: [],
        supportReady: false,
    };
}

function Field({ label, required, children }) {
    return (
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[180px_1fr]">
            <label className={`pt-2 text-sm ${required ? 'text-red-600' : 'text-gray-600'}`}>
                {label}{required ? '*' : ''}
            </label>
            {children}
        </div>
    );
}

export default function SalaryZohoJournalModal({ open, monthKey, onClose }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [organizations, setOrganizations] = useState([]);
    const [activeId, setActiveId] = useState('');
    const [forms, setForms] = useState({});
    const [support, setSupport] = useState({});

    useEffect(() => {
        if (!open || !monthKey) return undefined;
        let cancelled = false;
        setLoading(true);
        setOrganizations([]);
        setForms({});
        setSupport({});
        setActiveId('');
        (async () => {
            try {
                const res = await axiosInstance.get(
                    `/Employee/salary-register/${monthKey}/zoho-journal`,
                    { skipToast: true, timeout: 120000 },
                );
                if (cancelled) return;
                const rows = Array.isArray(res.data?.organizations) ? res.data.organizations : [];
                const label = String(res.data?.monthLabel || monthKey);
                const nextForms = {};
                for (const org of rows) nextForms[org.organizationId] = blankForm(org, monthKey, label);
                setOrganizations(rows);
                setForms(nextForms);
                setActiveId(rows[0]?.organizationId || '');
                await Promise.all(rows.map((org) => loadSupport(org.organizationId, nextForms)));
            } catch (error) {
                if (!cancelled) {
                    toast({
                        title: 'Could not open Update Zoho',
                        description: error?.response?.data?.message || error?.message || 'Zoho journal data failed to load.',
                        variant: 'destructive',
                    });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, monthKey]);

    async function loadSupport(organizationId, seedForms) {
        const params = { organizationId };
        const [supportRes, vendorRes, customerRes] = await Promise.all([
            axiosInstance.get('/zoho/journals/support', { params, skipToast: true, timeout: 120000 }),
            axiosInstance.get('/zoho/vendors', { params: { ...params, sync: 'false' }, skipToast: true, timeout: 120000 }).catch(() => null),
            axiosInstance.get('/zoho/customers', { params: { ...params, sync: 'false' }, skipToast: true, timeout: 120000 }).catch(() => null),
        ]);
        const data = supportRes?.data?.data || {};
        const accounts = Array.isArray(data.accounts) ? data.accounts : [];
        const locations = Array.isArray(data.locations) ? data.locations : [];
        const currencies = Array.isArray(data.currencies) ? data.currencies : [];
        const vendorRows = Array.isArray(vendorRes?.data?.data) ? vendorRes.data.data : [];
        const customerRows = Array.isArray(customerRes?.data?.data) ? customerRes.data.data : [];
        const contacts = [...vendorRows, ...customerRows].map((row) => ({
            id: String(row.contact_id || row.vendor_id || row.customer_id || row.zohoContactId || row._id || '').trim(),
            name: String(row.contact_name || row.vendor_name || row.customer_name || row.company_name || row.name || '').trim(),
        })).filter((row) => row.id && row.name);
        const seen = new Set();
        const uniqueContacts = contacts.filter((row) => {
            if (seen.has(row.id)) return false;
            seen.add(row.id);
            return true;
        });
        setSupport((prev) => ({
            ...prev,
            [organizationId]: { accounts, locations, currencies, contacts: uniqueContacts },
        }));
        const aed = currencies.find((row) => String(row.currency_code || '').toUpperCase() === 'AED');
        const dxb = locations.find((loc) => /dxb|dubai/i.test(String(loc.location_name || loc.name || '')));
        const location = dxb || locations[0];
        setForms((prev) => {
            const current = prev[organizationId] || seedForms?.[organizationId];
            if (!current || current.supportReady) return prev;
            return {
                ...prev,
                [organizationId]: {
                    ...current,
                    supportReady: true,
                    lines: assignSalaryJournalAccounts(current.lines, accounts),
                    journalNumber: current.journalNumber || String(data.nextJournalNumber || '').trim(),
                    currencyId: current.currencyId || String(aed?.currency_id || currencies[0]?.currency_id || ''),
                    locationId: current.locationId || String(location?.location_id || location?.id || ''),
                },
            };
        });
    }

    const active = organizations.find((org) => org.organizationId === activeId) || null;
    const form = forms[activeId] || null;
    const activeSupport = support[activeId] || { accounts: [], locations: [], currencies: [], contacts: [] };

    const totals = useMemo(() => {
        const lines = form?.lines || [];
        const debit = lines.reduce((sum, line) => sum + money(line.debit), 0);
        const credit = lines.reduce((sum, line) => sum + money(line.credit), 0);
        return { debit, credit, difference: debit - credit };
    }, [form?.lines]);

    const currencyLabel = useMemo(() => {
        const row = (activeSupport.currencies || []).find((item) => String(item.currency_id) === String(form?.currencyId));
        if (!row) return 'AED- Dirhams';
        const code = row.currency_code || 'AED';
        return row.currency_name ? `${code}- ${row.currency_name}` : code;
    }, [activeSupport.currencies, form?.currencyId]);

    function patchForm(patch) {
        setForms((prev) => {
            const current = prev[activeId];
            if (!current) return prev;
            return { ...prev, [activeId]: { ...current, ...patch } };
        });
    }

    function updateLine(key, patch) {
        patchForm({
            lines: (form?.lines || []).map((line) => (line.key === key ? { ...line, ...patch } : line)),
        });
    }

    function accountOptions(line) {
        const rows = Array.isArray(activeSupport.accounts) ? activeSupport.accounts : [];
        if (line.accountId && !rows.some((row) => String(row.account_id || row.id || '') === line.accountId)) {
            return [{ account_id: line.accountId, account_name: line.accountName || line.accountId }, ...rows];
        }
        return rows;
    }

    function onFiles(event) {
        const picked = Array.from(event.target.files || []);
        const next = [...(form?.files || [])];
        for (const file of picked) {
            if (next.length >= 5) break;
            if (file.size > 10 * 1024 * 1024) {
                toast({ title: 'File too large', description: `${file.name} is over 10MB.`, variant: 'destructive' });
                continue;
            }
            next.push(file);
        }
        patchForm({ files: next });
        event.target.value = '';
    }

    function validate(org, draft) {
        if (!String(draft.notes || '').trim()) return `${org.label} needs notes.`;
        const lines = (draft.lines || []).filter((line) => (
            line.accountId || line.description || line.contactId || money(line.debit) || money(line.credit)
        ));
        if (!lines.length) return '';
        let debit = 0;
        let credit = 0;
        for (const line of lines) {
            const lineDebit = money(line.debit);
            const lineCredit = money(line.credit);
            if (!line.accountId) return `${org.label}: each row needs an account.`;
            if (lineDebit > 0 && lineCredit > 0) return `${org.label}: a row cannot have both a debit and a credit.`;
            if (lineDebit <= 0 && lineCredit <= 0) return `${org.label}: each row needs a debit or a credit.`;
            debit += lineDebit;
            credit += lineCredit;
        }
        if (lines.length < 2) return `${org.label} needs at least two lines.`;
        if (Math.abs(debit - credit) > 0.009) return `${org.label} debits and credits must balance.`;
        return '';
    }

    async function submit(status) {
        const targets = organizations.filter((org) => {
            const draft = forms[org.organizationId];
            return (draft?.lines || []).some((line) => money(line.debit) > 0 || money(line.credit) > 0);
        });
        if (!targets.length) {
            toast({ title: 'Nothing to send', description: 'Add a debit and a credit before saving.', variant: 'destructive' });
            return;
        }
        for (const org of targets) {
            const problem = validate(org, forms[org.organizationId]);
            if (problem) {
                setActiveId(org.organizationId);
                toast({ title: 'Journal is not ready', description: problem, variant: 'destructive' });
                return;
            }
        }

        setSaving(true);
        const saved = [];
        try {
            for (const org of targets) {
                const draft = forms[org.organizationId];
                const payload = {
                    organizationId: org.organizationId,
                    organizationLabel: org.label,
                    journalDate: draft.journalDate,
                    reverseJournalDate: draft.reverseDate,
                    publishReverseOnly: draft.publishReverseOnly,
                    journalNumber: draft.journalNumber,
                    referenceNumber: draft.referenceNumber,
                    notes: String(draft.notes || '').trim(),
                    reportingMethod: draft.reportingMethod,
                    currencyId: draft.currencyId,
                    locationId: draft.locationId,
                    status,
                    lineItems: draft.lines.map((line) => ({
                        accountId: line.accountId,
                        description: line.description,
                        contactId: line.contactId,
                        debit: money(line.debit),
                        credit: money(line.credit),
                    })),
                };
                const body = new FormData();
                body.append('payload', JSON.stringify(payload));
                for (const file of draft.files || []) body.append('attachments', file);
                try {
                    const response = await axiosInstance.post(
                        `/Employee/salary-register/${monthKey}/zoho-journal`,
                        body,
                        { timeout: 120000 },
                    );
                    saved.push(response?.data?.message || org.label);
                } catch (error) {
                    toast({
                        title: saved.length ? 'Part of the journal was saved' : 'Zoho journal failed',
                        description: [
                            saved.length ? `Saved: ${saved.join(' ')}` : '',
                            `${org.label}: ${error?.response?.data?.message || error?.message || 'Could not store the journal.'}`,
                        ].filter(Boolean).join(' '),
                        variant: 'destructive',
                    });
                    return;
                }
            }
            toast({
                title: status === 'draft' ? 'Draft saved in Zoho' : 'Published in Zoho',
                description: saved.join(' '),
            });
            onClose?.();
        } finally {
            setSaving(false);
        }
    }

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
                <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
                    <h2 className="text-lg font-semibold text-gray-900">New Journal</h2>
                    <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading Zoho journal fields…
                    </div>
                ) : !form ? (
                    <p className="px-5 py-16 text-center text-sm text-gray-500">
                        No Zoho company is connected for this payroll.
                    </p>
                ) : (
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Zoho companies">
                            {organizations.map((org) => (
                                <button
                                    key={org.organizationId}
                                    type="button"
                                    role="tab"
                                    aria-selected={org.organizationId === activeId}
                                    title={org.name || org.label}
                                    onClick={() => setActiveId(org.organizationId)}
                                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                                        org.organizationId === activeId
                                            ? 'bg-blue-600 text-white'
                                            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {org.label}
                                </button>
                            ))}
                        </div>

                        <Field label="Location">
                            <select value={form.locationId} onChange={(event) => patchForm({ locationId: event.target.value })} className={inputClass}>
                                <option value="">Select location</option>
                                {activeSupport.locations.map((loc) => {
                                    const id = String(loc.location_id || loc.id || '');
                                    return <option key={id} value={id}>{loc.location_name || loc.name || id}</option>;
                                })}
                            </select>
                        </Field>
                        <Field label="Date" required>
                            <input type="date" value={form.journalDate} onChange={(event) => patchForm({ journalDate: event.target.value })} className={inputClass} />
                        </Field>
                        <Field label="Reverse Journal Date">
                            <input type="date" value={form.reverseDate} onChange={(event) => patchForm({ reverseDate: event.target.value })} className={inputClass} />
                        </Field>
                        <label className="ml-0 flex items-center gap-2 text-sm text-gray-700 sm:ml-[180px]">
                            <input
                                type="checkbox"
                                checked={form.publishReverseOnly}
                                onChange={(event) => patchForm({ publishReverseOnly: event.target.checked })}
                            />
                            Publish reverse journal only on the reverse journal date
                        </label>
                        <Field label="Journal#" required>
                            <input value={form.journalNumber} onChange={(event) => patchForm({ journalNumber: event.target.value })} className={inputClass} />
                        </Field>
                        <Field label="Reference#">
                            <input value={form.referenceNumber} maxLength={100} onChange={(event) => patchForm({ referenceNumber: event.target.value })} className={inputClass} />
                        </Field>
                        <Field label="Notes" required>
                            <textarea
                                value={form.notes}
                                maxLength={500}
                                rows={3}
                                placeholder="Max. 500 characters"
                                onChange={(event) => {
                                    const notes = event.target.value;
                                    patchForm({ notes, lines: linesForNote(form.lines, notes) });
                                }}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Reporting Method">
                            <div className="flex flex-wrap gap-4 pt-2 text-sm text-gray-700">
                                {[
                                    ['both', 'Accrual and Cash'],
                                    ['accrual', 'Accrual Only'],
                                    ['cash', 'Cash Only'],
                                ].map(([value, label]) => (
                                    <label key={value} className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="salary-journal-reporting"
                                            checked={form.reportingMethod === value}
                                            onChange={() => patchForm({ reportingMethod: value })}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </Field>
                        <Field label="Currency">
                            <select value={form.currencyId} onChange={(event) => patchForm({ currencyId: event.target.value })} className={inputClass}>
                                {activeSupport.currencies.map((row) => (
                                    <option key={row.currency_id} value={row.currency_id}>
                                        {row.currency_code}{row.currency_name ? `- ${row.currency_name}` : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <div className="overflow-x-auto rounded-lg border">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2">Account</th>
                                        <th className="px-3 py-2">Description</th>
                                        <th className="px-3 py-2">Contact ({currencyLabel.split('-')[0]})</th>
                                        <th className="px-3 py-2 text-right">Debits</th>
                                        <th className="px-3 py-2 text-right">Credits</th>
                                        <th className="px-2 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {(form.lines || []).map((line) => (
                                        <tr key={line.key} className="border-t">
                                            <td className="px-2 py-2">
                                                <select
                                                    value={line.accountId}
                                                    onChange={(event) => {
                                                        const accountId = event.target.value;
                                                        const account = accountOptions(line).find((row) => String(row.account_id || row.id || '') === accountId);
                                                        updateLine(line.key, {
                                                            accountId,
                                                            accountName: account?.account_name || account?.name || '',
                                                        });
                                                    }}
                                                    className={cellInput}
                                                >
                                                    <option value="">Select an account</option>
                                                    {accountOptions(line).map((account) => {
                                                        const id = String(account.account_id || account.id || '');
                                                        return <option key={id} value={id}>{account.account_name || account.name}</option>;
                                                    })}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    value={line.description}
                                                    placeholder="Description"
                                                    onChange={(event) => updateLine(line.key, { description: event.target.value, descriptionEdited: true })}
                                                    className={cellInput}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <select
                                                    value={line.contactId}
                                                    onChange={(event) => updateLine(line.key, { contactId: event.target.value })}
                                                    className={cellInput}
                                                >
                                                    <option value="">Select Contact</option>
                                                    {activeSupport.contacts.map((contact) => (
                                                        <option key={contact.id} value={contact.id}>{contact.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    inputMode="decimal"
                                                    value={line.debit}
                                                    onChange={(event) => updateLine(line.key, { debit: event.target.value, credit: event.target.value ? '' : line.credit })}
                                                    className={`${cellInput} text-right`}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    inputMode="decimal"
                                                    value={line.credit}
                                                    onChange={(event) => updateLine(line.key, { credit: event.target.value, debit: event.target.value ? '' : line.debit })}
                                                    className={`${cellInput} text-right`}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => patchForm({
                                                        lines: (form.lines || []).length > 2
                                                            ? form.lines.filter((row) => row.key !== line.key)
                                                            : form.lines,
                                                    })}
                                                    className="text-gray-400 hover:text-red-600"
                                                    aria-label="Remove row"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            type="button"
                            onClick={() => patchForm({ lines: [...(form.lines || []), emptyLine()] })}
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"
                        >
                            <Plus className="h-4 w-4" /> Add New Row
                        </button>

                        <div className="ml-auto w-full max-w-sm rounded-lg bg-gray-50 px-4 py-3 text-sm">
                            <div className="flex justify-between py-1 text-gray-500">
                                <span>Sub Total</span>
                                <span className="tabular-nums">{formatAmount(totals.debit)}</span>
                                <span className="tabular-nums">{formatAmount(totals.credit)}</span>
                            </div>
                            <div className="flex justify-between py-1 font-semibold text-gray-900">
                                <span>Total (AED)</span>
                                <span className="tabular-nums">{formatAmount(totals.debit)}</span>
                                <span className="tabular-nums">{formatAmount(totals.credit)}</span>
                            </div>
                            <div className={`flex justify-end pt-1 ${Math.abs(totals.difference) > 0.009 ? 'text-red-600' : 'text-gray-400'}`}>
                                <span className="mr-8">Difference</span>
                                <span className="tabular-nums">{formatAmount(totals.difference)}</span>
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 text-sm font-medium text-gray-700">Attachments</p>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                <Upload className="h-4 w-4" /> Upload File
                                <input type="file" multiple className="hidden" onChange={onFiles} />
                            </label>
                            <p className="mt-1 text-xs text-gray-400">You can upload a maximum of 5 files, 10MB each</p>
                            {form.files?.length ? (
                                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                                    {form.files.map((file, index) => (
                                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                                            <span className="truncate">{file.name}</span>
                                            <button
                                                type="button"
                                                className="text-red-600"
                                                onClick={() => patchForm({ files: form.files.filter((_, fileIndex) => fileIndex !== index) })}
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    </div>
                )}

                <div className="flex shrink-0 flex-wrap gap-2 border-t bg-white px-5 py-4">
                    <button
                        type="button"
                        disabled={saving || loading || !form}
                        onClick={() => submit('published')}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Save and Publish'}
                    </button>
                    <button
                        type="button"
                        disabled={saving || loading || !form}
                        onClick={() => submit('draft')}
                        className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                        Save as Draft
                    </button>
                    <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
