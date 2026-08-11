'use client';

import { X } from 'lucide-react';
import { format } from 'date-fns';

/** Placeholder day detail until attendance API is wired. */
export function getDayDetailStats(_day, totalStaff = 0) {
    return {
        totalStaff,
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
        <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-b-0">
            <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                {subValue ? (
                    <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>
                ) : null}
            </div>
            <p className="text-base sm:text-lg font-black text-gray-900 tabular-nums shrink-0">{value}</p>
        </div>
    );
}

export default function AttendanceDayDetailModal({ isOpen, onClose, day, totalStaff = 0 }) {
    if (!isOpen || !day) return null;

    const stats = getDayDetailStats(day, totalStaff);
    const dateLabel = format(day, 'EEEE, d MMMM yyyy');

    return (
        <div
            className="fixed inset-0 z-[240] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="attendance-day-detail-title"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                    <div className="min-w-0">
                        <h2
                            id="attendance-day-detail-title"
                            className="text-base sm:text-lg font-bold text-gray-900 truncate"
                        >
                            Attendance detail
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{dateLabel}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-5 py-2 max-h-[70vh] overflow-y-auto">
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
            </div>
        </div>
    );
}
