'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    FileText,
    MoreHorizontal,
    Plus,
    Search,
} from 'lucide-react';
import CreateTaskModal from '@/app/task-manager/CreateTaskModal';
import ReassignTaskModal from '@/app/task-manager/ReassignTaskModal';
import ListTableRowLink from '@/components/ListTableRowLink';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { formatCommandCenterNotificationMessage } from '@/utils/dashboardCommandCenterInbox';
import { taskNameLines } from '@/app/task-manager/taskNameLines';
import { toNextImageProfileSrc } from '@/utils/employeeProfileImage';
import { basePersonName, personKey, requesterEmployeeName, taskRolePeople } from '@/app/task-manager/taskRolePeople';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { buildListReturnHref, navigateFromList } from '@/utils/listReturnNavigation';
import { clearPendingInboxCache } from '@/utils/pendingInboxFetch';

const PAGE_SIZE_OPTIONS = [
    { id: '10', label: '10' },
    { id: '50', label: '50' },
    { id: '100', label: '100' },
    { id: 'all', label: 'All' },
];
const SCOPES = ['My Task', 'All Task'];
const DATE_RANGES = [
    { id: 'all', label: 'All Days' },
    { id: 'today', label: 'Today' },
    { id: 'prevDay', label: 'Prev Day' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'prevMonth', label: 'Prev Month' },
    { id: 'thisYear', label: 'This Year' },
    { id: 'prevYear', label: 'Prev Year' },
    { id: 'custom', label: 'Custom' },
];
const TYPE_FILTERS = ['All Types', 'System Task', 'Workflow Task', 'General Task'];
const STATUSES = [
    { value: 'All Status', label: 'All Status' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Overdue', label: 'Overdue' },
    { value: 'Completed', label: 'Completed / Closed' },
    { value: 'Cancelled', label: 'Cancelled' },
];
const PRIORITIES = ['All Priority', 'High', 'Medium', 'Low'];

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#0EA5E9', '#EC4899'];

const STATUS_STYLE = {
    Pending: 'bg-rose-50 text-rose-600',
    Open: 'bg-sky-50 text-sky-700',
    'Pending Review': 'bg-amber-50 text-amber-700',
    'Pending Due': 'bg-red-50 text-red-600',
    Overdue: 'bg-red-50 text-red-600',
    'In Progress': 'bg-sky-50 text-sky-700',
    Completed: 'bg-emerald-50 text-emerald-600',
    Closed: 'bg-emerald-50 text-emerald-700',
    Reopened: 'bg-sky-50 text-sky-700',
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
    if (status === 'Pending Due' || status === 'Overdue') return 'Overdue';
    if (status === 'Pending' || status === 'In Progress' || status === 'On Hold') return 'Pending';
    if (status === 'Rejected' || status === 'Dismissed') return 'Cancelled';
    return status || 'Pending';
}

function isOpenPending(shown) {
    return shown === 'Pending' || shown === 'Overdue' || shown === 'Open' || shown === 'Pending Review' || shown === 'Reopened';
}

function paramValue(params, key, fallback = '') {
    const value = params.get(key);
    if (value == null || value === 'null' || value === 'undefined') return fallback;
    return value;
}

function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}

function statusValue(value) {
    return STATUSES.some((item) => item.value === value) ? value : 'Pending';
}

function readTaskListFilters(params) {
    const page = parseInt(paramValue(params, 'page', '1'), 10);
    const size = paramValue(params, 'size', '10');
    return {
        scope: oneOf(paramValue(params, 'scope', 'My Task'), SCOPES, 'My Task'),
        typeFilter: oneOf(paramValue(params, 'type', 'All Types'), TYPE_FILTERS, 'All Types'),
        query: paramValue(params, 'q'),
        requesterQuery: personKey(paramValue(params, 'requester')),
        assigneeQuery: personKey(paramValue(params, 'assignee')),
        datePreset: oneOf(paramValue(params, 'date', 'all'), DATE_RANGES.map((item) => item.id), 'all'),
        fromDate: paramValue(params, 'from'),
        toDate: paramValue(params, 'to'),
        status: statusValue(paramValue(params, 'status', 'Pending')),
        priority: oneOf(paramValue(params, 'priority', 'All Priority'), PRIORITIES, 'All Priority'),
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSizeChoice: oneOf(size, PAGE_SIZE_OPTIONS.map((item) => item.id), '10'),
    };
}

function taskDetailsHref(task, tab) {
    const query = new URLSearchParams();
    if (task?.taskNumber) query.set('no', task.taskNumber);
    if (tab) query.set('tab', tab);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return `/task-manager/${encodeURIComponent(task.actionId)}${suffix}`;
}

function taskIsMine(task, viewer) {
    if (typeof task?.mine === 'boolean') return task.mine;
    return isMyTask(task, viewer);
}

