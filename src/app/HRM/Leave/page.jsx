'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Pencil, Plus } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import ErpPageHeader from '@/components/ErpPageHeader';
import ListTableRowLink from '@/components/ListTableRowLink';
import SortableTh, { compareSortValues, toggleSortState } from '@/components/SortableTh';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import axiosInstance from '@/utils/axios';

function isCompanyShellEmployee(emp) {
    const last = String(emp?.lastName || '').trim();
    if (/^\(company\)$/i.test(last)) return true;
    const full = `${emp?.firstName || ''} ${emp?.lastName || ''} ${emp?.employeeName || ''}`.trim();
    return /\(company\)\s*$/i.test(full);
}

function employeeDisplayName(emp) {
    if (emp?.employeeName) return String(emp.employeeName).trim();
    return [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim();
}

function normalizeStaffType(value) {
    return String(value || '').trim().toLowerCase() === 'site' ? 'site' : 'office';
}

function mapEmployeeFallback(emp) {
    return {
        _id: String(emp?._id || emp?.employeeId || ''),
        employeeId: emp?.employeeId || '',
        employeeName: employeeDisplayName(emp),
        staffType: normalizeStaffType(emp?.staffType),
        authorizedLeave: Number(emp?.authorizedLeave) || 0,
        unauthorizedLeave: Number(emp?.unauthorizedLeave) || 0,
        sickLeave: Number(emp?.sickLeave) || 0,
        annualLeaveTaken: Number(emp?.annualLeaveTaken) || 0,
    };
}

const STAFF_TABS = [
    { key: 'office', label: 'Office Staff' },
    { key: 'site', label: 'Site Staffs' },
];

const TABLE_COLUMNS = [
    { key: 'slNo', label: 'SL No' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'authorizedLeave', label: 'Authorize Leave' },
    { key: 'unauthorizedLeave', label: 'Unauthorized Leave' },
    { key: 'sickLeave', label: 'Sick Leave' },
    { key: 'annualLeaveTaken', label: 'Annual Leave Taken' },
];

export default function LeavePage() {
    const router = useRouter();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState('slNo');
    const [sortDirection, setSortDirection] = useState('asc');
    const [staffTab, setStaffTab] = useState('office');

    const fetchDirectory = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/Leave/employees', { skipToast: true });
            const list = Array.isArray(response.data?.employees) ? response.data.employees : [];
            setRows(list.map(mapEmployeeFallback));
        } catch (err) {
            try {
                const fallback = await axiosInstance.get('/Employee', {
                    params: { limit: 1000 },
                    skipToast: true,
                });
                const list = (fallback.data?.employees || []).filter(
                    (emp) =>
                        emp?.employeeId !== 'VEGA-HR-0000' &&
                        emp?.status !== 'Left User' &&
                        !isCompanyShellEmployee(emp),
                );
                setRows(list.map(mapEmployeeFallback));
                setError('');
            } catch (fallbackErr) {
                setRows([]);
                setError(
                    err?.response?.data?.message ||
                        fallbackErr?.response?.data?.message ||
                        err.message ||
                        'Failed to fetch employee leave records',
                );
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDirectory();
    }, [fetchDirectory]);

    const filteredRows = useMemo(
        () => rows.filter((row) => normalizeStaffType(row.staffType) === staffTab),
        [rows, staffTab],
    );

    const sortedRows = useMemo(() => {
        const list = [...filteredRows];
        const getVal = (row, index) => {
            switch (sortKey) {
                case 'slNo':
                    return index;
                case 'employeeName':
                    return row.employeeName || '';
                case 'employeeId':
                    return row.employeeId || '';
                case 'authorizedLeave':
                    return Number(row.authorizedLeave) || 0;
                case 'unauthorizedLeave':
                    return Number(row.unauthorizedLeave) || 0;
                case 'sickLeave':
                    return Number(row.sickLeave) || 0;
                case 'annualLeaveTaken':
                    return Number(row.annualLeaveTaken) || 0;
                default:
                    return row.employeeName || '';
            }
        };

        if (sortKey === 'slNo') {
            if (sortDirection === 'desc') list.reverse();
            return list;
        }

        list.sort((a, b) => compareSortValues(getVal(a), getVal(b), sortDirection));
        return list;
    }, [filteredRows, sortKey, sortDirection]);

    const handleSort = useCallback(
        (key) => {
            const next = toggleSortState(sortKey, sortDirection, key);
            setSortKey(next.sortKey);
            setSortDirection(next.sortDirection);
        },
        [sortKey, sortDirection],
    );

    return (
        <PermissionGuard moduleId="hrm_leave" permissionType="view">
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
                        <ErpPageHeader title="Employees Leave">
                            <button
                                type="button"
                                onClick={() => router.push('/HRM/Leave/apply')}
                                className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap"
                            >
                                <Plus size={18} />
                                Apply Leave
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/HRM/Leave/calendar')}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap border border-gray-800/20"
                            >
                                <CalendarDays size={18} />
                                Create Employee Leave Calendar
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/HRM/Leave/update')}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap border border-gray-800/20"
                            >
                                <Pencil size={16} />
                                Update Employee Leave
                            </button>
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
                            <ErpErrorBanner
                                className="mb-4"
                                message={error}
                                onRetry={fetchDirectory}
                            />
                        ) : null}

                        <div className="mt-3 sm:mt-4 mb-3 flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-100 w-full sm:w-fit overflow-x-auto">
                            {STAFF_TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setStaffTab(tab.key)}
                                    className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                                        staffTab === tab.key
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-[720px] lg:min-w-0 table-auto text-xs sm:text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            {TABLE_COLUMNS.map((col) => (
                                                <SortableTh
                                                    key={col.key}
                                                    label={col.label}
                                                    sortKey={col.key}
                                                    activeKey={sortKey}
                                                    direction={sortDirection}
                                                    onSort={handleSort}
                                                    className={col.key === 'slNo' ? 'w-14 sm:w-16' : ''}
                                                />
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td
                                                    colSpan={TABLE_COLUMNS.length}
                                                    className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500"
                                                >
                                                    Loading employee leave...
                                                </td>
                                            </tr>
                                        ) : sortedRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={TABLE_COLUMNS.length}
                                                    className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500"
                                                >
                                                    {staffTab === 'site'
                                                        ? 'No site staffs found.'
                                                        : 'No office staff found.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            sortedRows.map((row, index) => {
                                                const leaveHref = row._id
                                                    ? `/HRM/Leave/${row._id}`
                                                    : '';
                                                return (
                                                <ListTableRowLink
                                                    key={row._id || row.employeeId || index}
                                                    href={leaveHref}
                                                    router={router}
                                                    enabled={Boolean(leaveHref)}
                                                >
                                                <tr
                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500 tabular-nums">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                                                        {row.employeeName || 'N/A'}
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                        {row.employeeId || 'N/A'}
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 tabular-nums">
                                                        {row.authorizedLeave}
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 tabular-nums">
                                                        {row.unauthorizedLeave}
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 tabular-nums">
                                                        {row.sickLeave}
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 tabular-nums">
                                                        {row.annualLeaveTaken}
                                                    </td>
                                                </tr>
                                                </ListTableRowLink>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
