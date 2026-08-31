'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { crudAccess } from '@/utils/permissions';
import { navigateFromList } from '@/utils/listReturnNavigation';

function formatAed(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const COLUMNS = [
    { key: 'slNo', label: 'SL' },
    { key: 'month', label: 'Month' },
    { key: 'monthlySalary', label: 'Monthly Salary' },
    { key: 'actualSalary', label: 'Actual Salary' },
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'ot', label: 'OT' },
    { key: 'deduction', label: 'Deduction' },
];

export default function EmployeePayrollHistoryPanel({ employee }) {
    const router = useRouter();
    const employeeId = String(employee?.employeeId || '').trim();
    const [months, setMonths] = useState([]);
    const [years, setYears] = useState([]);
    const [year, setYear] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const canOpenMonth = crudAccess('hrm_salary').view;

    useEffect(() => {
        if (!employeeId) {
            setMonths([]);
            setYears([]);
            setLoading(false);
            return undefined;
        }
        const controller = new AbortController();
        setLoading(true);
        setError('');
        axiosInstance
            .get('/Employee/salary-register', {
                params: {
                    employeeId,
                    ...(year ? { year } : {}),
                },
                skipToast: true,
                signal: controller.signal,
            })
            .then((res) => {
                setMonths(Array.isArray(res.data?.months) ? res.data.months : []);
                setYears(Array.isArray(res.data?.years) ? res.data.years : []);
            })
            .catch((err) => {
                if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
                setMonths([]);
                setYears([]);
                setError(err?.response?.data?.message || err.message || 'Failed to load payroll history.');
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [employeeId, year]);

    const yearOptions = useMemo(() => {
        if (years.length) return years;
        const fromRows = [
            ...new Set(
                months
                    .map((row) => String(row?.monthKey || '').slice(0, 4))
                    .filter((y) => /^\d{4}$/.test(y)),
            ),
        ].sort((a, b) => Number(b) - Number(a));
        return fromRows;
    }, [years, months]);

    function openMonth(monthKey) {
        if (!canOpenMonth || !monthKey) return;
        navigateFromList(router, `/HRM/Salary/${encodeURIComponent(monthKey)}`);
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                    Monthly salary for this employee
                    {employee?.firstName || employee?.lastName
                        ? ` · ${`${employee.firstName || ''} ${employee.lastName || ''}`.trim()}`
                        : ''}
                </p>
                <label className="relative inline-flex items-center">
                    <span className="sr-only">Filter by year</span>
                    <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="h-9 appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All years</option>
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-2.5 text-gray-400"
                    />
                </label>
            </div>

            {error ? (
                <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                </p>
            ) : loading ? (
                <p className="py-10 text-center text-sm text-gray-500">Loading payroll history…</p>
            ) : months.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                    No monthly salary records for this employee.
                </p>
            ) : (
                <div className="overflow-x-auto w-full max-w-full">
                    <table className="w-full min-w-0 table-auto">
                        <thead>
                            <tr className="border-b border-gray-200">
                                {COLUMNS.map((col) => (
                                    <th
                                        key={col.key}
                                        className="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                                    >
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {months.map((row) => (
                                <tr
                                    key={row.monthKey || row.slNo}
                                    className={`border-b border-gray-100 ${
                                        canOpenMonth ? 'hover:bg-gray-50 cursor-pointer' : 'hover:bg-gray-50'
                                    }`}
                                    onClick={() => openMonth(row.monthKey)}
                                >
                                    <td className="py-3 px-4 text-sm text-gray-500 tabular-nums">
                                        {row.slNo}
                                    </td>
                                    <td className="py-3 px-4 text-sm font-medium text-gray-700">
                                        {row.month || row.monthKey}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500 tabular-nums">
                                        AED {formatAed(row.monthlySalary)}
                                    </td>
                                    <td className="py-3 px-4 text-sm font-semibold text-gray-700 tabular-nums">
                                        AED {formatAed(row.actualSalary)}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500 tabular-nums">
                                        AED {formatAed(row.basicSalary)}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500 tabular-nums">
                                        AED {formatAed(row.ot)}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500 tabular-nums">
                                        AED {formatAed(row.deduction)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
