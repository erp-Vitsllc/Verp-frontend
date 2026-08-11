'use client';

import { format } from 'date-fns';
import { X } from 'lucide-react';

/** Placeholder day detail until attendance API is wired. Sat 1st has full demo counts. */
export function getDayDetailStats(day, totalStaff = 0) {
    const isSatFirst = day && day.getDate() === 1 && day.getDay() === 6;
    const total = totalStaff > 0 ? totalStaff : 8;

    if (isSatFirst) {
        return {
            totalStaff: total,
            officePresent: 4,
            officeTotal: 5,
            sitePresent: 2,
            siteTotal: 3,
            totalPresent: 6,
            absentAuthorized: 1,
            absentUnauthorized: 1,
            sickLeave: 1,
            workFromHome: 2,
            lateArrived: 1,
            notMarked: 1,
        };
    }

    return {
        totalStaff: total,
        officePresent: 0,
        officeTotal: 0,
        sitePresent: 0,
        siteTotal: 0,
        totalPresent: 0,
        absentAuthorized: 0,
        absentUnauthorized: 0,
        sickLeave: 0,
        workFromHome: 0,
        lateArrived: 0,
        notMarked: 0,
    };
}

function StatRow({ label, value, subValue = null }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
            <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                {subValue ? (
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{subValue}</p>
                ) : null}
            </div>
            <p className="text-sm sm:text-base font-semibold text-gray-900 tabular-nums shrink-0">{value}</p>
        </div>
    );
}

/**
 * Side panel (1/4 width) — shows day attendance list inline, not a popup modal.
 */
export default function AttendanceDayDetailPanel({ day, totalStaff = 0, onClose }) {
    if (!day) {
        return (
            <div className="h-full min-h-[320px] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center p-5 text-center">
                <p className="text-sm font-medium text-gray-700">Day details</p>
                <p className="text-xs text-gray-400 mt-2 px-2">
                    Click a date on the calendar to view attendance breakdown here.
                </p>
            </div>
        );
    }

    const stats = getDayDetailStats(day, totalStaff);
    const dateLabel = format(day, 'EEEE, d MMMM yyyy');
    const dateParam = format(day, 'yyyy-MM-dd');
    const markUrl = `/HRM/Attendance/mark?date=${encodeURIComponent(dateParam)}`;

    const openMarkAttendance = () => {
        window.open(markUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="h-full min-h-[320px] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80 shrink-0">
                <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900">Attendance detail</h3>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 break-words">{dateLabel}</p>
                </div>
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                ) : null}
            </div>

            <div className="px-4 py-1 flex-1 overflow-y-auto">
                <StatRow label="Total staff" value={stats.totalStaff} />
                <StatRow
                    label="Office staff"
                    value={`${stats.officePresent} / ${stats.officeTotal}`}
                    subValue="Present / total office staff"
                />
                <StatRow
                    label="Site staff"
                    value={`${stats.sitePresent} / ${stats.siteTotal}`}
                    subValue="Present / total site staff"
                />
                <StatRow label="Total present" value={stats.totalPresent} />
                <StatRow
                    label="Absent"
                    value={`${stats.absentAuthorized + stats.absentUnauthorized}`}
                    subValue={`Authorized (${stats.absentAuthorized}) · Unauthorized (${stats.absentUnauthorized})`}
                />
                <StatRow label="Sick leave" value={stats.sickLeave} />
                <StatRow label="Work from home" value={stats.workFromHome} />
                <StatRow label="Late arrived" value={stats.lateArrived} />
                <StatRow label="Not marked attendance" value={stats.notMarked} />
            </div>

            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                <button
                    type="button"
                    onClick={openMarkAttendance}
                    className="w-full h-10 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-sm font-semibold transition-colors"
                >
                    Mark Attendance
                </button>
            </div>
        </div>
    );
}
