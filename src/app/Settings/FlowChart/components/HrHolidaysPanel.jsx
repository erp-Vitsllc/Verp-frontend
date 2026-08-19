'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, HardHat, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { holidayAppliesToList } from '@/utils/holidayScope';
import { getUaeHolidaysCurrentMonthThroughNextYear, MONTH_NAMES } from '../utils/uaeHolidaysCatalog';

const INNER_TABS = [
    { id: 'uae', label: 'UAE Holidays' },
    { id: 'office', label: 'Office' },
    { id: 'site', label: 'Site' },
];

function dayCountInclusive(from, to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
        return 0;
    }
    const start = new Date(`${from}T12:00:00.000Z`);
    const end = new Date(`${to}T12:00:00.000Z`);
    return Math.round((end - start) / 86400000) + 1;
}

function groupByYearMonth(items) {
    const yearMap = new Map();
    items.forEach((h) => {
        const year = Number(h.year) || Number(String(h.date || '').slice(0, 4));
        const month = Number(h.month) || Number(String(h.date || '').slice(5, 7));
        if (!year || !month) return;
        if (!yearMap.has(year)) yearMap.set(year, new Map());
        const monthMap = yearMap.get(year);
        if (!monthMap.has(month)) monthMap.set(month, []);
        monthMap.get(month).push(h);
    });
    return Array.from(yearMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, monthMap]) => ({
            year,
            months: Array.from(monthMap.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([month, monthItems]) => ({
                    month,
                    label: MONTH_NAMES[month - 1],
                    items: monthItems,
                })),
        }));
}

function relatedSavedForCatalog(catalog, savedHolidays) {
    return savedHolidays.filter((h) => {
        const source = h.sourceDate || h.date;
        return source === catalog.date || h.date === catalog.date;
    });
}

function catalogGroupFlags(catalog, savedHolidays) {
    const related = relatedSavedForCatalog(catalog, savedHolidays);
    let office = false;
    let site = false;
    let officeDate = '';
    let siteDate = '';
    related.forEach((h) => {
        const list = holidayAppliesToList(h);
        if (list.includes('office')) {
            office = true;
            officeDate = h.date;
        }
        if (list.includes('site')) {
            site = true;
            siteDate = h.date;
        }
    });
    return { office, site, both: office && site, officeDate, siteDate };
}

