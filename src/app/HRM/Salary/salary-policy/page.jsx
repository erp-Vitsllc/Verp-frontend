'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import SalaryPolicyFields from '../components/SalaryPolicyFields';
import SalaryHeaderActions from '../components/SalaryHeaderActions';
import { EMPTY_POLICY_FORM, policyFormFromApi } from '../utils/salaryPolicyForm';
import { notifyMainSalaryPolicyChanged } from '../utils/mainSalaryPolicy';

export default function SalaryPolicyPage() {
    const { toast } = useToast();
    const [form, setForm] = useState(EMPTY_POLICY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchPolicy = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setLoading(true);
            setError('');
        }
        try {
            const res = await axiosInstance.get('/Employee/payroll-settings', { skipToast: true });
            setForm(policyFormFromApi(res.data));
            if (silent) setError('');
        } catch (err) {
            if (!silent) setForm(EMPTY_POLICY_FORM);
            setError(err?.response?.data?.message || 'Failed to load salary policy.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPolicy();
    }, [fetchPolicy]);

    async function handleSave() {
        setSaving(true);
        try {
            await axiosInstance.put('/Employee/payroll-settings', form);
            toast({ title: 'Main salary policy saved' });
            notifyMainSalaryPolicyChanged();
            await fetchPolicy({ silent: true });
        } catch (err) {
            toast({
                title: 'Could not save salary policy',
                description: err?.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <PermissionGuard
            moduleId="hrm_salary"
            moduleIds={['hrm_salary', 'hrm_employees_view_salary', 'hrm']}
            permissionType="view"
        >
            <div
                className="flex min-h-screen w-full max-w-full overflow-x-hidden"
                style={{ backgroundColor: '#F2F6F9' }}
            >
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div
                        className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden"
                        style={{ backgroundColor: '#F2F6F9' }}
                    >
                        <ErpPageHeader title="Salary Policy">
                            <SalaryHeaderActions enrollLabel="Salary Enrollment" />
                        </ErpPageHeader>

                        {error ? (
                            <ErpErrorBanner className="mb-4" message={error} onRetry={() => fetchPolicy()} />
                        ) : null}

                        {loading ? (
                            <div className="rounded-xl border border-gray-100 bg-white px-4 py-10 flex justify-center">
                                <Loader2 size={22} className="animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <SalaryPolicyFields form={form} setForm={setForm} />
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="h-10 px-5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold shadow-sm disabled:opacity-60 inline-flex items-center gap-2"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                        Save
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
