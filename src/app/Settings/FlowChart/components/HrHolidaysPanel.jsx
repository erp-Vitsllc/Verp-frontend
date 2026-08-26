'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, HardHat, MapPin, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { holidayCoversLocation } from '@/utils/holidayScope';
import useWorkLocations from '@/hooks/useWorkLocations';
import { getUaeHolidaysCurrentMonthThroughNextYear, MONTH_NAMES } from '../utils/uaeHolidaysCatalog';

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

function catalogGroupFlags(catalog, savedHolidays, locations) {
    const related = relatedSavedForCatalog(catalog, savedHolidays);
    const byKey = {};
    (locations || []).forEach((loc) => {
        byKey[loc.key] = { added: false, date: '' };
    });
    related.forEach((h) => {
        (locations || []).forEach((loc) => {
            if (holidayCoversLocation(h, loc.key)) {
                byKey[loc.key] = { added: true, date: h.date };
            }
        });
    });
    const keys = (locations || []).map((loc) => loc.key);
    const allAdded = keys.length > 0 && keys.every((key) => byKey[key]?.added);
    return { byKey, allAdded };
}

function LocationIcon({ locationKey, className = 'w-3 h-3' }) {
    if (locationKey === 'office') return <Building2 className={className} />;
    if (locationKey === 'site') return <HardHat className={className} />;
    return <MapPin className={className} />;
}

function locationBadgeClass(key) {
    if (key === 'office') return 'text-blue-700 bg-blue-50';
    if (key === 'site') return 'text-teal-700 bg-teal-50';
    return 'text-violet-700 bg-violet-50';
}

function WorkLocationSelect({ value, onChange, locations, disabled }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="mt-1 h-11 w-full min-w-[10rem] px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 disabled:text-slate-400"
        >
            <option value="all">All</option>
            {(locations || []).map((loc) => (
                <option key={loc.key} value={loc.key}>
                    {loc.label}
                </option>
            ))}
        </select>
    );
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

function withCalendarFields(h) {
    return {
        ...h,
        year: Number(h.year) || Number(String(h.date).slice(0, 4)),
        month: Number(String(h.date).slice(5, 7)),
    };
}

