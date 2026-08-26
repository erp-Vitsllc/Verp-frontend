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
import SalaryPolicyFilter, { MAIN_POLICY_KEY } from '../components/SalaryPolicyFilter';
import SalaryHeaderActions from '../components/SalaryHeaderActions';
import { EMPTY_POLICY_FORM, policyFormFromApi } from '../utils/salaryPolicyForm';

export default function SalaryPolicyPage() {
    const { toast } = useToast();
    const [form, setForm] = useState(EMPTY_POLICY_FORM);
    const [policyKey, setPolicyKey] = useState(MAIN_POLICY_KEY);
    const [enrolledUsers, setEnrolledUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const loadEnrolledUsers = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/Employee/salary-enroll/options', { skipToast: true });
            const employees = Array.isArray(res.data?.employees) ? res.data.employees : [];
            const enrolledIds = new Set(
                (Array.isArray(res.data?.enrolledIds) ? res.data.enrolledIds : []).map((id) =>
                    String(id || '').trim(),
                ),
            );
            const users = employees
                .filter((emp) => enrolledIds.has(String(emp.employeeId || '').trim()))
                .map((emp) => ({
                    employeeId: String(emp.employeeId).trim(),
                    firstName: emp.firstName || '',
                    lastName: emp.lastName || '',
                }))
                .sort((a, b) =>
                    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, undefined, {
                        sensitivity: 'base',
                    }),
                );
            setEnrolledUsers(users);
        } catch {
            setEnrolledUsers([]);
        }
    }, []);

    const fetchPolicy = useCallback(async (key, { silent = false } = {}) => {
        if (!silent) {
            setLoading(true);
            setError('');
        }
        try {
            const path =
                key && key !== MAIN_POLICY_KEY
                    ? `/Employee/salary-enroll/${encodeURIComponent(key)}/policy`
                    : '/Employee/payroll-settings';
            const res = await axiosInstance.get(path, { skipToast: true });
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
        loadEnrolledUsers();
        fetchPolicy(MAIN_POLICY_KEY);
    }, [loadEnrolledUsers, fetchPolicy]);

    function handlePolicyChange(nextKey) {
        const key = nextKey || MAIN_POLICY_KEY;
        setPolicyKey(key);
        fetchPolicy(key);
    }

    async function handleSave() {
        setSaving(true);
        try {
            if (policyKey === MAIN_POLICY_KEY) {
                await axiosInstance.put('/Employee/payroll-settings', form);
                toast({ title: 'Main salary policy saved' });
            } else {
                await axiosInstance.put(
                    `/Employee/salary-enroll/${encodeURIComponent(policyKey)}/policy`,
                    form,
                );
                toast({ title: 'Employee salary policy saved' });
            }
            await fetchPolicy(policyKey, { silent: true });
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

                        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-3 sm:px-4 py-3">
                            <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                                <span className="text-sm font-medium text-slate-700 shrink-0">Policy</span>
                                <SalaryPolicyFilter
                                    users={enrolledUsers}
                                    value={policyKey}
                                    onChange={handlePolicyChange}
                                    disabled={loading || saving}
                                />
                            </label>
                        </div>

                        {error ? (
                            <ErpErrorBanner className="mb-4" message={error} onRetry={() => fetchPolicy(policyKey)} />
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
