'use client';

import { Fragment, useMemo } from 'react';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { mongoIdsEqual, normalizeMongoId } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

const PIPELINE = [
    { key: 'created', title: 'CREATED', subDefault: 'System' },
    { key: 'requester', title: 'REQUESTER', subDefault: 'Requester' },
    { key: 'pending_hr', title: 'HR', subDefault: '—' },
    { key: 'pending_accounts', title: 'ACCOUNTS', subDefault: '—' },
    { key: 'pending_admin', title: 'ADMIN', subDefault: 'Asset Controller' },
];

const BREADCRUMB = 'Created → Requester → HR → Accounts → Admin (on service)';

function stageToCurrentIndex(st) {
    if (!st || st === 'rejected') return -1;
    if (st === 'complete') return -1;
    if (st === 'pending_management') return 4;
    const m = {
        pending_hr: 2,
        pending_accounts: 3,
        pending_admin: 4,
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

/**
 * Same workflow sources as vehicle details Service tab: live activeServiceWorkflow when this
 * row is the active request, else services[].workflowSnapshot on the asset, else fleet API snapshot.
 */
function resolveWorkflowView(asset, serviceRecordId, workflowSnapshotProp) {
    const sid = normalizeMongoId(serviceRecordId);
    if (!sid) return workflowSnapshotProp ?? null;

    const live = asset?.activeServiceWorkflow;
    const liveMatches = live?.serviceRecordId != null && mongoIdsEqual(live.serviceRecordId, sid);
    const liveHasBody = !!(live?.stage || (Array.isArray(live?.history) && live.history.length > 0));
    if (liveMatches && liveHasBody) {
        return live;
    }

    const sub = Array.isArray(asset?.services)
        ? asset.services.find((s) => s?._id != null && mongoIdsEqual(s._id, sid))
        : null;
    const emb = sub?.workflowSnapshot;
    if (emb) {
        const sh = Array.isArray(emb.history) ? emb.history : [];
        if (emb.stage || sh.length) {
            return {
                stage: emb.stage,
                serviceTypeLabel: emb.serviceTypeLabel || '',
                serviceRecordId: emb.serviceRecordId || sub._id,
                history: sh,
            };
        }
    }
    if (workflowSnapshotProp != null && typeof workflowSnapshotProp === 'object') {
        if (workflowSnapshotProp.trailIncomplete && liveHasBody) {
            // Fallback for older rows where list snapshot could not be rebuilt.
            return live;
        }
        return workflowSnapshotProp;
    }
    return null;
}

/**
 * Read-only copy of the vehicle details “Progress tracker” for a service workflow.
 * Pass the asset from GET /AssetItem/detail/:id (with services[]) for parity with the details page.
 */
export default function VehicleServiceWorkflowTrackReadonly({
    asset,
    /** When set (from fleet list API), used only until asset detail is loaded */
    workflowSnapshot = null,
    serviceRecordId,
    vehicleDetailHref,
    loading,
    errorMessage,
}) {
    const wf = useMemo(
        () => resolveWorkflowView(asset, serviceRecordId, workflowSnapshot),
        [asset, serviceRecordId, workflowSnapshot]
    );
    const history = wf?.history || [];
    const stage = wf?.stage;

    const matches = useMemo(() => {
        if (!serviceRecordId) return false;
        if (wf && typeof wf === 'object' && (wf.stage || (Array.isArray(wf.history) && wf.history.length) || wf.trailIncomplete)) {
            return true;
        }
        if (workflowSnapshot != null && typeof workflowSnapshot === 'object') return true;
        const live = asset?.activeServiceWorkflow;
        if (live?.serviceRecordId && mongoIdsEqual(live.serviceRecordId, serviceRecordId)) return true;
        const sub = Array.isArray(asset?.services)
            ? asset.services.find((s) => s?._id != null && mongoIdsEqual(s._id, serviceRecordId))
            : null;
        const emb = sub?.workflowSnapshot;
        if (emb && (emb.stage || (Array.isArray(emb.history) && emb.history.length))) return true;
        return false;
    }, [serviceRecordId, wf, workflowSnapshot, asset]);

    const meta = useMemo(() => buildHistoryMeta(history), [history]);
    const currentIdx = useMemo(() => stageToCurrentIndex(stage), [stage]);
    const isComplete = stage === 'complete';
    const isRejected = stage === 'rejected';
    const inProgress = stage && !['complete', 'rejected'].includes(stage);

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
        const pendingName = wf?.currentAssignee?.displayName?.trim?.();
        if (inProgress && currentIdx >= 0 && pendingName) {
            s[currentIdx] = pendingName;
        }
        return s;
    }, [history, meta.requesterName, wf?.currentAssignee?.displayName, inProgress, currentIdx]);

    const connectorGaps = useMemo(() => {
        const d0 = meta.createdAt;
        const gaps = [];
        gaps[0] = formatGapLabel(d0, meta.hrAt || d0);
        gaps[1] = formatGapLabel(meta.hrAt || d0, meta.accAt || meta.hrAt);
        gaps[2] = formatGapLabel(meta.accAt || meta.hrAt, meta.acAt || meta.accAt);
        gaps[3] = formatGapLabel(meta.acAt || meta.accAt, new Date());
        if (d0 && !gaps[0]) gaps[0] = '< 1D';
        return gaps;
    }, [meta]);

    const workflowBanner = useMemo(() => {
        if (wf?.trailIncomplete) {
            return {
                title: 'Approval timeline not on file for this line',
                subtitle:
                    'No stored steps could be matched to this service row yet (older data or missing service id in logs). Use Refresh on the list after approvals so snapshots sync.',
                barClass: 'bg-slate-100 border-slate-200 text-slate-800',
            };
        }
        if (!wf?.stage) {
            return {
                title: 'No workflow on file',
                subtitle: 'This vehicle has no active service workflow data.',
                barClass: 'bg-slate-100 border-slate-200 text-slate-800',
            };
        }
        if (isRejected) {
            return {
                title: 'Workflow rejected',
                subtitle: 'This request was rejected.',
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
                subtitle: 'Waiting for Accounts to approve.',
                barClass: 'bg-sky-50 border-sky-200 text-sky-950',
            },
            pending_admin: {
                title: 'Asset Controller',
                subtitle: 'Waiting for Asset Controller to close the workflow.',
                barClass: 'bg-violet-50 border-violet-200 text-violet-950',
            },
            pending_management: {
                title: 'Asset Controller (legacy)',
                subtitle: 'Older workflow step — complete from Asset Controller.',
                barClass: 'bg-violet-50 border-violet-200 text-violet-950',
            },
        };
        const base =
            byStage[stage] || {
                title: PIPELINE.find((x) => x.key === stage)?.title || String(stage || ''),
                subtitle: 'Review in progress.',
                barClass: 'bg-slate-100 border-slate-200 text-slate-800',
            };
        const assigneeName = wf?.currentAssignee?.displayName?.trim?.();
        const subtitle = assigneeName ? `${base.subtitle} Approver now: ${assigneeName}.` : base.subtitle;
        return { ...base, subtitle };
    }, [wf?.stage, wf?.trailIncomplete, stage, isComplete, isRejected, wf?.currentAssignee?.displayName]);

    const n = PIPELINE.length;

    if (loading) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
                Loading workflow…
            </div>
        );
    }

    if (errorMessage) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-4 text-sm text-red-800">{errorMessage}</div>
        );
    }

    if (!matches) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-2">
                <p className="text-sm font-semibold text-slate-800">No tracker data for this view</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                    Load this vehicle’s detail page with the Service tab open to see the live workflow, or ensure the
                    service record is linked to approval history.
                </p>
                {vehicleDetailHref ? (
                    <Link href={`${vehicleDetailHref}?tab=service`} className="inline-flex text-xs font-bold text-teal-700 hover:underline">
                        Open vehicle details (Service tab) →
                    </Link>
                ) : null}
            </div>
        );
    }

    const renderTrack = () => {
        if (wf?.trailIncomplete) {
            return (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-center space-y-2">
                    <p className="text-sm text-slate-700">
                        This row has no matched history in the list response. New approvals save snapshots on each service
                        line automatically — try Refresh, or open the vehicle Service tab for the live workflow.
                    </p>
                    {vehicleDetailHref ? (
                        <Link
                            href={`${vehicleDetailHref}?tab=service`}
                            className="inline-flex text-xs font-bold text-teal-700 hover:underline"
                        >
                            Open vehicle details (Service tab) →
                        </Link>
                    ) : null}
                </div>
            );
        }
        if (isRejected) {
            return (
                <p className="text-sm text-red-600 font-medium text-center max-w-md px-2">
                    This workflow was rejected. Add a new service on the vehicle to start again.
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
                                        className={`mt-3 text-[11px] font-black tracking-wide text-center uppercase leading-tight ${
                                            titleDone ? 'text-emerald-600' : titleCurrent ? 'text-slate-700' : 'text-slate-500'
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

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div
                className={`px-4 py-3 border-b-2 flex flex-wrap items-start justify-between gap-3 ${workflowBanner.barClass}`}
            >
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tracking-tight">{workflowBanner.title}</p>
                    <p className="text-xs mt-0.5 opacity-90 leading-snug">{workflowBanner.subtitle}</p>
                    {(wf?.serviceRecordId || serviceRecordId) ? (
                        <p className="text-[10px] font-mono text-slate-700 mt-1.5">
                            Service record ID: {String(wf?.serviceRecordId || serviceRecordId)}
                        </p>
                    ) : null}
                    {asset?.assetId ? (
                        <p className="text-[10px] text-slate-600 mt-0.5">
                            Asset <span className="font-mono font-semibold">{asset.assetId}</span>
                        </p>
                    ) : null}
                </div>
            </div>
            <div
                className={
                    wf?.trailIncomplete
                        ? 'px-4 py-4 border-b border-slate-100 bg-white'
                        : 'px-4 py-3 border-b border-slate-100 bg-slate-50/50'
                }
            >
                {!wf?.trailIncomplete ? (
                    <>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                            Progress tracker
                        </p>
                        <p className="text-[11px] text-slate-500 mb-3">{BREADCRUMB}</p>
                    </>
                ) : null}
                {renderTrack()}
            </div>
        </div>
    );
}
