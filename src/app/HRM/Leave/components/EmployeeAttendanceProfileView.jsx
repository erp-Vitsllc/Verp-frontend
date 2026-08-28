'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowLeftRight,
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    CalendarDays,
    Check,
    ChevronRight,
    Clock,
    FileText,
    Home,
    Landmark,
    Minus,
    Paperclip,
    Plane,
    Plus,
    Search,
    Sparkle,
    Star,
    Stethoscope,
    TrendingUp,
    X,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { workLocationLabel } from '@/utils/workLocations';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { getEmployeeInitials } from '@/utils/employeeProfileImage';
import EmployeeOverviewAttendanceCard from './EmployeeOverviewAttendanceCard';
import HistoricalSalarySetupView from '@/app/HRM/Salary/enroll/HistoricalSalarySetupView';

const DATA_ROWS = [
    {
        key: 'on_leave',
        label: 'Annual leave',
        kind: 'annual',
        Icon: Plane,
        iconWrap: 'bg-[#DCEBFF] text-[#2563EB]',
    },
    {
        key: 'authorized_leave',
        label: 'Authorized leave',
        kind: 'applied',
        Icon: Check,
        iconWrap: 'bg-[#D8F5DE] text-[#1F7A3A]',
        showAvailable: false,
    },
    {
        key: 'unauthorized_leave',
        label: 'Unauthorized leave',
        kind: 'approved',
        Icon: AlertTriangle,
        iconWrap: 'bg-[#F8D5D5] text-[#B42318]',
    },
    {
        key: 'sick_leave',
        label: 'Sick leave',
        kind: 'applied',
        Icon: Stethoscope,
        iconWrap: 'bg-[#E8D9F8] text-[#6B3FA0]',
        showAvailable: true,
    },
    {
        key: 'compoff_leave',
        label: 'Comp off leave',
        kind: 'applied',
        Icon: CalendarDays,
        iconWrap: 'bg-[#EDE9FE] text-[#6D28D9]',
        showAvailable: false,
    },
    {
        key: 'late_arrived',
        label: 'Late arrival',
        kind: 'applied',
        Icon: Clock,
        iconWrap: 'bg-[#FDE7D0] text-[#C05621]',
        showAvailable: false,
    },
    {
        key: 'early_go',
        label: 'Early go',
        kind: 'applied',
        Icon: ArrowUpRight,
        iconWrap: 'bg-[#FDE7D0] text-[#C05621]',
        showAvailable: false,
    },
    {
        key: 'mispunch',
        label: 'Miss punch',
        kind: 'applied',
        Icon: Clock,
        iconWrap: 'bg-[#DCEBFF] text-[#2563EB]',
        showAvailable: false,
    },
    {
        key: 'on_office',
        label: 'Present days',
        kind: 'total',
        Icon: BarChart3,
        iconWrap: 'bg-[#D8F5DE] text-[#1F7A3A]',
    },
    {
        key: 'work_from_home',
        label: 'Work from home',
        kind: 'applied',
        Icon: Home,
        iconWrap: 'bg-[#D4EEF8] text-[#1A6B8A]',
        showAvailable: false,
    },
];

function currentDubaiYear() {
    return Number(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dubai',
            year: 'numeric',
        }).format(new Date()),
    );
}

function n(value) {
    return Number(value) || 0;
}

