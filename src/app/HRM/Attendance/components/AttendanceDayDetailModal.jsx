'use client';

import { X } from 'lucide-react';
import { format } from 'date-fns';
import { emptyDayDetailStats } from './AttendanceDayDetailPanel';

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

export default function AttendanceDayDetailModal({ isOpen, onClose, day, stats = null, totalStaff = 0 }) {
    if (!isOpen || !day) return null;

    const resolved = stats || emptyDayDetailStats(totalStaff);
    const dateLabel = format(day, 'EEEE, d MMMM yyyy');
    const notMarkedOrUnauthorized = Number(resolved.notMarked) || 0;

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
                    <StatRow label="Total staff" value={resolved.totalStaff ?? totalStaff} />
                    <StatRow
                        label="Office staff"
                        value={`${resolved.officePresent} / ${resolved.officeTotal}`}
                        subValue="Present / total office staff"
                    />
                    <StatRow
                        label="Site staff"
                        value={`${resolved.sitePresent} / ${resolved.siteTotal}`}
                        subValue="Present / total site staff"
                    />
                    <StatRow label="Total present" value={resolved.totalPresent} />
                    <StatRow
                        label="Absent"
                        value={`${(Number(resolved.absentAuthorized) || 0) + notMarkedOrUnauthorized}`}
                        subValue={`Authorized (${resolved.absentAuthorized || 0}) · Unauthorized (${notMarkedOrUnauthorized})`}
                    />
                    <StatRow label="Sick leave" value={resolved.sickLeave} />
                    <StatRow label="Work from home" value={resolved.workFromHome} />
                    <StatRow label="Late arrived" value={resolved.lateArrived} />
                    <StatRow label="Not marked attendance" value={notMarkedOrUnauthorized} />
                </div>
            </div>
        </div>
    );
}
