'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const PILL = {
    Completed: 'bg-emerald-50 text-emerald-600',
    'In Progress': 'bg-blue-50 text-blue-600',
    'Not Started': 'bg-slate-100 text-slate-500',
    Rejected: 'bg-rose-50 text-rose-600',
};

function formatWhen(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Dubai',
    }).format(date);
}

function PersonMark({ step }) {
    const [failed, setFailed] = useState(false);
    const initials = String(step.personName || '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
    if (step.personPhoto && !failed) {
        return <img src={step.personPhoto} alt="" onError={() => setFailed(true)} className="h-9 w-9 rounded-full object-cover" />;
    }
    if (!step.personName) return null;
    return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
            {initials}
        </span>
    );
}

export function WorkflowBoard({ actionId, onChanged }) {
    const { toast } = useToast();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError('');
        axiosInstance
            .get(`/Employee/task-manager/tasks/${encodeURIComponent(actionId)}/workflow`, { skipToast: true })
            .then((res) => {
                if (!cancelled) setData(res.data || null);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.response?.data?.message || 'Could not load the workflow.');
            });
        return () => {
            cancelled = true;
        };
    }, [actionId]);

    const decide = async (decision) => {
        setBusy(true);
        try {
            const res = await axiosInstance.post(
                `/Employee/task-manager/tasks/${encodeURIComponent(actionId)}/workflow/decision`,
                { decision },
                { skipToast: true },
            );
            setData(res.data || null);
            toast({
                title: decision === 'approve' ? 'Step approved' : 'Step rejected',
                description: res.data?.message || 'The workflow was updated.',
            });
            onChanged?.();
        } catch (err) {
            toast({
                title: 'Could not update this step',
                description: err?.response?.data?.message || 'Try again.',
            });
        } finally {
            setBusy(false);
        }
    };

    if (error) return <p className="text-sm text-rose-600">{error}</p>;
    if (!data) return <p className="text-sm text-slate-500">Loading workflow...</p>;

    const steps = Array.isArray(data.steps) ? data.steps : [];
    return (
        <ol className="space-y-0">
            {steps.map((step, index) => {
                const done = step.status === 'Completed';
                const active = step.status === 'In Progress';
                const rejected = step.status === 'Rejected';
                return (
                    <li key={`${step.key}-${index}`} className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3">
                        <div className="flex flex-col items-center">
                            <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                    done
                                        ? 'bg-emerald-500 text-white'
                                        : active
                                          ? 'bg-[#2563EB] text-white'
                                          : rejected
                                            ? 'bg-rose-500 text-white'
                                            : 'border border-slate-200 bg-white text-slate-400'
                                }`}
                            >
                                {done ? <Check size={16} /> : rejected ? <X size={14} /> : index + 1}
                            </span>
                            {index < steps.length - 1 && <span className={`my-1 w-px flex-1 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                        </div>
                        <div className={`pb-5 ${index === steps.length - 1 ? 'pb-0' : ''}`}>
                            <div className="flex items-start gap-2">
                                <PersonMark step={step} />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                                    <p className="text-xs text-slate-500">{step.detail}</p>
                                    {step.at && <p className="text-xs text-slate-400">{formatWhen(step.at)}</p>}
                                </div>
                            </div>
                            {active && step.canAct && (
                                <div className="mt-2 flex gap-2">
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => decide('approve')}
                                        className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => decide('reject')}
                                        className="h-8 rounded-lg bg-rose-500 px-3 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                            {active && data.workflowLocked && (
                                <p className="mt-2 text-xs text-slate-500">
                                    Approve or reject this step on the {data.moduleLabel || 'module'} page.
                                </p>
                            )}
                        </div>
                        <span className={`h-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[step.status] || PILL['Not Started']}`}>
                            {step.status}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

export default function WorkflowProcessModal({ task, onClose, onChanged }) {
    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between bg-[#2563EB] px-5 py-3.5 text-white">
                    <div>
                        <h2 className="text-[16px] font-semibold">Workflow Process</h2>
                        <p className="text-xs text-white/80">{task.taskNumber ? `${task.taskNumber} · ` : ''}{task.taskName}</p>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 hover:bg-white/15">
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 py-5">
                    <WorkflowBoard actionId={task.actionId} onChanged={onChanged} />
                </div>
            </section>
        </div>
    );
}
