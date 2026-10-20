'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Settings, Trash2, Upload, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const emptyLine = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    accountId: '',
    description: '',
    contactId: '',
    debit: '',
    credit: '',
});

function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return n;
}

function formatAmount(value) {
    return money(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayIso() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

export default function FineMyJournalModal({ isOpen, fine, onClose, onSuccess }) {
    const { toast } = useToast();
    const organizationId = String(fine?.zohoOrganizationId || '').trim();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [locations, setLocations] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [locationId, setLocationId] = useState('');
    const [journalDate, setJournalDate] = useState(todayIso());
    const [reverseDate, setReverseDate] = useState('');
    const [publishReverseOnly, setPublishReverseOnly] = useState(false);
    const [journalNumber, setJournalNumber] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [reportingMethod, setReportingMethod] = useState('both');
    const [currencyId, setCurrencyId] = useState('');
    const [lines, setLines] = useState([emptyLine(), emptyLine()]);
    const [files, setFiles] = useState([]);

    const loadSupport = useCallback(async () => {
        const params = organizationId ? { organizationId } : {};
        setLoading(true);
        try {
            const [supportRes, vendorRes, customerRes] = await Promise.all([
                axiosInstance.get('/zoho/journals/support', { params, skipToast: true, timeout: 120000 }),
                axiosInstance.get('/zoho/vendors', { params: { ...params, sync: 'false' }, skipToast: true, timeout: 120000 }).catch(() => null),
                axiosInstance.get('/zoho/customers', { params: { ...params, sync: 'false' }, skipToast: true, timeout: 120000 }).catch(() => null),
            ]);
            const data = supportRes?.data?.data || {};
            const accountRows = Array.isArray(data.accounts) ? data.accounts : [];
            const locationRows = Array.isArray(data.locations) ? data.locations : [];
            const currencyRows = Array.isArray(data.currencies) ? data.currencies : [];
            setAccounts(accountRows);
            setLocations(locationRows);
            setCurrencies(currencyRows);
            setJournalNumber(String(data.nextJournalNumber || '').trim());

            const aed = currencyRows.find((c) => String(c.currency_code || '').toUpperCase() === 'AED');
            setCurrencyId(String(aed?.currency_id || currencyRows[0]?.currency_id || ''));

            const dxb = locationRows.find((loc) => /dxb|dubai/i.test(String(loc.location_name || loc.name || '')));
            setLocationId(String((dxb || locationRows[0])?.location_id || (dxb || locationRows[0])?.id || ''));

            const vendorRows = Array.isArray(vendorRes?.data?.data) ? vendorRes.data.data : [];
            const customerRows = Array.isArray(customerRes?.data?.data) ? customerRes.data.data : [];
            const mapped = [
                ...vendorRows.map((row) => ({
                    id: String(row.contact_id || row.vendor_id || row.zohoContactId || row._id || '').trim(),
                    name: String(row.contact_name || row.vendor_name || row.company_name || row.name || '').trim(),
                    kind: 'Vendor',
                })),
                ...customerRows.map((row) => ({
                    id: String(row.contact_id || row.customer_id || row.zohoContactId || row._id || '').trim(),
                    name: String(row.contact_name || row.customer_name || row.company_name || row.name || '').trim(),
                    kind: 'Customer',
                })),
            ].filter((row) => row.id && row.name);
            const seen = new Set();
            setContacts(mapped.filter((row) => {
                if (seen.has(row.id)) return false;
                seen.add(row.id);
                return true;
            }));
        } catch (error) {
            toast({
                title: 'Could not load journal form',
                description: error?.response?.data?.message || error?.message || 'Zoho journal data failed to load.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [organizationId, toast]);

    useEffect(() => {
        if (!isOpen) return;
        setJournalDate(todayIso());
        setReverseDate('');
        setPublishReverseOnly(false);
        setReferenceNumber(String(fine?.fineId || ''));
        setNotes(String(fine?.notes || fine?.reason || '').slice(0, 500));
        setReportingMethod('both');
        setLines([emptyLine(), emptyLine()]);
        setFiles([]);
        loadSupport();
    }, [isOpen, fine?.fineId, fine?.notes, fine?.reason, loadSupport]);

    const totals = useMemo(() => {
        const debit = lines.reduce((sum, line) => sum + money(line.debit), 0);
        const credit = lines.reduce((sum, line) => sum + money(line.credit), 0);
        return { debit, credit, difference: debit - credit };
    }, [lines]);

    const currencyLabel = useMemo(() => {
        const row = currencies.find((c) => String(c.currency_id) === String(currencyId));
        if (!row) return 'AED';
        const code = row.currency_code || 'AED';
        const name = row.currency_name || '';
        return name ? `${code}- ${name}` : code;
    }, [currencies, currencyId]);

    const updateLine = (key, patch) => {
        setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    };

    const onFiles = (event) => {
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
    };

    const submit = async (status) => {
        if (!notes.trim()) {
            toast({ title: 'Notes required', description: 'Enter notes (max 500 characters).', variant: 'destructive' });
            return;
        }
        if (Math.abs(totals.difference) > 0.009) {
            toast({ title: 'Journal is not balanced', description: 'Debits and credits must be equal.', variant: 'destructive' });
            return;
        }
        const lineItems = lines
            .filter((line) => line.accountId || line.debit || line.credit || line.description || line.contactId)
            .map((line) => ({
                accountId: line.accountId,
                description: line.description,
                contactId: line.contactId,
                debit: money(line.debit),
                credit: money(line.credit),
            }));

        const payload = {
            organizationId,
            journalDate,
            reverseJournalDate: reverseDate,
            publishReverseOnly,
            referenceNumber,
            notes: notes.trim(),
            reportingMethod,
            currencyId,
            locationId,
            status,
            lineItems,
        };

        const form = new FormData();
        form.append('payload', JSON.stringify(payload));
        files.forEach((file) => form.append('attachments', file));

        const fineId = fine?._id || fine?.fineId;
        setSaving(true);
        try {
            const response = await axiosInstance.post(`/Fine/${fineId}/my-journal`, form, {
                timeout: 120000,
            });
            toast({
                title: status === 'draft' ? 'Draft saved in Zoho' : 'Journal added',
                description: response?.data?.message || 'Stored in Zoho.',
            });
            if (status === 'published') {
                onSuccess?.(response?.data?.fine);
            }
        } catch (error) {
            toast({
                title: 'Zoho journal failed',
                description: error?.response?.data?.message || error?.message || 'Could not store the journal.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 print:hidden">
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
                ) : (
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <Field label="Location">
                            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass}>
                                <option value="">Select location</option>
                                {locations.map((loc) => {
                                    const id = String(loc.location_id || loc.id || '');
                                    return (
                                        <option key={id} value={id}>
                                            {loc.location_name || loc.name || id}
                                        </option>
                                    );
                                })}
                            </select>
                        </Field>
                        <Field label="Date" required>
                            <input type="date" value={journalDate} onChange={(e) => setJournalDate(e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Reverse Journal Date">
                            <input type="date" value={reverseDate} onChange={(e) => setReverseDate(e.target.value)} className={inputClass} />
                        </Field>
                        <label className="ml-[180px] flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={publishReverseOnly}
                                onChange={(e) => setPublishReverseOnly(e.target.checked)}
                            />
                            Publish reverse journal only on the reverse date
                        </label>
                        <Field label="Journal#" required>
                            <div className="flex items-center gap-2">
                                <input value={journalNumber} readOnly className={`${inputClass} bg-gray-50`} placeholder="Auto" />
                                <span title="Click here to configure auto-generation of journal numbers." className="text-gray-400">
                                    <Settings className="h-4 w-4" />
                                </span>
                            </div>
                        </Field>
                        <Field label="Reference#">
                            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Notes" required>
                            <textarea
                                value={notes}
                                maxLength={500}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Max. 500 characters"
                                className={`${inputClass} min-h-[72px]`}
                            />
                        </Field>
                        <Field label="Reporting Method">
                            <div className="flex flex-wrap gap-4 text-sm text-gray-800">
                                {[
                                    ['both', 'Accrual and Cash'],
                                    ['accrual', 'Accrual Only'],
                                    ['cash', 'Cash Only'],
                                ].map(([value, label]) => (
                                    <label key={value} className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="reportingMethod"
                                            checked={reportingMethod === value}
                                            onChange={() => setReportingMethod(value)}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </Field>
                        <Field label="Currency">
                            <select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} className={inputClass}>
                                {currencies.map((row) => (
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
                                    {lines.map((line) => (
                                        <tr key={line.key} className="border-t">
                                            <td className="px-2 py-2">
                                                <select
                                                    value={line.accountId}
                                                    onChange={(e) => updateLine(line.key, { accountId: e.target.value })}
                                                    className={cellInput}
                                                >
                                                    <option value="">Select an account</option>
                                                    {accounts.map((account) => {
                                                        const id = String(account.account_id || account.id || '');
                                                        return (
                                                            <option key={id} value={id}>
                                                                {account.account_name || account.name}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    value={line.description}
                                                    placeholder="Description"
                                                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                                                    className={cellInput}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <select
                                                    value={line.contactId}
                                                    onChange={(e) => updateLine(line.key, { contactId: e.target.value })}
                                                    className={cellInput}
                                                >
                                                    <option value="">Select Contact</option>
                                                    {contacts.map((contact) => (
                                                        <option key={`${contact.kind}-${contact.id}`} value={contact.id}>
                                                            {contact.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    inputMode="decimal"
                                                    value={line.debit}
                                                    onChange={(e) => updateLine(line.key, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                                                    className={`${cellInput} text-right`}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    inputMode="decimal"
                                                    value={line.credit}
                                                    onChange={(e) => updateLine(line.key, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                                                    className={`${cellInput} text-right`}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setLines((prev) => (prev.length > 2 ? prev.filter((row) => row.key !== line.key) : prev))}
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
                            onClick={() => setLines((prev) => [...prev, emptyLine()])}
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"
                        >
                            <Plus className="h-4 w-4" /> Add New Row
                        </button>

                        <div className="ml-auto w-full max-w-md rounded-lg bg-gray-50 p-4 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Sub Total</span>
                                <span className="tabular-nums">{formatAmount(totals.debit)} &nbsp; {formatAmount(totals.credit)}</span>
                            </div>
                            <div className="mt-2 flex justify-between font-semibold text-gray-900">
                                <span>Total ({currencyLabel.split('-')[0].trim()})</span>
                                <span className="tabular-nums">{formatAmount(totals.debit)} &nbsp; {formatAmount(totals.credit)}</span>
                            </div>
                            <div className={`mt-2 flex justify-between ${Math.abs(totals.difference) > 0.009 ? 'text-red-600' : 'text-gray-500'}`}>
                                <span>Difference</span>
                                <span className="tabular-nums">{formatAmount(totals.difference)}</span>
                            </div>
                        </div>

                        <div>
                            <p className="mb-1 text-sm text-gray-700">Attachments</p>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                <Upload className="h-4 w-4" /> Upload File
                                <input type="file" multiple className="hidden" onChange={onFiles} />
                            </label>
                            <p className="mt-1 text-xs text-gray-500">You can upload a maximum of 5 files, 10MB each</p>
                            {files.length > 0 && (
                                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                                    {files.map((file, index) => (
                                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                                            <span className="truncate">{file.name}</span>
                                            <button type="button" className="text-xs text-red-600" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}>
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex shrink-0 flex-wrap gap-2 border-t bg-white px-5 py-4">
                    <button
                        type="button"
                        disabled={saving || loading}
                        onClick={() => submit('published')}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Save and Publish'}
                    </button>
                    <button
                        type="button"
                        disabled={saving || loading}
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
        </div>
    );
}

const inputClass = 'w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500';
const cellInput = 'w-full min-w-[140px] rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500';

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
