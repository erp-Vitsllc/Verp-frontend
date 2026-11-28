'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';

const DEFAULT_MOM_TASKS = [
    'Add BOQ preparation',
    'MR completion',
    'Budget submission',
    'Customer invoice',
    'LPO to vendor',
    'Delivery date',
    'Bill entry',
    'Budget vs actual review',
    'Close work order',
];

function rowKey() {
    return `mom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankRow(taskName = '') {
    return {
        id: rowKey(),
        taskName,
        assigneeId: '',
        assigneeName: '',
        completionDate: '',
    };
}

function savedRows(order) {
    return (Array.isArray(order?.mom) ? order.mom : []).map((row) => ({
        id: String(row?.id || rowKey()),
        taskName: String(row?.taskName || ''),
        assigneeId: String(row?.assigneeId || ''),
        assigneeName: String(row?.assigneeName || ''),
        completionDate: String(row?.completionDate || ''),
    }));
}

function rowsFromOrder(order) {
    if (order?.momReady) return savedRows(order);
    return DEFAULT_MOM_TASKS.map((taskName) => blankRow(taskName));
}

export default function WorkOrderMomPanel({ order, onSaved }) {
    const { toast } = useToast();
    const dragFrom = useRef(null);
    const rowsRef = useRef([]);
    const [rows, setRows] = useState(() => rowsFromOrder(order));
    rowsRef.current = rows;
    const [people, setPeople] = useState([]);
    const [dropAt, setDropAt] = useState(null);
    const [busy, setBusy] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');

    useEffect(() => {
        setRows(rowsFromOrder(order));
    }, [order?._id, order?.momReady]);

    useEffect(() => {
        let ignore = false;
        axiosInstance.get('/Employee/task-manager/assignees', { skipToast: true })
            .then((response) => {
                if (ignore) return;
                const list = Array.isArray(response?.data?.employees) ? response.data.employees : [];
                setPeople(list.map((person) => ({
                    id: String(person.id || ''),
                    name: String(person.name || person.employeeId || '').trim(),
                })).filter((person) => person.id && person.name));
            })
            .catch(() => {
                if (!ignore) setPeople([]);
            });
        return () => {
            ignore = true;
        };
    }, []);

    const persist = async (next) => {
        try {
            const response = await axiosInstance.patch(`/WorkOrder/${order._id}`, { mom: next }, { skipToast: true });
            if (response.data?.workOrder) onSaved?.(response.data.workOrder);
        } catch (error) {
            toast({
                title: 'Could not save MOM',
                description: error?.response?.data?.message || 'Try again.',
                variant: 'destructive',
            });
        }
    };

    const commit = (next) => {
        rowsRef.current = next;
        setRows(next);
        persist(next);
    };

    const patchRow = (id, patch) => {
        commit(rowsRef.current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };

    const addUnder = (index) => {
        const next = [...rowsRef.current];
        next.splice(Math.max(index + 1, 0), 0, blankRow(''));
        commit(next);
    };

    const removeRow = (id) => {
        commit(rowsRef.current.filter((row) => row.id !== id));
    };

    const moveRow = (from, to) => {
        if (from == null || to == null || from === to) return;
        const next = [...rowsRef.current];
        const [row] = next.splice(from, 1);
        const target = from < to ? to - 1 : to;
        next.splice(target, 0, row);
        commit(next);
    };

    const submit = async () => {
        setBusy(true);
        try {
            const response = await axiosInstance.patch(
                `/WorkOrder/${order._id}`,
                { submitMom: true, mom: rowsRef.current },
                { skipToast: true },
            );
            if (response.data?.workOrder) onSaved?.(response.data.workOrder);
            setRejecting(false);
            setReason('');
            toast({
                title: response.data?.workOrder?.momStatus === 'approved' ? 'MOM approved' : 'MOM submitted',
                description: response.data?.emailMessage || 'The project manager has this MOM.',
            });
        } catch (error) {
            toast({
                title: 'Could not submit MOM',
                description: error?.response?.data?.message || 'Try again.',
                variant: 'destructive',
            });
        } finally {
            setBusy(false);
        }
    };

    const decide = async (decision) => {
        if (decision === 'reject' && !reason.trim()) {
            toast({ title: 'A reason is required', description: 'Write why this MOM is rejected.', variant: 'destructive' });
            return;
        }
        setBusy(true);
        try {
            const response = await axiosInstance.patch(
                `/WorkOrder/${order._id}`,
                {
                    decideMom: decision,
                    mom: rowsRef.current,
                    ...(decision === 'reject' ? { rejectReason: reason.trim() } : {}),
                },
                { skipToast: true },
            );
            if (response.data?.workOrder) onSaved?.(response.data.workOrder);
            setRejecting(false);
            setReason('');
            toast({
                title: decision === 'approve' ? 'MOM approved' : 'MOM rejected',
                description: decision === 'approve' ? 'You can still edit this MOM.' : 'Edit the MOM and submit it again.',
            });
        } catch (error) {
            toast({
                title: 'Could not update MOM',
                description: error?.response?.data?.message || 'Try again.',
                variant: 'destructive',
            });
        } finally {
            setBusy(false);
        }
    };

    const status = String(order?.momStatus || '');
    const managerName = String(order?.projectManagerName || 'the project manager').trim();
    const canDecide = Boolean(order?.viewerCanApproveMom) && status === 'pending';

    return (
        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-slate-800">MOM</h2>
                <button
                    type="button"
                    onClick={() => addUnder(rows.length - 1)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2f6fed] px-3 text-sm font-semibold text-white hover:bg-[#245fe0] ${FOCUS}`}
                >
                    <Plus size={14} />
                    Add
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm text-slate-700">
                    <thead>
                        <tr className="bg-[#f4f7fb] text-[11px] uppercase tracking-wide text-slate-500">
                            <th className="w-10 px-2 py-2" aria-label="Drag" />
                            <th className="px-3 py-2 font-semibold">Task name</th>
                            <th className="px-3 py-2 font-semibold">Assignee</th>
                            <th className="px-3 py-2 font-semibold">Completion date</th>
                            <th className="w-24 px-3 py-2 font-semibold">Delete</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => {
                            const known = people.some((person) => person.id === row.assigneeId);
                            return (
                                <tr
                                    key={row.id}
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setDropAt(index);
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        moveRow(dragFrom.current, index);
                                        dragFrom.current = null;
                                        setDropAt(null);
                                    }}
                                    className={`border-t border-[#e6eef6] ${dropAt === index ? 'shadow-[inset_0_2px_0_0_#2f6fed]' : ''}`}
                                >
                                    <td className="px-2 py-2">
                                        <div
                                            draggable
                                            aria-label="Drag row"
                                            title="Drag row"
                                            onDragStart={(event) => {
                                                dragFrom.current = index;
                                                event.dataTransfer.effectAllowed = 'move';
                                            }}
                                            onDragEnd={() => {
                                                dragFrom.current = null;
                                                setDropAt(null);
                                            }}
                                            className="flex h-8 w-7 cursor-grab items-center justify-center rounded text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
                                        >
                                            <GripVertical size={16} />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            value={row.taskName}
                                            aria-label="Task name"
                                            onChange={(event) => {
                                                const taskName = event.target.value;
                                                setRows((current) => {
                                                    const next = current.map((item) => (
                                                        item.id === row.id ? { ...item, taskName } : item
                                                    ));
                                                    rowsRef.current = next;
                                                    return next;
                                                });
                                            }}
                                            onBlur={() => persist(rowsRef.current)}
                                            className={`h-10 w-full rounded-lg border border-[#e5edf6] px-3 text-sm outline-none ${FOCUS}`}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <select
                                            value={row.assigneeId}
                                            aria-label="Assignee"
                                            onChange={(event) => {
                                                const assigneeId = event.target.value;
                                                const person = people.find((item) => item.id === assigneeId);
                                                patchRow(row.id, {
                                                    assigneeId,
                                                    assigneeName: person?.name || '',
                                                });
                                            }}
                                            className={`h-10 w-full rounded-lg border border-[#e5edf6] bg-white px-3 text-sm outline-none ${FOCUS}`}
                                        >
                                            <option value="">Select</option>
                                            {row.assigneeId && !known ? (
                                                <option value={row.assigneeId}>{row.assigneeName || 'Saved assignee'}</option>
                                            ) : null}
                                            {people.map((person) => (
                                                <option key={person.id} value={person.id}>{person.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2">
                                        <DatePicker
                                            value={row.completionDate}
                                            onChange={(completionDate) => patchRow(row.id, { completionDate: completionDate || '' })}
                                            placeholder="dd/MM/yyyy"
                                            className={`h-10 w-full justify-start rounded-lg border-[#e5edf6] bg-white px-3 text-sm font-normal shadow-none hover:bg-white ${FOCUS}`}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                aria-label="Add row under"
                                                title="Add row under"
                                                onClick={() => addUnder(index)}
                                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#2f6fed] text-[#2f6fed] hover:bg-[#e8f1ff] ${FOCUS}`}
                                            >
                                                <Plus size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label="Delete row"
                                                title="Delete"
                                                onClick={() => removeRow(row.id)}
                                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 ${FOCUS}`}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-[#e6eef6] pt-4">
                {status === 'pending' ? (
                    <p className="text-sm text-amber-800">Waiting for {managerName}. Approve it, or reject it with a description.</p>
                ) : null}
                {status === 'approved' ? (
                    <p className="text-sm text-emerald-700">
                        Approved{order?.momDecidedByName ? ` by ${order.momDecidedByName}` : ''}. You can still edit this MOM.
                    </p>
                ) : null}
                {status === 'rejected' ? (
                    <p className="text-sm text-rose-700">
                        Rejected{order?.momReason ? `: ${order.momReason}` : ''}. Edit the MOM and submit it again.
                    </p>
                ) : null}
                {status !== 'pending' && status !== 'approved' && status !== 'rejected' ? (
                    <p className="text-sm text-slate-500">
                        {order?.viewerIsProjectManager
                            ? 'Submit approves this MOM, because you are the project manager.'
                            : `Submit sends this MOM to ${managerName} for approval.`}
                    </p>
                ) : null}
                {canDecide && rejecting ? (
                    <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Reason for rejection"
                        className={`min-h-[80px] w-full rounded-lg border border-[#e5edf6] px-3 py-2 text-sm outline-none ${FOCUS}`}
                    />
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={submit}
                        className={`inline-flex h-10 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:opacity-60 ${FOCUS}`}
                    >
                        {busy ? 'Saving…' : status === 'approved' ? 'Submit again' : 'Submit'}
                    </button>
                    {canDecide ? (
                        <>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => decide('approve')}
                                className={`inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 ${FOCUS}`}
                            >
                                Approve
                            </button>
                            {rejecting ? (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decide('reject')}
                                    className={`inline-flex h-10 items-center rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 ${FOCUS}`}
                                >
                                    Confirm reject
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setRejecting(true)}
                                    className={`inline-flex h-10 items-center rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 ${FOCUS}`}
                                >
                                    Reject
                                </button>
                            )}
                        </>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
