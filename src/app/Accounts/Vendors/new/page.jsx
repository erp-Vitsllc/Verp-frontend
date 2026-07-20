'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

function RequiredLabel({ children }) {
    return (
        <span className="text-xs font-bold text-red-600">
            {children} <span className="text-blue-600">*</span>
        </span>
    );
}

function FieldLabel({ children }) {
    return <span className="text-xs font-semibold text-slate-600">{children}</span>;
}

export default function NewVendorPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        contactName: '',
        companyName: '',
        email: '',
        phone: '',
        website: '',
        notes: '',
    });

    const setField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!String(form.contactName || '').trim()) {
            setError('Vendor name is required.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            await axiosInstance.post('/zoho/vendors', {
                contact_name: String(form.contactName).trim(),
                company_name: form.companyName,
                email: form.email,
                phone: form.phone,
                website: form.website,
                notes: form.notes,
            });
            toast({ title: 'Vendor created', description: 'The vendor was created in Zoho Books.' });
            router.push('/Accounts/Vendors');
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to create vendor');
        } finally {
            setSaving(false);
        }
    };

    return (
        <PermissionGuard moduleId="purchases" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f6f8]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden overflow-y-auto">
                        <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 px-4 sm:px-6 py-4">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900">New Vendor</h2>
                                <p className="text-xs sm:text-sm text-slate-500">
                                    Create a vendor in Zoho Books.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4 px-4 sm:px-6 py-5">
                                    {error ? (
                                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                            {error}
                                        </div>
                                    ) : null}

                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                        <RequiredLabel>Vendor Name</RequiredLabel>
                                        <input
                                            type="text"
                                            value={form.contactName}
                                            onChange={(e) => setField('contactName', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                            required
                                        />
                                    </label>
                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                        <FieldLabel>Company Name</FieldLabel>
                                        <input
                                            type="text"
                                            value={form.companyName}
                                            onChange={(e) => setField('companyName', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                        />
                                    </label>
                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                        <FieldLabel>Email</FieldLabel>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setField('email', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                        />
                                    </label>
                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                        <FieldLabel>Work Phone</FieldLabel>
                                        <input
                                            type="text"
                                            value={form.phone}
                                            onChange={(e) => setField('phone', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                        />
                                    </label>
                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-center gap-1.5 sm:gap-3">
                                        <FieldLabel>Website</FieldLabel>
                                        <input
                                            type="text"
                                            value={form.website}
                                            onChange={(e) => setField('website', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                        />
                                    </label>
                                    <label className="grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:items-start gap-1.5 sm:gap-3">
                                        <FieldLabel>Notes</FieldLabel>
                                        <textarea
                                            value={form.notes}
                                            onChange={(e) => setField('notes', e.target.value)}
                                            rows={3}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                        />
                                    </label>
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push('/Accounts/Vendors')}
                                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}
