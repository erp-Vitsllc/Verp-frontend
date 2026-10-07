'use client';

import { useEffect, useState } from 'react';
import { User, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';

export default function ReassignTaskModal({ task, onClose, onDone }) {
    const [employees, setEmployees] = useState([]);
    const [assigneeId, setAssigneeId] = useState('');
    const [reason, setReason] = useState('');
    const [notifyAssignee, setNotifyAssignee] = useState(true);
    const [notifyRequester, setNotifyRequester] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        axiosInstance
            .get('/Employee/task-manager/assignees', { skipToast: true })
            .then((res) => {
                if (!cancelled) setEmployees(Array.isArray(res.data?.employees) ? res.data.employees : []);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.response?.data?.message || 'Could not load assignees.');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const submit = async (event) => {
        event.preventDefault();
        if (!assigneeId) {
            setError('Select a new assignee.');
            return;
        }
        if (!reason.trim()) {
            setError('Reason for reassignment is required.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const res = await axiosInstance.post(
                `/Employee/task-manager/tasks/${encodeURIComponent(task.actionId)}/reassign`,
                {
                    assigneeId,
                    reason: reason.trim(),
                    notifyAssignee,
                    notifyRequester,
                },
                { skipToast: true },
            );
            onDone?.(res.data);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not reassign this task.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4" onClick={(event) => {
            if (event.target === event.currentTarget && !submitting) onClose();
        }}>
            <form onSubmit={submit} className="w-full max-w-[560px] overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between bg-[#2563EB] px-5 py-3.5 text-white">
                    <h2 className="text-[16px] font-semibold">Reassign Task</h2>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 hover:bg-white/15">
                        <X size={18} />
                    </button>
                </div>
                <div className="space-y-4 px-5 py-4">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                                {task.taskNumber ? `${task.taskNumber} - ` : ''}{task.taskName}
                            </p>
                            <p className="text-xs text-slate-500">Current Assignee: {task.assigneeName || 'Unassigned'}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">{task.taskCategory === 'Work Flow Task' ? 'Workflow Task' : task.taskCategory}</span>
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">{task.priority}</span>
                        </div>
                    </div>
                    <label className="block">
                        <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">New Assignee <span className="text-rose-500">*</span></span>
                        <div className="relative">
                            <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                value={assigneeId}
                                onChange={(event) => setAssigneeId(event.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                            >
                                <option value="">Select User</option>
                                {employees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>
                                        {employee.name}{employee.employeeId ? ` (${employee.employeeId})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </label>
                    <label className="block">
                        <span className="mb-1.5 flex items-center justify-between text-[13px] font-semibold text-slate-800">
                            <span>Reason for Reassignment <span className="text-rose-500">*</span></span>
                            <span className="font-normal text-slate-400">{reason.length}/500</span>
                        </span>
                        <textarea
                            value={reason}
                            maxLength={500}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                            placeholder="Enter reason for reassignment"
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={notifyAssignee} onChange={(event) => setNotifyAssignee(event.target.checked)} />
                        Send email notification to new assignee
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={notifyRequester} onChange={(event) => setNotifyRequester(event.target.checked)} />
                        Notify requester{task.requesterName ? ` (${task.requesterName})` : ''}
                    </label>
                    {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
                    <button type="button" onClick={onClose} disabled={submitting} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
                        Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="h-10 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
                        {submitting ? 'Reassigning...' : 'Reassign Task'}
                    </button>
                </div>
            </form>
        </div>
    );
}
