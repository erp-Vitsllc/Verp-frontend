'use client';

export const SALARY_ENROLL_LOCK_MESSAGE =
    'Enroll to salary first. Attendance, check-in/out, and leave unlock after Enroll Status is Enrolled.';

export default function DashboardSalaryEnrollLock({ locked }) {
    if (!locked) return null;
    return (
        <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-white px-5 text-center"
            role="status"
        >
            <div className="max-w-[18rem]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Enroll Status
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800 leading-snug">
                    {SALARY_ENROLL_LOCK_MESSAGE}
                </p>
            </div>
        </div>
    );
}