function formatAed(value) {
    const amount = Number(value) || 0;
    return `AED ${Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatSignedAed(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return `+ ${formatAed(amount)}`;
    if (amount < 0) return `− ${formatAed(amount)}`;
    return formatAed(0);
}

function OverviewListRow({ icon: Icon, iconWrap, title, subtitle, value, valueClass, badge, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80 transition-colors"
        >
            <span
                className={`h-10 w-10 rounded-xl inline-flex items-center justify-center shrink-0 ${iconWrap}`}
            >
                <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#1B2A4A]">{title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
            </div>
            {badge ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 shrink-0">
                    {badge}
                </span>
            ) : (
                <span className={`text-[14px] font-bold tabular-nums shrink-0 ${valueClass || 'text-[#1B2A4A]'}`}>
                    {value}
                </span>
            )}
            <ChevronRight size={16} className="text-slate-300 shrink-0" />
        </button>
    );
}

function AnnualLeaveEligibilityCard({ annualLeave }) {
    const eligibleDays = n(annualLeave?.eligibleDays) || 30;
    const leaveSalaryDays = n(annualLeave?.leaveSalaryDays);
    const remainingDays = n(annualLeave?.remainingDays);
    const airTicket = annualLeave?.airTicketEligible ? 'Eligible' : 'Pending';

    const metrics = [
        { label: 'Eligible days', value: eligibleDays },
        { label: 'Leave salary days', value: leaveSalaryDays },
        { label: 'Remaining', value: `${remainingDays} days`, accent: true },
        { label: 'Air ticket', value: airTicket },
    ];

    return (
        <div>
            <div className="rounded-xl bg-[#E8F4FB] px-3.5 py-2">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-8 w-8 rounded-lg bg-[#C5E4F4] text-[#1B4F72] inline-flex items-center justify-center shrink-0">
                            <Sparkle size={14} fill="currentColor" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[13px] font-bold text-[#1B2A4A] leading-tight">
                                Current annual leave eligibility
                            </p>
                            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                After the most recent leave-salary settlement
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        {metrics.map((item) => (
                            <div key={item.label} className="shrink-0">
                                <p className="text-[10px] text-slate-400 leading-none">{item.label}</p>
                                <p
                                    className={`mt-0.5 text-[13px] font-bold tabular-nums leading-tight ${
                                        item.accent ? 'text-[#1A9B8C]' : 'text-[#1B2A4A]'
                                    }`}
                                >
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-1.5 flex justify-end">
                <Link
                    href="/HRM/Leave/calendar"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1A9B8C] hover:text-[#178c7e] whitespace-nowrap"
                >
                    View leave calendar
                    <ArrowRight size={13} />
                </Link>
            </div>
        </div>
    );
}

const WORKFLOW_STEPS = [
    { title: 'Request raised', detail: 'Employee submits details' },
    { title: 'HOD review', detail: 'Checks balance & history' },
    { title: 'HR processing', detail: 'Validate policy & payroll' },
    { title: 'Record updated', detail: 'Calendar and reports sync' },
];
const REQUEST_DOTS = ['bg-[#7C3AED]', 'bg-[#F59E0B]', 'bg-[#EF4444]', 'bg-[#2563EB]'];
const TASK_AGING_FALLBACK = [
    { label: '1 week', count: 0, color: '#22C55E' },
    { label: '10 days', count: 0, color: '#6366F1' },
    { label: '20 days', count: 0, color: '#F59E0B' },
    { label: '30 days', count: 0, color: '#FB923C' },
    { label: 'More', count: 0, color: '#EF4444' },
];

function WorkflowStepper({ activeIndex }) {
    return (
        <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
            {WORKFLOW_STEPS.map((step, index) => {
                const done = index < activeIndex;
                const active = index === activeIndex;
                return (
                    <div
                        key={step.title}
                        className={`relative flex flex-1 items-center gap-2.5 min-w-0 px-3 py-2.5 ${
                            active ? 'bg-[#EAF4FC]' : ''
                        }`}
                    >
                        {index > 0 ? (
                            <span className="absolute left-0 top-2 bottom-2 w-px bg-slate-200" />
                        ) : null}
                        <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ${
                                done
                                    ? 'bg-[#D8F5DE] text-[#16A34A]'
                                    : active
                                      ? 'bg-[#2563EB] text-white'
                                      : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            {done ? <Check size={13} strokeWidth={2.75} /> : index + 1}
                        </span>
                        <div className="min-w-0">
                            <p
                                className={`text-[12px] font-bold leading-tight truncate ${
                                    done || active ? 'text-[#1B2A4A]' : 'text-slate-400'
                                }`}
                            >
                                {step.title}
                            </p>
                            <p className="mt-0.5 text-[10px] leading-tight text-slate-400 truncate">
                                {step.detail}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Metric({ label, value, accent = false }) {
    return (
        <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                {label}
            </span>
            <span
                className={`text-[13px] font-bold tabular-nums leading-none ${
                    accent ? 'text-[#1A9B8C]' : 'text-[#1B2A4A]'
                }`}
            >
                {value}
            </span>
        </div>
    );
}

function ProfileHero({ employee, year, presentDays, nextBirthday }) {
    const nameParts = String(employee?.name || '').trim().split(/\s+/);
    const initials = getEmployeeInitials(nameParts[0], nameParts.slice(1).join(' '));
    const staffLabel = `${workLocationLabel(employee?.staffType)} staff`;
    const isActive = employee?.isActive !== false;

    return (
        <div
            className="rounded-2xl px-4 sm:px-5 py-3.5 mb-4 overflow-hidden text-white"
            style={{
                background: 'linear-gradient(105deg, #0C2238 0%, #14344C 52%, #1A5F62 100%)',
            }}
        >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-[#C5E4F7] text-[#1B4F72] flex items-center justify-center text-sm font-black">
                            {initials}
                        </div>
                        <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#14344C] ${
                                isActive ? 'bg-[#34C759]' : 'bg-slate-400'
                            }`}
                        />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate uppercase text-white">
                            {employee?.name || 'Employee'}
                        </h1>
                        <p className="text-sm text-white/65 mt-0.5 truncate">
                            {staffLabel}
                            {employee?.employeeId ? (
                                <>
                                    {' | '}
                                    <Link
                                        href={`/emp/${employee.employeeId}`}
                                        className="hover:text-white hover:underline"
                                    >
                                        {employee.employeeId}
                                    </Link>
                                </>
                            ) : null}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 min-w-0 xl:flex-1 xl:max-w-3xl xl:px-4">
                    {[
                        { label: 'Designation', value: employee?.designation || '—' },
                        { label: 'Years of Service', value: employee?.yearsOfServiceLabel || '—' },
                        { label: 'Reports To', value: employee?.reportsTo || '—' },
                        { label: 'Birthday', value: employee?.birthdayLabel || '—' },
                    ].map((item, index) => (
                        <div
                            key={item.label}
                            className={`min-w-0 px-3 sm:px-4 ${
                                index % 2 === 1 ? 'border-l border-white/25' : ''
                            } ${index > 0 ? 'lg:border-l lg:border-white/25' : ''}`}
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                                {item.label}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white truncate">{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className="shrink-0 xl:text-right space-y-1.5">
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            isActive
                                ? 'bg-[#2F9E6B] text-white'
                                : 'bg-white/15 text-white/80'
                        }`}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {isActive ? 'Active' : employee?.status || 'Inactive'}
                    </span>
                    {nextBirthday?.name ? (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                            Next birthday
                            <span className="block mt-0.5 text-[12px] font-semibold normal-case tracking-normal text-white/90">
                                {nextBirthday.name} — {nextBirthday.dateLabel}
                            </span>
                        </p>
                    ) : null}
                    <p className="text-[12px] font-medium text-white/80">
                        {n(presentDays)} present days in {year}
                    </p>
                </div>
            </div>
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

function downloadSummaryCsv(profile) {
    const counts = profile?.summary?.counts || {};
    const applied = profile?.summary?.appliedCounts || {};
    const rows = [
        ['Leave type', 'Approved / taken', 'Applied'],
        ...DATA_ROWS.map((row) => [
            row.label,
            String(n(row.key === 'on_office' ? profile?.summary?.presentDays : counts[row.key])),
            String(n(applied[row.key])),
        ]),
    ];
    const csv = rows.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile?.employee?.employeeId || 'employee'}-leave-${profile?.year || ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function EmployeeAttendanceProfileView({ employeeMongoId }) {
    const router = useRouter();
    const [year, setYear] = useState(currentDubaiYear);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profile, setProfile] = useState(null);
    const [expandedStatKey, setExpandedStatKey] = useState('');
    const [calendarScope, setCalendarScope] = useState('mine');
    const [activeTab, setActiveTab] = useState('attendance');
    const [salaryTabVisited, setSalaryTabVisited] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (!employeeMongoId) return;
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get(
                `/Leave/employees/${employeeMongoId}/attendance-profile`,
                { params: { year }, skipToast: true },
            );
            setProfile(response.data || null);
        } catch (err) {
            setProfile(null);
            setError(err?.response?.data?.message || err.message || 'Failed to load profile.');
        } finally {
            setLoading(false);
        }
    }, [employeeMongoId, year]);

    useEffect(() => {
        setProfile(null);
        setExpandedStatKey('');
        setSearch('');
        setActiveTab('attendance');
        setSalaryTabVisited(false);
    }, [employeeMongoId]);

    useEffect(() => {
        if (!employeeMongoId) return;
        fetchProfile();
    }, [employeeMongoId, fetchProfile]);

    const eventsByKey = useMemo(() => {
        const map = {};
        for (const row of DATA_ROWS) map[row.key] = [];
        for (const event of profile?.events || []) {
            if (!map[event.statusKey]) map[event.statusKey] = [];
            map[event.statusKey].push(event);
        }
        return map;
    }, [profile?.events]);

    const expandedEvents = expandedStatKey ? eventsByKey[expandedStatKey] || [] : [];
    const expandedLabel = DATA_ROWS.find((row) => row.key === expandedStatKey)?.label || '';

    const navigateHrm = (path) => {
        router.push(path);
    };

    const yearOptions = useMemo(() => {
        const now = currentDubaiYear();
        const joinYear = Number(String(profile?.employee?.dateOfJoining || '').slice(0, 4));
        const start = Number.isFinite(joinYear) && joinYear >= 2000 ? joinYear : now - 5;
        const years = [];
        for (let value = now; value >= start; value -= 1) years.push(value);
        if (!years.includes(year)) years.unshift(year);
        return years;
    }, [profile?.employee?.dateOfJoining, year]);

    const employee = profile?.employee;
    const counts = profile?.summary?.counts || {};
    const appliedCounts = profile?.summary?.appliedCounts || {};
    const financial = profile?.financial || {};
    const salary = financial.salary || {};
    const annualLeave = profile?.annualLeave || {};
    const presentDays = n(profile?.summary?.presentDays ?? counts.on_office);
    const loans = financial.loans || [];
    const advances = financial.advances || [];
    const fines = financial.fines || [];
    const rewards = financial.rewards || [];
    const utility = financial.utility || {};
    const increment = financial.increment;
    const loanOutstanding = loans.reduce((sum, row) => sum + n(row.outstanding), 0);
    const advanceOutstanding = advances.reduce((sum, row) => sum + n(row.outstanding), 0);
    const fineOutstanding = fines.reduce((sum, row) => sum + n(row.outstanding), 0);
    const utilityOutstanding = n(utility.outstanding);
    const totalOutstanding = loanOutstanding + advanceOutstanding + fineOutstanding + utilityOutstanding;
    const monthlySalary = n(salary.monthlySalary) || n(salary.totalSalary);
    const salaryOther = n(salary.other) || Math.max(0, monthlySalary - n(salary.basic));
    const activeLoan = loans.find((row) => n(row.outstanding) > 0) || loans[0];
    const activeAdvance = advances.find((row) => n(row.outstanding) > 0);
    const latestReward = rewards[0];
    const pendingFine = fines.find((row) => n(row.outstanding) > 0) || fines[0];
    const rewardTotal = n(latestReward?.amount);
    const pendingHrRequests = profile?.requests?.pending || [];
    const pendingHrCount =
        n(profile?.requests?.hrPendingCount) ||
        pendingHrRequests.length ||
        Object.values(appliedCounts).reduce((sum, value) => sum + n(value), 0);
    const pendingTaskCount = n(profile?.requests?.workTaskPendingCount);
    const workflowActiveIndex = Number.isFinite(Number(profile?.requests?.workflowActiveIndex))
        ? Number(profile.requests.workflowActiveIndex)
        : pendingHrCount
          ? 1
          : 3;
    const taskAging = profile?.requests?.taskAging?.length
        ? profile.requests.taskAging
        : TASK_AGING_FALLBACK;
    const agingMax = Math.max(1, ...taskAging.map((bar) => n(bar.count)));
    const deductionBits = [];
    if (n(counts.late_arrived)) deductionBits.push('Late arrival');
    if (n(counts.unauthorized_leave)) deductionBits.push('Unauthorized leave');

    const visibleRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return DATA_ROWS;
        return DATA_ROWS.filter((row) => row.label.toLowerCase().includes(query));
    }, [search]);

    if (loading && !profile) {
        return <div className="py-16 text-center text-sm text-gray-500">Loading HR profile...</div>;
    }

    if (error && !profile) {
        return <ErpErrorBanner className="mb-4" message={error} onRetry={fetchProfile} />;
    }

    if (!profile) return null;

    return (
        <>
            <ProfileHero
                employee={employee}
                year={profile.year}
                presentDays={presentDays}
                nextBirthday={profile.nextBirthday}
            />

            <div className="mb-3.5 flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className="flex items-end gap-5 border-b border-slate-200">
                        <button
                            type="button"
                            onClick={() => setActiveTab('attendance')}
                            className={`-mb-px border-b-2 px-0.5 pb-2 text-sm font-semibold tracking-wide transition-colors ${
                                activeTab === 'attendance'
                                    ? 'border-[#1A9B8C] text-[#1B2A4A]'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Attendance and information
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('salary');
                                setSalaryTabVisited(true);
                            }}
                            className={`-mb-px border-b-2 px-0.5 pb-2 text-sm font-semibold tracking-wide transition-colors ${
                                activeTab === 'salary'
                                    ? 'border-[#1A9B8C] text-[#1B2A4A]'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Salary information
                        </button>
                    </div>
                    {activeTab === 'attendance' ? (
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-1.5">
                            Requests, approvals and historical records in one place
                        </p>
                    ) : (
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-1.5">
                            Historical salary setup and enrollment for this employee
                        </p>
                    )}
                </div>
                {activeTab === 'attendance' ? (
                <div className="flex flex-wrap items-center gap-2">
                    <label className="relative">
                        <Search
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search records"
                            className="h-9 w-[160px] sm:w-[180px] rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs font-medium text-slate-700 placeholder:text-slate-400"
                        />
                    </label>
                    <select
                        value={year}
                        onChange={(event) => setYear(Number(event.target.value))}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                    >
                        {yearOptions.map((option) => (
                            <option key={option} value={option}>
                                Year {option}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => navigateHrm('/HRM/Leave/apply')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1A9B8C] px-3.5 text-xs font-semibold text-white hover:bg-[#178c7e]"
                    >
                        <Plus size={14} />
                        New request
                    </button>
                </div>
                ) : null}
            </div>

            <div className={activeTab === 'attendance' ? '' : 'hidden'}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 items-stretch">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
                    <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[15px] font-bold text-[#1B2A4A]">Employee data</h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Year {profile.year} attendance & leave summary
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => downloadSummaryCsv(profile)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 shrink-0"
                        >
                            Download report
                            <ArrowRight size={13} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="divide-y divide-slate-100 flex-1">
                        {visibleRows.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-slate-400">
                                No records match “{search}”.
                            </p>
                        ) : (
                            visibleRows.map((row) => {
                                const Icon = row.Icon;
                                const taken = row.key === 'on_office' ? presentDays : n(counts[row.key]);
                                const applied = n(appliedCounts[row.key]);
                                const remaining =
                                    row.key === 'on_leave'
                                        ? n(annualLeave.remainingDays ?? Math.max(0, 30 - taken))
                                        : row.key === 'sick_leave'
                                          ? n(annualLeave.sickRemaining)
                                          : 0;

                                return (
                                    <button
                                        key={row.key}
                                        type="button"
                                        onClick={() => setExpandedStatKey(row.key)}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-1.5 text-left hover:bg-slate-50/80 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span
                                                className={`h-7 w-7 rounded-full inline-flex items-center justify-center shrink-0 ${row.iconWrap}`}
                                            >
                                                <Icon size={13} />
                                            </span>
                                            <span className="text-[13px] font-semibold text-[#1B2A4A]">
                                                {row.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
                                            {row.kind === 'annual' ? (
                                                <>
                                                    <Metric label="Taken" value={taken} />
                                                    <Metric
                                                        label="Remaining"
                                                        value={`${remaining} days`}
                                                        accent
                                                    />
                                                </>
                                            ) : row.kind === 'total' ? (
                                                <Metric label="Total" value={taken} />
                                            ) : row.kind === 'approved' ? (
                                                <Metric label="Approved" value={taken} />
                                            ) : (
                                                <>
                                                    <Metric label="Approved" value={taken} />
                                                    <Metric label="Applied" value={applied} />
                                                    {row.showAvailable ? (
                                                        <Metric
                                                            label="Available"
                                                            value={remaining}
                                                            accent
                                                        />
                                                    ) : null}
                                                </>
                                            )}
                                            <ArrowRight size={13} className="text-slate-400 shrink-0" />
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    <div className="px-3 pb-3 pt-1">
                        <AnnualLeaveEligibilityCard annualLeave={annualLeave} />
                    </div>
                </div>

                <EmployeeOverviewAttendanceCard
                    employeeMongoId={employeeMongoId}
                    year={profile.year}
                />
            </div>

            <div className="mt-3 sm:mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 items-start">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 pt-4 pb-3.5 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[15px] font-bold text-[#1B2A4A]">Salary & financial details</h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Payroll, increments, liabilities and deductions
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigateHrm('/HRM/Salary')}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 shrink-0"
                        >
                            Payroll file
                            <ArrowRight size={12} className="text-slate-400" />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                        <OverviewListRow
                            icon={BarChart3}
                            iconWrap="bg-[#DCEBFF] text-[#2563EB]"
                            title="Salary"
                            subtitle={`Basic ${formatAed(salary.basic)} · Other ${formatAed(salaryOther)}`}
                            value={formatAed(monthlySalary)}
                            onClick={() => navigateHrm('/HRM/Salary')}
                        />
                        <OverviewListRow
                            icon={TrendingUp}
                            iconWrap="bg-[#D8F5DE] text-[#1F7A3A]"
                            title="Latest increment"
                            subtitle={
                                increment?.amount
                                    ? `${increment.dateLabel || 'Latest'} · ${formatAed(increment.amount)} increase`
                                    : 'No increment recorded'
                            }
                            value={increment?.amount ? formatSignedAed(increment.amount) : formatAed(0)}
                            valueClass={increment?.amount ? 'text-[#16A34A]' : undefined}
                            onClick={() => navigateHrm(`/emp/${employeeMongoId}`)}
                        />
                        <OverviewListRow
                            icon={ArrowLeftRight}
                            iconWrap="bg-slate-100 text-slate-500"
                            title="Advance"
                            subtitle={
                                activeAdvance
                                    ? `${activeAdvance.reason || activeAdvance.code} - ${activeAdvance.remainingPayments || 0} payments remaining`
                                    : 'No active advance'
                            }
                            value={formatAed(advanceOutstanding)}
                            onClick={() => navigateHrm('/HRM/LoanAndAdvance')}
                        />
                        <OverviewListRow
                            icon={Landmark}
                            iconWrap="bg-[#EDE9FE] text-[#6D28D9]"
                            title="Loan"
                            subtitle={
                                n(activeLoan?.outstanding) > 0
                                    ? `${activeLoan.reason || activeLoan.code} - ${activeLoan.remainingPayments || 0} payments remaining`
                                    : 'No active loan'
                            }
                            value={formatAed(loanOutstanding)}
                            onClick={() => navigateHrm('/HRM/LoanAndAdvance')}
                        />
                        <OverviewListRow
                            icon={Star}
                            iconWrap="bg-[#FEF3C7] text-[#D97706]"
                            title="Rewards earned"
                            subtitle={
                                latestReward
                                    ? `${latestReward.type}${latestReward.dateLabel ? ` - ${latestReward.dateLabel}` : ''}`
                                    : 'No rewards recorded'
                            }
                            value={formatAed(rewardTotal)}
                            onClick={() => navigateHrm('/HRM/Reward')}
                        />
                        <OverviewListRow
                            icon={AlertTriangle}
                            iconWrap="bg-[#F8D5D5] text-[#B42318]"
                            title="Fines"
                            subtitle={
                                n(pendingFine?.outstanding) > 0
                                    ? `${pendingFine.code}${pendingFine.type ? ` - ${pendingFine.type}` : ''} - Payment pending`
                                    : 'No pending recovery'
                            }
                            value={formatAed(fineOutstanding)}
                            onClick={() => navigateHrm('/HRM/Fine')}
                        />
                        <OverviewListRow
                            icon={Minus}
                            iconWrap="bg-[#FDE7D0] text-[#C05621]"
                            title="Utility excess"
                            subtitle={
                                utilityOutstanding
                                    ? `${utility.utilityType || 'Mobile bill'} excess${utility.billMonthLabel ? ` - ${utility.billMonthLabel}` : ''}`
                                    : 'No utility excess'
                            }
                            value={formatAed(utilityOutstanding)}
                            onClick={() => navigateHrm('/HRM/Asset/UtilityBills')}
                        />
                        <OverviewListRow
                            icon={Minus}
                            iconWrap="bg-[#FCE7F3] text-[#BE185D]"
                            title="Deductions"
                            subtitle={deductionBits.length ? deductionBits.join(' - ') : 'No attendance deductions'}
                            value={formatAed(0)}
                            onClick={() => navigateHrm('/HRM/Salary')}
                        />
                    </div>
                    <div className="p-3">
                        <div className="rounded-xl bg-[#12263F] px-5 py-5 text-white">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                                        Total outstanding
                                    </p>
                                    <p className="mt-1.5 text-[26px] font-bold tabular-nums leading-none">
                                        {formatAed(totalOutstanding)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-white/80">
                                    <span>
                                        Loan{' '}
                                        <strong className="font-semibold text-white">
                                            {formatAed(loanOutstanding)}
                                        </strong>
                                    </span>
                                    <span>
                                        Advance{' '}
                                        <strong className="font-semibold text-white">
                                            {formatAed(advanceOutstanding)}
                                        </strong>
                                    </span>
                                    <span>
                                        Fines{' '}
                                        <strong className="font-semibold text-white">
                                            {formatAed(fineOutstanding)}
                                        </strong>
                                    </span>
                                    <span>
                                        Utility{' '}
                                        <strong className="font-semibold text-white">
                                            {formatAed(utilityOutstanding)}
                                        </strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[680px]">
                    <div className="px-4 pt-4 pb-3.5 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[15px] font-bold text-[#1B2A4A]">Requests & work follow-up</h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Pending HR approvals and assigned tasks
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigateHrm('/HRM/Leave')}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 shrink-0"
                        >
                            View all
                            <ArrowRight size={12} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-[#F3EEFF] px-3.5 py-4 flex items-center gap-3">
                            <span className="h-10 w-10 rounded-xl bg-white text-[#6D28D9] inline-flex items-center justify-center shrink-0">
                                <FileText size={16} />
                            </span>
                            <div>
                                <p className="text-[11px] text-slate-400">HR requests</p>
                                <p className="text-[14px] font-bold text-[#1B2A4A]">
                                    {pendingHrCount} pending
                                </p>
                            </div>
                        </div>
                        <div className="rounded-xl bg-[#EEF5FC] px-3.5 py-4 flex items-center gap-3">
                            <span className="h-10 w-10 rounded-xl bg-white text-[#2563EB] inline-flex items-center justify-center shrink-0">
                                <Check size={16} />
                            </span>
                            <div>
                                <p className="text-[11px] text-slate-400">Work tasks</p>
                                <p className="text-[14px] font-bold text-[#1B2A4A]">
                                    {pendingTaskCount} pending
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-4 pb-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
                            Request approval workflow
                        </p>
                        <WorkflowStepper activeIndex={workflowActiveIndex} />
                    </div>

                    <div className="px-4 pb-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">
                            Pending HR requests
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100 border-t border-slate-100 flex-1">
                        {pendingHrRequests.length ? (
                            pendingHrRequests.map((row, index) => (
                                <button
                                    key={row.id}
                                    type="button"
                                    onClick={() => navigateHrm('/HRM/Leave')}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80 transition-colors"
                                >
                                    <span
                                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${REQUEST_DOTS[index % REQUEST_DOTS.length]}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-bold text-[#1B2A4A]">{row.title}</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">{row.subtitle}</p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 shrink-0">
                                        {row.badge}
                                    </span>
                                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                                </button>
                            ))
                        ) : (
                            <p className="px-4 py-6 text-[12px] text-slate-400">No pending HR requests</p>
                        )}
                    </div>

                    <div className="px-4 py-4 border-t border-slate-100">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
                            Task aging
                        </p>
                        <div className="space-y-2.5">
                            {taskAging.map((bar) => {
                                const count = n(bar.count);
                                const width = count ? Math.max(14, Math.round((count / agingMax) * 100)) : 0;
                                return (
                                    <div key={bar.label} className="flex items-center gap-2.5">
                                        <span className="w-14 text-[11px] text-slate-400 shrink-0">{bar.label}</span>
                                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${width}%`,
                                                    backgroundColor: bar.color,
                                                }}
                                            />
                                        </div>
                                        <span className="w-5 text-right text-[11px] font-semibold text-slate-500">
                                            {count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-auto px-4 py-4 border-t border-slate-100 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[13px] font-bold text-[#1B2A4A]">Annual leave calendar</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                                Check your schedule or team availability
                            </p>
                            <Link
                                href="/HRM/Leave/calendar"
                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A] hover:text-[#15803D]"
                            >
                                Open calendar
                                <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setCalendarScope('mine')}
                                className={`h-7 rounded-full px-2.5 text-[10px] font-semibold ${
                                    calendarScope === 'mine'
                                        ? 'bg-white text-[#1B2A4A] shadow-sm'
                                        : 'text-slate-400'
                                }`}
                            >
                                My calendar
                            </button>
                            <button
                                type="button"
                                onClick={() => setCalendarScope('all')}
                                className={`h-7 rounded-full px-2.5 text-[10px] font-semibold ${
                                    calendarScope === 'all'
                                        ? 'bg-white text-[#1B2A4A] shadow-sm'
                                        : 'text-slate-400'
                                }`}
                            >
                                All employees
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            {salaryTabVisited && employee?.employeeId ? (
                <div className={activeTab === 'salary' ? '' : 'hidden'}>
                    <HistoricalSalarySetupView
                        employeeId={employee.employeeId}
                        embedded
                    />
                </div>
            ) : activeTab === 'salary' ? (
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-12 text-center text-sm text-slate-500">
                    Salary setup is unavailable for this employee.
                </div>
            ) : null}

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
