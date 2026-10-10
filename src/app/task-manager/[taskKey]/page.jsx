'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Building2,
    Calendar,
    Check,
    ChevronLeft,
    Link2,
    Mail,
    MoreHorizontal,
    Pencil,
    RefreshCw,
    UserRound,
} from 'lucide-react';
import CreateTaskModal from '@/app/task-manager/CreateTaskModal';
import ReassignTaskModal from '@/app/task-manager/ReassignTaskModal';
import { WorkflowBoard } from '@/app/task-manager/WorkflowProcessModal';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'workflow', label: 'Workflow' },
    { id: 'updates', label: 'Work Updates' },
    { id: 'email', label: 'Emails' },
    { id: 'attachments', label: 'Attachments' },
    { id: 'history', label: 'History' },
];

const STATUS_STYLE = {
    Pending: 'bg-rose-50 text-rose-600',
    'Pending Due': 'bg-red-50 text-red-600',
    'In Progress': 'bg-sky-50 text-sky-700',
    Completed: 'bg-emerald-50 text-emerald-600',
    Cancelled: 'bg-slate-100 text-slate-500',
    'On Hold': 'bg-amber-50 text-amber-700',
    Rejected: 'bg-slate-100 text-slate-600',
};

const PRIORITY_STYLE = {
    High: 'bg-rose-50 text-rose-600',
    Medium: 'bg-amber-50 text-amber-700',
    Low: 'bg-emerald-50 text-emerald-700',
};

function formatWhen(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Dubai',
    }).format(date);
}

function formatDay(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Dubai',
    }).format(date);
}

function formatClock(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Dubai',
    }).format(date);
}

function Avatar({ name, photo, size = 'h-9 w-9' }) {
    const [failed, setFailed] = useState(false);
    const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    if (photo && !failed) {
        return <img src={photo} alt="" onError={() => setFailed(true)} className={`${size} rounded-full object-cover`} />;
    }
    return <span className={`flex ${size} items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700`}>{initials}</span>;
}

function Toggle({ checked, onChange, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#2563EB]' : 'bg-slate-300'}`}
        >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-5' : 'left-0.5'}`} />
        </button>
    );
}

function EmailChips({ item }) {
    return (
        <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Email notifications sent to</span>
            {item.assigneeName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <Check size={12} /> Assignee ({item.assigneeName})
                </span>
            )}
            {item.requesterName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <Check size={12} /> Requester ({item.requesterName})
                </span>
            )}
            <span className={`ml-auto text-[11px] font-semibold ${item.emailSent ? 'text-emerald-600' : 'text-slate-400'}`}>
                {item.emailSent ? `Email Sent ${formatClock(item.createdAt)}` : 'Not sent'}
            </span>
        </div>
    );
}

function TaskDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const taskKey = decodeURIComponent(String(params?.taskKey || ''));
    const [taskNumber, setTaskNumber] = useState('');
    const [tab, setTab] = useState('overview');
    const [task, setTask] = useState(null);
    const [error, setError] = useState('');
    const [editOpen, setEditOpen] = useState(false);
    const [reassignOpen, setReassignOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [updateText, setUpdateText] = useState('');
    const [people, setPeople] = useState([]);
    const [mentionIds, setMentionIds] = useState([]);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        const res = await axiosInstance.get(`/Employee/task-manager/tasks/${encodeURIComponent(taskKey)}`, { skipToast: true });
        setTask(res.data?.task || null);
    }, [taskKey]);

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        setTaskNumber(query.get('no') || '');
        const requested = query.get('tab');
        if (requested === 'comments') setTab('updates');
        else if (TABS.some((item) => item.id === requested)) setTab(requested);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setError('');
        load().catch((err) => {
            if (!cancelled) setError(err?.response?.data?.message || 'Could not load this task.');
        });
        return () => {
            cancelled = true;
        };
    }, [load]);

    const saveNotifications = async (next) => {
        const previous = task;
        setTask((current) => ({ ...current, notifications: next }));
        try {
            const res = await axiosInstance.patch(
                `/Employee/task-manager/tasks/${encodeURIComponent(taskKey)}/notifications`,
                next,
                { skipToast: true },
            );
            setTask(res.data?.task || previous);
        } catch (err) {
            setTask(previous);
            toast({ title: 'Could not update notifications', description: err?.response?.data?.message || 'Try again.' });
        }
    };

    useEffect(() => {
        if (tab !== 'updates' || people.length) return undefined;
        let cancelled = false;
        axiosInstance.get('/Employee/task-manager/assignees', { skipToast: true })
            .then((res) => {
                if (!cancelled) setPeople(Array.isArray(res.data?.employees) ? res.data.employees : []);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [tab, people.length]);

    const pendingMention = (updateText.match(/(?:^|\s)@([^\n@]*)$/) || [])[1];
    const mentionChoices = pendingMention == null
        ? []
        : people.filter((person) => person.name.toLowerCase().includes(pendingMention.trim().toLowerCase())).slice(0, 8);

    const chooseMention = (person) => {
        setUpdateText((current) => current.replace(/(^|\s)@[^\n@]*$/, `$1@${person.name} `));
        setMentionIds((current) => (current.includes(person.id) ? current : [...current, person.id]));
    };

    const addUpdate = async () => {
        if (!updateText.trim()) return;
        const mentioned = people
            .filter((person) => updateText.toLowerCase().includes(`@${String(person.name || '').toLowerCase()}`))
            .map((person) => person.id);
        const mentions = [...new Set([...mentionIds, ...mentioned])];
        setBusy(true);
        try {
            const res = await axiosInstance.post(
                `/Employee/task-manager/tasks/${encodeURIComponent(taskKey)}/updates`,
                { text: updateText.trim(), mentions },
                { skipToast: true },
            );
            setTask(res.data?.task || null);
            setUpdateText('');
            setMentionIds([]);
            toast({
                title: 'Work update added',
                description: res.data?.task?.notifications?.workUpdate === false
                    ? 'Email notifications are off.'
                    : mentions.length
                        ? 'The mentioned people were emailed with the task link.'
                        : 'The current assignee was emailed with the task link.',
            });
        } catch (err) {
            toast({ title: 'Could not add the update', description: err?.response?.data?.message || 'Try again.' });
        } finally {
            setBusy(false);
        }
    };

    const closeRequest = async (step) => {
        setBusy(true);
        try {
            const res = await axiosInstance.post(
                `/Employee/task-manager/tasks/${encodeURIComponent(taskKey)}/close`,
                { step },
                { skipToast: true },
            );
            setTask(res.data?.task || null);
            setTab('updates');
            toast({
                title: step === 'finish' ? 'Request closed' : 'Close request sent',
                description: res.data?.message || 'Updated.',
            });
        } catch (err) {
            toast({ title: 'Could not close the request', description: err?.response?.data?.message || 'Try again.' });
        } finally {
            setBusy(false);
        }
    };

    const setStatus = async (status) => {
        setMenuOpen(false);
        setBusy(true);
        try {
            const res = await axiosInstance.post(
                `/Employee/task-manager/tasks/${encodeURIComponent(taskKey)}/status`,
                { status },
                { skipToast: true },
            );
            setTask(res.data?.task || null);
            setTab('updates');
            toast({ title: 'Status updated', description: `Marked as ${status}.` });
        } catch (err) {
            toast({ title: 'Could not update status', description: err?.response?.data?.message || 'Try again.' });
        } finally {
            setBusy(false);
        }
    };

    if (error) {
        return (
            <Shell>
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            </Shell>
        );
    }
    if (!task) {
        return <Shell><p className="text-sm text-slate-500">Loading task...</p></Shell>;
    }

    const notes = task.notifications || { workUpdate: true, comment: true };
    const updates = Array.isArray(task.updates) ? task.updates : [];
    const comments = Array.isArray(task.comments) ? task.comments : [];
    const number = taskNumber || task.taskNumber || '';
    const sentEmails = Array.isArray(task.emails) ? task.emails : [];
    const loggedTaskMail = sentEmails.some((item) => /task update|work update|task comment|task created|task reassigned/i.test(`${item.emailType || ''} ${item.subject || ''}`));
    const updateMails = loggedTaskMail ? [] : [
        ...updates.filter((item) => item.emailSent).map((item) => ({ ...item, channel: 'Task updated' })),
        ...comments.filter((item) => item.emailSent).map((item) => ({ ...item, channel: 'New comment' })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return (
        <Shell>
            <button type="button" onClick={() => router.push('/task-manager')} className="mb-3 text-sm font-semibold text-[#2563EB]">
                Task Manager
            </button>
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-bold text-slate-900">{number || 'Task'}</h1>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[task.displayStatus] || 'bg-slate-100 text-slate-600'}`}>
                                    {task.displayStatus || task.status}
                                </span>
                            </div>
                            <h2 className="mt-1 text-2xl font-bold text-slate-900">{task.taskName}</h2>
                            {task.closeMessage ? <p className="mt-1 text-sm text-slate-500">{task.closeMessage}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                            {task.canComplete && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setStatus('Completed')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
                                >
                                    <Check size={14} /> Mark completed
                                </button>
                            )}
                            {task.canRequestClose && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => closeRequest('request')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
                                >
                                    <Check size={14} /> Close Request
                                </button>
                            )}
                            {task.canFinishClose && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => closeRequest('finish')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
                                >
                                    <Check size={14} /> Close this request
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={!task.canReassign}
                                onClick={() => setReassignOpen(true)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-sm font-semibold text-white disabled:opacity-40"
                            >
                                <RefreshCw size={14} /> Reassign
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-sm font-semibold text-white"
                            >
                                <Pencil size={14} /> Edit
                            </button>
                            <div className="relative">
                                <button type="button" aria-label="More actions" onClick={() => setMenuOpen((open) => !open)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600">
                                    <MoreHorizontal size={16} />
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                        {['In Progress', 'Completed', 'Cancelled'].map((status) => {
                                            const locked = task.workflowLocked && !(status === 'Completed' && task.canComplete);
                                            return (
                                                <button key={status} type="button" disabled={busy || locked} onClick={() => setStatus(status)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                                                    Mark as {status}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <Fact label="Task Type" value={task.taskCategory === 'Work Flow Task' ? 'Workflow Task' : task.taskCategory} pill="bg-violet-50 text-violet-700" />
                        <Fact label="Task Priority" value={task.priority} pill={PRIORITY_STYLE[task.priority]} />
                        <Fact label="Request Date" value={formatWhen(task.requestDate)} icon={Calendar} />
                        <Fact label="Task Completion Date" value={formatDay(task.completionDate)} icon={Calendar} />
                        <Fact label="Task Status" value={task.displayStatus || task.status} pill="bg-sky-50 text-sky-700" />
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <PersonFact label="Requester Name" name={task.requesterName} role={task.requesterRole} photo={task.requesterPhoto} />
                        <PersonFact label="Assignee Name" name={task.assigneeName} role={task.assigneeRole} photo={task.assigneePhoto} />
                        <Fact label="Department" value={task.department || '—'} icon={Building2} />
                        <Fact label="Related To" value={task.relatedTo || task.moduleLabel || '—'} icon={Link2} />
                        <Fact label="Last Updated" value={`${formatWhen(task.updatedAt || task.requestDate)}${task.lastUpdatedBy ? ` by ${task.lastUpdatedBy}` : ''}`} icon={Calendar} />
                    </div>

                    <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
                        {TABS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTab(item.id)}
                                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === item.id ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-slate-500'}`}
                            >
                                {item.label}
                                {item.id === 'attachments' ? ` (${(task.attachments || []).length})` : ''}
                            </button>
                        ))}
                    </div>

                    <div className="pt-4">
                        {tab === 'overview' && (
                            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                                <p className="font-semibold text-slate-800">Description</p>
                                <p className="mt-2 whitespace-pre-wrap">{task.description || 'No description.'}</p>
                                {task.accessPath && task.taskCategory !== 'General Task' ? (
                                    <a href={task.accessPath} className="mt-3 inline-flex text-sm font-semibold text-[#2563EB]">
                                        Open this section
                                    </a>
                                ) : null}
                                <p className="mt-3 text-slate-500">Open Workflow to see who acted on each step. Work Updates keep the notes, and Emails shows each message sent for this task.</p>
                            </div>
                        )}
                        {tab === 'workflow' && <WorkflowBoard actionId={task.actionId} onChanged={load} />}
                        {tab === 'updates' && (
                            <div>
                                <h3 className="mb-3 text-base font-semibold text-slate-800">Work Updates</h3>
                                <div className="mb-4 rounded-xl border border-slate-200 p-3">
                                    <textarea value={updateText} onChange={(event) => setUpdateText(event.target.value)} rows={3} placeholder="Write the work update. Type @ and a name to email that person." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                                    {mentionChoices.length > 0 && (
                                        <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                                            {mentionChoices.map((person) => (
                                                <button
                                                    key={person.id}
                                                    type="button"
                                                    onClick={() => chooseMention(person)}
                                                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                                >
                                                    @{person.name}{person.employeeId ? ` (${person.employeeId})` : ''}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <p className="mt-1 text-xs text-slate-500">Type @Name to email that person. With no @, the email goes to the current assignee.</p>
                                    <div className="mt-2 flex justify-end">
                                        <button type="button" disabled={busy || !updateText.trim()} onClick={addUpdate} className="h-8 rounded-lg bg-[#2563EB] px-3 text-sm font-semibold text-white disabled:opacity-60">Post update</button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {updates.length === 0 && <p className="text-sm text-slate-500">No work updates yet.</p>}
                                    {updates.map((item, index) => (
                                        <article key={`${item.createdAt}-${index}`} className="grid grid-cols-[88px_16px_minmax(0,1fr)] gap-3">
                                            <div className="text-right text-xs text-slate-400">
                                                <p>{formatDay(item.createdAt)}</p>
                                                <p>{formatClock(item.createdAt)}</p>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="mt-1 h-3 w-3 rounded-full bg-emerald-500" />
                                                {index < updates.length - 1 && <span className="mt-1 w-px flex-1 bg-sky-200" />}
                                            </div>
                                            <div className="rounded-xl border border-slate-200 p-3">
                                                <div className="flex items-start gap-2">
                                                    <Avatar name={item.authorName} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-sm font-semibold text-slate-800">{item.authorName}</p>
                                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{item.kind || 'Work Update'}</span>
                                                            {item.badge && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">{item.badge}</span>}
                                                        </div>
                                                        <p className="text-xs text-slate-500">{item.authorRole || '—'}</p>
                                                        <p className="mt-1 text-sm text-slate-700">{item.text}</p>
                                                        <EmailChips item={item} />
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        )}
                        {tab === 'email' && (
                            <div>
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-800"><Mail size={16} /> Emails for this task</h3>
                                    {task.accessPath && task.taskCategory !== 'General Task' ? (
                                        <a href={task.accessPath} className="text-sm font-semibold text-[#2563EB]">Open the related page</a>
                                    ) : null}
                                </div>
                                <EmailInbox
                                    sentEmails={sentEmails}
                                    updateMails={updateMails}
                                    task={task}
                                    number={number}
                                />
                            </div>
                        )}
                        {tab === 'attachments' && (
                            <div className="space-y-2">
                                {(task.attachments || []).length === 0 && <p className="text-sm text-slate-500">No attachments.</p>}
                                {(task.attachments || []).map((file, index) => (
                                    <a key={`${file.fileName}-${index}`} href={file.url || undefined} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700">
                                        {file.fileName || 'Attachment'}
                                    </a>
                                ))}
                            </div>
                        )}
                        {tab === 'history' && (
                            <div className="space-y-3">
                                {(task.history || []).length === 0 && <p className="text-sm text-slate-500">No history yet.</p>}
                                {(task.history || []).map((item, index) => (
                                    <div key={`${item.createdAt}-${index}`} className="border-l-2 border-blue-200 pl-3">
                                        <p className="text-sm font-semibold text-slate-800">{item.event}</p>
                                        <p className="text-sm text-slate-600">{item.detail}</p>
                                        <p className="text-xs text-slate-400">{item.actorName} · {formatWhen(item.createdAt)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex gap-2">
                            <Mail className="mt-0.5 text-emerald-600" size={18} />
                            <div>
                                <p className="text-sm font-semibold text-emerald-800">Automatic email notification on every work update</p>
                                <p className="mt-1 text-xs text-emerald-700">A mentioned person receives the email. If nobody is mentioned, the current assignee receives it, with the task link.</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-800">Notification Settings</h3>
                        <SettingRow
                            title="Send email on work update"
                            hint="Notify a mentioned person, or the assignee"
                            checked={notes.workUpdate !== false}
                            onChange={(workUpdate) => saveNotifications({ ...notes, workUpdate })}
                        />
                        <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-800">Notification Recipients</h3>
                        <Recipient
                            name={String(task.requesterName || '').replace(/\s*\([^)]*\)\s*$/, '').trim()}
                            role="Requester"
                            email={task.requesterEmail}
                            photo={task.requesterPhoto}
                            active={notes.workUpdate !== false || notes.comment !== false}
                        />
                        {(Array.isArray(task.handoff) && task.handoff.length ? task.handoff : [{
                            personName: task.assigneeName,
                            personRole: 'Assignee',
                            role: 'Assignee',
                            personPhoto: task.assigneePhoto,
                            current: true,
                        }]).map((person, index) => (
                            <Recipient
                                key={`${person.personName || person.role}-${index}`}
                                name={person.personName}
                                role={person.role || person.personRole || 'Assignee'}
                                email={person.email || (person.current ? task.assigneeEmail : '')}
                                photo={person.personPhoto}
                                active={Boolean(person.current) && (notes.workUpdate !== false || notes.comment !== false)}
                            />
                        ))}
                    </div>
                </aside>
            </div>
            {editOpen && (
                <CreateTaskModal
                    open
                    initialTask={task}
                    onClose={() => setEditOpen(false)}
                    onCreated={() => load()}
                />
            )}
            {reassignOpen && (
                <ReassignTaskModal
                    task={{ ...task, taskNumber: number }}
                    onClose={() => setReassignOpen(false)}
                    onDone={(result) => {
                        setReassignOpen(false);
                        toast({ title: 'Task reassigned', description: result?.message || 'The assignee was updated.' });
                        load();
                    }}
                />
            )}
        </Shell>
    );
}

function Shell({ children }) {
    return (
        <div className="flex min-h-screen w-full bg-[#F4F7FB]">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Navbar />
                <div className="px-4 py-5 sm:px-6 lg:px-8">{children}</div>
            </div>
        </div>
    );
}

function Fact({ label, value, pill, icon: Icon }) {
    return (
        <div>
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                {Icon ? <Icon size={14} className="text-slate-400" /> : null}
                {pill ? <span className={`rounded-full px-2 py-0.5 text-xs ${pill}`}>{value || '—'}</span> : value || '—'}
            </p>
        </div>
    );
}

function PersonFact({ label, name, role, photo }) {
    return (
        <div>
            <p className="text-xs text-slate-400">{label}</p>
            <div className="mt-1 flex items-center gap-2">
                <Avatar name={name} photo={photo} size="h-8 w-8" />
                <div>
                    <p className="text-sm font-semibold text-slate-800">{name || '—'}</p>
                    <p className="text-xs text-slate-500">{role || '—'}</p>
                </div>
            </div>
        </div>
    );
}

function SettingRow({ title, hint, checked, onChange }) {
    return (
        <div className="mt-3 flex items-center justify-between gap-3">
            <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><Mail size={14} className="text-slate-400" /> {title}</p>
                <p className="text-xs text-slate-500">{hint}</p>
            </div>
            <Toggle checked={checked} onChange={onChange} label={title} />
        </div>
    );
}

function Recipient({ name, role, email, photo, active }) {
    return (
        <div className="mb-3 flex items-center gap-2">
            <Avatar name={name} photo={photo} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{name || '—'} <span className="font-normal text-slate-500">({role})</span></p>
                <p className="truncate text-xs text-slate-500">{email || 'No company email'}</p>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${active && email ? 'text-emerald-600' : 'text-slate-400'}`}>
                {active && email ? <Check size={14} /> : <UserRound size={14} />}
                {active && email ? 'Will be notified' : 'Not notified'}
            </span>
        </div>
    );
}

function senderLabel(from) {
    const raw = String(from || '').trim();
    if (!raw) return 'VeRP';
    const named = raw.match(/^\s*"?([^"<]+)"?\s*</);
    if (named?.[1]?.trim()) return named[1].trim();
    if (/verp|vitsllc|vegadigital|no-?reply/i.test(raw)) return 'VeRP';
    return raw;
}

function emailSnippet(value, limit = 120) {
    const text = String(value || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text || text.length <= limit) return text;
    return `${text.slice(0, limit).trim()}…`;
}

function formatListTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const dayKey = (input) => new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Dubai',
    }).format(input);
    if (dayKey(date) === dayKey(new Date())) return formatClock(value);
    const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Dubai' }).format(date);
    const thisYear = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Dubai' }).format(new Date());
    const options = { month: 'short', day: 'numeric', timeZone: 'Asia/Dubai' };
    if (year !== thisYear) options.year = 'numeric';
    return new Intl.DateTimeFormat('en-US', options).format(date);
}

function EmailInbox({ sentEmails, updateMails, task, number }) {
    const [openKey, setOpenKey] = useState(null);
    const rows = [
        ...sentEmails.map((item, index) => ({
            key: String(item.id || `sent-${item.subject || 'email'}-${item.sentAt || index}`),
            kind: 'sent',
            from: senderLabel(item.from),
            subject: item.subject || 'Email',
            preview: emailSnippet(item.html) || item.emailType || '',
            when: item.sentAt,
            item,
        })),
        ...updateMails.map((item, index) => ({
            key: `preview-${item.createdAt || index}-${index}`,
            kind: 'preview',
            from: 'VeRP',
            subject: item.channel === 'New comment'
                ? `New Comment: ${number || task.taskName}`
                : `Task Updated: ${number || task.taskName}`,
            preview: emailSnippet(item.text),
            when: item.createdAt,
            item,
            mode: item.channel === 'New comment' ? 'comment' : 'update',
        })),
    ].sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));

    if (rows.length === 0) {
        return <p className="text-sm text-slate-500">No emails have been sent for this task yet.</p>;
    }

    const open = rows.find((row) => row.key === openKey);
    if (open) {
        return (
            <div>
                <button
                    type="button"
                    onClick={() => setOpenKey(null)}
                    className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB]"
                >
                    <ChevronLeft size={16} /> All emails
                </button>
                {open.kind === 'sent' ? (
                    <SentEmailBlock email={open.item} />
                ) : (
                    <EmailPreview mode={open.mode} task={task} number={number} item={open.item} />
                )}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200">
            {rows.map((row) => (
                <button
                    key={row.key}
                    type="button"
                    onClick={() => setOpenKey(row.key)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
                >
                    <span className="hidden w-28 shrink-0 truncate text-sm font-semibold text-slate-800 sm:block">{row.from}</span>
                    <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2 sm:hidden">
                            <span className="truncate text-sm font-semibold text-slate-800">{row.from}</span>
                            <span className="ml-auto shrink-0 text-xs text-slate-500">{formatListTime(row.when)}</span>
                        </span>
                        <span className="block truncate text-sm text-slate-800">
                            <span className="font-medium">{row.subject}</span>
                            {row.preview ? <span className="font-normal text-slate-500"> — {row.preview}</span> : null}
                        </span>
                    </span>
                    <span className="hidden shrink-0 text-xs font-medium text-slate-500 sm:block">{formatListTime(row.when)}</span>
                </button>
            ))}
        </div>
    );
}

function SentEmailBlock({ email }) {
    const to = (email.to || []).filter(Boolean).join(', ') || '—';
    const cc = (email.cc || []).filter(Boolean).join(', ');
    return (
        <article className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{email.subject || 'Email'}</p>
                {email.emailType ? <p className="text-xs text-slate-500">{email.emailType}</p> : null}
            </div>
            <div className="space-y-1 px-4 py-3 text-sm text-slate-600">
                <p><span className="text-slate-400">From:</span> {email.from || 'VeRP Notifications'}</p>
                <p><span className="text-slate-400">To:</span> {to}</p>
                {cc ? <p><span className="text-slate-400">Cc:</span> {cc}</p> : null}
                <p><span className="text-slate-400">Date:</span> {formatWhen(email.sentAt)}</p>
            </div>
            {email.html ? (
                <iframe
                    title={email.subject || 'Email'}
                    sandbox=""
                    srcDoc={email.html}
                    className="h-[420px] w-full border-t border-slate-100 bg-white"
                />
            ) : (
                <p className="px-4 pb-4 text-sm text-slate-500">This email was sent before the message copy was saved. The subject and recipients above are the record of it.</p>
            )}
        </article>
    );
}

function EmailPreview({ mode, task, number, item }) {
    const to = [task.assigneeEmail, task.requesterEmail].filter(Boolean).join(', ') || 'No company email on file';
    const body = item?.text ? String(item.text).replace(/<[^>]+>/g, '') : 'No update has been posted yet.';
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{mode === 'update' ? `Task Updated: ${number || task.taskName}` : `New Comment: ${number || task.taskName}`}</p>
                <p className="text-sm text-slate-500">{task.taskName}</p>
            </div>
            <div className="space-y-1 px-4 py-3 text-sm text-slate-600">
                <p><span className="text-slate-400">From:</span> no-reply@vegadigital.ae</p>
                <p><span className="text-slate-400">To:</span> {to}</p>
                <p><span className="text-slate-400">Date:</span> {formatWhen(item?.createdAt || task.updatedAt)}</p>
            </div>
            <div className="px-4 pb-4 text-sm text-slate-700">
                <p>Hi,</p>
                <p className="mt-2">{mode === 'update' ? 'The following task has been updated:' : 'A new comment was added:'}</p>
                <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-1">
                    <dt className="text-slate-400">Task Number</dt><dd>{number || '—'}</dd>
                    <dt className="text-slate-400">Task Name</dt><dd>{task.taskName}</dd>
                    <dt className="text-slate-400">{mode === 'update' ? 'Update By' : 'Comment By'}</dt><dd>{item?.authorName || '—'}</dd>
                    <dt className="text-slate-400">{mode === 'update' ? 'Update Details' : 'Comment'}</dt><dd>{body}</dd>
                    <dt className="text-slate-400">Current Status</dt><dd>{task.displayStatus || task.status}</dd>
                    <dt className="text-slate-400">Updated On</dt><dd>{formatWhen(item?.createdAt || task.updatedAt)}</dd>
                </dl>
                <p className="mt-4 text-xs text-slate-400">This is an automated notification from the Vega Digital Task Management System.</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <p className="text-sm font-bold text-[#1D4ED8]">VEGA DIGITAL</p>
                    <p className="text-xs text-slate-400">Your Trusted Technology Partner</p>
                </div>
            </div>
        </div>
    );
}

export default function TaskDetailsRoute() {
    return (
        <PermissionGuard moduleId="hrm" permissionType="view">
            <TaskDetailsPage />
        </PermissionGuard>
    );
}
