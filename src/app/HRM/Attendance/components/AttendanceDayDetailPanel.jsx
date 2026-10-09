'use client';

import { format } from 'date-fns';
import { X } from 'lucide-react';

export function emptyDayDetailStats(totalStaff = 0) {
    const total = Number(totalStaff) || 0;
    return {
        activeEmployees: total,
        totalStaff: total,
        officePresent: 0,
        officeTotal: total,
        sitePresent: 0,
        siteTotal: 0,
        totalPresent: 0,
        onLeave: 0,
        absentAuthorized: 0,
        absentUnauthorized: total,
        sickLeave: 0,
        workFromHome: 0,
        lateArrived: 0,
        notMarked: total,
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
export default function AttendanceDayDetailPanel({
    day,
    stats = null,
    totalStaff = 0,
    groupLabel = '',
    groupCount = null,
    onClose,
}) {
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

    const companyTotal = Number(totalStaff) || 0;
    const resolved = stats || emptyDayDetailStats(groupCount ?? companyTotal);
    const dateLabel = format(day, 'EEEE, d MMMM yyyy');
    // Same headcount as the calendar cell for this day and staff group.
    const dayStaff =
        Number(resolved.activeEmployees) ||
        Number(resolved.totalStaff) ||
        Number(groupCount) ||
        companyTotal;
    const notMarkedOrUnauthorized = Number(resolved.notMarked) || 0;
    const onLeave = Number(resolved.onLeave ?? resolved.absentAuthorized) || 0;

    return (
        <div className="h-full min-h-[320px] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80 shrink-0">
                <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900">Attendance detail</h3>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 break-words">{dateLabel}</p>
                    {groupLabel ? (
                        <p className="text-[11px] font-semibold text-gray-700 mt-0.5">{groupLabel}</p>
                    ) : null}
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
                <StatRow label="Total staff" value={dayStaff} />
                <StatRow label="Present" value={resolved.present ?? resolved.totalPresent} />
                {resolved.isWeeklyOff || (resolved.weeklyOff || 0) > 0 ? (
                    <StatRow
                        label="Off Day (weekly)"
                        value={resolved.weeklyOff || dayStaff}
                        subValue="From Working Time schedule for this staff group"
                    />
                ) : null}
                {(resolved.holiday || 0) > 0 ? (
                    <StatRow label="Holiday" value={resolved.holiday} />
                ) : null}
                <StatRow label="On leave" value={onLeave} />
                <StatRow label="Sick leave" value={resolved.sickLeave} />
                <StatRow label="Work from home" value={resolved.workFromHome} />
                <StatRow label="Late arrived" value={resolved.lateArrived} />
                <StatRow label="Not marked / Unauthorized" value={notMarkedOrUnauthorized} />
            </div>
        </div>
    );
}
