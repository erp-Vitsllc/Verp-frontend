'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, User, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';

export default function ReassignTaskModal({ task, onClose, onDone }) {
    const [employees, setEmployees] = useState([]);
    const [assigneeId, setAssigneeId] = useState('');
    const [reason, setReason] = useState('');
    const [notifyRequester, setNotifyRequester] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [employeeQuery, setEmployeeQuery] = useState('');
    const pickerRef = useRef(null);

    const selectedEmployee = employees.find((employee) => employee.id === assigneeId) || null;
    const visibleEmployees = useMemo(() => {
        const needle = employeeQuery.trim().toLowerCase();
        if (!needle) return employees;
        return employees.filter((employee) => {
            const label = `${employee.name || ''} ${employee.employeeId || ''}`.toLowerCase();
            return label.includes(needle);
        });
    }, [employees, employeeQuery]);

    useEffect(() => {
        if (!pickerOpen) return undefined;
        const close = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) setPickerOpen(false);
        };
        window.addEventListener('mousedown', close);
        return () => window.removeEventListener('mousedown', close);
    }, [pickerOpen]);

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
            setError('Description is required.');
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
                    notifyAssignee: true,
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
            <form onSubmit={submit} className="w-full max-w-[560px] rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between rounded-t-xl bg-[#2563EB] px-5 py-3.5 text-white">
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
                        <div className="relative" ref={pickerRef}>
                            <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <button
                                type="button"
                                onClick={() => setPickerOpen((open) => !open)}
                                className="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-left text-sm text-slate-700 outline-none focus:border-blue-500"
                            >
                                <span className={selectedEmployee ? 'truncate text-slate-800' : 'truncate text-slate-400'}>
                                    {selectedEmployee
                                        ? `${selectedEmployee.name}${selectedEmployee.employeeId ? ` (${selectedEmployee.employeeId})` : ''}`
                                        : 'Select User'}
                                </span>
                            </button>
                            {pickerOpen && (
                                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                                    <div className="relative border-b border-slate-100 p-2">
                                        <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            autoFocus
                                            value={employeeQuery}
                                            onChange={(event) => setEmployeeQuery(event.target.value)}
                                            placeholder="Search employee"
                                            aria-label="Search employee"
                                            className="h-9 w-full rounded-md border border-slate-200 pl-8 pr-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <ul className="max-h-52 overflow-y-auto py-1">
                                        {visibleEmployees.length === 0 ? (
                                            <li className="px-3 py-2 text-sm text-slate-500">No employees found</li>
                                        ) : visibleEmployees.map((employee) => (
                                            <li key={employee.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAssigneeId(employee.id);
                                                        setEmployeeQuery('');
                                                        setPickerOpen(false);
                                                        setError('');
                                                    }}
                                                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                                        employee.id === assigneeId ? 'bg-blue-50 font-semibold text-[#2563EB]' : 'text-slate-700'
                                                    }`}
                                                >
                                                    {employee.name}{employee.employeeId ? ` (${employee.employeeId})` : ''}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </label>
                    <label className="block">
                        <span className="mb-1.5 flex items-center justify-between text-[13px] font-semibold text-slate-800">
                            <span>Description <span className="text-rose-500">*</span></span>
                            <span className="font-normal text-slate-400">{reason.length}/500</span>
                        </span>
                        <textarea
                            value={reason}
                            maxLength={500}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                            placeholder="Description is required"
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                    </label>
                    <p className="text-xs text-slate-500">The previous assignee and the new assignee both receive this description by email.</p>
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
