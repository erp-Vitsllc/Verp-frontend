'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, MapPin } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import useWorkLocations from '@/hooks/useWorkLocations';

const WEEK_DAYS = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
];

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const MERIDIEMS = ['AM', 'PM'];

function defaultDay(isWeekend) {
    return {
        isOffDay: Boolean(isWeekend),
        startHour: '09',
        startMinute: '00',
        startMeridiem: 'AM',
        endHour: '06',
        endMinute: '00',
        endMeridiem: 'PM',
    };
}

function buildDefaultWeek() {
    return WEEK_DAYS.reduce((acc, day, index) => {
        acc[day.key] = defaultDay(index >= 5);
        return acc;
    }, {});
}

function normalizeWeek(raw) {
    const base = buildDefaultWeek();
    if (!raw || typeof raw !== 'object') return base;
    WEEK_DAYS.forEach(({ key }) => {
        const day = raw[key];
        if (!day || typeof day !== 'object') return;
        base[key] = {
            isOffDay: Boolean(day.isOffDay),
            startHour: String(day.startHour || '09').padStart(2, '0'),
            startMinute: String(day.startMinute || '00').padStart(2, '0'),
            startMeridiem: MERIDIEMS.includes(day.startMeridiem) ? day.startMeridiem : 'AM',
            endHour: String(day.endHour || '06').padStart(2, '0'),
            endMinute: String(day.endMinute || '00').padStart(2, '0'),
            endMeridiem: MERIDIEMS.includes(day.endMeridiem) ? day.endMeridiem : 'PM',
        };
    });
    return base;
}

