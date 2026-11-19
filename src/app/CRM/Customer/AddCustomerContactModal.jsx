'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import CatalogModal, { fieldClass, labelClass } from '../../inventory/item-master/CatalogModal';
import { emailProblem, normalizePhone, phoneProblem } from '../../inventory/vendor-management/vendorFieldValidation';
import { createCustomerContact, customerApiMessage, updateCustomerContact } from './customerApi';

const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), { ssr: false });

export default function AddCustomerContactModal({ customerId, contact, onClose, onSaved, stacked = false }) {
    const [name, setName] = useState(contact?.name || '');
    const [designation, setDesignation] = useState(contact?.designation || '');
    const [email, setEmail] = useState(contact?.emails?.[0] || '');
    const [phone, setPhone] = useState(() => normalizePhone(contact?.phones?.[0] || ''));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showRequired, setShowRequired] = useState(false);
    const emailError = !email.trim()
        ? (showRequired ? 'Email is required.' : '')
        : emailProblem(email);
    const phoneError = !phone.trim()
        ? (showRequired ? 'Phone number is required.' : '')
        : phoneProblem(phone);

    async function onSubmit(event) {
        event.preventDefault();
        const missingEmail = !email.trim() ? 'Email is required.' : emailProblem(email);
        const missingPhone = !phone.trim() ? 'Phone number is required.' : phoneProblem(phone);
        if (!name.trim() || missingEmail || missingPhone) {
            setShowRequired(true);
            setError(!name.trim() ? 'Name is required.' : (missingEmail || missingPhone));
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            name: name.trim(),
            designation: designation.trim(),
            entries: [{ email: email.trim(), phone: phone.trim() }],
        };
        try {
            const saved = contact?.id
                ? await updateCustomerContact(customerId, contact.id, payload)
                : await createCustomerContact(customerId, payload);
            onSaved(saved);
        } catch (saveError) {
            setError(customerApiMessage(saveError, 'Could not save this contact.'));
            setSaving(false);
        }
    }

    return (
        <CatalogModal title={contact ? 'Edit Contact' : 'Add Contact'} onClose={onClose} wide stacked={stacked}>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
                <div className="max-h-[min(40rem,calc(100vh-11rem))] overflow-y-auto px-5 py-4">
                    {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className={labelClass}>Name</span>
                            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
                        </label>
                        <label className="block">
                            <span className={labelClass}>Designation</span>
                            <input className={fieldClass} value={designation} onChange={(event) => setDesignation(event.target.value)} />
                        </label>
                    </div>

                    <div className="mt-4 rounded-xl border border-[#E6EDF5] p-3">
                        <p className="mb-3 text-sm font-medium text-slate-700">Contact details</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className={labelClass}>Email <span className="text-red-500">*</span></span>
                                <input
                                    className={`${fieldClass} ${emailError ? 'border-red-400' : ''}`}
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                />
                                {emailError ? <p className="mt-1 text-xs text-red-600">{emailError}</p> : null}
                            </label>
                            <div className="min-w-0">
                                <span className={labelClass}>Phone <span className="text-red-500">*</span></span>
                                <PhoneInputField
                                    label=""
                                    defaultCountry="AE"
                                    value={phone}
                                    required={false}
                                    showValidatedBadge={false}
                                    placeholder="Phone number"
                                    onChange={(value) => setPhone(value || '')}
                                />
                                {phoneError ? <p className="mt-1 text-xs text-red-600">{phoneError}</p> : null}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E6EDF5] px-5 py-4">
                    <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-slate-700">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'OK'}
                    </button>
                </div>
            </form>
        </CatalogModal>
    );
}
