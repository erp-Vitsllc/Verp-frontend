'use client';

export const SALARY_ENROLL_LOCK_MESSAGE =
    'Enroll to salary first. Attendance, check-in/out, and leave unlock after Enroll Status is Enrolled.';

export function salaryLockFromAttendancePayload(data) {
    const locked = data?.salaryEnrolled === false || data?.attendanceLocked === true;
    const message = String(data?.lockMessage || data?.message || '').trim();
    return {
        locked,
        message: locked ? message || SALARY_ENROLL_LOCK_MESSAGE : '',
    };
}

export default function DashboardSalaryEnrollLock({ locked, message }) {
    if (!locked) return null;
    const text = message || SALARY_ENROLL_LOCK_MESSAGE;
    const waitingForProcessingMonth = text !== SALARY_ENROLL_LOCK_MESSAGE;
    return (
        <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-white px-5 text-center"
            role="status"
        >
            <div className="max-w-[18rem]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {waitingForProcessingMonth ? 'Enrolled' : 'Enroll Status'}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800 leading-snug">
                    {text}
                </p>
            </div>
        </div>
    );
}