export default function HrHolidaysPanel() {
    const { toast } = useToast();
    const { locations } = useWorkLocations();
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
    const [customAppliesTo, setCustomAppliesTo] = useState('all');
    const [modalAppliesTo, setModalAppliesTo] = useState('all');

    const { thisYear, nextYear, fromMonth, holidays: uaeHolidays } = useMemo(
        () => getUaeHolidaysCurrentMonthThroughNextYear(),
        [],
    );

    const innerTabs = useMemo(
        () => [
            { id: 'uae', label: 'UAE Holidays' },
            ...locations.map((loc) => ({ id: loc.key, label: loc.label })),
        ],
        [locations],
    );

    const locationLabel = useCallback(
        (key) => locations.find((loc) => loc.key === key)?.label || key,
        [locations],
    );

    const uaeYears = useMemo(() => groupByYearMonth(uaeHolidays), [uaeHolidays]);

    const holidaysByLocation = useMemo(() => {
        const map = {};
        locations.forEach((loc) => {
            map[loc.key] = savedHolidays
                .filter((h) => holidayCoversLocation(h, loc.key))
                .map(withCalendarFields);
        });
        return map;
    }, [savedHolidays, locations]);

    const customDayCount = useMemo(
        () => dayCountInclusive(customFromDate, customToDate || customFromDate),
        [customFromDate, customToDate],
    );

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

    useEffect(() => {
        if (innerTab === 'uae') return;
        if (!locations.some((loc) => loc.key === innerTab)) {
            setInnerTab('uae');
            return;
        }
        setCustomAppliesTo(innerTab);
    }, [locations, innerTab]);

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
        setModalAppliesTo(innerTab !== 'uae' ? innerTab : 'all');
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
            if (appliesTo && appliesTo !== 'all' && appliesTo !== 'both') {
                setInnerTab(appliesTo);
            }
        }
    };

    const handleDeleteHoliday = async (date, appliesTo) => {
        setDeletingDate(`${date}:${appliesTo}`);
        try {
            await axiosInstance.delete(`/Holiday/${date}`, { params: { appliesTo } });
            toast({
                title: 'Holiday removed',
                description: `${date} removed from the ${locationLabel(appliesTo)} calendar.`,
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
        const pending = items.filter((h) => !catalogGroupFlags(h, savedHolidays, locations).allAdded);
        if (!pending.length) {
            toast({
                title: 'Already added',
                description: 'All holidays in this month are already saved for every work location.',
            });
            return;
        }
        for (const h of pending) {
            // sequential to avoid overloading API / duplicate race
            // eslint-disable-next-line no-await-in-loop
            await handleAddHoliday(h, 'all');
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

    const locationNames = locations.map((loc) => loc.label).join(', ');

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
                        Add a holiday to one work location or all of them ({locationNames || 'Office, Site'}).
                        Employees in that location get it on their attendance calendar.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
                    {innerTabs.map((tab) => (
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
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] gap-3 items-end">
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
                    <label className="block min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Work location
                        </span>
                        <WorkLocationSelect
                            value={customAppliesTo}
                            onChange={setCustomAppliesTo}
                            locations={locations}
                            disabled={saving}
                        />
                    </label>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => submitCustomHoliday(customAppliesTo)}
                        className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black disabled:opacity-50 whitespace-nowrap"
                    >
                        {saving ? 'Updating…' : 'Update'}
                    </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                    {customDayCount || 0} {customDayCount === 1 ? 'day' : 'days'} selected.
                    {customAppliesTo === 'all'
                        ? ' Update adds this holiday for every work location group.'
                        : ` Update adds this holiday for ${locationLabel(customAppliesTo)} staff only.`}
                </p>
            </div>

            {loading ? (
                <p className="text-sm text-slate-400 py-16 text-center">Loading holiday calendar…</p>
            ) : innerTab === 'uae' ? (
                <HolidayMonthBlocks
                    years={uaeYears}
                    yearHint={yearHint}
                    emptyText={`No UAE holidays listed from ${MONTH_NAMES[fromMonth - 1]} ${thisYear} through ${nextYear}.`}
                    headerExtra={(items) => {
                        const allSaved = items.every((h) => catalogGroupFlags(h, savedHolidays, locations).allAdded);
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
                        const flags = catalogGroupFlags(h, savedHolidays, locations);
                        const addedLocations = locations.filter((loc) => flags.byKey[loc.key]?.added);
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
                                        {addedLocations.length ? (
                                            <span className="flex flex-wrap items-center gap-1.5 pl-3.5">
                                                {addedLocations.map((loc) => {
                                                    const savedDate = flags.byKey[loc.key]?.date;
                                                    return (
                                                        <span
                                                            key={loc.key}
                                                            className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${locationBadgeClass(loc.key)}`}
                                                        >
                                                            <LocationIcon locationKey={loc.key} />
                                                            {loc.label}
                                                            {savedDate && savedDate !== h.date ? ` · ${savedDate}` : ''}
                                                        </span>
                                                    );
                                                })}
                                            </span>
                                        ) : null}
                                    </div>
                                </td>
                                <td className="px-4 sm:px-5 py-3 text-right">
                                    {flags.allAdded ? (
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
            ) : (
                <HolidayMonthBlocks
                    years={groupByYearMonth(holidaysByLocation[innerTab] || [])}
                    emptyText={`No ${locationLabel(innerTab)} holidays added yet. Add them from the UAE Holidays tab.`}
                    renderRow={(h) => renderSavedRow(h, innerTab)}
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

                        <label className="block mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Work location
                            </span>
                            <WorkLocationSelect
                                value={modalAppliesTo}
                                onChange={setModalAppliesTo}
                                locations={locations}
                                disabled={saving}
                            />
                        </label>

                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => submitAddModal(modalAppliesTo)}
                            className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black disabled:opacity-50"
                        >
                            {saving ? 'Updating…' : 'Update'}
                        </button>
                        <p className="text-[11px] text-slate-400 mt-3">
                            {modalAppliesTo === 'all'
                                ? 'Update adds this holiday for every work location group.'
                                : `Update adds this holiday for ${locationLabel(modalAppliesTo)} staff only. Other groups stay as working days unless they already have this date.`}
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
