'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import axiosInstance from '@/utils/axios';
import SalaryHeaderActions from '../../components/SalaryHeaderActions';

function formatAed(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const ROW_GRID =
    'grid w-full min-w-[720px] items-center gap-x-2 sm:gap-x-3 ' +
    'grid-cols-[2.25rem_minmax(6.5rem,0.9fr)_minmax(8rem,1.3fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_3.25rem_4.25rem]';

const COLUMNS = [
    { key: 'slNo', label: 'SL' },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'name', label: 'Employee' },
    { key: 'monthlySalary', label: 'Monthly Salary' },
    { key: 'actualSalary', label: 'Actual Salary' },
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'ot', label: 'OT', compact: true },
    { key: 'deduction', label: 'Deduction', compact: true },
];

export default function SalaryMonthRegisterPage() {
    const params = useParams();
    const monthKey = String(params?.monthKey || '');
    const [title, setTitle] = useState('');
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchMonth = useCallback(async () => {
        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            setError('Invalid salary month.');
            setEmployees([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get(`/Employee/salary-register/${monthKey}`, { skipToast: true });
            setTitle(res.data?.month ? `${res.data.month} Salary` : `${monthKey} Salary`);
            setEmployees(Array.isArray(res.data?.employees) ? res.data.employees : []);
        } catch (err) {
            setEmployees([]);
            setError(err?.response?.data?.message || 'Failed to load month salary.');
        } finally {
            setLoading(false);
        }
    }, [monthKey]);

    useEffect(() => {
        fetchMonth();
    }, [fetchMonth]);

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
                        <ErpPageHeader title={title || 'Salary'}>
                            <Link
                                href={`/HRM/Salary/${monthKey}`}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap border border-gray-800/20 no-underline"
                            >
                                Processing conditions
                            </Link>
                            <SalaryHeaderActions enrollLabel="Salary Enrollment" />
                        </ErpPageHeader>

                        {error ? (
                            <ErpErrorBanner className="mb-4" message={error} onRetry={fetchMonth} />
                        ) : null}

                        <div className="w-full max-w-full overflow-x-auto">
                            <div className="min-w-[720px]">
                                <div className={`${ROW_GRID} px-3 sm:px-4 py-2 text-gray-700`}>
                                    {COLUMNS.map((col) => (
                                        <span
                                            key={col.key}
                                            className={
                                                col.compact
                                                    ? 'text-[9px] font-semibold tracking-normal text-gray-600'
                                                    : 'text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-left'
                                            }
                                        >
                                            {col.label}
                                        </span>
                                    ))}
                                </div>
                                {loading ? (
                                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-xs text-gray-500 sm:text-sm">
                                        Loading enrolled employees...
                                    </div>
                                ) : employees.length === 0 ? (
                                    <div className="rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-xs text-gray-500 sm:text-sm">
                                        No enrolled employees for this month.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1.5 bg-white p-1 rounded-xl border border-gray-100">
                                        {employees.map((row) => (
                                            <div
                                                key={row.employeeId}
                                                className={`${ROW_GRID} px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-700`}
                                            >
                                                <span className="tabular-nums">{row.slNo}</span>
                                                <span className="truncate font-mono text-[11px] sm:text-xs">
                                                    {row.employeeId}
                                                </span>
                                                <span className="truncate">{row.name}</span>
                                                <span className="tabular-nums">{formatAed(row.monthlySalary)}</span>
                                                <span className="tabular-nums">{formatAed(row.actualSalary)}</span>
                                                <span className="tabular-nums">{formatAed(row.basicSalary)}</span>
                                                <span className="tabular-nums text-[11px]">{formatAed(row.ot)}</span>
                                                <span className="tabular-nums text-[11px]">
                                                    {formatAed(row.deduction)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
