'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, User, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { ERP_ATTACHMENT_ACCEPT, validateErpUploadFile } from '@/utils/uploadFileTypes';

const TASK_TYPES = ['System Task', 'Workflow Task', 'General Task'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const EMPTY_FORM = {
    taskType: 'System Task',
    priority: 'Medium',
    taskName: '',
    description: '',
    assigneeId: '',
    completionDate: '',
};

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.readAsDataURL(file);
    });
}

function FieldLabel({ children, required }) {
    return (
        <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            {children}
            {required ? <span className="text-rose-500"> *</span> : null}
        </span>
    );
}

function normalizeTaskType(value) {
    if (value === 'Work Flow Task') return 'Workflow Task';
    return TASK_TYPES.includes(value) ? value : 'Workflow Task';
}

function toDateInput(value) {
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

export default function CreateTaskModal({ open, onClose, onCreated, initialTask = null }) {
    const { toast } = useToast();
    const fileRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const [form, setForm] = useState(EMPTY_FORM);
    const [files, setFiles] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loadingPeople, setLoadingPeople] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        setForm(
            initialTask
                ? {
                      taskType: normalizeTaskType(initialTask.taskCategory || initialTask.taskType),
                      priority: initialTask.priority || 'Medium',
                      taskName: initialTask.taskName || '',
                      description: initialTask.description || '',
                      assigneeId: initialTask.assigneeId || '',
                      completionDate: toDateInput(initialTask.completionDate || initialTask.requestDate),
                  }
                : EMPTY_FORM,
        );
        setFiles([]);
        setError('');
        setSubmitting(false);
        const onKey = (event) => {
            if (event.key === 'Escape') onCloseRef.current();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, initialTask]);

    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        setLoadingPeople(true);
        axiosInstance
            .get('/Employee/task-manager/assignees', { skipToast: true })
            .then((res) => {
                if (!cancelled) setEmployees(Array.isArray(res.data?.employees) ? res.data.employees : []);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.response?.data?.message || 'Could not load assignees.');
            })
            .finally(() => {
                if (!cancelled) setLoadingPeople(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    if (!open) return null;

    const assigneeLocked = Boolean(initialTask) && initialTask.canReassign === false;
    const assigneeOptions = [...employees];
    if (
        initialTask?.assigneeId &&
        !assigneeOptions.some((employee) => employee.id === initialTask.assigneeId)
    ) {
        assigneeOptions.unshift({
            id: initialTask.assigneeId,
            name: initialTask.assigneeName || 'Current assignee',
            employeeId: initialTask.assigneeEmpId || '',
        });
    }

    const setField = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
        setError('');
    };

    const addFiles = (list) => {
        const incoming = Array.from(list || []);
        if (!incoming.length) return;
        const next = [...files];
        for (const file of incoming) {
            if (next.length >= 5) {
                setError('You can attach up to 5 files.');
                break;
            }
            const check = validateErpUploadFile(file);
            if (!check.ok) {
                setError(check.message);
                continue;
            }
            next.push(file);
        }
        setFiles(next);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.taskName.trim()) {
            setError('Task name is required.');
            return;
        }
        if (!form.assigneeId) {
            setError('Select an assignee.');
            return;
        }
        if (!form.completionDate) {
            setError('Completion date is required.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const attachments = await Promise.all(
                files.map(async (file) => ({
                    name: file.name,
                    data: await fileToDataUrl(file),
                })),
            );
            const priority = form.taskType === 'System Task' ? 'High' : form.priority;
            const payload = {
                taskType: form.taskType,
                priority,
                taskName: form.taskName.trim(),
                description: form.description.trim(),
                assigneeId: form.assigneeId,
                completionDate: form.completionDate,
                attachments,
            };
            const editing = Boolean(initialTask?.actionId);
            const res = editing
                ? await axiosInstance.patch(`/Employee/task-manager/tasks/${encodeURIComponent(initialTask.actionId)}`, payload, { skipToast: true })
                : await axiosInstance.post('/Employee/task-manager/tasks', payload, { skipToast: true });
            toast({
                title: editing ? 'Task updated' : 'Task created',
                description: `${form.taskName.trim()} is listed under ${priority} priority.`,
            });
            onCreated?.(res.data?.task || {
                actionId: initialTask?.actionId,
                taskType: form.taskType,
                priority,
                taskName: form.taskName,
            });
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not create the task.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget && !submitting) onClose();
            }}
        >
            <form
                onSubmit={handleSubmit}
                className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            >
                <div className="flex items-center justify-between bg-[#2563EB] px-5 py-3.5 text-white">
                    <h2 className="text-[16px] font-semibold">{initialTask ? 'Edit Task' : 'Create New Task'}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-md p-1 hover:bg-white/15"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 overflow-y-auto px-5 py-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label>
                            <FieldLabel required>Task Type</FieldLabel>
                            <select
                                value={form.taskType}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    setForm((current) => ({
                                        ...current,
                                        taskType: next,
                                        priority: next === 'System Task' ? 'High' : current.priority,
                                    }));
                                }}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                            >
                                {TASK_TYPES.map((item) => (
                                    <option key={item}>{item}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <FieldLabel required>Task Priority</FieldLabel>
                            <select
                                value={form.taskType === 'System Task' ? 'High' : form.priority}
                                disabled={form.taskType === 'System Task'}
                                onChange={(event) => setField('priority', event.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                            >
                                {PRIORITIES.map((item) => (
                                    <option key={item}>{item}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <FieldLabel required>Task Name</FieldLabel>
                        <input
                            value={form.taskName}
                            onChange={(event) => setField('taskName', event.target.value)}
                            placeholder="System Access Request"
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500"
                        />
                    </label>

                    <label className="block">
                        <FieldLabel>Description</FieldLabel>
                        <textarea
                            value={form.description}
                            onChange={(event) => setField('description', event.target.value)}
                            rows={3}
                            placeholder="Request for new system access for the employee. Provide required details and approval."
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500"
                        />
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label>
                            <FieldLabel required>Assignee</FieldLabel>
                            <div className="relative">
                                <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={form.assigneeId}
                                    disabled={loadingPeople || assigneeLocked}
                                    onChange={(event) => setField('assigneeId', event.target.value)}
                                    className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-50"
                                >
                                    <option value="">{loadingPeople ? 'Loading users...' : 'Select User'}</option>
                                    {assigneeOptions.map((employee) => (
                                        <option key={employee.id} value={employee.id}>
                                            {employee.name}{employee.employeeId ? ` (${employee.employeeId})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {assigneeLocked ? (
                                <p className="mt-1 text-xs text-slate-500">Only the current assignee or admin super user can change the assignee.</p>
                            ) : null}
                        </label>
                        <label>
                            <FieldLabel required>Completion Date</FieldLabel>
                            <input
                                type="date"
                                value={form.completionDate}
                                onChange={(event) => setField('completionDate', event.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                            />
                        </label>
                    </div>

                    <div>
                        <FieldLabel>Attachments</FieldLabel>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(event) => {
                                event.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(event) => {
                                event.preventDefault();
                                setDragging(false);
                                addFiles(event.dataTransfer.files);
                            }}
                            className={`flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-sm ${
                                dragging ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-500'
                            }`}
                        >
                            <Paperclip size={18} className="mb-2" />
                            Drag & drop files here or click to upload
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            multiple
                            accept={ERP_ATTACHMENT_ACCEPT}
                            className="hidden"
                            onChange={(event) => {
                                addFiles(event.target.files);
                                event.target.value = '';
                            }}
                        />
                        {files.length > 0 && (
                            <ul className="mt-2 space-y-1">
                                {files.map((file, index) => (
                                    <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-[13px] text-slate-600">
                                        <span className="truncate">{file.name}</span>
                                        <button
                                            type="button"
                                            aria-label={`Remove ${file.name}`}
                                            onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                            className="ml-2 text-slate-400 hover:text-rose-500"
                                        >
                                            <X size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {error && (
                        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="h-10 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                    >
                        {submitting ? 'Saving...' : initialTask ? 'Save Task' : 'Create Task'}
                    </button>
                </div>
            </form>
        </div>
    );
}
