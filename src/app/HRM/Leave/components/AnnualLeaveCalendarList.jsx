'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import ErpErrorBanner from '@/components/ErpErrorBanner';

const ALL_GROUP = 'all';

function formatListDate(value) {
    const raw = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '—';
    const [year, month, day] = raw.split('-');
    return `${day}/${month}/${year}`;
}

export default function AnnualLeaveCalendarList({
    year,
    yearMin,
    yearMax,
    onYearChange,
    refreshKey = 0,
}) {
    const currentYear = new Date().getFullYear();
    const minYear = Number.isInteger(Number(yearMin)) ? Number(yearMin) : currentYear;
    const maxYear = Number.isInteger(Number(yearMax)) ? Number(yearMax) : currentYear;
    const selectedYear = Number.isInteger(Number(year)) ? Number(year) : currentYear;
    const [groupKey, setGroupKey] = useState(ALL_GROUP);
    const [rows, setRows] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchList = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/Leave/calendar/annual-list', {
                params: { year: selectedYear },
                skipToast: true,
            });
            setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
            setGroups(Array.isArray(response.data?.groups) ? response.data.groups : []);
        } catch (err) {
            setRows([]);
            setGroups([]);
            setError(err?.response?.data?.message || err.message || 'Failed to load annual leave list.');
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchList();
    }, [fetchList, refreshKey]);

    useEffect(() => {
        setGroupKey(ALL_GROUP);
    }, [selectedYear]);

    const tabs = useMemo(
        () => [{ key: ALL_GROUP, label: 'All' }, ...groups.filter((row) => row?.key && row?.label)],
        [groups],
    );

    const visibleRows = useMemo(() => {
        if (groupKey === ALL_GROUP) return rows;
        return rows.filter((row) => String(row.groupKey || '') === String(groupKey));
    }, [groupKey, rows]);

    const shiftYear = (direction) => {
        const next = selectedYear + direction;
        if (next < minYear || next > maxYear) return;
        onYearChange?.(next);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-col gap-3 border-b border-[#E5E7EB] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {tabs.map((tab) => {
                        const active = tab.key === groupKey;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setGroupKey(tab.key)}
                                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                    active
                                        ? 'bg-[#2563EB] text-white'
                                        : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 text-sm font-medium text-[#374151]">
                    <button
                        type="button"
                        onClick={() => shiftYear(-1)}
                        disabled={selectedYear <= minYear}
                        className="rounded p-0.5 text-[#6B7280] hover:bg-[#F3F4F6] disabled:cursor-default disabled:opacity-40"
                        aria-label="Previous year"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="min-w-[3.5rem] text-center tabular-nums">{selectedYear}</span>
                    <button
                        type="button"
                        onClick={() => shiftYear(1)}
                        disabled={selectedYear >= maxYear}
                        className="rounded p-0.5 text-[#6B7280] hover:bg-[#F3F4F6] disabled:cursor-default disabled:opacity-40"
                        aria-label="Next year"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {error ? (
                <div className="px-5 pt-4">
                    <ErpErrorBanner message={error} onRetry={fetchList} />
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto">
                {loading ? (
                    <div className="flex h-full min-h-[12rem] items-center justify-center px-4 text-sm text-[#6B7280]">
                        Loading annual leave list...
                    </div>
                ) : (
                    <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                            <tr>
                                <th className="whitespace-nowrap px-4 py-2.5">SL No</th>
                                <th className="whitespace-nowrap px-4 py-2.5">Name</th>
                                <th className="whitespace-nowrap px-4 py-2.5">Start Date</th>
                                <th className="whitespace-nowrap px-4 py-2.5">End Date</th>
                                <th className="whitespace-nowrap px-4 py-2.5">Status</th>
                                <th className="whitespace-nowrap px-4 py-2.5 text-right">Days Applied</th>
                                <th className="whitespace-nowrap px-4 py-2.5 text-right">Days Used</th>
                                <th className="whitespace-nowrap px-4 py-2.5 text-right">Remaining Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRows.length ? (
                                visibleRows.map((row, index) => (
                                    <tr
                                        key={row.id || `${row.employeeMongoId}-${row.startDate}-${index}`}
                                        className="border-t border-[#F3F4F6] text-[#111827]"
                                    >
                                        <td className="whitespace-nowrap px-4 py-2.5 text-[#6B7280]">{index + 1}</td>
                                        <td className="px-4 py-2.5 font-medium">
                                            <div>{row.employeeName}</div>
                                            {row.employeeId ? (
                                                <div className="text-[11px] font-normal text-[#9CA3AF]">
                                                    {row.employeeId}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5">{formatListDate(row.startDate)}</td>
                                        <td className="whitespace-nowrap px-4 py-2.5">{formatListDate(row.endDate)}</td>
                                        <td className="whitespace-nowrap px-4 py-2.5">
                                            <span
                                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                    row.status === 'Taken'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-amber-50 text-amber-800'
                                                }`}
                                            >
                                                {row.status === 'Taken' ? 'Taken' : 'Not'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                                            {Number(row.daysApplied) || 0}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                                            {Number(row.daysUsed) || 0}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-semibold">
                                            {Number(row.remainingDays) || 0}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#6B7280]">
                                        No annual leave applications for {selectedYear}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