function viewerNameHits(names, value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return false;
    if (names.includes(raw)) return true;
    const base = basePersonName(value).toLowerCase();
    return Boolean(base && names.includes(base));
}

function isMyTask(task, viewer) {
    if (!viewer) return false;
    const ids = [viewer.employeeObjectId, viewer.empObjectId, viewer._id, viewer.id]
        .map((value) => String(value || ''))
        .filter(Boolean);
    const assigneeIds = [task.assigneeId, task.originalAssigneeId, task.reassignedAssigneeId]
        .map((value) => String(value || ''))
        .filter(Boolean);
    if (assigneeIds.some((id) => ids.includes(id))) return true;
    const codes = [viewer.employeeId, viewer.empId]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
    const assigneeCodes = [task.assigneeEmpId, task.originalAssigneeEmpId]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
    if (assigneeCodes.some((code) => codes.includes(code))) return true;
    const names = [viewer.name, viewer.username]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
    if ([task.assigneeName, task.mainAssigneeName, task.originalAssigneeName, task.reassignedAssigneeName]
        .some((value) => viewerNameHits(names, value))) return true;
    if (task.reassignedAssigneeName) return false;
    const assignee = String(task.assigneeName || '').trim().toLowerCase();
    const paren = assignee.match(/\(([^)]+)\)\s*$/);
    if (!paren) return false;
    const lead = assignee.slice(0, assignee.lastIndexOf('(')).trim();
    const inside = paren[1].trim();
    if (names.includes(lead) || names.includes(inside)) return true;
    const requester = String(task.requesterBaseName || task.requesterName || '').trim().toLowerCase();
    return Boolean(requester && names.includes(requester));
}

function addDays(key, days) {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function monthBounds(year, month) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, '0');
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

function resolveDateRange(preset, customFrom, customTo) {
    if (preset === 'custom') return { from: customFrom || '', to: customTo || '' };
    if (preset === 'all') return { from: '', to: '' };
    const today = dateKey(new Date());
    if (!today) return { from: '', to: '' };
    const [year, month] = today.split('-').map(Number);
    if (preset === 'today') return { from: today, to: today };
    if (preset === 'prevDay') {
        const prev = addDays(today, -1);
        return { from: prev, to: prev };
    }
    if (preset === 'thisMonth') return monthBounds(year, month);
    if (preset === 'prevMonth') {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        return monthBounds(prevYear, prevMonth);
    }
    if (preset === 'thisYear') return { from: `${year}-01-01`, to: `${year}-12-31` };
    if (preset === 'prevYear') return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    return { from: '', to: '' };
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

const PRIORITY_SORT_RANK = { Low: 0, Medium: 1, High: 2 };

function taskSequence(task) {
    const parts = String(task?.taskNumber || '').match(/\d+/g);
    if (!parts?.length) return 0;
    const year = Number(parts.length > 1 ? parts[parts.length - 2] : 0) || 0;
    const sequence = Number(parts[parts.length - 1]) || 0;
    return year * 1000000 + sequence;
}

function timeValue(value) {
    const time = new Date(value || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
}

/** Reassigned tasks use the latest reassign date. Every other task uses the assign date. */
function listActivityDate(task) {
    if (String(task?.reassignedAssigneeName || '').trim() && task?.reassignedAt) return task.reassignedAt;
    return task?.requestDate;
}

function taskSortValue(task, key, titles) {
    if (key === 'taskNumber') {
        const sequence = taskSequence(task);
        return sequence || null;
    }
    if (key === 'requestDate') {
        const time = timeValue(listActivityDate(task));
        return time || null;
    }
    if (key === 'completionDate') {
        const time = timeValue(task?.completionDate);
        return time || null;
    }
    if (key === 'priority') {
        return Object.prototype.hasOwnProperty.call(PRIORITY_SORT_RANK, task?.priority)
            ? PRIORITY_SORT_RANK[task.priority]
            : null;
    }
    if (key === 'type') return displayTaskType(task?.taskCategory) || null;
    if (key === 'name') return titles.get(task.actionId) || task?.taskName || null;
    if (key === 'requester') return task?.requesterName || null;
    if (key === 'assignee') return task?.mainAssigneeName || task?.assigneeName || null;
    if (key === 'status') return listStatus(task) || null;
    return null;
}

function compareSortValues(left, right) {
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, { sensitivity: 'base', numeric: true });
}

function latestTaskFirst(left, right) {
    const timeGap = timeValue(listActivityDate(right)) - timeValue(listActivityDate(left));
    if (timeGap) return timeGap;
    return taskSequence(right) - taskSequence(left);
}

function sortTaskRows(rows, sortKey, sortDirection, titles) {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
        const leftValue = taskSortValue(left, sortKey, titles);
        const rightValue = taskSortValue(right, sortKey, titles);
        if (leftValue == null && rightValue == null) return latestTaskFirst(left, right);
        if (leftValue == null) return 1;
        if (rightValue == null) return -1;
        const gap = compareSortValues(leftValue, rightValue);
        if (gap) return gap * direction;
        return latestTaskFirst(left, right);
    });
}