function HolidayMonthBlocks({ years, yearHint, emptyText, renderRow, headerExtra }) {
    if (!years.length) {
        return <p className="text-sm text-slate-400 py-16 text-center">{emptyText}</p>;
    }

    return (
        <div className="space-y-8">
            {years.map(({ year, months }) => (
                <div key={year} className="space-y-6">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-1">
                        {year}
                        {yearHint ? ` · ${yearHint(year)}` : ''}
                    </h4>
                    {months.map(({ month, label, items }) => (
                        <div
                            key={`${year}-${month}`}
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
                                {headerExtra ? headerExtra(items) : null}
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
                                    <tbody>{items.map((item) => renderRow(item))}</tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export default function HrHolidaysPanel() {
    const { toast } = useToast();
    const [innerTab, setInnerTab] = useState('uae');
    const [savedHolidays, setSavedHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingDate, setDeletingDate] = useState(null);
    const [addTarget, setAddTarget] = useState(null);
    const [customDate, setCustomDate] = useState(false);
    const [addFromDate, setAddFromDate] = useState('');
    const [addToDate, setAddToDate] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [customFromDate, setCustomFromDate] = useState('');
    const [customToDate, setCustomToDate] = useState('');

    const { thisYear, nextYear, fromMonth, holidays: uaeHolidays } = useMemo(
        () => getUaeHolidaysCurrentMonthThroughNextYear(),
        [],
    );

    const uaeYears = useMemo(() => groupByYearMonth(uaeHolidays), [uaeHolidays]);

    const officeHolidays = useMemo(
        () =>
            savedHolidays
                .filter((h) => holidayAppliesToList(h).includes('office'))
                .map((h) => ({
                    ...h,
                    year: Number(h.year) || Number(String(h.date).slice(0, 4)),
                    month: Number(String(h.date).slice(5, 7)),
                })),
        [savedHolidays],
    );

    const siteHolidays = useMemo(
        () =>
            savedHolidays
                .filter((h) => holidayAppliesToList(h).includes('site'))
                .map((h) => ({
                    ...h,
                    year: Number(h.year) || Number(String(h.date).slice(0, 4)),
                    month: Number(String(h.date).slice(5, 7)),
                })),
        [savedHolidays],
    );

    const customDayCount = useMemo(
        () => dayCountInclusive(customFromDate, customToDate || customFromDate),
        [customFromDate, customToDate],
    );

    const officeYears = useMemo(() => groupByYearMonth(officeHolidays), [officeHolidays]);
    const siteYears = useMemo(() => groupByYearMonth(siteHolidays), [siteHolidays]);

    const loadHolidays = useCallback(async (opts = {}) => {
        if (!opts.silent) setLoading(true);
        try {
            const [thisRes, nextRes] = await Promise.all([
                axiosInstance.get('/Holiday', { params: { year: thisYear }, skipToast: true }),
                axiosInstance.get('/Holiday', { params: { year: nextYear }, skipToast: true }),
            ]);
            const thisList = Array.isArray(thisRes.data?.holidays) ? thisRes.data.holidays : [];
            const nextList = Array.isArray(nextRes.data?.holidays) ? nextRes.data.holidays : [];
            setSavedHolidays([...thisList, ...nextList]);
        } catch (err) {
            setSavedHolidays([]);
            toast({
                title: 'Could not load saved holidays',
                description: err?.response?.data?.message || 'Try again.',
                variant: 'destructive',
            });
        } finally {
            if (!opts.silent) setLoading(false);
        }
    }, [thisYear, nextYear, toast]);

    useEffect(() => {
        loadHolidays();
    }, [loadHolidays]);

    const notifyChanged = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('verp:holidays-changed'));
        }
    };

    const openAddModal = (holiday) => {
        setAddTarget(holiday);
        setCustomDate(false);
        setAddFromDate(holiday.date);
        setAddToDate(holiday.date);
    };

    const handleAddHoliday = async (holiday, appliesTo, options = {}) => {
        const name = String(holiday.name || '').trim();
        const sourceDate = String(holiday.date || '').trim();
        const fromDate = String(options.fromDate || sourceDate).trim();
        const toDate = String(options.toDate || fromDate).trim();
        if (!name || !fromDate) return false;

        setSaving(true);
        try {
            const res = await axiosInstance.post('/Holiday', {
                name,
                date: fromDate,
                fromDate,
                toDate,
                appliesTo,
                sourceDate,
                custom: Boolean(options.custom) || fromDate !== sourceDate || toDate !== fromDate,
            });
            toast({
                title: 'Holiday added',
                description: res.data?.message || `${name} marked on attendance.`,
            });
            await loadHolidays({ silent: true });
            notifyChanged();
            return true;
        } catch (err) {
            toast({
                title: 'Add failed',
                description: err?.response?.data?.message || 'Could not add holiday.',
                variant: 'destructive',
            });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const submitAddModal = async (appliesTo) => {
        if (!addTarget) return;
        const fromDate = customDate ? addFromDate : addTarget.date;
        const toDate = customDate ? addToDate : addTarget.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
            toast({
                title: 'Dates required',
                description: 'Pick a valid from date and to date before adding.',
                variant: 'destructive',
            });
            return;
        }
        if (toDate < fromDate) {
            toast({
                title: 'Invalid range',
                description: 'To date must be on or after from date.',
                variant: 'destructive',
            });
            return;
        }
        const ok = await handleAddHoliday(addTarget, appliesTo, {
            fromDate,
            toDate,
            custom: customDate,
        });
        if (ok) setAddTarget(null);
    };

    const submitCustomHoliday = async (appliesTo) => {
        const name = customTitle.trim();
        const fromDate = customFromDate;
        const toDate = customToDate || customFromDate;
        if (!name) {
            toast({
                title: 'Title required',
                description: 'Enter a holiday name.',
                variant: 'destructive',
            });
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
            toast({
                title: 'Dates required',
                description: 'Pick from date and to date.',
                variant: 'destructive',
            });
            return;
        }
        if (toDate < fromDate) {
            toast({
                title: 'Invalid range',
                description: 'To date must be on or after from date.',
                variant: 'destructive',
            });
            return;
        }
        const ok = await handleAddHoliday(
            { name, date: fromDate },
            appliesTo,
            { fromDate, toDate, custom: true },
        );
        if (ok) {
            setCustomTitle('');
            setCustomFromDate('');
            setCustomToDate('');
            if (appliesTo === 'office') setInnerTab('office');
            else if (appliesTo === 'site') setInnerTab('site');
        }
    };

    const handleDeleteHoliday = async (date, appliesTo) => {
        setDeletingDate(`${date}:${appliesTo}`);
        try {
            await axiosInstance.delete(`/Holiday/${date}`, { params: { appliesTo } });
            toast({
                title: 'Holiday removed',
                description:
                    appliesTo === 'office'
                        ? `${date} removed from the Office calendar.`
                        : appliesTo === 'site'
                          ? `${date} removed from the Site calendar.`
                          : `${date} removed from both calendars.`,
            });
            await loadHolidays({ silent: true });
            notifyChanged();
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
        const pending = items.filter((h) => !catalogGroupFlags(h, savedHolidays).both);
        if (!pending.length) {
            toast({ title: 'Already added', description: 'All holidays in this month are already saved for Office and Site.' });
            return;
        }
        for (const h of pending) {
            // sequential to avoid overloading API / duplicate race
            // eslint-disable-next-line no-await-in-loop
            await handleAddHoliday(h, 'both');
        }
    };

    const yearHint = (year) =>
        year === thisYear ? `${MONTH_NAMES[fromMonth - 1]}–December` : 'January–December';

    const renderSavedRow = (h, appliesTo) => {
        const deleteKey = `${h.date}:${appliesTo}`;
        return (
            <tr key={`${h.date}-${appliesTo}`} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60">
                <td className="px-4 sm:px-5 py-3 font-semibold text-slate-700 tabular-nums">
                    <span className="inline-flex items-center gap-2">
                        {h.date}
                        {h.isCustomDate ? (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                Custom
                            </span>
                        ) : null}
                    </span>
                </td>
                <td className="px-4 sm:px-5 py-3">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#9B59B6] shrink-0" />
                        <span className="font-bold text-slate-800">{h.name}</span>
                    </span>
                </td>
                <td className="px-4 sm:px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                        <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                            Added
                        </span>
                        <button
                            type="button"
                            disabled={deletingDate === deleteKey}
                            onClick={() => handleDeleteHoliday(h.date, appliesTo)}
                            className="text-[11px] font-bold text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                            {deletingDate === deleteKey ? '…' : 'Remove'}
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-4 sm:p-6 lg:p-10 min-h-[400px] sm:min-h-[600px]">
            <div className="flex flex-col gap-4 mb-6 sm:mb-8">
                <div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">
                        Holidays
                    </h3>
                    <p className="text-slate-400 text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider mt-1 italic">
                        {MONTH_NAMES[fromMonth - 1]} {thisYear} through December {nextYear}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">
                        Add a UAE holiday to Office, Site, or both. Custom from/to dates mark every day in the range.
                        Islamic dates may shift by 1–2 days after moon sighting.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
                    {INNER_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setInnerTab(tab.id)}
                            className={`px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-black transition-all whitespace-nowrap ${
                                innerTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-6 sm:mb-8 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4 text-[#9B59B6]" />
                    <h4 className="text-sm font-black text-slate-800">Add holiday</h4>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-3 items-end">
                    <label className="block min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            From date — To date
                        </span>
                        <DateRangePicker
                            startValue={customFromDate}
                            endValue={customToDate}
                            onStartChange={setCustomFromDate}
                            onEndChange={setCustomToDate}
                            placeholder="Select from and to date"
                            className="mt-1 h-11 w-full min-w-0 max-w-full text-sm font-bold"
                        />
                    </label>
                    <label className="block min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Title
                        </span>
                        <input
                            type="text"
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder="Holiday name"
                            className="mt-1 h-11 w-full px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 placeholder:text-slate-300"
                        />
                    </label>
                    <div className="h-11 px-3 rounded-xl border border-slate-200 bg-white flex items-center justify-center min-w-[5.5rem]">
                        <span className="text-sm font-black text-slate-800 tabular-nums">
                            {customDayCount || 0}
                        </span>
                        <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {customDayCount === 1 ? 'day' : 'days'}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => submitCustomHoliday('both')}
                        className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black disabled:opacity-50"
                    >
                        Add both
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => submitCustomHoliday('office')}
                        className="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black disabled:opacity-50"
                    >
                        Add office
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => submitCustomHoliday('site')}
                        className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black disabled:opacity-50"
                    >
                        Add site
                    </button>
                    <span className="text-[11px] text-slate-400">
                        Marks every day in the range on the Office calendar, Site calendar, or both.
                    </span>
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-slate-400 py-16 text-center">Loading holiday calendar…</p>
            ) : innerTab === 'uae' ? (
                <HolidayMonthBlocks
                    years={uaeYears}
                    yearHint={yearHint}
                    emptyText={`No UAE holidays listed from ${MONTH_NAMES[fromMonth - 1]} ${thisYear} through ${nextYear}.`}
                    headerExtra={(items) => {
                        const allSaved = items.every((h) => catalogGroupFlags(h, savedHolidays).both);
                        return (
                            <button
                                type="button"
                                disabled={allSaved || saving}
                                onClick={() => handleAddAllInMonth(items)}
                                className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black disabled:opacity-40 whitespace-nowrap"
                            >
                                {allSaved ? 'All added' : 'Add all'}
                            </button>
                        );
                    }}
                    renderRow={(h) => {
                        const flags = catalogGroupFlags(h, savedHolidays);
                        return (
                            <tr
                                key={h.date}
                                className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60"
                            >
                                <td className="px-4 sm:px-5 py-3 font-semibold text-slate-700 tabular-nums">
                                    {h.date}
                                </td>
                                <td className="px-4 sm:px-5 py-3">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-[#9B59B6] shrink-0" />
                                            <span className="font-bold text-slate-800">{h.name}</span>
                                        </span>
                                        {flags.office || flags.site ? (
                                            <span className="flex flex-wrap items-center gap-1.5 pl-3.5">
                                                {flags.office ? (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                                        <Building2 className="w-3 h-3" />
                                                        Office
                                                        {flags.officeDate && flags.officeDate !== h.date
                                                            ? ` · ${flags.officeDate}`
                                                            : ''}
                                                    </span>
                                                ) : null}
                                                {flags.site ? (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                                                        <HardHat className="w-3 h-3" />
                                                        Site
                                                        {flags.siteDate && flags.siteDate !== h.date
                                                            ? ` · ${flags.siteDate}`
                                                            : ''}
                                                    </span>
                                                ) : null}
                                            </span>
                                        ) : null}
                                    </div>
                                </td>
                                <td className="px-4 sm:px-5 py-3 text-right">
                                    {flags.both ? (
                                        <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                                            Added
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => openAddModal(h)}
                                            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black disabled:opacity-50"
                                        >
                                            Add
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    }}
                />
            ) : innerTab === 'site' ? (
                <HolidayMonthBlocks
                    years={siteYears}
                    emptyText="No Site holidays added yet. Add them from the UAE Holidays tab."
                    renderRow={(h) => renderSavedRow(h, 'site')}
                />
            ) : (
                <HolidayMonthBlocks
                    years={officeYears}
                    emptyText="No Office holidays added yet. Add them from the UAE Holidays tab."
                    renderRow={(h) => renderSavedRow(h, 'office')}
                />
            )}

            {addTarget ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
                    onClick={() => !saving && setAddTarget(null)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 p-5 sm:p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Add holiday
                                </p>
                                <h4 className="text-lg font-black text-slate-900 mt-1">{addTarget.name}</h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAddTarget(null)}
                                className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <label className="flex items-center gap-2 mb-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={customDate}
                                onChange={(e) => {
                                    setCustomDate(e.target.checked);
                                    if (!e.target.checked) {
                                        setAddFromDate(addTarget.date);
                                        setAddToDate(addTarget.date);
                                    }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-sm font-bold text-slate-700">Custom date</span>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                            <label className="block">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    From date
                                </span>
                                <input
                                    type="date"
                                    value={addFromDate}
                                    disabled={!customDate}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        setAddFromDate(next);
                                        if (addToDate && next && addToDate < next) setAddToDate(next);
                                    }}
                                    className="mt-1 h-11 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 disabled:text-slate-400"
                                />
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    To date
                                </span>
                                <input
                                    type="date"
                                    value={addToDate}
                                    min={addFromDate || undefined}
                                    disabled={!customDate}
                                    onChange={(e) => setAddToDate(e.target.value)}
                                    className="mt-1 h-11 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 disabled:text-slate-400"
                                />
                            </label>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-5">
                            {customDate
                                ? `Every day in this range is marked on attendance (${dayCountInclusive(addFromDate, addToDate) || 0} day${dayCountInclusive(addFromDate, addToDate) === 1 ? '' : 's'}).`
                                : 'Official date. Turn on Custom date to change it or cover 2+ days.'}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => submitAddModal('both')}
                                className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black disabled:opacity-50"
                            >
                                Add both
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => submitAddModal('office')}
                                className="h-10 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black disabled:opacity-50"
                            >
                                Add office
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => submitAddModal('site')}
                                className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black disabled:opacity-50"
                            >
                                Add site
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-3">
                            Office-only leaves Site as a working day (unless they already have another holiday). Site-only does the reverse. Both marks both calendars.
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
