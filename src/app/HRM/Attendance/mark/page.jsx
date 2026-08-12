'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MarkAttendanceTable from './components/MarkAttendanceTable';

/** Company calendar day (Asia/Dubai) as yyyy-MM-dd — matches backend midnight routine. */
function getDubaiDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function parseDateParam(value) {
    if (!value) {
        const todayKey = getDubaiDateKey();
        const parsed = parseISO(todayKey);
        return isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date());
    }
    const parsed = parseISO(String(value));
    if (isValid(parsed)) return startOfDay(parsed);
    const todayKey = getDubaiDateKey();
    const fallback = parseISO(todayKey);
    return isValid(fallback) ? startOfDay(fallback) : startOfDay(new Date());
}

const STAFF_TABS = [
    { key: 'office', label: 'Office Staff' },
    { key: 'site', label: 'Site Staffs' },
];

function MarkAttendanceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const dateParam = searchParams.get('date');

    const selectedDate = useMemo(() => parseDateParam(dateParam), [dateParam]);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const fullDateLabel = format(selectedDate, 'EEEE, d MMMM yyyy');

    // Follow "today" so after 12 AM (Dubai) the page opens a fresh empty day.
    const [followToday, setFollowToday] = useState(() => {
        if (!dateParam) return true;
        return dateParam === getDubaiDateKey();
    });
    const [dayRolledOver, setDayRolledOver] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [staffTab, setStaffTab] = useState('office');
    const lastDubaiDayRef = useRef(getDubaiDateKey());

    const goToDate = useCallback(
        (nextDate, { follow = false } = {}) => {
            const date = format(startOfDay(nextDate), 'yyyy-MM-dd');
            setFollowToday(follow || date === getDubaiDateKey());
            setDayRolledOver(false);
            router.replace(`/HRM/Attendance/mark?date=${date}`);
        },
        [router],
    );

    const goPrev = () => goToDate(addDays(selectedDate, -1), { follow: false });
    const goNext = () => goToDate(addDays(selectedDate, 1), { follow: false });

    const handleCalendarSelect = (day) => {
        if (!day) return;
        goToDate(day, { follow: false });
        setCalendarOpen(false);
    };

    useEffect(() => {
        if (!dateParam) {
            const today = getDubaiDateKey();
            router.replace(`/HRM/Attendance/mark?date=${today}`);
            setFollowToday(true);
        }
    }, [dateParam, router]);

    useEffect(() => {
        const checkRollover = () => {
            const dubaiToday = getDubaiDateKey();
            if (dubaiToday === lastDubaiDayRef.current) return;

            lastDubaiDayRef.current = dubaiToday;

            // Previous day marks stay in DB; switch live view to the new empty day.
            if (followToday) {
                setDayRolledOver(true);
                setFollowToday(true);
                router.replace(`/HRM/Attendance/mark?date=${dubaiToday}`);
            }
        };

        const intervalId = setInterval(checkRollover, 15 * 1000);
        const onVisible = () => {
            if (document.visibilityState === 'visible') checkRollover();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', checkRollover);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', checkRollover);
        };
    }, [followToday, router]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible">
            <div className="flex flex-wrap border-b border-gray-100 px-2 sm:px-4">
                {STAFF_TABS.map((tab) => {
                    const active = staffTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setStaffTab(tab.key)}
                            className={`px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-all relative ${
                                active
                                    ? 'text-[#EA3D2F]'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label}
                            {active ? (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#EA3D2F] rounded-t-full" />
                            ) : null}
                        </button>
                    );
                })}
            </div>

            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                        Mark Attendance
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Mark and review attendance for{' '}
                        {staffTab === 'site' ? 'site staffs' : 'office staff'} on the selected date.
                    </p>
                    {dayRolledOver ? (
                        <p className="text-xs text-emerald-700 mt-1">
                            New day started — previous day is saved. Status is empty for today; mark again.
                        </p>
                    ) : null}
                </div>

                <div className="flex items-center gap-1 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={goPrev}
                        className="h-9 w-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        aria-label="Previous day"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="min-w-[12rem] sm:min-w-[16rem] px-3 py-1.5 text-center rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-colors"
                                aria-label="Open calendar to choose date"
                            >
                                <p className="text-sm sm:text-base font-semibold text-gray-900 inline-flex items-center justify-center gap-1.5">
                                    <CalendarDays size={15} className="text-gray-500 shrink-0" />
                                    {fullDateLabel}
                                </p>
                                <p className="text-[11px] text-gray-400 tabular-nums mt-0.5">{dateKey}</p>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={handleCalendarSelect}
                                defaultMonth={selectedDate}
                                captionLayout="dropdown"
                                fromYear={2020}
                                toYear={new Date().getFullYear() + 5}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <button
                        type="button"
                        onClick={goNext}
                        className="h-9 w-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        aria-label="Next day"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="px-2 sm:px-4 py-3">
                <MarkAttendanceTable dateKey={dateKey} staffType={staffTab} />
            </div>
        </div>
    );
}

export default function MarkAttendancePage() {
    return (
        <PermissionGuard moduleId="hrm_attendance" permissionType="view">
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
                        <Suspense
                            fallback={
                                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
                                    Loading...
                                </div>
                            }
                        >
                            <MarkAttendanceContent />
                        </Suspense>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
