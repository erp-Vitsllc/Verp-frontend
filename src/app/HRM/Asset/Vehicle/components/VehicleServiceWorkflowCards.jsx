'use client';

import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader2, X, PauseCircle } from 'lucide-react';
import VehiclePlateThumbnail from '@/app/HRM/Asset/Vehicle/components/VehiclePlateThumbnail';
import VehicleServiceModal from '@/app/HRM/Asset/Vehicle/components/VehicleServiceModal';
import { vehicleAssetStatusBadgeClass } from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PIPELINE = [
    { key: 'created', title: 'CREATED', subDefault: 'System' },
    { key: 'requester', title: 'REQUESTER', subDefault: 'Requester' },
    { key: 'pending_hr', title: 'HR', subDefault: '—' },
    { key: 'pending_accounts', title: 'ACCOUNTS', subDefault: '—' },
    { key: 'pending_admin', title: 'ADMIN', subDefault: 'Asset Controller' },
    { key: 'scheduled_service', title: 'SCHEDULED', subDefault: 'In-shop window' },
];

const BREADCRUMB = 'Created → Requester → HR → Accounts → Admin → Scheduled (service window)';

function stageToCurrentIndex(st) {
    if (!st || st === 'rejected') return -1;
    if (st === 'complete') return -1;
    if (st === 'pending_management') return 5;
    const m = {
        pending_hr: 2,
        pending_accounts: 3,
        pending_admin: 4,
        scheduled_service: 5,
    };
    return m[st] ?? -1;
}

function formatShortDate(d) {
    if (!d) return '';
    try {
        return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return '';
    }
}

function formatGapLabel(d1, d2) {
    if (!d1 || !d2) return '';
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (Number.isNaN(t1) || Number.isNaN(t2)) return '';
    const ms = Math.abs(t2 - t1);
    const days = Math.floor(ms / 86400000);
    if (days >= 1) return `${days}D`;
    const hours = Math.floor(ms / 3600000);
    if (hours >= 1) return `${hours}H`;
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return '< 1H';
    return '< 1D';
}

function buildHistoryMeta(history) {
    const list = Array.isArray(history) ? history : [];
    const created = list.find((h) => h.action === 'created');
    const approved = (stage) => list.find((h) => h.stage === stage && h.action === 'approve');

    return {
        createdAt: created?.at,
        requesterName: created?.byName || '',
        hrAt: approved('pending_hr')?.at,
        accAt: approved('pending_accounts')?.at,
        acAt: approved('pending_admin')?.at,
        mgmtAt: approved('pending_management')?.at,
    };
}

function approveDateForPipelineIndex(history, pipelineIndex) {
    const stages = ['pending_hr', 'pending_accounts', 'pending_admin'];
    if (pipelineIndex < 2) return '';
    const st = stages[pipelineIndex - 2];
    if (!st || !history) return '';
    const row = history.find((x) => x.stage === st && x.action === 'approve');
    return row?.at ? formatShortDate(row.at) : '';
}

function StepCircle({ i, currentIdx, allComplete }) {
    const done = allComplete || (currentIdx >= 0 && i < currentIdx);
    const current = !allComplete && currentIdx >= 0 && i === currentIdx;

    if (done) {
        return (
            <div className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm ring-4 ring-white shrink-0">
                <Check className="w-5 h-5 text-white stroke-[3]" />
            </div>
        );
    }
    if (current) {
        return (
            <div className="w-11 h-11 rounded-full bg-white border-[3px] border-emerald-500 flex items-center justify-center text-emerald-600 font-bold text-sm shadow-sm ring-4 ring-emerald-50/80 shrink-0">
                {i + 1}
            </div>
        );
    }
    return (
        <div className="w-11 h-11 rounded-full bg-white border-2 border-pink-200 flex items-center justify-center text-pink-300 font-bold text-sm shrink-0">
            {i + 1}
        </div>
    );
}

