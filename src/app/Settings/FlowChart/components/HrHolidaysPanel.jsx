'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { getUaeHolidaysForYear, MONTH_NAMES } from '../utils/uaeHolidaysCatalog';

export default function HrHolidaysPanel() {
    const { toast } = useToast();
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [savedHolidays, setSavedHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingDate, setSavingDate] = useState(null);
    const [deletingDate, setDeletingDate] = useState(null);

    const uaeHolidays = useMemo(() => getUaeHolidaysForYear(year), [year]);

    const savedDateSet = useMemo(
        () => new Set(savedHolidays.map((h) => h.date)),
        [savedHolidays],
    );

    /** Group UAE holidays by month — only months that have at least one holiday. */
    const monthsWithHolidays = useMemo(() => {
        const map = new Map();
        uaeHolidays.forEach((h) => {
            if (!map.has(h.month)) map.set(h.month, []);
            map.get(h.month).push(h);
        });
        return Array.from(map.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([month, items]) => ({
                month,
                label: MONTH_NAMES[month - 1],
                items,
            }));
    }, [uaeHolidays]);

    const loadHolidays = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/Holiday', {
                params: { year },
                skipToast: true,
            });
            const list = Array.isArray(res.data?.holidays) ? res.data.holidays : [];
            setSavedHolidays(list);
        } catch (err) {
            setSavedHolidays([]);
            toast({
                title: 'Could not load saved holidays',
                description: err?.response?.data?.message || 'Try again.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [year, toast]);

    useEffect(() => {
        loadHolidays();
    }, [loadHolidays]);

    const yearOptions = useMemo(() => {
        const current = new Date().getFullYear();
        return [current - 1, current, current + 1, current + 2];
    }, []);

    const handleAddHoliday = async (holiday) => {
        const name = String(holiday.name || '').trim();
        const date = String(holiday.date || '').trim();
        if (!name || !date) return;

        setSavingDate(date);
        try {
            await axiosInstance.post('/Holiday', { name, date });
            toast({
                title: 'Holiday added',
                description: `${name} (${date}) marked on attendance calendar & dashboard.`,
            });
            await loadHolidays();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('verp:holidays-changed'));
            }
        } catch (err) {
            toast({
                title: 'Add failed',
                description: err?.response?.data?.message || 'Could not add holiday.',
                variant: 'destructive',
            });
        } finally {
            setSavingDate(null);
        }
    };

    const handleDeleteHoliday = async (date) => {
        setDeletingDate(date);
        try {
            await axiosInstance.delete(`/Holiday/${date}`);
            toast({ title: 'Holiday removed', description: `${date} removed from calendar.` });
            await loadHolidays();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('verp:holidays-changed'));
            }
        } catch (err) {
            toast({
                title: 'Remove failed',
                description: err?.response?.data?.message || 'Could not remove holiday.',
                variant: 'destructive',
            });
        } finally {
            setDeletingDate(null);
        }
    };

    const handleAddAllInMonth = async (items) => {
        const pending = items.filter((h) => !savedDateSet.has(h.date));
        if (!pending.length) {
            toast({ title: 'Already added', description: 'All holidays in this month are already saved.' });
            return;
        }
        for (const h of pending) {
            // sequential to avoid overloading API / duplicate race
            // eslint-disable-next-line no-await-in-loop
            await handleAddHoliday(h);
        }
    };

    return (
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-4 sm:p-6 lg:p-10 min-h-[400px] sm:min-h-[600px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">
                        UAE Holidays
                    </h3>
                    <p className="text-slate-400 text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider mt-1 italic">
                        UAE calendar holidays by month — click Add to mark on attendance &amp; dashboard
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">
                        Islamic dates are expected and may shift by 1–2 days after moon sighting.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Year
                    </label>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700"
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-slate-400 py-16 text-center">Loading UAE holiday calendar…</p>
            ) : monthsWithHolidays.length === 0 ? (
                <p className="text-sm text-slate-400 py-16 text-center">
                    No UAE holidays listed for {year}.
                </p>
            ) : (
                <div className="space-y-6">
                    {monthsWithHolidays.map(({ month, label, items }) => {
                        const allSaved = items.every((h) => savedDateSet.has(h.date));
                        return (
                            <div
                                key={month}
                                className="rounded-2xl border border-slate-100 overflow-hidden"
                            >
                                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-100">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <CalendarDays className="w-4 h-4 text-[#9B59B6] shrink-0" />
                                        <h4 className="text-sm font-black text-slate-800">
                                            {label} {year}
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {items.length} holiday{items.length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={allSaved || Boolean(savingDate)}
                                        onClick={() => handleAddAllInMonth(items)}
                                        className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black disabled:opacity-40 whitespace-nowrap"
                                    >
                                        {allSaved ? 'All added' : 'Add all'}
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[560px] text-xs sm:text-sm">
                                        <thead>
                                            <tr className="text-left border-b border-slate-50">
                                                <th className="px-4 sm:px-5 py-2.5 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                                                    Date
                                                </th>
                                                <th className="px-4 sm:px-5 py-2.5 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                                                    Holiday
                                                </th>
                                                <th className="px-4 sm:px-5 py-2.5 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((h) => {
                                                const isSaved = savedDateSet.has(h.date);
                                                return (
                                                    <tr
                                                        key={h.date}
                                                        className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60"
                                                    >
                                                        <td className="px-4 sm:px-5 py-3 font-semibold text-slate-700 tabular-nums">
                                                            {h.date}
                                                        </td>
                                                        <td className="px-4 sm:px-5 py-3">
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <span className="h-2 w-2 rounded-full bg-[#9B59B6] shrink-0" />
                                                                <span className="font-bold text-slate-800">
                                                                    {h.name}
                                                                </span>
                                                            </span>
                                                        </td>
                                                        <td className="px-4 sm:px-5 py-3 text-right">
                                                            {isSaved ? (
                                                                <div className="inline-flex items-center gap-2 justify-end">
                                                                    <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                                                                        Added
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        disabled={deletingDate === h.date}
                                                                        onClick={() =>
                                                                            handleDeleteHoliday(h.date)
                                                                        }
                                                                        className="text-[11px] font-bold text-red-500 hover:text-red-600 disabled:opacity-50"
                                                                    >
                                                                        {deletingDate === h.date
                                                                            ? '…'
                                                                            : 'Remove'}
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    disabled={savingDate === h.date}
                                                                    onClick={() => handleAddHoliday(h)}
                                                                    className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black disabled:opacity-50"
                                                                >
                                                                    {savingDate === h.date
                                                                        ? 'Saving…'
                                                                        : 'Add'}
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
