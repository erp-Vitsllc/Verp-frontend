'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    CheckCircle2,
    Clock,
    FileText,
    MoreHorizontal,
    Plus,
    Search,
} from 'lucide-react';
import CreateTaskModal from '@/app/task-manager/CreateTaskModal';
import ReassignTaskModal from '@/app/task-manager/ReassignTaskModal';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { formatCommandCenterNotificationMessage } from '@/utils/dashboardCommandCenterInbox';

const PAGE_SIZE_OPTIONS = [
    { id: '10', label: '10' },
    { id: '50', label: '50' },
    { id: '100', label: '100' },
    { id: 'all', label: 'All' },
];
const SCOPES = ['My Tasks', 'All Tasks'];
const TYPE_FILTERS = ['All Types', 'System Task', 'Workflow Task', 'General Task'];
const STATUSES = ['All Status', 'Pending', 'Overdue', 'Completed', 'Cancelled'];
const PRIORITIES = ['All Priority', 'High', 'Medium', 'Low'];

const EMPTY_SUMMARY = {
    total: 0,
    pending: 0,
    pendingDue: 0,
    completed: 0,
    totalChange: 0,
    pendingChange: 0,
    pendingDueChange: 0,
    completedChange: 0,
};

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#0EA5E9', '#EC4899'];

const STATUS_STYLE = {
    Pending: 'bg-rose-50 text-rose-600',
    'Pending Due': 'bg-red-50 text-red-600',
    Overdue: 'bg-red-50 text-red-600',
    'In Progress': 'bg-sky-50 text-sky-700',
    Completed: 'bg-emerald-50 text-emerald-600',
    Cancelled: 'bg-slate-100 text-slate-500',
    'On Hold': 'bg-amber-50 text-amber-700',
    Rejected: 'bg-slate-100 text-slate-600',
    Dismissed: 'bg-slate-100 text-slate-500',
};

const PRIORITY_STYLE = {
    High: 'bg-rose-50 text-rose-600',
    Medium: 'bg-amber-50 text-amber-600',
    Low: 'bg-emerald-50 text-emerald-600',
};

const TYPE_STYLE = {
    'System Task': 'bg-sky-50 text-sky-700',
    'Workflow Task': 'bg-violet-50 text-violet-700',
    'Work Flow Task': 'bg-violet-50 text-violet-700',
    'General Task': 'bg-orange-50 text-orange-700',
};

function displayTaskType(value) {
    return value === 'Work Flow Task' ? 'Workflow Task' : value || '';
}

function readViewer() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('user') || localStorage.getItem('employeeUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function listStatus(task) {
    const status = task?.displayStatus || '';
    if (status === 'In Progress' || status === 'On Hold') return 'Pending';
    if (status === 'Pending Due') return 'Overdue';
    if (status === 'Rejected' || status === 'Dismissed') return 'Cancelled';
    if (status === 'Pending') {
        const started = new Date(task.requestDate).getTime();
        if (!Number.isNaN(started) && Date.now() - started > 48 * 60 * 60 * 1000) return 'Overdue';
    }
    return status || 'Pending';
}

function isMyTask(task, viewer) {
    if (!viewer) return false;
    const ids = [viewer.employeeObjectId, viewer.empObjectId, viewer._id, viewer.id]
        .map((value) => String(value || ''))
        .filter(Boolean);
    if (task.assigneeId && ids.includes(String(task.assigneeId))) return true;
    const codes = [viewer.employeeId, viewer.empId]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
    if (task.assigneeEmpId && codes.includes(String(task.assigneeEmpId).trim().toLowerCase())) return true;
    const names = [viewer.name, viewer.username]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
    const assignee = String(task.assigneeName || '').trim().toLowerCase();
    const requester = String(task.requesterName || '').trim().toLowerCase();
    return (assignee && names.includes(assignee)) || (requester && names.includes(requester));
}

function dateKey(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function formatDisplayDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Dubai',
    }).format(date);
}

function notificationTitle(task) {
    if (task?.manual) return task.taskName || task.requestType || 'Task';
    try {
        const formatted = formatCommandCenterNotificationMessage(task);
        const title = String(formatted?.title || '').trim();
        if (title) return title;
    } catch {
        /* Stored notification text is the fallback. */
    }
    return task?.taskName || task?.requestType || 'Notification';
}

function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

function colorFor(name) {
    const text = String(name || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = (hash + text.charCodeAt(i)) % AVATAR_COLORS.length;
    return AVATAR_COLORS[hash];
}

function pageList(current, total) {
    if (total <= 1) return [1];
    const wanted = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const n of sorted) {
        if (prev && n - prev > 1) out.push('…');
        out.push(n);
        prev = n;
    }
    return out;
}