function ColumnSortArrows({ label, columnKey, sortKey, sortDirection, onSort }) {
    const upOn = sortKey === columnKey && sortDirection === 'asc';
    const downOn = sortKey === columnKey && sortDirection === 'desc';
    const buttonClass = (on) =>
        `flex h-3.5 w-3.5 items-center justify-center rounded-sm leading-none ${on ? 'text-[#2563EB]' : 'text-slate-300 hover:text-slate-500'}`;
    return (
        <span className="inline-flex shrink-0 flex-col">
            <button
                type="button"
                className={buttonClass(upOn)}
                aria-label={`Sort ${label} ascending`}
                aria-pressed={upOn}
                title={`Sort ${label} ascending`}
                onClick={() => onSort(columnKey, 'asc')}
            >
                <ChevronUp size={12} strokeWidth={2.75} />
            </button>
            <button
                type="button"
                className={buttonClass(downOn)}
                aria-label={`Sort ${label} descending`}
                aria-pressed={downOn}
                title={`Sort ${label} descending`}
                onClick={() => onSort(columnKey, 'desc')}
            >
                <ChevronDown size={12} strokeWidth={2.75} />
            </button>
        </span>
    );
}

function SortableTh({ label, columnKey, sortKey, sortDirection, onSort, className = '' }) {
    const active = sortKey === columnKey;
    return (
        <th
            className={className}
            aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <div className="flex items-center gap-0.5 whitespace-nowrap">
                <span>{label}</span>
                <ColumnSortArrows
                    label={label}
                    columnKey={columnKey}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                />
            </div>
        </th>
    );
}

function notificationTitle(task) {
    if (task?.manual) return task.taskName || task.requestType || 'Task';
    const specific = String(task?.taskName || '').trim();
    const type = String(task?.requestType || '').trim();
    if (specific && specific.toLowerCase() !== type.toLowerCase()) return specific;
    try {
        const formatted = formatCommandCenterNotificationMessage(task);
        const title = String(formatted?.title || '').trim();
        if (title && title.toLowerCase() !== type.toLowerCase()) return title;
    } catch {
        /* Stored notification text is the fallback. */
    }
    return specific || type || 'Notification';
}