function TimeSelect({ hour, minute, meridiem, disabled, onChange }) {
    return (
        <div className="inline-flex items-center gap-1.5">
            <select
                value={hour}
                disabled={disabled}
                onChange={(e) => onChange({ hour: e.target.value, minute, meridiem })}
                className="h-9 w-[4.25rem] px-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
            >
                {HOURS.map((h) => (
                    <option key={h} value={h}>
                        {h}
                    </option>
                ))}
            </select>
            <span className="text-slate-300 font-black">:</span>
            <select
                value={minute}
                disabled={disabled}
                onChange={(e) => onChange({ hour, minute: e.target.value, meridiem })}
                className="h-9 w-[4.25rem] px-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
            >
                {MINUTES.map((m) => (
                    <option key={m} value={m}>
                        {m}
                    </option>
                ))}
            </select>
            <select
                value={meridiem}
                disabled={disabled}
                onChange={(e) => onChange({ hour, minute, meridiem: e.target.value })}
                className="h-9 w-[4.5rem] px-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
            >
                {MERIDIEMS.map((m) => (
                    <option key={m} value={m}>
                        {m}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default function HrWorkingTimePanel() {
    const { toast } = useToast();
    const { locations } = useWorkLocations();
    const [category, setCategory] = useState('office');
    const [schedules, setSchedules] = useState({
        site: buildDefaultWeek(),
        office: buildDefaultWeek(),
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadSchedules = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/WorkingTime', { skipToast: true });
            const data = res.data?.workingTime || {};
            const extra = data.extra && typeof data.extra === 'object' ? data.extra : {};
            const extraWeeks = Object.fromEntries(
                Object.entries(extra).map(([key, week]) => [key, normalizeWeek(week)]),
            );
            setSchedules({
                site: normalizeWeek(data.site),
                office: normalizeWeek(data.office),
                ...extraWeeks,
            });
        } catch (err) {
            setSchedules({
                site: buildDefaultWeek(),
                office: buildDefaultWeek(),
            });
            toast({
                title: 'Could not load working times',
                description: err?.response?.data?.message || 'Using defaults. You can still edit and save.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadSchedules();
    }, [loadSchedules]);

    useEffect(() => {
        if (!locations.length) return;
        setSchedules((prev) => {
            const next = { ...prev };
            let changed = false;
            locations.forEach((loc) => {
                if (!next[loc.key]) {
                    next[loc.key] = normalizeWeek(prev.office);
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
        if (!locations.some((loc) => loc.key === category)) {
            setCategory(locations[0]?.key || 'office');
        }
    }, [locations, category]);

    const week = schedules[category] || buildDefaultWeek();

    const updateDay = (dayKey, patch) => {
        setSchedules((prev) => {
            const currentWeek = prev[category] || buildDefaultWeek();
            return {
                ...prev,
                [category]: {
                    ...currentWeek,
                    [dayKey]: {
                        ...currentWeek[dayKey],
                        ...patch,
                    },
                },
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const extra = {};
            Object.entries(schedules).forEach(([key, weekValue]) => {
                if (key === 'office' || key === 'site') return;
                extra[key] = weekValue;
            });
            await axiosInstance.put('/WorkingTime', {
                site: schedules.site,
                office: schedules.office,
                extra,
            });
            toast({
                title: 'Working times saved',
                description: 'Weekly schedules updated. Off days applied to attendance calendars.',
            });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('verp:working-time-changed'));
            }
        } catch (err) {
            toast({
                title: 'Save failed',
                description: err?.response?.data?.message || 'Could not save working times.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-4 sm:p-6 lg:p-10 min-h-[400px] sm:min-h-[600px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">
                        Working Time
                    </h3>
                    <p className="text-slate-400 text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider mt-1 italic">
                        Weekly schedule by category — set timing or mark off day
                    </p>
                </div>
                <button
                    type="button"
                    disabled={saving || loading}
                    onClick={handleSave}
                    className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black disabled:opacity-50 whitespace-nowrap self-start sm:self-auto"
                >
                    {saving ? 'Saving…' : 'Save schedule'}
                </button>
            </div>

            <div className="flex items-center gap-2 mb-6 bg-slate-50 p-1 rounded-xl border border-slate-100 w-full sm:w-fit overflow-x-auto">
                {locations.map((loc) => (
                    <button
                        key={loc.key}
                        type="button"
                        onClick={() => setCategory(loc.key)}
                        className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all whitespace-nowrap ${
                            category === loc.key
                                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <MapPin className="w-3.5 h-3.5" />
                        {loc.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="text-sm text-slate-400 py-16 text-center">Loading working times…</p>
            ) : (
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="hidden sm:grid grid-cols-[9rem_1fr_auto] gap-4 px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-100">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                            Day
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                            Timing (AM/PM – AM/PM)
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">
                            Off day
                        </span>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {WEEK_DAYS.map(({ key, label }) => {
                            const day = week[key];
                            return (
                                <div
                                    key={key}
                                    className={`grid grid-cols-1 sm:grid-cols-[9rem_1fr_auto] gap-3 sm:gap-4 px-4 sm:px-5 py-4 items-center ${
                                        day.isOffDay ? 'bg-slate-50/80' : 'hover:bg-slate-50/40'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="text-sm font-black text-slate-800">{label}</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                        {day.isOffDay ? (
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Off day — no working hours
                                            </span>
                                        ) : (
                                            <>
                                                <TimeSelect
                                                    hour={day.startHour}
                                                    minute={day.startMinute}
                                                    meridiem={day.startMeridiem}
                                                    disabled={day.isOffDay}
                                                    onChange={({ hour, minute, meridiem }) =>
                                                        updateDay(key, {
                                                            startHour: hour,
                                                            startMinute: minute,
                                                            startMeridiem: meridiem,
                                                        })
                                                    }
                                                />
                                                <span className="text-slate-300 font-black text-sm">–</span>
                                                <TimeSelect
                                                    hour={day.endHour}
                                                    minute={day.endMinute}
                                                    meridiem={day.endMeridiem}
                                                    disabled={day.isOffDay}
                                                    onChange={({ hour, minute, meridiem }) =>
                                                        updateDay(key, {
                                                            endHour: hour,
                                                            endMinute: minute,
                                                            endMeridiem: meridiem,
                                                        })
                                                    }
                                                />
                                            </>
                                        )}
                                    </div>

                                    <label className="inline-flex items-center gap-2 justify-start sm:justify-end cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={day.isOffDay}
                                            onChange={(e) =>
                                                updateDay(key, { isOffDay: e.target.checked })
                                            }
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-bold text-slate-600">Off day</span>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
