'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Pencil, Plus, Printer } from 'lucide-react';
import { useInventoryAccess } from '../item-master/itemMasterAccess';
import AddContactModal from './AddContactModal';

const TABS = ['Overview', 'Contacts', 'Products and Brand', 'Brands', 'Pricing', 'RFQs', 'POs', 'Documents'];

function shown(value) {
    const text = String(value || '').trim();
    return text || 'N/A';
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

function contactCategories(contacts) {
    const categories = new Map();
    contacts.forEach((contact) => {
        (contact.lines || []).forEach((line) => {
            const name = String(line.categoryName || '').trim();
            const id = String(line.categoryId || '').trim();
            if (!name && !id) return;
            const key = id || name.toLowerCase();
            if (!categories.has(key)) categories.set(key, { id: key, name: name || 'Category' });
        });
    });
    return [...categories.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function contactHasCategory(contact, categoryId) {
    return (contact.lines || []).some((line) => {
        const id = String(line.categoryId || '').trim();
        const name = String(line.categoryName || '').trim().toLowerCase();
        return id === categoryId || name === categoryId;
    });
}

export default function VendorDetail({ vendor, onReload }) {
    const router = useRouter();
    const access = useInventoryAccess();
    const [tab, setTab] = useState('Contacts');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [contactModal, setContactModal] = useState(null);
    const contacts = Array.isArray(vendor.contacts) ? vendor.contacts : [];
    const categories = contactCategories(contacts);
    const activeCategory = categories.find((category) => category.id === categoryFilter);
    const visibleContacts = activeCategory
        ? contacts.filter((contact) => contactHasCategory(contact, categoryFilter))
        : contacts;
    const site = websiteHref(vendor.website);

    function openTab(next) {
        if (next !== 'Contacts') setCategoryFilter('');
        setTab(next);
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/inventory/vendor-management')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-slate-700"
                    >
                        <ArrowLeft size={14} />
                        Back
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900">Vendor Detail</h1>
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
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)]">
                    <div className="flex gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#E6EDF5] text-blue-600">
                            <Building2 size={28} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">{vendor.name}</h2>
                                {vendor.vendorType ? (
                                    <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{vendor.vendorType}</span>
                                ) : null}
                                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${vendor.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                    {vendor.status || 'Active'}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{shown(vendor.address)}</p>
                            <dl className="mt-4 space-y-1 text-sm text-slate-600">
                                <div><span className="text-slate-500">Primary Contact: </span><span className="font-semibold text-slate-800">{shown(vendor.contact)}</span></div>
                                <div><span className="text-slate-500">Phone: </span><span className="font-semibold text-slate-800">{shown(vendor.phone)}</span></div>
                                <div><span className="text-slate-500">Email: </span><span className="font-semibold text-slate-800">{shown(vendor.email)}</span></div>
                            </dl>
                        </div>
                    </div>
                    <dl className="space-y-4 border-[#E6EDF5] text-sm lg:border-l lg:pl-6">
                        <div>
                            <dt className="text-slate-500">Payment Terms</dt>
                            <dd className="mt-0.5 text-base font-bold text-slate-900">{shown(vendor.paymentTerms)}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">TRN / VAT</dt>
                            <dd className="mt-0.5 text-base font-bold text-slate-900">{shown(vendor.taxRegNo)}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Website</dt>
                            <dd className="mt-0.5 text-base font-semibold">
                                {site ? <a href={site} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{vendor.website}</a> : 'N/A'}
                            </dd>
                        </div>
                    </dl>
                </div>
            </section>

            <section className="rounded-2xl border border-[#E6EDF5] bg-white">
                <div role="tablist" aria-label="Vendor detail" className="flex gap-1 overflow-x-auto border-b border-[#E6EDF5] px-4">
                    {TABS.map((item) => (
                        <button
                            key={item}
                            type="button"
                            role="tab"
                            aria-selected={tab === item}
                            onClick={() => openTab(item)}
                            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${tab === item ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            {item}
                        </button>
                    ))}
                </div>

                {tab === 'Contacts' ? (
                    <div className="p-4 sm:p-5">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Vendor Contacts</h2>
                                {activeCategory ? (
                                    <p className="mt-1 text-sm text-slate-500">
                                        Showing contacts for {activeCategory.name}.{' '}
                                        <button type="button" onClick={() => setCategoryFilter('')} className="font-medium text-blue-600 hover:underline">
                                            Show all
                                        </button>
                                    </p>
                                ) : null}
                            </div>
                            {access.ready && !access.canCreateVendor ? null : (
                                <button
                                    type="button"
                                    onClick={() => setContactModal({ mode: 'add' })}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"
                                >
                                    <Plus size={14} />
                                    Add Contact
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                                        {['Name', 'Designation', 'Email(s)', 'Phone(s)', 'Products Handling', 'Action'].map((heading) => (
                                            <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleContacts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                                {activeCategory ? 'No contacts for this category.' : 'No contacts yet.'}
                                            </td>
                                        </tr>
                                    ) : visibleContacts.map((contact) => (
                                        <tr key={contact.id} className="border-b border-slate-100 text-slate-700">
                                            <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-800">
                                                {contact.name}
                                                {contact.isPrimary ? <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700">Primary</span> : null}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5">{contact.designation || 'N/A'}</td>
                                            <td className="px-4 py-3.5"><Lines values={contact.emails} link="mail" /></td>
                                            <td className="whitespace-nowrap px-4 py-3.5"><Lines values={contact.phones} /></td>
                                            <td className="px-4 py-3.5">{contact.brands?.length ? contact.brands.join(', ') : 'N/A'}</td>
                                            <td className="px-4 py-3.5">
                                                {access.ready && !access.canEditVendor ? null : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setContactModal({ mode: 'edit', contact })}
                                                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 text-sm font-medium text-slate-700"
                                                    >
                                                        <Pencil size={13} />
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : tab === 'Products and Brand' ? (
                    <div className="p-4 sm:p-5">
                        {categories.length === 0 ? (
                            <p className="py-10 text-center text-sm text-slate-500">No categories yet. They appear here when a contact has a category.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => {
                                            setCategoryFilter(category.id);
                                            setTab('Contacts');
                                        }}
                                        className="flex min-h-28 flex-col justify-between rounded-xl border border-[#E6EDF5] bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                                    >
                                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Category</span>
                                        <span className="mt-3 text-base font-semibold text-slate-900">{category.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="px-5 py-10 text-sm text-slate-500">No records yet.</p>
                )}
            </section>

            {contactModal ? (
                <AddContactModal
                    vendorId={vendor.id}
                    contact={contactModal.contact}
                    onClose={() => setContactModal(null)}
                    onSaved={() => {
                        setContactModal(null);
                        onReload();
                    }}
                />
            ) : null}
        </div>
    );
}