function TaskNameList({ task, title }) {
    const lines = taskNameLines(task, title);
    return (
        <div title={lines.join('\n')}>
            <p className="text-[13px] font-semibold leading-5 text-slate-800 break-words">{lines[0]}</p>
            {lines.slice(1).map((line) => (
                <p key={line} className="text-[12px] leading-4 text-slate-500 break-words">{line}</p>
            ))}
        </div>
    );
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

function AssigneeCell({ task }) {
    const reassignedName = String(task.reassignedAssigneeName || '').trim();
    const mainName = task.mainAssigneeName || task.assigneeName;
    const mainPhoto = reassignedName ? task.mainAssigneePhoto : (task.mainAssigneePhoto || task.assigneePhoto);
    const mainHint = reassignedName
        ? mainName
        : (task.assigneeEmpId ? `${mainName} (${task.assigneeEmpId})` : mainName);
    return (
        <div className="min-w-[190px]">
            <PersonCell name={mainName} photo={mainPhoto} hint={mainHint} />
            {reassignedName ? (
                <div className="mt-1.5 ml-4 border-l border-slate-200 pl-2">
                    <p className="text-[11px] font-medium leading-4 text-slate-400">Reassigned</p>
                    <PersonCell name={reassignedName} photo={task.reassignedAssigneePhoto} hint={`Reassigned: ${reassignedName}`} />
                </div>
            ) : null}
        </div>
    );
}

function PersonCell({ name, photo, hint }) {
    const [failed, setFailed] = useState(false);
    const label = name || '—';
    const src = toNextImageProfileSrc(photo);
    return (
        <div className="flex items-center gap-2.5 min-w-0" title={hint || label}>
            {src && !failed ? (
                <img
                    src={src}
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

function percentChange(current, previous) {
    if (!previous && !current) return 0;
    if (!previous) return 100;
    return Math.round(((current - previous) / previous) * 100);
}

function shiftMonthKey(monthKey, delta) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return '';
    const cursor = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
}

function taskMatchesListFilters(task, options) {
    const {
        titles,
        viewer,
        scope,
        typeFilter,
        query,
        requesterQuery,
        assigneeQuery,
        activeRange,
        status,
        priority,
        includeStatus,
    } = options;
    const shown = listStatus(task);
    if (scope === 'My Task' && !taskIsMine(task, viewer)) return false;
    if (typeFilter !== 'All Types' && displayTaskType(task.taskCategory) !== typeFilter) return false;
    const finished = shown === 'Completed' || shown === 'Closed';
    if (finished && status !== 'Completed') return false;
    if (includeStatus && !finished) {
        if (status === 'Pending' && !isOpenPending(shown)) return false;
        if (status !== 'All Status' && status !== 'Pending' && shown !== status) return false;
    }
    if (priority !== 'All Priority' && task.priority !== priority) return false;
    const key = dateKey(listActivityDate(task));
    if ((activeRange.from || activeRange.to) && !key) return false;
    if (activeRange.from && key < activeRange.from) return false;
    if (activeRange.to && key > activeRange.to) return false;
    const requesterNeedle = personKey(requesterQuery);
    if (requesterNeedle && personKey(requesterEmployeeName(task)) !== requesterNeedle) return false;
    const assigneeNeedle = personKey(assigneeQuery);
    if (assigneeNeedle) {
        const names = [
            task.assigneeName,
            task.assigneeEmpId,
            task.originalAssigneeName,
            task.mainAssigneeName,
            task.reassignedAssigneeName,
        ]
            .map((value) => personKey(basePersonName(value)))
            .filter(Boolean);
        if (!names.includes(assigneeNeedle)) return false;
    }
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return true;
    const title = (titles.get(task.actionId) || task.taskName || '').toLowerCase();
    return [
        task.taskNumber,
        title,
        task.taskName,
        task.taskSubject,
        task.requestType,
        displayTaskType(task.taskCategory),
        shown,
        task.priority,
        task.description,
    ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
}

function summarizeTasks(list) {
    const thisMonth = dateKey(new Date()).slice(0, 7);
    const lastMonth = shiftMonthKey(thisMonth, -1);
    const next = {
        total: list.length,
        pending: 0,
        pendingDue: 0,
        completed: 0,
        totalChange: 0,
        pendingChange: 0,
        pendingDueChange: 0,
        completedChange: 0,
    };
    const months = {
        total: { current: 0, previous: 0 },
        pending: { current: 0, previous: 0 },
        pendingDue: { current: 0, previous: 0 },
        completed: { current: 0, previous: 0 },
    };
    const bump = (bucket, month) => {
        if (month === thisMonth) months[bucket].current += 1;
        else if (month === lastMonth) months[bucket].previous += 1;
    };
    list.forEach((task) => {
        const shown = listStatus(task);
        const requestedMonth = dateKey(task.requestDate).slice(0, 7);
        bump('total', requestedMonth);
        if (isOpenPending(shown)) {
            next.pending += 1;
            bump('pending', requestedMonth);
            if (shown === 'Overdue') {
                next.pendingDue += 1;
                bump('pendingDue', requestedMonth);
            }
        } else if (shown === 'Completed' || shown === 'Closed') {
            next.completed += 1;
            bump('completed', dateKey(task.completionDate || task.requestDate).slice(0, 7));
        }
    });
    next.totalChange = percentChange(months.total.current, months.total.previous);
    next.pendingChange = percentChange(months.pending.current, months.pending.previous);
    next.pendingDueChange = percentChange(months.pendingDue.current, months.pendingDue.previous);
    next.completedChange = percentChange(months.completed.current, months.completed.previous);
    return next;
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

function StatCard({ label, value, change, goodWhenUp, icon: Icon, wrap, bubble, figure, onClick }) {
    return (
        <button type="button" onClick={onClick} className={`w-full rounded-2xl px-5 py-4 text-left ${wrap}`}>
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
        </button>
    );
}

function PersonFilter({ value, people, onChange, emptyLabel, searchPlaceholder, ariaLabel }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [menuPos, setMenuPos] = useState(null);
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const searchRef = useRef(null);
    const selected = people.find((person) => person.key === value);
    const selectedLabel = selected?.name || (value ? value.replace(/\b[a-z]/g, (char) => char.toUpperCase()) : '');
    const needle = search.trim().toLowerCase();
    const shown = needle
        ? people.filter((person) => person.name.toLowerCase().includes(needle))
        : people;

    const placeMenu = useCallback(() => {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.max(rect.width, 260);
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
        setMenuPos({ top: rect.bottom + 4, left, width });
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const frame = requestAnimationFrame(() => searchRef.current?.focus());
        const onPointer = (event) => {
            const target = event.target;
            if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        window.addEventListener('mousedown', onPointer);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', placeMenu);
        window.addEventListener('scroll', placeMenu, true);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('mousedown', onPointer);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', placeMenu);
            window.removeEventListener('scroll', placeMenu, true);
        };
    }, [open, placeMenu]);

    const choose = (key) => {
        onChange(key);
        setSearch('');
        setOpen(false);
    };

    return (
        <div className="relative w-[190px] shrink-0" ref={rootRef}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                title={selectedLabel || emptyLabel}
                onClick={() => {
                    if (open) {
                        setOpen(false);
                        return;
                    }
                    setSearch('');
                    placeMenu();
                    setOpen(true);
                }}
                className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left text-[13px] text-slate-700"
            >
                <span className={`truncate ${selectedLabel ? 'text-slate-700' : 'text-slate-400'}`}>
                    {selectedLabel || emptyLabel}
                </span>
                <ChevronDown size={14} className="shrink-0 text-slate-400" />
            </button>
            {open && menuPos && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 80 }}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                >
                    <div className="border-b border-slate-100 p-2">
                        <div className="relative">
                            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                ref={searchRef}
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
                                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
                            />
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1" role="listbox">
                        <button
                            type="button"
                            onClick={() => choose('')}
                            className={`block w-full px-3 py-1.5 text-left text-[13px] hover:bg-slate-50 ${value ? 'text-slate-600' : 'bg-slate-100 font-medium text-slate-800'}`}
                        >
                            {emptyLabel}
                        </button>
                        {shown.map((person) => (
                            <button
                                key={person.key}
                                type="button"
                                onClick={() => choose(person.key)}
                                title={person.name}
                                className={`block w-full truncate px-3 py-1.5 text-left text-[13px] hover:bg-slate-50 ${person.key === value ? 'bg-slate-100 font-medium text-slate-800' : 'text-slate-700'}`}
                            >
                                {person.name}
                            </button>
                        ))}
                        {!shown.length && (
                            <p className="px-3 py-2 text-[13px] text-slate-400">No matches</p>
                        )}
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

function TaskManagerContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlKey = searchParams.toString();
    const filtersFromUrl = useMemo(() => readTaskListFilters(searchParams), [searchParams]);
    const urlKeyRef = useRef(urlKey);
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tasks, setTasks] = useState([]);
    const [viewer, setViewer] = useState(null);
    const [scope, setScope] = useState(filtersFromUrl.scope);
    const [typeFilter, setTypeFilter] = useState(filtersFromUrl.typeFilter);
    const [query, setQuery] = useState(filtersFromUrl.query);
    const [requesterQuery, setRequesterQuery] = useState(filtersFromUrl.requesterQuery);
    const [assigneeQuery, setAssigneeQuery] = useState(filtersFromUrl.assigneeQuery);
    const [datePreset, setDatePreset] = useState(filtersFromUrl.datePreset);
    const [fromDate, setFromDate] = useState(filtersFromUrl.fromDate);
    const [toDate, setToDate] = useState(filtersFromUrl.toDate);
    const [customOpen, setCustomOpen] = useState(false);
    const [status, setStatus] = useState(filtersFromUrl.status);
    const [priority, setPriority] = useState(filtersFromUrl.priority);
    const [pageSizeChoice, setPageSizeChoice] = useState(filtersFromUrl.pageSizeChoice);
    const [page, setPage] = useState(filtersFromUrl.page);
    const [sortKey, setSortKey] = useState('requestDate');
    const [sortDirection, setSortDirection] = useState('desc');
    const [selected, setSelected] = useState(() => new Set());
    const [openMenu, setOpenMenu] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [reassignTask, setReassignTask] = useState(null);
    const [deleteTask, setDeleteTask] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const customRef = useRef(null);

    if (urlKeyRef.current !== urlKey) {
        urlKeyRef.current = urlKey;
        setScope(filtersFromUrl.scope);
        setTypeFilter(filtersFromUrl.typeFilter);
        setQuery(filtersFromUrl.query);
        setRequesterQuery(filtersFromUrl.requesterQuery);
        setAssigneeQuery(filtersFromUrl.assigneeQuery);
        setDatePreset(filtersFromUrl.datePreset);
        setFromDate(filtersFromUrl.fromDate);
        setToDate(filtersFromUrl.toDate);
        setStatus(filtersFromUrl.status);
        setPriority(filtersFromUrl.priority);
        setPageSizeChoice(filtersFromUrl.pageSizeChoice);
        setPage(filtersFromUrl.page);
    }

    const listReturnParams = useMemo(() => ({
        ...(scope !== 'My Task' ? { scope } : {}),
        ...(typeFilter !== 'All Types' ? { type: typeFilter } : {}),
        ...(query ? { q: query } : {}),
        employee: '',
        ...(requesterQuery ? { requester: requesterQuery } : {}),
        ...(assigneeQuery ? { assignee: assigneeQuery } : {}),
        ...(datePreset !== 'all' ? { date: datePreset } : {}),
        ...(fromDate ? { from: fromDate } : {}),
        ...(toDate ? { to: toDate } : {}),
        ...(status !== 'Pending' ? { status } : {}),
        ...(priority !== 'All Priority' ? { priority } : {}),
        ...(page > 1 ? { page } : {}),
        ...(pageSizeChoice !== '10' ? { size: pageSizeChoice } : {}),
    }), [
        scope,
        typeFilter,
        query,
        requesterQuery,
        assigneeQuery,
        datePreset,
        fromDate,
        toDate,
        status,
        priority,
        page,
        pageSizeChoice,
    ]);

    usePersistListReturnState(listReturnParams);

    useEffect(() => {
        const apply = (params) => {
            const next = readTaskListFilters(params);
            setScope(next.scope);
            setTypeFilter(next.typeFilter);
            setQuery(next.query);
            setRequesterQuery(next.requesterQuery);
            setAssigneeQuery(next.assigneeQuery);
            setDatePreset(next.datePreset);
            setFromDate(next.fromDate);
            setToDate(next.toDate);
            setStatus(next.status);
            setPriority(next.priority);
            setPageSizeChoice(next.pageSizeChoice);
            setPage(next.page);
        };
        const syncFromAddressBar = () => {
            if (window.location.pathname !== '/task-manager') return;
            apply(new URLSearchParams(window.location.search));
        };
        window.addEventListener('popstate', syncFromAddressBar);
        return () => window.removeEventListener('popstate', syncFromAddressBar);
    }, []);

    const load = useCallback(async () => {
        setError('');
        try {
            const res = await axiosInstance.get('/Employee/task-manager/notifications', { skipToast: true });
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
        if (!customOpen) return undefined;
        const close = (event) => {
            if (customRef.current && !customRef.current.contains(event.target)) setCustomOpen(false);
        };
        window.addEventListener('mousedown', close);
        return () => window.removeEventListener('mousedown', close);
    }, [customOpen]);

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

    useEffect(() => {
        if (loading) return;
        const count = tasks.filter((task) => taskIsMine(task, viewer) && isOpenPending(listStatus(task))).length;
        window.dispatchEvent(new CustomEvent('task-manager-assignee-count', { detail: { count } }));
    }, [tasks, viewer, loading]);

    const activeRange = useMemo(
        () => resolveDateRange(datePreset, fromDate, toDate),
        [datePreset, fromDate, toDate],
    );

    const listFilter = useMemo(() => ({
        titles,
        viewer,
        scope,
        typeFilter,
        query,
        requesterQuery,
        assigneeQuery,
        activeRange,
        status,
        priority,
    }), [
        titles,
        viewer,
        scope,
        typeFilter,
        query,
        requesterQuery,
        assigneeQuery,
        activeRange,
        status,
        priority,
    ]);

    const requesters = useMemo(
        () => taskRolePeople(
            tasks.filter((task) => taskMatchesListFilters(task, { ...listFilter, requesterQuery: '', includeStatus: true })),
            'requester',
            notificationTitle,
        ),
        [tasks, listFilter],
    );
    const assignees = useMemo(
        () => taskRolePeople(
            tasks.filter((task) => taskMatchesListFilters(task, { ...listFilter, assigneeQuery: '', includeStatus: true })),
            'assignee',
            notificationTitle,
        ),
        [tasks, listFilter],
    );

    const cardTasks = useMemo(
        () => tasks.filter((task) => taskMatchesListFilters(task, { ...listFilter, includeStatus: false })),
        [tasks, listFilter],
    );

    const cardSummary = useMemo(() => summarizeTasks(cardTasks), [cardTasks]);

    const filtered = useMemo(
        () => tasks.filter((task) => taskMatchesListFilters(task, { ...listFilter, includeStatus: true })),
        [tasks, listFilter],
    );
    const sorted = useMemo(
        () => sortTaskRows(filtered, sortKey, sortDirection, titles),
        [filtered, sortKey, sortDirection, titles],
    );

    const pageSize = pageSizeChoice === 'all' ? Math.max(sorted.length, 1) : Number(pageSizeChoice);
    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const start = sorted.length === 0 ? 0 : (safePage - 1) * pageSize;
    const pageRows = sorted.slice(start, start + pageSize);

    const listReturnHref = buildListReturnHref('/task-manager', listReturnParams);

    const openDetails = (task, tab) => {
        navigateFromList(router, taskDetailsHref(task, tab), listReturnHref);
    };
    const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selected.has(row.actionId));

    useEffect(() => {
        if (loading) return;
        if (page > pageCount) setPage(pageCount);
    }, [loading, page, pageCount]);

    const resetFilters = () => {
        setScope('My Task');
        setTypeFilter('All Types');
        setPageSizeChoice('10');
        setQuery('');
        setRequesterQuery('');
        setAssigneeQuery('');
        setDatePreset('all');
        setFromDate('');
        setToDate('');
        setCustomOpen(false);
        setStatus('Pending');
        setPriority('All Priority');
        setSortKey('requestDate');
        setSortDirection('desc');
        setPage(1);
    };

    const sortBy = (columnKey, direction) => {
        setSortKey(columnKey);
        setSortDirection(direction === 'asc' ? 'asc' : 'desc');
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
                            value={cardSummary.total}
                            change={cardSummary.totalChange}
                            goodWhenUp
                            icon={FileText}
                            wrap="bg-[#EAF3FF]"
                            bubble="bg-[#3B82F6] text-white"
                            figure="text-[#2563EB]"
                            onClick={() => {
                                setStatus('All Status');
                                setPage(1);
                            }}
                        />
                        <StatCard
                            label="Pending Tasks"
                            value={cardSummary.pending}
                            change={cardSummary.pendingChange}
                            goodWhenUp={false}
                            icon={Clock}
                            wrap="bg-[#FDECEC]"
                            bubble="bg-[#EF4444] text-white"
                            figure="text-[#EF4444]"
                            onClick={() => {
                                setStatus('Pending');
                                setPage(1);
                            }}
                        />
                        <StatCard
                            label="Pending Due"
                            value={cardSummary.pendingDue}
                            change={cardSummary.pendingDueChange}
                            goodWhenUp={false}
                            icon={AlertTriangle}
                            wrap="bg-[#FFF6E8]"
                            bubble="bg-[#F59E0B] text-white"
                            figure="text-[#D97706]"
                            onClick={() => {
                                setStatus('Overdue');
                                setPage(1);
                            }}
                        />
                        <StatCard
                            label="Completed Tasks"
                            value={cardSummary.completed}
                            change={cardSummary.completedChange}
                            goodWhenUp
                            icon={CheckCircle2}
                            wrap="bg-[#E8F8EF]"
                            bubble="bg-[#22C55E] text-white"
                            figure="text-[#16A34A]"
                            onClick={() => {
                                setStatus('Completed');
                                setPage(1);
                            }}
                        />
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
                            <div className="relative w-[220px] shrink-0">
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
                            <PersonFilter
                                value={requesterQuery}
                                people={requesters}
                                emptyLabel="Requester"
                                searchPlaceholder="Search requester"
                                ariaLabel="Requester"
                                onChange={(next) => {
                                    setRequesterQuery(next);
                                    setPage(1);
                                }}
                            />
                            <PersonFilter
                                value={assigneeQuery}
                                people={assignees}
                                emptyLabel="Assignee"
                                searchPlaceholder="Search assignee"
                                ariaLabel="Assignee"
                                onChange={(next) => {
                                    setAssigneeQuery(next);
                                    setPage(1);
                                }}
                            />
                            <select
                                value={scope}
                                onChange={(event) => {
                                    setScope(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="My task or all tasks"
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
                            <div className="relative shrink-0" ref={customRef}>
                                <select
                                    value={datePreset}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setDatePreset(value);
                                        setPage(1);
                                        if (value === 'custom') {
                                            setCustomOpen(true);
                                        } else {
                                            setCustomOpen(false);
                                        }
                                    }}
                                    onClick={() => {
                                        if (datePreset === 'custom') setCustomOpen(true);
                                    }}
                                    aria-label="Request date"
                                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700"
                                >
                                    {DATE_RANGES.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                </select>
                                {customOpen && (
                                    <div className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                            <Calendar size={13} /> Custom dates
                                        </p>
                                        <label className="block text-[11px] font-medium text-slate-400">
                                            From
                                            <input
                                                type="date"
                                                value={fromDate}
                                                onChange={(event) => setFromDate(event.target.value)}
                                                aria-label="From date"
                                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px] text-slate-700"
                                            />
                                        </label>
                                        <label className="mt-2 block text-[11px] font-medium text-slate-400">
                                            To
                                            <input
                                                type="date"
                                                value={toDate}
                                                onChange={(event) => setToDate(event.target.value)}
                                                aria-label="To date"
                                                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px] text-slate-700"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCustomOpen(false);
                                                setPage(1);
                                            }}
                                            className="mt-3 h-8 w-full rounded-lg bg-[#2563EB] text-[13px] font-semibold text-white"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                )}
                            </div>
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
                                    <option key={item.value} value={item.value}>{item.label}</option>
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
                                        <SortableTh label="Task #" columnKey="taskNumber" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
                                        <SortableTh label="Request Date" columnKey="requestDate" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
                                        <SortableTh label="Task Type" columnKey="type" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
                                        <SortableTh label="Task Name" columnKey="name" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
                                        <SortableTh label="Requester" columnKey="requester" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
                                        <SortableTh label="Assignee" columnKey="assignee" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
                                        <SortableTh label="Priority" columnKey="priority" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
                                        <SortableTh label="Completion Date" columnKey="completionDate" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
                                        <SortableTh label="Status" columnKey="status" sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} className="px-3 py-3" />
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
                                                <ListTableRowLink
                                                    key={task.actionId}
                                                    href={taskDetailsHref(task)}
                                                    router={router}
                                                    listReturnHref={listReturnHref}
                                                >
                                                <tr className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/70">
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
                                                    <td
                                                        className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap"
                                                        title={String(task.reassignedAssigneeName || '').trim() && task.reassignedAt ? 'Reassigned date' : 'Assigned date'}
                                                    >
                                                        {formatDisplayDate(listActivityDate(task)) || '—'}
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${TYPE_STYLE[displayTaskType(task.taskCategory)] || TYPE_STYLE[task.taskCategory] || 'bg-slate-100 text-slate-600'}`}>
                                                            {displayTaskType(task.taskCategory)}
                                                        </span>
                                                    </td>
                                                    <td className="min-w-[200px] max-w-[280px] px-3 py-3.5">
                                                        <TaskNameList task={task} title={title} />
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <PersonCell name={task.requesterName} photo={task.requesterPhoto} />
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <AssigneeCell task={task} />
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
                                                </ListTableRowLink>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] text-slate-500">
                            <div className="flex flex-wrap items-center gap-3">
                                <p>
                                    Showing {sorted.length === 0 ? 0 : start + 1} to {Math.min(start + pageSize, sorted.length)} of {sorted.length} tasks
                                </p>
                                <select
                                    value={pageSizeChoice}
                                    onChange={(event) => {
                                        setPageSizeChoice(event.target.value);
                                        setPage(1);
                                    }}
                                    aria-label="Tasks per page"
                                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-600"
                                >
                                    {PAGE_SIZE_OPTIONS.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label} / page</option>
                                    ))}
                                </select>
                            </div>
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
                        setScope('My Task');
                        setTypeFilter(displayTaskType(created?.taskType || created?.taskCategory) || 'All Types');
                        setQuery('');
                        setRequesterQuery('');
                        setAssigneeQuery('');
                        setDatePreset('all');
                        setFromDate('');
                        setToDate('');
                        setCustomOpen(false);
                        setStatus('Pending');
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
                        { id: 'return', label: 'Return to assignee' },
                        { id: 'delete', label: 'Delete' },
                        { id: 'edit', label: 'Edit' },
                        { id: 'reassign', label: 'Reassign' },
                        { id: 'workflow', label: 'Workflow' },
                    ].map((item) => {
                        const task = tasks.find((row) => row.actionId === openMenu.id);
                        if (item.id === 'return' && !task?.canReturn) return null;
                        const closed = task?.displayStatus === 'Closed';
                        const disabled = closed && (item.id === 'edit' || item.id === 'reassign' || item.id === 'delete')
                            || (item.id === 'reassign' && task && !task.canReassign)
                            || (item.id === 'delete' && task && !task.canDelete);
                        return (
                            <button
                                key={item.id}
                                type="button"
                                disabled={disabled}
                                title={disabled ? (closed ? 'This task is closed' : item.id === 'delete' ? 'Only the task creator or an admin super user can delete' : 'Only the current assignee, the original assignee, or an admin super user can reassign') : undefined}
                                onClick={() => {
                                    setOpenMenu(null);
                                    if (!task) return;
                                    if (item.id === 'delete') {
                                        if (!task.canDelete) return;
                                        setDeleteTask(task);
                                    } else if (item.id === 'edit') {
                                        setEditTask(task);
                                    } else if (item.id === 'return') {
                                        const href = taskDetailsHref(task);
                                        router.push(href.includes('?') ? `${href}&return=1` : `${href}?return=1`);
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
                            Delete {deleteTask.taskNumber ? `${deleteTask.taskNumber} — ` : ''}{deleteTask.taskName}? The task, its notification bells, alerts, and any approval it started are removed. An assignment goes back to Unassigned.
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
                                        clearPendingInboxCache();
                                        if (typeof window !== 'undefined') {
                                            [
                                                'leave-pending-inbox-changed',
                                                'attendance-pending-inbox-changed',
                                                'asset-pending-inbox-changed',
                                                'fine-pending-inbox-changed',
                                                'salary-pending-inbox-changed',
                                                'payment-pending-inbox-changed',
                                                'reward-pending-inbox-changed',
                                                'loan-pending-inbox-changed',
                                            ].forEach((name) => {
                                                const event = new CustomEvent(name);
                                                window.dispatchEvent(event);
                                                document.dispatchEvent(event);
                                            });
                                        }
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
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading...</div>}>
                <TaskManagerContent />
            </Suspense>
        </PermissionGuard>
    );
}
