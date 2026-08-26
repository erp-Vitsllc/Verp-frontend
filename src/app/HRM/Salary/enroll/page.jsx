'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import useWorkLocations from '@/hooks/useWorkLocations';
import { normalizeWorkLocationKey } from '@/utils/workLocations';
import SalaryHeaderActions from '../components/SalaryHeaderActions';
import SalaryPolicyFields from '../components/SalaryPolicyFields';
import { EMPTY_POLICY_FORM, policyFormFromApi } from '../utils/salaryPolicyForm';
import NavButton from '@/components/NavButton';

const INNER_TABS = [
    { key: 'employees', label: 'Employees' },
    { key: 'policies', label: 'Policies' },
];

function formatSalaryStart(value) {
    const ym = String(value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return '—';
    const [year, month] = ym.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (Number.isNaN(date.getTime())) return ym;
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export default function EnrollSalaryPage() {
    const { toast } = useToast();
    const { tabs } = useWorkLocations();
    const [staffTab, setStaffTab] = useState('');
    const [innerTab, setInnerTab] = useState('employees');
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [policyForm, setPolicyForm] = useState(EMPTY_POLICY_FORM);
    const [policySource, setPolicySource] = useState('main');
    const [policyLoading, setPolicyLoading] = useState(false);
    const [policySaving, setPolicySaving] = useState(false);
    const [policyError, setPolicyError] = useState('');

    const fetchDirectory = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get('/Employee/salary-enroll/options', { skipToast: true });
            setEmployees(Array.isArray(res.data?.employees) ? res.data.employees : []);
        } catch (err) {
            setEmployees([]);
            setError(err?.response?.data?.message || 'Failed to load salary enrollment.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchGroupPolicy = useCallback(async (locationKey) => {
        if (!locationKey) return;
        setPolicyLoading(true);
        setPolicyError('');
        try {
            const res = await axiosInstance.get(
                `/Employee/payroll-settings/group/${encodeURIComponent(locationKey)}`,
                { skipToast: true },
            );
            setPolicyForm(policyFormFromApi(res.data));
            setPolicySource(res.data?.source === 'group' ? 'group' : 'main');
        } catch (err) {
            setPolicyForm(EMPTY_POLICY_FORM);
            setPolicyError(err?.response?.data?.message || 'Failed to load work location policy.');
        } finally {
            setPolicyLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDirectory();
    }, [fetchDirectory]);

    useEffect(() => {
        if (!tabs.length) return;
        if (!tabs.some((tab) => tab.key === staffTab)) {
            setStaffTab(tabs[0].key);
        }
    }, [tabs, staffTab]);

    useEffect(() => {
        if (innerTab !== 'policies' || !staffTab) return;
        fetchGroupPolicy(staffTab);
    }, [innerTab, staffTab, fetchGroupPolicy]);

    const activeLocation = tabs.find((tab) => tab.key === staffTab);
    const rows = useMemo(() => {
        const key = normalizeWorkLocationKey(staffTab);
        return employees
            .filter((emp) => normalizeWorkLocationKey(emp.staffType) === key)
            .sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }),
            );
    }, [employees, staffTab]);

    async function saveGroupPolicy() {
        if (!staffTab) return;
        setPolicySaving(true);
        try {
            await axiosInstance.put(
                `/Employee/payroll-settings/group/${encodeURIComponent(staffTab)}`,
                policyForm,
            );
            setPolicySource('group');
            toast({ title: `${activeLocation?.label || 'Work location'} policy saved` });
            await fetchGroupPolicy(staffTab);
        } catch (err) {
            toast({
                title: 'Could not save work location policy',
                description: err?.response?.data?.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setPolicySaving(false);
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
                        <ErpPageHeader title="Enroll Salary">
                            <SalaryHeaderActions enrollLabel="Salary Enrollment" />
                        </ErpPageHeader>

                        <div className={HEADER_PAIR_GRID}>
                            <div
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                            />
                            <div
                                className={`bg-white rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}
                            />
                        </div>

                        {error ? (
                            <ErpErrorBanner className="mb-4" message={error} onRetry={fetchDirectory} />
                        ) : null}

                        <div className="mb-3 flex items-center gap-2 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 w-full sm:w-fit">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setStaffTab(tab.key)}
                                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
                                        staffTab === tab.key
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="mb-4 flex items-center gap-6 border-b border-gray-200 px-1">
                            {INNER_TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setInnerTab(tab.key)}
                                    className={`relative pb-2.5 text-xs font-bold tracking-wide sm:text-sm ${
                                        innerTab === tab.key
                                            ? 'text-blue-600'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    {tab.label}
                                    {innerTab === tab.key ? (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
                                    ) : null}
                                </button>
                            ))}
                        </div>

                        {innerTab === 'policies' ? (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 sm:text-sm">
                                    {policySource === 'group'
                                        ? `This is the ${activeLocation?.label || 'work location'} policy. Saving does not change Main.`
                                        : `Showing Main policy. Save to store a copy for ${activeLocation?.label || 'this work location'} only. Main is not changed.`}
                                </p>
                                {policyError ? (
                                    <ErpErrorBanner
                                        className="mb-2"
                                        message={policyError}
                                        onRetry={() => fetchGroupPolicy(staffTab)}
                                    />
                                ) : null}
                                {policyLoading ? (
                                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-10 flex justify-center">
                                        <Loader2 size={22} className="animate-spin text-blue-600" />
                                    </div>
                                ) : (
                                    <>
                                        <SalaryPolicyFields form={policyForm} setForm={setPolicyForm} />
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={saveGroupPolicy}
                                                disabled={policySaving || !staffTab}
                                                className="h-10 px-5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold shadow-sm disabled:opacity-60 inline-flex items-center gap-2"
                                            >
                                                {policySaving ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : null}
                                                Save
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="w-full max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                                <div className="w-full max-w-full overflow-x-auto">
                                    <table className="w-full min-w-[640px] table-auto text-xs sm:text-sm">
                                        <thead className="border-b border-gray-200 bg-gray-50">
                                            <tr>
                                                <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                    Name
                                                </th>
                                                <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                    Enroll Status
                                                </th>
                                                <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600">
                                                    Salary Start Date
                                                </th>
                                                <th className="px-3 sm:px-4 py-2.5 text-right text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600 w-24">
                                                    Edit
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                                                        <Loader2
                                                            size={20}
                                                            className="inline animate-spin text-blue-600"
                                                        />
                                                    </td>
                                                </tr>
                                            ) : rows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                                                        No employees in this work location.
                                                    </td>
                                                </tr>
                                            ) : (
                                                rows.map((row) => (
                                                    <tr key={row.employeeId} className="hover:bg-slate-50">
                                                        <td className="px-3 sm:px-4 py-2.5 font-medium text-slate-800">
                                                            <div className="min-w-0">
                                                                <div className="truncate">{row.name || '—'}</div>
                                                                <div className="text-[11px] font-normal text-slate-400">
                                                                    {row.employeeId}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 sm:px-4 py-2.5">
                                                            <span
                                                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                                    row.enrolled
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : 'bg-amber-50 text-amber-700'
                                                                }`}
                                                            >
                                                                {row.enrolled ? 'Enrolled' : 'Pending'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 sm:px-4 py-2.5 text-slate-700 whitespace-nowrap">
                                                            {row.enrolled
                                                                ? formatSalaryStart(row.fromMonth)
                                                                : 'Pending'}
                                                        </td>
                                                        <td className="px-3 sm:px-4 py-2.5 text-right">
                                                            <NavButton
                                                                href={`/HRM/Salary/enroll/${encodeURIComponent(row.employeeId)}`}
                                                                listReturnHref="/HRM/Salary/enroll"
                                                                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-600 no-underline"
                                                            >
                                                                <Pencil size={12} />
                                                                Edit
                                                            </NavButton>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
