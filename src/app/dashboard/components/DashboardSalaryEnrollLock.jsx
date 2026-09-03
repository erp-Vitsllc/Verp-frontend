'use client';

export const SALARY_ENROLL_LOCK_MESSAGE =
    'Enroll to salary first. Attendance, check-in/out, and leave unlock after Enroll Status is Enrolled.';

const YEAR_MONTH = /^\d{4}-\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const EMPTY_SALARY_LOCK = {
    locked: false,
    message: '',
    enrolledWaiting: false,
    processingStartDate: '',
    daysRemaining: 0,
};

function getDubaiDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

export function firstOfProcessingMonth(value) {
    const raw = String(value || '').trim();
    if (ISO_DATE.test(raw) || YEAR_MONTH.test(raw)) return `${raw.slice(0, 7)}-01`;
    return '';
}

export function formatProcessingStartLabel(value) {
    const key = firstOfProcessingMonth(value);
    if (!key) return '';
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function daysUntilProcessingStart(value, todayKey = getDubaiDateKey()) {
    const start = firstOfProcessingMonth(value);
    if (!ISO_DATE.test(start) || !ISO_DATE.test(todayKey)) return 0;
    const [y1, m1, d1] = todayKey.split('-').map(Number);
    const [y2, m2, d2] = start.split('-').map(Number);
    return Math.max(
        0,
        Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000),
    );
}

export function salaryLockFromAttendancePayload(data) {
    const locked = data?.salaryEnrolled === false || data?.attendanceLocked === true;
    if (!locked) return { ...EMPTY_SALARY_LOCK };
    const enrolledWaiting = data?.salaryEnrolled === true || data?.lockKind === 'processing';
    const processingStartDate = firstOfProcessingMonth(
        data?.processingStartDate || data?.processingStartMonth || '',
    );
    const fromApi = Number(data?.daysRemaining);
    const daysRemaining = Number.isFinite(fromApi)
        ? Math.max(0, fromApi)
        : daysUntilProcessingStart(processingStartDate);
    const message = String(data?.lockMessage || data?.message || '').trim();
    return {
        locked: true,
        enrolledWaiting,
        processingStartDate,
        daysRemaining,
        message:
            message ||
            (enrolledWaiting
                ? `Your attendance will start on ${formatProcessingStartLabel(processingStartDate)}`
                : SALARY_ENROLL_LOCK_MESSAGE),
    };
}

export default function DashboardSalaryEnrollLock({
    locked,
    message,
    enrolledWaiting = false,
    processingStartDate = '',
    daysRemaining: daysRemainingProp,
}) {
    if (!locked) return null;

    const waiting =
        enrolledWaiting ||
        Boolean(firstOfProcessingMonth(processingStartDate)) ||
        (Boolean(message) && message !== SALARY_ENROLL_LOCK_MESSAGE);
    const startLabel = formatProcessingStartLabel(processingStartDate);
    const days = daysUntilProcessingStart(processingStartDate) || Number(daysRemainingProp) || 0;
    const text = message || SALARY_ENROLL_LOCK_MESSAGE;

    return (
        <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-white/95 px-4 text-center"
            role="status"
        >
            {waiting ? (
                <div className="max-w-[20rem]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                        Enrolled
                    </p>
                    <p className="mt-2 text-lg sm:text-xl font-black text-slate-900 leading-snug">
                        Your attendance will start on
                    </p>
                    {startLabel ? (
                        <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                            {startLabel}
                        </p>
                    ) : (
                        <p className="mt-1 text-base font-bold text-slate-800 leading-snug">{text}</p>
                    )}
                    {days > 0 ? (
                        <>
                            <p className="mt-3 text-4xl sm:text-5xl font-black tabular-nums tracking-tight text-slate-900 leading-none">
                                {days}
                            </p>
                            <p className="mt-1.5 text-sm sm:text-base font-bold uppercase tracking-[0.12em] text-slate-500">
                                {days === 1 ? 'day remaining' : 'days remaining'}
                            </p>
                        </>
                    ) : null}
                </div>
            ) : (
                <div className="max-w-[18rem]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Enroll Status
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-800 leading-snug">{text}</p>
                </div>
            )}
        </div>
    );
}
