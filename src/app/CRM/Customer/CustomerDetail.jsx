'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Printer, RefreshCw } from 'lucide-react';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';
import { customerApiMessage, syncCustomerFromZoho } from './customerApi';

const TABS = ['Overview', 'Contacts', 'Products', 'Brands', 'Bills', 'Pricing', 'RFQs', 'POs', 'Documents'];

function shown(value) {
    const text = String(value || '').trim();
    return text || 'N/A';
}

function money(amount, currency) {
    if (amount == null || amount === '' || Number.isNaN(Number(amount))) return 'N/A';
    const code = String(currency || 'AED').trim() || 'AED';
    try {
        return new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(amount));
    } catch {
        return `${code} ${Number(amount).toFixed(2)}`;
    }
}

function websiteHref(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) return text;
    return `https://${text}`;
}

function Lines({ values, link }) {
    const rows = (values || []).map((value) => String(value || '').trim()).filter(Boolean);
    if (!rows.length) return 'N/A';
    return (
        <span className="flex flex-col gap-0.5">
            {rows.map((value) => (
                link ? (
                    <a key={value} href={link === 'mail' ? `mailto:${value}` : `tel:${value}`} className="text-blue-600 hover:underline">
                        {value}
                    </a>
                ) : <span key={value}>{value}</span>
            ))}
        </span>
    );
}

export default function CustomerDetail({ customer, onReload }) {
    const router = useRouter();
    const [tab, setTab] = useState('Contacts');
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState('');
    const contacts = Array.isArray(customer.contacts) ? customer.contacts : [];
    const brands = Array.isArray(customer.brands) ? customer.brands.filter(Boolean) : [];
    const site = websiteHref(customer.website);

    async function syncFromZoho() {
        setSyncing(true);
        setSyncError('');
        try {
            await syncCustomerFromZoho(customer.id);
            onReload();
        } catch (err) {
            setSyncError(customerApiMessage(err, 'Could not sync this customer from Zoho.'));
        } finally {
            setSyncing(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (!tryNavigateListReturn(router)) router.push('/CRM/Customer');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700"
                    >
                        <ArrowLeft size={14} />
                        Back
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900">Customer Detail</h1>
                </div>
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700"
                >
                    <Printer size={14} />
                    Print
                </button>
            </div>

            <section className="rounded-2xl border border-[#E6EDF5] bg-white p-4 sm:p-5">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(11rem,0.7fr)_minmax(180px,0.7fr)_auto] lg:items-start">
                    <div className="flex min-w-0 gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#E6EDF5] text-blue-600">
                            <Building2 size={28} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">{customer.name}</h2>
                                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${customer.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                    {customer.status || 'Active'}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{shown(customer.address)}</p>
                            <dl className="mt-4 space-y-1 text-sm text-slate-600">
                                <div><span className="text-slate-500">Primary Contact: </span><span className="font-semibold text-slate-800">{shown(customer.contact)}</span></div>
                                <div><span className="text-slate-500">Phone: </span><span className="font-semibold text-slate-800">{shown(customer.phone)}</span></div>
                                <div><span className="text-slate-500">Email: </span><span className="font-semibold text-slate-800">{shown(customer.email)}</span></div>
                            </dl>
                        </div>
                    </div>
                    <div className="min-w-[11rem] space-y-4 border-[#E6EDF5] lg:border-l lg:pl-6">
                        <div>
                            <p className="text-sm text-slate-500">Outstanding</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{money(customer.outstandingPayment, customer.currencyCode)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Unused Credits</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{money(customer.unusedCredits, customer.currencyCode)}</p>
                        </div>
                    </div>
                    <dl className="space-y-4 border-[#E6EDF5] text-sm lg:border-l lg:pl-6">
                        <div>
                            <dt className="text-slate-500">Payment Terms</dt>
                            <dd className="mt-0.5 text-base font-bold text-slate-900">{shown(customer.paymentTerms)}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">TRN / VAT</dt>
                            <dd className="mt-0.5 text-base font-bold text-slate-900">{shown(customer.taxRegNo)}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Website</dt>
                            <dd className="mt-0.5 text-base font-semibold">
                                {site ? <a href={site} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{customer.website}</a> : 'N/A'}
                            </dd>
                        </div>
                    </dl>
                    <div className="flex flex-col items-start gap-2 lg:items-end">
                        <button
                            type="button"
                            disabled={syncing}
                            onClick={syncFromZoho}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync from Zoho'}
                        </button>
                        {syncError ? <p className="max-w-xs text-right text-xs text-red-600">{syncError}</p> : null}
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-[#E6EDF5] bg-white">
                <div role="tablist" aria-label="Customer detail" className="flex gap-1 overflow-x-auto border-b border-[#E6EDF5] px-4">
                    {TABS.map((item) => (
                        <button
                            key={item}
                            type="button"
                            role="tab"
                            aria-selected={tab === item}
                            onClick={() => setTab(item)}
                            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${tab === item ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            {item}
                        </button>
                    ))}
                </div>

                {tab === 'Contacts' ? (
                    <div className="p-4 sm:p-5">
                        <h2 className="mb-4 text-lg font-bold text-slate-900">Customer Contacts</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                                        {['Name', 'Designation', 'Email(s)', 'Phone(s)'].map((heading) => (
                                            <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {contacts.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No contacts yet.</td>
                                        </tr>
                                    ) : contacts.map((contact) => (
                                        <tr key={contact.id} className="border-b border-slate-100 text-slate-700">
                                            <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">
                                                {contact.name}
                                                {contact.isPrimary ? <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700">Primary</span> : null}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5">{contact.designation || 'N/A'}</td>
                                            <td className="px-4 py-3.5"><Lines values={contact.emails} link="mail" /></td>
                                            <td className="whitespace-nowrap px-4 py-3.5"><Lines values={contact.phones} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : tab === 'Brands' ? (
                    <div className="p-4 sm:p-5">
                        {brands.length === 0 ? (
                            <p className="py-10 text-center text-sm text-slate-500">No brands yet.</p>
                        ) : (
                            <div className="flex flex-wrap gap-4">
                                {brands.map((brand) => (
                                    <div
                                        key={brand}
                                        className="flex size-32 items-center justify-center rounded-xl border border-[#E6EDF5] bg-white p-3 text-center text-sm font-semibold leading-snug text-slate-900 shadow-sm"
                                    >
                                        <span className="line-clamp-4 break-words">{brand}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : tab === 'Products' ? (
                    <div className="p-4 sm:p-5">
                        {customer.products == null ? (
                            <p className="py-10 text-center text-sm text-slate-500">No products yet.</p>
                        ) : (
                            <p className="text-sm text-slate-700">Products: <span className="font-semibold text-slate-900">{customer.products}</span></p>
                        )}
                    </div>
                ) : tab === 'Overview' ? (
                    <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-slate-500">Customer code</dt>
                            <dd className="mt-0.5 font-semibold text-slate-900">{shown(customer.code)}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Location</dt>
                            <dd className="mt-0.5 font-semibold text-slate-900">{shown(customer.location)}</dd>
                        </div>
                    </dl>
                ) : (
                    <p className="px-5 py-10 text-sm text-slate-500">No records yet.</p>
                )}
            </section>
        </div>
    );
}