function PersonCell({ name, photo, hint }) {
    const [failed, setFailed] = useState(false);
    const label = name || '—';
    return (
        <div className="flex items-center gap-2.5 min-w-0" title={hint || label}>
            {photo && !failed ? (
                <img
                    src={photo}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover shrink-0 bg-slate-100"
                    onError={() => setFailed(true)}
                />
            ) : (
                <span
                    className="h-8 w-8 rounded-full shrink-0 text-white text-[11px] font-semibold flex items-center justify-center"
                    style={{ backgroundColor: colorFor(label) }}
                >
                    {initials(label)}
                </span>
            )}
            <span className="truncate text-[13px] font-medium text-slate-700">{label}</span>
        </div>
    );
}

function ChangePill({ value, goodWhenUp }) {
    const up = value > 0;
    const down = value < 0;
    const positive = goodWhenUp ? up : down;
    const tone = !up && !down ? 'text-slate-500' : positive ? 'text-emerald-600' : 'text-rose-600';
    const Icon = down ? ArrowDown : ArrowUp;
    return (
        <p className={`mt-3 flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold leading-none ${tone}`}>
            {(up || down) && <Icon size={14} strokeWidth={2.5} />}
            <span>{Math.abs(value)}% from last month</span>
        </p>
    );
}