function Connector({ leftDone, gapLabel }) {
    return (
        <div className="flex-1 min-w-[20px] flex flex-col items-center justify-start pt-0 self-start mt-[18px]">
            {gapLabel ? (
                <span className="text-[10px] font-medium text-slate-400 leading-none mb-1 whitespace-nowrap">{gapLabel}</span>
            ) : (
                <span className="h-3 block" />
            )}
            <div className="w-full h-[3px] rounded-full bg-pink-100 relative overflow-hidden">
                <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${leftDone ? 'w-full bg-emerald-400' : 'w-0 bg-emerald-400'}`}
                />
            </div>
        </div>
    );
}

export default function VehicleServiceWorkflowCards({ asset, assetId, onUpdated }) {
    const { toast } = useToast();
    const [comment, setComment] = useState('');
    const [holdReason, setHoldReason] = useState('');
    const [holdUntilDate, setHoldUntilDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [pendingIntent, setPendingIntent] = useState('approve');
    const [confirmUnholdOpen, setConfirmUnholdOpen] = useState(false);
    const [schedModal, setSchedModal] = useState(null);
    const [extendDays, setExtendDays] = useState('1');
    const [extendNote, setExtendNote] = useState('');
    const [liveNote, setLiveNote] = useState('');
    const [liveInvoice, setLiveInvoice] = useState({ name: '', data: '', mime: '' });
    const serviceFormRef = useRef(null);
    const [viewerEmployeeId, setViewerEmployeeId] = useState('');
    const [viewerEmployeeObjectId, setViewerEmployeeObjectId] = useState('');

    const wf = asset?.activeServiceWorkflow;
    const stage = wf?.stage;
    const history = wf?.history || [];
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem('employeeUser') || localStorage.getItem('user');
            const parsed = raw ? JSON.parse(raw) : null;
            setViewerEmployeeId(String(parsed?.employeeId || '').trim());
            setViewerEmployeeObjectId(String(parsed?.employeeObjectId || parsed?._id || '').trim());
        } catch {
            setViewerEmployeeId('');
            setViewerEmployeeObjectId('');
        }
    }, []);

    const normalized = (v) => String(v || '').replace(/\s+/g, '').toLowerCase();
    const isCurrentApprover = useMemo(() => {
        const assigneeEmpId = normalized(wf?.currentAssignee?.employeeId);
        const assigneeObjId = normalized(wf?.currentAssignee?._id);
        if (assigneeEmpId && assigneeEmpId === normalized(viewerEmployeeId)) return true;
        if (assigneeObjId && assigneeObjId === normalized(viewerEmployeeObjectId)) return true;
        return false;
    }, [wf?.currentAssignee?.employeeId, wf?.currentAssignee?._id, viewerEmployeeId, viewerEmployeeObjectId]);

    const canActOnWorkflow =
        (asset?.canRespondToServiceWorkflow === true || isCurrentApprover) &&
        isCurrentApprover;

    const meta = useMemo(() => buildHistoryMeta(history), [history]);
    const currentIdx = useMemo(() => stageToCurrentIndex(stage), [stage]);
    const isScheduledStage = stage === 'scheduled_service';

    const inProgress = stage && !['complete', 'rejected'].includes(stage);
    const isComplete = stage === 'complete';
    const isRejected = stage === 'rejected';
    const holdInfo = wf?.accountsHold || null;
    const isHoldActive = stage === 'pending_accounts' && !!holdInfo?.holdUntilDate;
    const requestStatus = useMemo(() => {
        if (!stage) return { label: 'Pending', className: 'bg-slate-100 text-slate-700 border-slate-200' };
        const pendingName = wf?.currentAssignee?.displayName?.trim?.();
        if (['pending_hr', 'pending_accounts', 'pending_admin', 'pending_management'].includes(stage)) {
            return {
                label: pendingName ? `Pending ${pendingName}` : 'Pending',
                className: 'bg-amber-100 text-amber-900 border-amber-200',
            };
        }
        if (stage === 'scheduled_service') {
            return {
                label: String(asset?.status || '').toLowerCase() === 'on service' ? 'On Service' : 'Scheduled',
                className:
                    String(asset?.status || '').toLowerCase() === 'on service'
                        ? 'bg-violet-100 text-violet-900 border-violet-200'
                        : 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
            };
        }
        if (stage === 'complete') return { label: 'Completed', className: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
        return { label: 'Completed', className: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
    }, [stage, wf?.currentAssignee?.displayName, asset?.status]);

    const connectorGaps = useMemo(() => {
        const d0 = meta.createdAt;
        const gaps = [];
        gaps[0] = formatGapLabel(d0, meta.hrAt || d0);
        gaps[1] = formatGapLabel(meta.hrAt || d0, meta.accAt || meta.hrAt);
        gaps[2] = formatGapLabel(meta.accAt || meta.hrAt, meta.acAt || meta.accAt);
        gaps[3] = formatGapLabel(meta.acAt || meta.accAt, new Date());
        gaps[4] = formatGapLabel(meta.acAt || new Date(), new Date());
        if (d0 && !gaps[0]) gaps[0] = '< 1D';
        return gaps;
    }, [meta]);

    const subtitles = useMemo(() => {
        const s = PIPELINE.map((p) => p.subDefault);
        if (meta.requesterName) s[1] = meta.requesterName;
        const nameFor = (st) => {
            const ap = history.find((x) => x.stage === st && x.action === 'approve');
            return ap?.byName || '';
        };
        if (nameFor('pending_hr')) s[2] = nameFor('pending_hr');
        if (nameFor('pending_accounts')) s[3] = nameFor('pending_accounts');
        if (nameFor('pending_admin')) s[4] = nameFor('pending_admin');
        if (isScheduledStage && (wf?.scheduledServiceDate || wf?.serviceWindowEndDate)) {
            s[5] = `${formatShortDate(wf.scheduledServiceDate)} – ${formatShortDate(wf.serviceWindowEndDate)}`;
        }
        const pendingName = wf?.currentAssignee?.displayName?.trim?.();
        if (inProgress && currentIdx >= 0 && pendingName) {
            s[currentIdx] = pendingName;
        }
        return s;
    }, [history, meta.requesterName, wf?.currentAssignee?.displayName, inProgress, currentIdx, isScheduledStage, wf?.scheduledServiceDate, wf?.serviceWindowEndDate]);

    const workflowServiceRecord = useMemo(() => {
        const sid = wf?.serviceRecordId;
        if (!sid || !Array.isArray(asset?.services)) return null;
        return asset.services.find((s) => String(s._id) === String(sid)) || null;
    }, [wf?.serviceRecordId, asset?.services]);

    const canExtendWindow = isScheduledStage;
    const canMarkLive = isScheduledStage && String(asset?.status || '').trim().toLowerCase() === 'on service';

    const submitScheduledPeriod = async (payload) => {
        if (!assetId) return;
        try {
            setLoading(true);
            const { data } = await axiosInstance.post(`/AssetItem/${assetId}/service-workflow/period`, payload);
            toast({
                title: 'Saved',
                description: data?.message || 'Updated.',
            });
            setSchedModal(null);
            setExtendNote('');
            setLiveNote('');
            setLiveInvoice({ name: '', data: '', mime: '' });
            setExtendDays('1');
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: e.response?.data?.message || e.message || 'Could not update.',
            });
        } finally {
            setLoading(false);
        }
    };

    const respond = async (action, serviceUpdates = undefined, holdPayload = undefined) => {
        if (!assetId) return;
        try {
            setLoading(true);
            const payload = {
                action,
                comment: comment.trim() || undefined,
            };
            if (action === 'approve' && serviceUpdates) {
                payload.serviceUpdates = serviceUpdates;
            }
            if (action === 'hold' && holdPayload) {
                payload.holdReason = holdPayload.reason;
                payload.holdUntilDate = holdPayload.holdUntilDate;
            }
            const { data } = await axiosInstance.post(`/AssetItem/${assetId}/service-workflow/respond`, payload);
            toast({
                title: action === 'approve' ? 'Recorded' : 'Rejected',
                description: data?.message || 'Workflow updated.',
            });
            setComment('');
            setHoldReason('');
            setHoldUntilDate('');
            setApprovalModalOpen(false);
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: e.response?.data?.message || e.message || 'Could not update workflow.',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveClick = async () => {
        if (!workflowServiceRecord) {
            toast({ variant: 'destructive', title: 'Missing service', description: 'Could not load the service record for this workflow.' });
            return;
        }
        const ok = serviceFormRef.current?.validateForm?.();
        if (!ok) return;
        const serviceUpdates = serviceFormRef.current?.getServiceUpdatePayload?.();
        if (!serviceUpdates) {
            toast({ variant: 'destructive', title: 'Invalid form', description: 'Could not build service update.' });
            return;
        }
        await respond('approve', serviceUpdates);
    };

    const handleRejectClick = async () => {
        if (!comment.trim()) {
            toast({
                variant: 'destructive',
                title: 'Reason required',
                description: 'Enter a rejection reason in the note field.',
            });
            return;
        }
        await respond('reject');
    };

    const handleHoldClick = async () => {
        const reason = holdReason.trim();
        if (!reason) {
            toast({
                variant: 'destructive',
                title: 'Reason required',
                description: 'Enter why this request is on hold.',
            });
            return;
        }
        if (!holdUntilDate) {
            toast({
                variant: 'destructive',
                title: 'Date required',
                description: 'Select the hold-until date.',
            });
            return;
        }
        await respond('hold', undefined, { reason, holdUntilDate });
    };

    const handleUnholdClick = async () => {
        if (stage !== 'pending_accounts') {
            toast({
                variant: 'destructive',
                title: 'Not allowed',
                description: 'Only Accounts can clear hold for this request.',
            });
            return;
        }
        await respond('unhold');
    };

    const n = PIPELINE.length;

    const workflowBanner = useMemo(() => {
        if (!wf?.stage) {
            return {
                title: 'Service workflow',
                subtitle: 'No active request. Add a service record for this vehicle to start approvals.',
                barClass: 'bg-slate-100 border-slate-200 text-slate-800',
            };
        }
        if (isRejected) {
            return {
                title: 'Workflow rejected',
                subtitle: 'This request was rejected. Add a new service to begin again.',
                barClass: 'bg-red-50 border-red-200 text-red-900',
            };
        }
        if (isComplete) {
            return {
                title: 'Workflow complete',
                subtitle: 'All steps approved — vehicle status restored.',
                barClass: 'bg-emerald-50 border-emerald-200 text-emerald-900',
            };
        }
        const byStage = {
            pending_hr: {
                title: 'HR approval',
                subtitle: 'Waiting for Human Resources to approve this service request.',
                barClass: 'bg-amber-50 border-amber-300 text-amber-950',
            },
            pending_accounts: {
                title: 'Accounts approval',
                subtitle: isHoldActive
                    ? `On hold until ${holdInfo?.holdUntilDate ? new Date(holdInfo.holdUntilDate).toLocaleDateString() : '—'}. Clear hold to continue review.`
                    : 'Approve to send to Asset Controller, or place on hold (reason + date).',
                barClass: 'bg-sky-50 border-sky-200 text-sky-950',
            },
            pending_admin: {
                title: 'Asset Controller (Admin)',
                subtitle: 'Set the planned first service day and how many calendar days the in-shop window lasts, then accept.',
                barClass: 'bg-violet-50 border-violet-200 text-violet-950',
            },
            scheduled_service: {
                title: 'Scheduled in-shop service',
                subtitle: wf?.scheduledServiceDate
                    ? `Window: ${formatShortDate(wf.scheduledServiceDate)} → ${formatShortDate(wf.serviceWindowEndDate)}. Before the first day the vehicle stays “Waiting for service”; on that day it moves to “On service” until the window ends.`
                    : 'Service date and duration are set. Use Extend as needed. Mark live is available only when status is On Service.',
                barClass: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-950',
            },
        };
        const base =
            byStage[stage] || {
                title: PIPELINE.find((x) => x.key === stage)?.title || String(stage || ''),
                subtitle: 'Review and approve or reject below.',
                barClass: 'bg-slate-100 border-slate-200 text-slate-800',
            };
        const assigneeName = wf?.currentAssignee?.displayName?.trim?.();
        const subtitle = assigneeName ? `${base.subtitle} Approver now: ${assigneeName}.` : base.subtitle;
        return { ...base, subtitle };
    }, [
        wf?.stage,
        stage,
        isComplete,
        isRejected,
        wf?.currentAssignee?.displayName,
        isHoldActive,
        holdInfo?.holdUntilDate,
        wf?.scheduledServiceDate,
        wf?.serviceWindowEndDate,
    ]);

    const renderTrack = () => {
        if (!wf?.stage) {
            return (
                <p className="text-xs text-gray-500 text-center max-w-md px-2 leading-relaxed">
                    No service workflow yet. It starts when a new service record is added for this vehicle.
                </p>
            );
        }
        if (isRejected) {
            return (
                <p className="text-sm text-red-600 font-medium text-center max-w-md px-2">
                    This workflow was rejected. Add a new service to start again.
                </p>
            );
        }

        return (
            <div className="w-full min-h-0 overflow-x-auto pb-1">
                <div className="min-w-[920px] flex items-start py-2">
                    {PIPELINE.map((step, i) => {
                        const segmentAfterStepDone = isComplete || (currentIdx >= 0 && currentIdx > i);
                        const titleDone = isComplete || (currentIdx >= 0 && i < currentIdx);
                        const titleCurrent = !isComplete && currentIdx >= 0 && i === currentIdx;

                        let line2 = '';
                        if (i === 0) line2 = meta.createdAt ? formatShortDate(meta.createdAt) : '';
                        else if (i === 1) line2 = meta.createdAt ? formatShortDate(meta.createdAt) : '';
                        else line2 = approveDateForPipelineIndex(history, i);

                        return (
                            <Fragment key={step.key}>
                                <div className="flex flex-col items-center w-[120px] shrink-0 mx-0.5">
                                    <StepCircle i={i} currentIdx={currentIdx} allComplete={isComplete} />
                                    <p
                                        className={`mt-3 text-[11px] font-black tracking-wide text-center uppercase leading-tight ${titleDone ? 'text-emerald-600' : titleCurrent ? 'text-slate-700' : 'text-slate-500'
                                            }`}
                                    >
                                        {step.title}
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-500 text-center leading-snug line-clamp-2 px-0.5 min-h-[32px]">
                                        {subtitles[i] || '—'}
                                    </p>
                                    {line2 ? <p className="mt-0.5 text-[10px] text-slate-400 text-center">{line2}</p> : null}
                                </div>
                                {i < n - 1 && <Connector leftDone={segmentAfterStepDone} gapLabel={connectorGaps[i]} />}
                            </Fragment>
                        );
                    })}
                </div>
                {isComplete && (
                    <p className="text-xs text-emerald-700 font-medium text-center mt-3 px-2">
                        All steps approved — vehicle status restored.
                    </p>
                )}
            </div>
        );
    };

    const cardShell = 'min-h-[420px] flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden';

    const currentStageStep = PIPELINE.find((x) => x.key === stage);
    const modalSubtitle =
        currentIdx >= 0 && subtitles[currentIdx] && String(subtitles[currentIdx]).trim() !== ''
            ? subtitles[currentIdx]
            : currentStageStep?.subDefault;

    return (
        <>
            <div className={`lg:col-span-6 ${cardShell}`}>
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-8 gap-5">
                    <VehiclePlateThumbnail
                        plateEmirate={asset?.plateEmirate}
                        plateNumber={asset?.plateNumber}
                        size="large"
                        className="w-full"
                    />
                    <div className="text-center max-w-sm">
                        <p className="text-sm font-semibold text-gray-800">Vehicle plate</p>
                        {asset?.status ? (
                            <span
                                className={`inline-flex mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${vehicleAssetStatusBadgeClass(asset.status)}`}
                            >
                                {asset.status}
                            </span>
                        ) : null}
                        <div className="mt-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Request status</p>
                            <span
                                className={`inline-flex mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${requestStatus.className}`}
                            >
                                {requestStatus.label}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{BREADCRUMB}</p>
                        {asset?.assetId ? (
                            <p className="text-[10px] text-gray-500 mt-1">
                                Asset <span className="font-mono font-medium text-gray-700">{asset.assetId}</span>
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className={`lg:col-span-6 ${cardShell}`}>
                <div
                    className={`px-4 py-3 shrink-0 border-b-2 flex flex-wrap items-start justify-between gap-3 ${workflowBanner.barClass}`}
                >
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold tracking-tight">{workflowBanner.title}</p>
                        <p className="text-xs mt-0.5 opacity-90 leading-snug">{workflowBanner.subtitle}</p>
                        {wf?.serviceRecordId ? (
                            <p className="text-[10px] font-mono text-slate-700 mt-1.5">
                                Service record ID: {String(wf.serviceRecordId)}
                            </p>
                        ) : null}
                        {asset?.assetId ? (
                            <p className="text-[10px] text-slate-600 mt-0.5">
                                Asset <span className="font-mono font-semibold">{asset.assetId}</span>
                            </p>
                        ) : null}
                    </div>
                    {inProgress && canActOnWorkflow ? (
                        <div className="shrink-0 flex flex-wrap items-center gap-2">
                            {isHoldActive ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmUnholdOpen(true)}
                                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold shadow-sm hover:bg-teal-700 transition-colors"
                                >
                                    Unhold (Resume Review)
                                </button>
                            ) : isScheduledStage ? (
                                <>
                                    <button
                                        type="button"
                                        disabled={!canExtendWindow}
                                        title={!canExtendWindow ? 'Extend is only available between the first service day and the last day of the window' : ''}
                                        onClick={() => setSchedModal('extend')}
                                        className="px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Extend
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canMarkLive}
                                        title={!canMarkLive ? 'Mark live is available only when vehicle status is On Service' : ''}
                                        onClick={() => setSchedModal('live')}
                                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Mark live
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSchedModal('reject')}
                                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold shadow-sm hover:bg-red-700 transition-colors"
                                    >
                                        Reject
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPendingIntent('approve');
                                            setApprovalModalOpen(true);
                                        }}
                                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPendingIntent('reject');
                                            setApprovalModalOpen(true);
                                        }}
                                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold shadow-sm hover:bg-red-700 transition-colors"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setApprovalModalOpen(true)}
                                        className="px-4 py-2 rounded-lg bg-white/90 border border-slate-300/80 text-slate-800 text-xs font-bold shadow-sm hover:bg-white hover:border-slate-400 transition-colors"
                                    >
                                        View
                                    </button>
                                </>
                            )}
                        </div>
                    ) : null}
                </div>

                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-5 overflow-y-auto">
                    {!inProgress ? (
                        <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
                            {isRejected
                                ? 'Workflow ended — rejected.'
                                : isComplete
                                    ? 'Workflow completed — vehicle status restored.'
                                    : 'No service workflow yet. It starts when a new service record is added for this vehicle.'}
                        </p>
                    ) : canActOnWorkflow ? (
                        <div className="text-center max-w-sm leading-relaxed space-y-3">
                            <p className="text-sm text-gray-500">
                                You are the assigned approver for this step.
                            </p>
                            {isHoldActive ? (
                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmUnholdOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                                    >
                                        Unhold (Resume Review)
                                    </button>
                                </div>
                            ) : isScheduledStage ? (
                                <>
                                    <p className="text-xs text-slate-600">
                                        Extend: add more calendar days to the in-shop window. Mark live: upload invoice and
                                        complete this service request (enabled only when status is On Service).
                                    </p>
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            disabled={!canExtendWindow}
                                            onClick={() => setSchedModal('extend')}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-50"
                                        >
                                            Extend
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!canMarkLive}
                                            onClick={() => setSchedModal('live')}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                                        >
                                            Mark live
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSchedModal('reject')}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPendingIntent('approve');
                                                setApprovalModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPendingIntent('reject');
                                                setApprovalModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Accept requires required fields (vendor + one quotation where applicable). Admin
                                        requires service date and duration.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center max-w-sm leading-relaxed">
                            {wf?.currentAssignee?.displayName
                                ? `This step is waiting on ${wf.currentAssignee.displayName}. Only they can approve or reject.`
                                : 'This step is assigned to the role shown on the tracker. Only that approver can act.'}
                        </p>
                    )}
                </div>

                {!isComplete ? (
                    <div className="shrink-0 border-t border-gray-200 bg-slate-50/90 px-3 py-3 max-h-[220px] overflow-y-auto overflow-x-auto">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">Progress tracker</p>
                        <div className="flex justify-center min-w-0">{renderTrack()}</div>
                    </div>
                ) : null}
            </div>

            {approvalModalOpen && inProgress && canActOnWorkflow && !isScheduledStage ? (
                <div
                    className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="workflow-approval-modal-title"
                    onClick={() => !loading && setApprovalModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`px-4 py-3 border-b-2 shrink-0 flex items-start justify-between gap-3 ${workflowBanner.barClass}`}>
                            <div className="min-w-0">
                                <p id="workflow-approval-modal-title" className="text-sm font-bold tracking-tight">
                                    {workflowBanner.title}
                                </p>
                                <p className="text-xs mt-0.5 opacity-90 leading-snug">{workflowBanner.subtitle}</p>
                            </div>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => setApprovalModalOpen(false)}
                                className="p-2 rounded-lg text-slate-600 hover:bg-black/5 transition-colors shrink-0"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 min-h-0 flex flex-col">
                            <div className="px-6 pt-4 pb-2 border-b border-gray-100 shrink-0">
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide inline-block border-b-2 border-gray-900 pb-1 pr-8">
                                    {currentStageStep?.title || stage}
                                </h3>
                                <p className="text-xs text-gray-600 mt-2">{modalSubtitle}</p>
                                <p className="text-[11px] text-slate-500 mt-2">
                                    {stage === 'pending_accounts'
                                        ? 'Review the requester details below. Approve to send to Asset Controller, use Hold with reason and date to notify the driver, or Reject with a reason.'
                                        : 'Review and edit the service details below if needed, then approve or reject.'}
                                </p>
                            </div>

                            {workflowServiceRecord ? (
                                <VehicleServiceModal
                                    ref={serviceFormRef}
                                    embedMode
                                    hideFormFooter
                                    isOpen={approvalModalOpen}
                                    onClose={() => { }}
                                    onSuccess={() => { }}
                                    assetId={assetId}
                                    workflowServiceRecord={workflowServiceRecord}
                                    assignedEmployee={asset?.assignedTo}
                                    workflowStage={stage}
                                />
                            ) : (
                                <p className="p-6 text-sm text-amber-800 bg-amber-50/80">
                                    Service record not found on this asset. You can still reject with a note, or close and refresh the page.
                                </p>
                            )}

                            <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0 bg-slate-50/50">
                                {stage === 'pending_accounts' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Hold reason</label>
                                            <input
                                                type="text"
                                                value={holdReason}
                                                onChange={(e) => setHoldReason(e.target.value)}
                                                placeholder="Required when using Hold"
                                                className="w-full px-3 py-2 border border-amber-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500/20 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Hold until date</label>
                                            <input
                                                type="date"
                                                value={holdUntilDate}
                                                onChange={(e) => setHoldUntilDate(e.target.value)}
                                                className="w-full px-3 py-2 border border-amber-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500/20 outline-none"
                                            />
                                        </div>
                                    </div>
                                ) : null}
                                <label className="block text-xs font-semibold text-gray-700">
                                    Note (required when rejecting)
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Rejection reason (required). Optional note on approve."
                                    rows={3}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-y focus:ring-2 focus:ring-teal-500/15 focus:border-teal-400 outline-none bg-white"
                                />
                                <div className="flex flex-wrap gap-3 pt-1">
                                    {isHoldActive ? (
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => handleUnholdClick()}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold disabled:opacity-50 shadow-sm"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                            Unhold (Resume Review)
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                disabled={loading || !workflowServiceRecord}
                                                onClick={() => handleApproveClick()}
                                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 shadow-sm"
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                                Accept
                                            </button>
                                            {stage === 'pending_accounts' ? (
                                                <button
                                                    type="button"
                                                    disabled={loading}
                                                    onClick={() => handleHoldClick()}
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 shadow-sm"
                                                >
                                                    <PauseCircle size={16} />
                                                    Hold
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => handleRejectClick()}
                                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 shadow-sm"
                                            >
                                                Reject
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {schedModal && inProgress && canActOnWorkflow && isScheduledStage ? (
                <div
                    className="fixed inset-0 z-[135] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => !loading && setSchedModal(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-3 border-b border-slate-100">
                            <p className="text-sm font-bold text-slate-900">
                                {schedModal === 'extend'
                                    ? 'Extend service window'
                                    : schedModal === 'live'
                                        ? 'Mark live — complete workflow'
                                        : 'Reject scheduled request'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {schedModal === 'extend'
                                    ? 'Add whole calendar days to the end of the current window.'
                                    : schedModal === 'live'
                                        ? 'Add a short description to complete this service request and restore vehicle status.'
                                        : 'This will reject this scheduled service request and restore vehicle status.'}
                            </p>
                        </div>
                        <div className="p-4 space-y-3">
                            {schedModal === 'extend' ? (
                                <>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700">Extra days</label>
                                        <input
                                            type="number"
                                            min={1}
                                            step={1}
                                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                            value={extendDays}
                                            onChange={(e) => setExtendDays(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700">Note (optional)</label>
                                        <textarea
                                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y min-h-[72px]"
                                            value={extendNote}
                                            onChange={(e) => setExtendNote(e.target.value)}
                                            rows={2}
                                        />
                                    </div>
                                </>
                            ) : schedModal === 'live' || schedModal === 'reject' ? (
                                <>
                                    {schedModal === 'live' ? (
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700">Attachment (optional)</label>
                                            <div
                                                className={`mt-1 relative flex items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${liveInvoice.name ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
                                            >
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) {
                                                            setLiveInvoice({ name: '', data: '', mime: '' });
                                                            return;
                                                        }
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            const r = String(reader.result || '');
                                                            const base64 = r.includes(',') ? r.split(',')[1] : r;
                                                            setLiveInvoice({
                                                                name: file.name,
                                                                data: base64,
                                                                mime: file.type || 'application/pdf',
                                                            });
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }}
                                                />
                                                <div className="text-center pointer-events-none px-2">
                                                    {liveInvoice.name ? (
                                                        <>
                                                            <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[260px]">{liveInvoice.name}</p>
                                                            <p className="text-[10px] text-teal-700 font-bold mt-1">Click to change</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Upload attachment</p>
                                                            <p className="text-[10px] text-slate-400 mt-1">PDF, JPG, PNG</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700">
                                            Description {schedModal === 'live' ? <span className="text-red-500">*</span> : null}
                                        </label>
                                        <textarea
                                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y min-h-[72px]"
                                            value={liveNote}
                                            onChange={(e) => setLiveNote(e.target.value)}
                                            rows={2}
                                            placeholder={schedModal === 'live' ? 'Enter description (required)' : 'Enter note (optional)'}
                                        />
                                    </div>
                                </>
                            ) : null}
                        </div>
                        <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80">
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => setSchedModal(null)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-200/80"
                            >
                                Cancel
                            </button>
                            {schedModal === 'extend' ? (
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => {
                                        const d = Math.floor(Number(extendDays));
                                        if (!Number.isFinite(d) || d < 1) {
                                            toast({ variant: 'destructive', title: 'Check days', description: 'Enter at least 1 day.' });
                                            return;
                                        }
                                        submitScheduledPeriod({ action: 'extend', extendDays: d, comment: extendNote.trim() || undefined });
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save extend'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={loading || (schedModal === 'live' && !liveNote.trim())}
                                    onClick={() => {
                                        submitScheduledPeriod({
                                            action: schedModal === 'reject' ? 'reject' : 'go_live',
                                            comment: liveNote.trim() || undefined,
                                            ...(schedModal === 'live' && liveInvoice.data
                                                ? {
                                                    invoice: {
                                                        name: liveInvoice.name,
                                                        data: liveInvoice.data,
                                                    },
                                                }
                                                : {}),
                                        });
                                    }}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${schedModal === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                >
                                    {loading ? 'Saving...' : schedModal === 'reject' ? 'Confirm reject' : 'Complete (mark live)'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            <AlertDialog open={confirmUnholdOpen} onOpenChange={setConfirmUnholdOpen}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear hold and resume review?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the hold status and return the request to live review.
                            Accept/Reject actions will be available again for Accounts.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={loading}
                            onClick={(e) => {
                                e.preventDefault();
                                handleUnholdClick().then(() => setConfirmUnholdOpen(false));
                            }}
                        >
                            {loading ? 'Processing...' : 'OK'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
