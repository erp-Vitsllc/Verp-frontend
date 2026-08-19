'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Cell, Pie, PieChart, Tooltip as RechartsTooltip } from 'recharts';
import {
    X,
    Plus,
    CalendarDays,
    Banknote,
    Gift,
    AlertTriangle,
    Package,
    TrendingUp,
    ExternalLink,
    Paperclip,
    ChevronRight,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import DashboardAttendanceCalendar from '@/app/dashboard/components/DashboardAttendanceCalendar';
import RechartsBox from '@/components/charts/RechartsBox';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import {
    getEmployeeProfilePictureSrc,
    getEmployeeInitials,
} from '@/utils/employeeProfileImage';
import { toast } from '@/hooks/use-toast';

const STAT_BOXES = [
    { key: 'on_leave', label: 'Annual leave' },
    { key: 'authorized_leave', label: 'Authorized leave' },
    { key: 'unauthorized_leave', label: 'Unauthorized leave' },
    { key: 'sick_leave', label: 'Sick leave' },
    { key: 'late_arrived', label: 'Late arrival' },
    { key: 'early_go', label: 'Early go' },
    { key: 'mispunch', label: 'Mispunch' },
    { key: 'on_office', label: 'Present' },
    { key: 'work_from_home', label: 'Work from home' },
];

function formatMoney(value) {
    const n = Number(value) || 0;
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function PaidTotalAmount({ paid, total }) {
    const paidNum = Number(paid) || 0;
    const totalNum = Number(total) || 0;
    const outstanding = Math.max(0, totalNum - paidNum);

    return (
        <div className="text-right shrink-0">
            <p className="font-black text-gray-900 tabular-nums text-sm">
                {formatMoney(paidNum)}
                <span className="text-gray-400 font-semibold mx-0.5">/</span>
                {formatMoney(totalNum)}
            </p>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                Paid / Payable
            </p>
            {outstanding > 0.01 ? (
                <p className="text-[10px] text-amber-700 font-semibold tabular-nums mt-0.5">
                    Due {formatMoney(outstanding)}
                </p>
            ) : totalNum > 0 ? (
                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Recovered</p>
            ) : null}
        </div>
    );
}

function ProfileHero({ employee, year, presentDays, annualEligible }) {
    const src = getEmployeeProfilePictureSrc(employee);
    const nameParts = String(employee?.name || '').trim().split(/\s+/);
    const initials = getEmployeeInitials(nameParts[0], nameParts.slice(1).join(' '));
    const staffLabel =
        String(employee?.staffType || '').toLowerCase() === 'site' ? 'Site staff' : 'Office staff';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-5 sm:mb-6">
            <div className="h-24 sm:h-28 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-700" />
            <div className="px-4 sm:px-6 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 sm:-mt-12">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-200 shrink-0">
                        {src ? (
                            <img src={src} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-black text-slate-600">
                                {initials}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 pb-0.5">
                        <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                            {employee?.name || 'Employee'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">{staffLabel}</p>
                        {employee?.employeeId ? (
                            <Link
                                href={`/emp/${employee.employeeId}`}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-1"
                            >
                                {employee.employeeId}
                                <ExternalLink size={13} />
                            </Link>
                        ) : null}
                    </div>
                    <div className="sm:text-right shrink-0 space-y-1">
                        <p className="text-[11px] text-gray-400">Profile year · {year}</p>
                        <p className="text-xs text-gray-600">
                            Present days:{' '}
                            <span className="font-bold text-gray-900 tabular-nums">{presentDays}</span>
                        </p>
                        <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                annualEligible
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-800'
                            }`}
                        >
                            {annualEligible ? 'Annual leave eligible' : 'Annual leave pending'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PortalCard({ title, subtitle, children, className = '' }) {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm sm:text-base font-bold text-gray-900">{title}</h2>
                {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
            </div>
            <div className="p-4 sm:p-5">{children}</div>
        </div>
    );
}

function SectionCard({ title, actionLabel, onAction, children, className = '' }) {
    return (
        <div className={`rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden ${className}`}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-white">
                <h4 className="text-sm font-bold text-gray-900">{title}</h4>
                {actionLabel && onAction ? (
                    <button
                        type="button"
                        onClick={onAction}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        <Plus size={12} />
                        {actionLabel}
                    </button>
                ) : null}
            </div>
            <div className="p-4 bg-white">{children}</div>
        </div>
    );
}

function FinancialList({ items, emptyLabel, renderLine }) {
    if (!items?.length) {
        return <p className="text-xs text-gray-500">{emptyLabel}</p>;
    }
    return (
        <ul className="space-y-2">
            {items.map((item) => (
                <li
                    key={item.id || item.code}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs"
                >
                    {renderLine(item)}
                </li>
            ))}
        </ul>
    );
}

function LeaveSummaryTable({ year, counts, onSelect }) {
    return (
        <div>
            <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem] gap-2 px-1 pb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <span>Leave type</span>
                <span className="text-center">Taken</span>
                <span className="text-right">View</span>
            </div>
            <div className="divide-y divide-gray-100">
                {STAT_BOXES.map((box) => {
                    const count = Number(counts[box.key]) || 0;
                    return (
                        <button
                            key={box.key}
                            type="button"
                            onClick={() => onSelect(box.key)}
                            className="w-full grid grid-cols-[1fr_5rem_5rem] gap-2 items-center py-3 px-1 text-left hover:bg-slate-50/80 transition-colors rounded-lg"
                        >
                            <span className="text-sm font-medium text-gray-800">{box.label}</span>
                            <span className="text-center text-lg font-bold text-blue-600 tabular-nums">
                                {count}
                            </span>
                            <span className="flex justify-end text-gray-400">
                                <ChevronRight size={16} />
                            </span>
                        </button>
                    );
                })}
            </div>
            <p className="text-[11px] text-gray-500 mt-3">
                Leave summary for {year}. Click a row for dates, reasons, and attachments.
            </p>
        </div>
    );
}

function EventsDetailPanel({ title, events, onClose }) {
    return (
        <div
            className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{events.length} record(s)</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(80vh-4.5rem)] px-5 py-3">
                    {events.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6 text-center">No records for this category.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {events.map((event) => (
                                <li key={event.id} className="py-3">
                                    <p className="text-sm font-semibold text-gray-900">{event.date}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{event.statusLabel}</p>
                                    {event.reason ? (
                                        <p className="text-sm text-gray-700 mt-2">{event.reason}</p>
                                    ) : null}
                                    {event.leavePayType ? (
                                        <p className="text-xs text-gray-500 mt-1 capitalize">
                                            Pay type: {event.leavePayType}
                                        </p>
                                    ) : null}
                                    {event.attachmentName ? (
                                        <p className="inline-flex items-center gap-1 text-xs text-blue-600 mt-2">
                                            <Paperclip size={12} />
                                            {event.attachmentName}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function AnnualLeavePie({ annualLeave }) {
    const slices = useMemo(() => {
        const pie = annualLeave?.pie || [];
        return pie.map((segment) => ({
            name: segment.label,
            value: segment.value,
            fill: segment.color,
        }));
    }, [annualLeave?.pie]);

    const total = slices.reduce((sum, slice) => sum + (Number(slice.value) || 0), 0);
    const eligible = Boolean(annualLeave?.eligible);

    if (!slices.length) {
        return (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-8 text-center">
                <p className="text-xs text-gray-500">No attendance data for the pie period yet.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h3 className="text-sm font-bold text-gray-900">Annual leave breakdown</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        {annualLeave?.pieFrom} → {annualLeave?.pieTo}
                        {annualLeave?.lastAnnualLeaveDate
                            ? ' · since last annual leave'
                            : ' · year to date'}
                    </p>
                </div>
                <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        eligible
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-800'
                    }`}
                >
                    {eligible ? 'Annual OK' : 'Annual pending'}
                </span>
            </div>
            <div className="relative min-h-[180px]">
                <RechartsBox fillParent minHeight={180}>
                    <PieChart>
                        <Pie
                            data={slices}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="52%"
                            outerRadius="82%"
                            paddingAngle={2}
                            stroke="#fff"
                            strokeWidth={2}
                        >
                            {slices.map((slice) => (
                                <Cell key={slice.name} fill={slice.fill} />
                            ))}
                        </Pie>
                        <RechartsTooltip formatter={(value, name) => [`${value} day(s)`, name]} />
                    </PieChart>
                </RechartsBox>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-800 tabular-nums">{total}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Days
                    </span>
                </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-3">
                Present days this year: <strong>{annualLeave?.presentDays ?? 0}</strong> /{' '}
                {annualLeave?.requiredPresentDays ?? 300} required for annual leave eligibility.
            </p>
        </div>
    );
}

export default function EmployeeAttendanceProfileView({ employeeMongoId }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);
    const [expandedStatKey, setExpandedStatKey] = useState('');

    const fetchProfile = useCallback(async () => {
        if (!employeeMongoId) return;
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get(
                `/Leave/employees/${employeeMongoId}/attendance-profile`,
                { skipToast: true },
            );
            setProfile(response.data || null);
        } catch (err) {
            setProfile(null);
            setError(err?.response?.data?.message || err.message || 'Failed to load profile.');
        } finally {
            setLoading(false);
        }
    }, [employeeMongoId]);

    useEffect(() => {
        if (!employeeMongoId) return;
        setExpandedStatKey('');
        fetchProfile();
    }, [employeeMongoId, fetchProfile]);

    const eventsByKey = useMemo(() => {
        const map = {};
        for (const box of STAT_BOXES) map[box.key] = [];
        for (const event of profile?.events || []) {
            if (!map[event.statusKey]) map[event.statusKey] = [];
            map[event.statusKey].push(event);
        }
        return map;
    }, [profile?.events]);

    const expandedEvents = expandedStatKey ? eventsByKey[expandedStatKey] || [] : [];
    const expandedLabel = STAT_BOXES.find((box) => box.key === expandedStatKey)?.label || '';

    const showComingSoon = () => {
        toast({ title: 'Coming soon', description: 'Salary increment will be available soon.' });
    };

    const navigateHrm = (path) => {
        router.push(path);
    };

    const employee = profile?.employee;
    const counts = profile?.summary?.counts || {};
    const financial = profile?.financial || {};
    const salary = financial.salary || {};

    if (loading) {
        return <div className="py-16 text-center text-sm text-gray-500">Loading HR profile...</div>;
    }

    if (error) {
        return <ErpErrorBanner className="mb-4" message={error} onRetry={fetchProfile} />;
    }

    if (!profile) return null;

    return (
        <>
            <ProfileHero
                employee={employee}
                year={profile.year}
                presentDays={profile.summary?.presentDays ?? 0}
                annualEligible={profile.annualLeave?.eligible}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4 sm:space-y-5">
                    <PortalCard
                        title={`Leave summary · ${profile.year}`}
                        subtitle="Attendance & leave records for this employee"
                    >
                        <div className="mb-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => navigateHrm('/HRM/Leave/apply')}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
                            >
                                <Plus size={14} />
                                Add leave
                            </button>
                            <button
                                type="button"
                                onClick={() => navigateHrm('/HRM/Leave/update')}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                                <CalendarDays size={14} />
                                Annual / authorized leave
                            </button>
                        </div>
                        <LeaveSummaryTable
                            year={profile.year}
                            counts={counts}
                            onSelect={setExpandedStatKey}
                        />
                    </PortalCard>

                    <PortalCard title="My attendance" subtitle="Monthly calendar view">
                        <DashboardAttendanceCalendar
                            forEmployeeId={employeeMongoId}
                            hideTeamControls
                            className="!col-span-1 lg:!col-span-1 w-full"
                        />
                    </PortalCard>

                    <PortalCard title="Annual leave overview">
                        <AnnualLeavePie annualLeave={profile.annualLeave} />
                    </PortalCard>
                </div>

                <div className="space-y-4 sm:space-y-5">
                    <PortalCard
                        title="Financial details"
                        subtitle="Salary, loans, fines, rewards & assigned assets"
                    >
                        <div className="mb-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={showComingSoon}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                <TrendingUp size={14} />
                                Salary increment
                            </button>
                            <button
                                type="button"
                                onClick={() => navigateHrm('/HRM/Fine')}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                                <AlertTriangle size={14} />
                                Add fine
                            </button>
                            <button
                                type="button"
                                onClick={() => navigateHrm('/HRM/LoanAndAdvance')}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                                <Banknote size={14} />
                                Add loan
                            </button>
                            <button
                                type="button"
                                onClick={() => navigateHrm('/HRM/Reward')}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                            >
                                <Gift size={14} />
                                Add reward
                            </button>
                        </div>

                        <div className="space-y-4">
                            <SectionCard
                                title="Salary details"
                                actionLabel="Increment"
                                onAction={showComingSoon}
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Basic</p>
                                        <p className="text-lg font-black text-gray-900 tabular-nums">
                                            {formatMoney(salary.basic)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Monthly</p>
                                        <p className="text-lg font-black text-gray-900 tabular-nums">
                                            {formatMoney(salary.monthlySalary)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Total</p>
                                        <p className="text-lg font-black text-gray-900 tabular-nums">
                                            {formatMoney(salary.totalSalary)}
                                        </p>
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard
                                title="Loans"
                                actionLabel="Add loan"
                                onAction={() => navigateHrm('/HRM/LoanAndAdvance')}
                            >
                                <FinancialList
                                    items={financial.loans}
                                    emptyLabel="No loans recorded."
                                    renderLine={(item) => (
                                        <>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900">{item.code}</p>
                                                <p className="text-gray-500 mt-0.5">{item.status || '—'}</p>
                                            </div>
                                            <PaidTotalAmount paid={item.paid} total={item.total} />
                                        </>
                                    )}
                                />
                            </SectionCard>

                            <SectionCard title="Advances">
                                <FinancialList
                                    items={financial.advances}
                                    emptyLabel="No advances recorded."
                                    renderLine={(item) => (
                                        <>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900">{item.code}</p>
                                                <p className="text-gray-500 mt-0.5">{item.status || '—'}</p>
                                            </div>
                                            <PaidTotalAmount paid={item.paid} total={item.total} />
                                        </>
                                    )}
                                />
                            </SectionCard>

                            <SectionCard
                                title="Rewards"
                                actionLabel="Add reward"
                                onAction={() => navigateHrm('/HRM/Reward')}
                            >
                                <FinancialList
                                    items={financial.rewards}
                                    emptyLabel="No rewards recorded."
                                    renderLine={(item) => (
                                        <>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900">{item.code}</p>
                                                <p className="text-gray-500 mt-0.5">
                                                    {item.type} · {item.status || '—'}
                                                </p>
                                            </div>
                                            <p className="font-black text-gray-900 tabular-nums shrink-0">
                                                {formatMoney(item.amount)}
                                            </p>
                                        </>
                                    )}
                                />
                            </SectionCard>

                            <SectionCard
                                title="Fines"
                                actionLabel="Add fine"
                                onAction={() => navigateHrm('/HRM/Fine')}
                            >
                                <FinancialList
                                    items={financial.fines}
                                    emptyLabel="No fines recorded."
                                    renderLine={(item) => (
                                        <>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900">{item.code}</p>
                                                <p className="text-gray-500 mt-0.5">{item.status || '—'}</p>
                                            </div>
                                            <PaidTotalAmount paid={item.paid} total={item.total} />
                                        </>
                                    )}
                                />
                            </SectionCard>

                            <SectionCard title="Assigned assets">
                                <FinancialList
                                    items={financial.assets}
                                    emptyLabel="No assigned assets."
                                    renderLine={(item) => (
                                        <div className="min-w-0 flex items-center gap-2">
                                            <Package size={14} className="text-slate-400 shrink-0" />
                                            <div>
                                                <p className="font-semibold text-gray-900">{item.code}</p>
                                                <p className="text-gray-500 mt-0.5">{item.status || '—'}</p>
                                            </div>
                                        </div>
                                    )}
                                />
                            </SectionCard>
                        </div>
                    </PortalCard>
                </div>
            </div>

            {expandedStatKey ? (
                <EventsDetailPanel
                    title={expandedLabel}
                    events={expandedEvents}
                    onClose={() => setExpandedStatKey('')}
                />
            ) : null}
        </>
    );
}