function StatCard({ label, value, change, goodWhenUp, icon: Icon, wrap, bubble, figure }) {
    return (
        <div className={`rounded-2xl px-5 py-4 ${wrap}`}>
            <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${bubble}`}>
                    <Icon size={20} />
                </span>
                <div className="min-w-0">
                    <p className="whitespace-nowrap text-[13px] font-medium text-slate-500">{label}</p>
                    <p className={`mt-0.5 text-[28px] font-bold leading-none tabular-nums ${figure}`}>{value}</p>
                </div>
            </div>
            <ChangePill value={change} goodWhenUp={goodWhenUp} />
        </div>
    );
}

function TaskManagerContent() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [tasks, setTasks] = useState([]);
    const [viewer, setViewer] = useState(null);
    const [scope, setScope] = useState('My Tasks');
    const [typeFilter, setTypeFilter] = useState('All Types');
    const [query, setQuery] = useState('');
    const [requesterQuery, setRequesterQuery] = useState('');
    const [assigneeQuery, setAssigneeQuery] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [status, setStatus] = useState('All Status');
    const [priority, setPriority] = useState('All Priority');
    const [pageSizeChoice, setPageSizeChoice] = useState('10');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(() => new Set());
    const [openMenu, setOpenMenu] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [reassignTask, setReassignTask] = useState(null);
    const [deleteTask, setDeleteTask] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setError('');
        try {
            const res = await axiosInstance.get('/Employee/task-manager/notifications', { skipToast: true });
            setSummary(res.data?.summary || EMPTY_SUMMARY);
            setTasks(Array.isArray(res.data?.tasks) ? res.data.tasks : []);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load notifications.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        document.title = 'Task Manager';
        setViewer(readViewer());
        load();
    }, [load]);

    useEffect(() => {
        if (!openMenu) return undefined;
        const close = () => setOpenMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('scroll', close, true);
        };
    }, [openMenu]);

    const titles = useMemo(() => {
        const map = new Map();
        tasks.forEach((task) => map.set(task.actionId, notificationTitle(task)));
        return map;
    }, [tasks]);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const requesterNeedle = requesterQuery.trim().toLowerCase();
        const assigneeNeedle = assigneeQuery.trim().toLowerCase();
        return tasks.filter((task) => {
            const shown = listStatus(task);
            if (scope === 'My Tasks' && !isMyTask(task, viewer)) return false;
            if (typeFilter !== 'All Types' && displayTaskType(task.taskCategory) !== typeFilter) return false;
            if (scope === 'All Tasks' && status === 'All Status' && (shown === 'Completed' || shown === 'Cancelled')) return false;
            if (status !== 'All Status' && shown !== status) return false;
            if (priority !== 'All Priority' && task.priority !== priority) return false;
            const key = dateKey(task.requestDate);
            if ((fromDate || toDate) && !key) return false;
            if (fromDate && key < fromDate) return false;
            if (toDate && key > toDate) return false;
            if (requesterNeedle && !String(task.requesterName || '').toLowerCase().includes(requesterNeedle)) return false;
            if (assigneeNeedle) {
                const assigneeText = [task.assigneeName, task.assigneeEmpId].filter(Boolean).join(' ').toLowerCase();
                if (!assigneeText.includes(assigneeNeedle)) return false;
            }
            if (!needle) return true;
            const title = (titles.get(task.actionId) || task.taskName || '').toLowerCase();
            return [
                task.taskNumber,
                title,
                task.taskName,
                task.requestType,
                displayTaskType(task.taskCategory),
                shown,
                task.priority,
                task.description,
            ]
                .join(' ')
                .toLowerCase()
                .includes(needle);
        });
    }, [tasks, titles, viewer, scope, typeFilter, query, requesterQuery, assigneeQuery, fromDate, toDate, status, priority]);

    const pageSize = pageSizeChoice === 'all' ? Math.max(filtered.length, 1) : Number(pageSizeChoice);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const start = filtered.length === 0 ? 0 : (safePage - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    const openDetails = (task, tab) => {
        const query = new URLSearchParams();
        if (task.taskNumber) query.set('no', task.taskNumber);
        if (tab) query.set('tab', tab);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        router.push(`/task-manager/${encodeURIComponent(task.actionId)}${suffix}`);
    };
    const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selected.has(row.actionId));

    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

    const resetFilters = () => {
        setScope('My Tasks');
        setTypeFilter('All Types');
        setPageSizeChoice('10');
        setQuery('');
        setRequesterQuery('');
        setAssigneeQuery('');
        setFromDate('');
        setToDate('');
        setStatus('All Status');
        setPriority('All Priority');
        setPage(1);
    };

    const toggleAllPage = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allPageSelected) pageRows.forEach((row) => next.delete(row.actionId));
            else pageRows.forEach((row) => next.add(row.actionId));
            return next;
        });
    };

    const toggleOne = (actionId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(actionId)) next.delete(actionId);
            else next.add(actionId);
            return next;
        });
    };

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#F4F7FB]">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Navbar />
                <div className="w-full max-w-full px-4 py-5 sm:px-6 lg:px-8">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Task Manager</h1>
                            <p className="mt-1 text-sm text-slate-500">
                                Manage, track and complete your tasks efficiently
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCreateOpen(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8]"
                        >
                            <Plus size={16} />
                            Create New Task
                        </button>
                    </div>

                    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard
                            label="Total Tasks"
                            value={summary.total}
                            change={summary.totalChange}
                            goodWhenUp
                            icon={FileText}
                            wrap="bg-[#EAF3FF]"
                            bubble="bg-[#3B82F6] text-white"
                            figure="text-[#2563EB]"
                        />
                        <StatCard
                            label="Pending Tasks"
                            value={summary.pending}
                            change={summary.pendingChange}
                            goodWhenUp={false}
                            icon={Clock}
                            wrap="bg-[#FDECEC]"
                            bubble="bg-[#EF4444] text-white"
                            figure="text-[#EF4444]"
                        />
                        <StatCard
                            label="Pending Due"
                            value={summary.pendingDue}
                            change={summary.pendingDueChange}
                            goodWhenUp={false}
                            icon={AlertTriangle}
                            wrap="bg-[#FFF6E8]"
                            bubble="bg-[#F59E0B] text-white"
                            figure="text-[#D97706]"
                        />
                        <StatCard
                            label="Completed Tasks"
                            value={summary.completed}
                            change={summary.completedChange}
                            goodWhenUp
                            icon={CheckCircle2}
                            wrap="bg-[#E8F8EF]"
                            bubble="bg-[#22C55E] text-white"
                            figure="text-[#16A34A]"
                        />
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
                            <div className="relative min-w-[220px] flex-1">
                                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Search by task name, number..."
                                    aria-label="Search tasks"
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
                                />
                            </div>
                            <div className="relative w-[180px] shrink-0">
                                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={requesterQuery}
                                    onChange={(event) => {
                                        setRequesterQuery(event.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Requester"
                                    aria-label="Search requester"
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
                                />
                            </div>
                            <div className="relative w-[180px] shrink-0">
                                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={assigneeQuery}
                                    onChange={(event) => {
                                        setAssigneeQuery(event.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Assignee"
                                    aria-label="Search assignee"
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
                                />
                            </div>
                            <select
                                value={scope}
                                onChange={(event) => {
                                    setScope(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="My tasks or all tasks"
                                className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700"
                            >
                                {SCOPES.map((item) => (
                                    <option key={item}>{item}</option>
                                ))}
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(event) => {
                                    setTypeFilter(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="Task type"
                                className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700"
                            >
                                {TYPE_FILTERS.map((item) => (
                                    <option key={item}>{item}</option>
                                ))}
                            </select>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(event) => {
                                    setFromDate(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="From date"
                                className="h-9 shrink-0 rounded-lg border border-slate-200 px-2 text-[13px] text-slate-600"
                            />
                            <input
                                type="date"
                                value={toDate}
                                onChange={(event) => {
                                    setToDate(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="To date"
                                className="h-9 shrink-0 rounded-lg border border-slate-200 px-2 text-[13px] text-slate-600"
                            />
                            <select
                                value={status}
                                onChange={(event) => {
                                    setStatus(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="Status"
                                className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-600"
                            >
                                {STATUSES.map((item) => (
                                    <option key={item}>{item}</option>
                                ))}
                            </select>
                            <select
                                value={pageSizeChoice}
                                onChange={(event) => {
                                    setPageSizeChoice(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="Tasks per page"
                                className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-600"
                            >
                                {PAGE_SIZE_OPTIONS.map((item) => (
                                    <option key={item.id} value={item.id}>{item.label} / page</option>
                                ))}
                            </select>
                            <select
                                value={priority}
                                onChange={(event) => {
                                    setPriority(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="Priority"
                                className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-600"
                            >
                                {PRIORITIES.map((item) => (
                                    <option key={item}>{item}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="h-9 shrink-0 px-2 text-[13px] font-semibold text-[#2563EB]"
                            >
                                Reset
                            </button>
                        </div>

                        {error && (
                            <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="min-w-[1100px] w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[12px] font-semibold text-slate-400">
                                        <th className="w-10 px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={allPageSelected}
                                                onChange={toggleAllPage}
                                                aria-label="Select tasks on this page"
                                            />
                                        </th>
                                        <th className="px-3 py-3">Task #</th>
                                        <th className="px-3 py-3">Request Date</th>
                                        <th className="px-3 py-3">Task Type</th>
                                        <th className="px-3 py-3">Task Name</th>
                                        <th className="px-3 py-3">Requester</th>
                                        <th className="px-3 py-3">Assignee</th>
                                        <th className="px-3 py-3">Priority</th>
                                        <th className="px-3 py-3">Completion Date</th>
                                        <th className="px-3 py-3">Status</th>
                                        <th className="px-3 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && (
                                        <tr>
                                            <td colSpan={11} className="px-4 py-16 text-center text-sm text-slate-500">
                                                Loading notifications...
                                            </td>
                                        </tr>
                                    )}
                                    {!loading && pageRows.length === 0 && (
                                        <tr>
                                            <td colSpan={11} className="px-4 py-16 text-center text-sm text-slate-500">
                                                No notifications match these filters.
                                            </td>
                                        </tr>
                                    )}
                                    {!loading &&
                                        pageRows.map((task) => {
                                            const title = titles.get(task.actionId) || task.taskName || 'Notification';
                                            return (
                                                <tr
                                                    key={task.actionId}
                                                    onClick={(event) => {
                                                        if (event.target.closest('button, input, a, label')) return;
                                                        openDetails(task);
                                                    }}
                                                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/70"
                                                >
                                                    <td className="px-4 py-3.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={selected.has(task.actionId)}
                                                            onChange={() => toggleOne(task.actionId)}
                                                            aria-label={`Select ${task.taskNumber}`}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3.5 text-[13px] font-semibold text-slate-700">
                                                        {task.taskNumber}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">
                                                        {formatDisplayDate(task.requestDate) || '—'}
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${TYPE_STYLE[displayTaskType(task.taskCategory)] || TYPE_STYLE[task.taskCategory] || 'bg-slate-100 text-slate-600'}`}>
                                                            {displayTaskType(task.taskCategory)}
                                                        </span>
                                                    </td>
                                                    <td className="max-w-[280px] px-3 py-3.5">
                                                        <p className="line-clamp-2 text-[13px] font-medium text-slate-800" title={`${task.requestType}: ${title}`}>
                                                            {title}
                                                        </p>
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <PersonCell name={task.requesterName} photo={task.requesterPhoto} />
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <PersonCell
                                                            name={task.assigneeName}
                                                            photo={task.assigneePhoto}
                                                            hint={task.assigneeEmpId ? `${task.assigneeName} (${task.assigneeEmpId})` : task.assigneeName}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${PRIORITY_STYLE[task.priority] || ''}`}>
                                                            {task.priority}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">
                                                        {formatDisplayDate(task.completionDate) || '—'}
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLE[listStatus(task)] || 'bg-slate-100 text-slate-600'}`}>
                                                            {listStatus(task)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-right">
                                                        <button
                                                            type="button"
                                                            aria-label={`Actions for ${task.taskNumber}`}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                const rect = event.currentTarget.getBoundingClientRect();
                                                                setOpenMenu((current) => (
                                                                    current?.id === task.actionId
                                                                        ? null
                                                                        : { id: task.actionId, top: rect.bottom + 4, left: rect.right - 168 }
                                                                ));
                                                            }}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                                        >
                                                            <MoreHorizontal size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] text-slate-500">
                            <p>
                                Showing {filtered.length === 0 ? 0 : start + 1} to {Math.min(start + pageSize, filtered.length)} of {filtered.length} tasks
                            </p>
                            <div className="flex items-center gap-1">
                                {pageList(safePage, pageCount).map((item, index) =>
                                    item === '…' ? (
                                        <span key={`gap-${index}`} className="px-1.5 text-slate-400">
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => setPage(item)}
                                            className={`h-8 min-w-8 rounded-lg px-2 text-[13px] font-semibold ${
                                                item === safePage
                                                    ? 'bg-[#2563EB] text-white'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {item}
                                        </button>
                                    ),
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <CreateTaskModal
                open={createOpen || Boolean(editTask)}
                initialTask={editTask}
                onClose={() => {
                    setCreateOpen(false);
                    setEditTask(null);
                }}
                onCreated={(created) => {
                    if (!editTask) {
                        setScope('My Tasks');
                        setTypeFilter(displayTaskType(created?.taskType || created?.taskCategory) || 'All Types');
                        setQuery('');
                        setRequesterQuery('');
                        setAssigneeQuery('');
                        setFromDate('');
                        setToDate('');
                        setStatus('All Status');
                        setPriority(created?.priority || 'All Priority');
                    }
                    setPage(1);
                    load();
                }}
            />
            {openMenu && (
                <div
                    className="fixed z-50 w-40 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
                    style={{ top: openMenu.top, left: Math.max(8, openMenu.left) }}
                    onClick={(event) => event.stopPropagation()}
                >
                    {[
                        { id: 'delete', label: 'Delete' },
                        { id: 'edit', label: 'Edit' },
                        { id: 'reassign', label: 'Reassign' },
                        { id: 'workflow', label: 'Workflow' },
                    ].map((item) => {
                        const task = tasks.find((row) => row.actionId === openMenu.id);
                        const disabled = (item.id === 'reassign' && task && !task.canReassign)
                            || (item.id === 'delete' && task && !task.canDelete);
                        return (
                            <button
                                key={item.id}
                                type="button"
                                disabled={disabled}
                                title={disabled ? (item.id === 'delete' ? 'Only the task creator or an admin super user can delete' : 'Only the current assignee or admin super user can reassign') : undefined}
                                onClick={() => {
                                    setOpenMenu(null);
                                    if (!task) return;
                                    if (item.id === 'delete') {
                                        if (!task.canDelete) return;
                                        setDeleteTask(task);
                                    } else if (item.id === 'edit') {
                                        setEditTask(task);
                                    } else if (item.id === 'reassign') {
                                        setReassignTask(task);
                                    } else {
                                        openDetails(task, 'workflow');
                                    }
                                }}
                                className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${
                                    item.id === 'delete' ? 'text-rose-600' : 'text-slate-700'
                                }`}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {deleteTask && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
                        <h2 className="text-base font-semibold text-slate-800">Delete task</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Delete {deleteTask.taskNumber ? `${deleteTask.taskNumber} — ` : ''}{deleteTask.taskName}? It will also leave the assignee’s page.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setDeleteTask(null)}
                                className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={async () => {
                                    setDeleting(true);
                                    try {
                                        await axiosInstance.delete(
                                            `/Employee/task-manager/tasks/${encodeURIComponent(deleteTask.actionId)}`,
                                            { skipToast: true },
                                        );
                                        toast({ title: 'Task deleted', description: deleteTask.taskName });
                                        setDeleteTask(null);
                                        load();
                                    } catch (err) {
                                        toast({
                                            title: 'Could not delete the task',
                                            description: err?.response?.data?.message || 'Try again.',
                                        });
                                    } finally {
                                        setDeleting(false);
                                    }
                                }}
                                className="h-9 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {reassignTask && (
                <ReassignTaskModal
                    task={reassignTask}
                    onClose={() => setReassignTask(null)}
                    onDone={(result) => {
                        setReassignTask(null);
                        toast({ title: 'Task reassigned', description: result?.message || 'The new assignee was updated.' });
                        load();
                    }}
                />
            )}
        </div>
    );
}

export default function TaskManagerPage() {
    return (
        <PermissionGuard moduleId="hrm" permissionType="view">
            <TaskManagerContent />
        </PermissionGuard>
    );
}
