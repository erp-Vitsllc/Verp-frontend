'use client';

import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader2, X, PauseCircle, UserCheck, Layers, CalendarRange, ClipboardList, FileText } from 'lucide-react';
import VehicleServiceModal from '@/app/HRM/Asset/Vehicle/components/VehicleServiceModal';
import { parseVehicleServiceRemark } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';
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

const STATIC_VENDOR_OPTIONS = [
    'Al Futtaim Motors',
    'AGMC',
    'Emirates Motor Company',
    'Dynatrade',
    'FastTrack Auto',
    'Galadari Automobiles',
    'Arabian Automobiles',
    'Premier Car Care',
];

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

function computeReturnDateFromService(baseDate, serviceDuration) {
    const base = String(baseDate || '').trim();
    const days = Math.floor(Number(serviceDuration));
    if (!base || !Number.isFinite(days) || days < 1) return '';
    const d = new Date(base);
    if (Number.isNaN(d.getTime())) return '';
    // Requested formula: next return date = current return date + duration
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
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

function normalizeServiceStatusFormValue(v) {
    return String(v || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

/** Status shown in "Return from service to live" — driven by workflow stage + vehicle, not manual picks. */
function deriveReturnFormServiceStatus({ stage, assetStatus, accidentServiceStatusFromRemark }) {
    const st = String(stage || '').trim();
    const assetSt = String(assetStatus || '').trim().toLowerCase();
    const remarkNorm = normalizeServiceStatusFormValue(accidentServiceStatusFromRemark);

    if (st === 'complete') return 'complete';
    if (st === 'rejected') return 'rejected';
    if (st === 'scheduled_service') {
        if (assetSt === 'on service') return 'on_service';
        if (remarkNorm === 'on_service' || remarkNorm === 'complete') return remarkNorm;
        if (remarkNorm === 'scheduled_service') return 'scheduled_service';
        return 'scheduled_service';
    }
    if (st === 'pending_admin' || st === 'pending_management') return 'pending_admin';
    if (['pending_admin', 'scheduled_service', 'on_service', 'complete', 'rejected'].includes(remarkNorm)) {
        return remarkNorm;
    }
    return remarkNorm || 'scheduled_service';
}

function serviceStatusFormLabel(value) {
    const v = normalizeServiceStatusFormValue(value);
    const labels = {
        pending_admin: 'Pending Admin',
        scheduled_service: 'Scheduled Service',
        on_service: 'On Service',
        complete: 'Complete',
        rejected: 'Rejected',
    };
    return labels[v] || (v ? v.replace(/_/g, ' ') : '—');
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

export default function VehicleServiceWorkflowCards({ asset, assetId, serviceRecordId, onUpdated }) {
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
    const [liveShopInvoice, setLiveShopInvoice] = useState({ name: '', data: '', mime: '' });
    const [accidentActionForm, setAccidentActionForm] = useState({
        serviceDate: '',
        garageName: '',
        serviceDuration: '',
        garageLocation: '',
        serviceReturnDate: '',
    });
    const [accidentStatusForm, setAccidentStatusForm] = useState({
        serviceStatus: '',
        serviceReport: { name: '', data: '', mime: '' },
        returnShopInvoice: { name: '', data: '', mime: '' },
        description: '',
        returnDate: '',
        returnMode: 'date',
        extendDays: '',
        returnStatus: '',
    });
    const [hrReason, setHrReason] = useState('');
    const [hrVendorName, setHrVendorName] = useState('');
    const [hrSelectedQuotation, setHrSelectedQuotation] = useState('');
    const [accountsReason, setAccountsReason] = useState('');
    const [accountsHoldDialogOpen, setAccountsHoldDialogOpen] = useState(false);
    const [hrApproveDialogOpen, setHrApproveDialogOpen] = useState(false);
    const [hrRejectDialogOpen, setHrRejectDialogOpen] = useState(false);
    const [accountsApproveConfirmOpen, setAccountsApproveConfirmOpen] = useState(false);
    const [accountsHoldDurationDays, setAccountsHoldDurationDays] = useState('1');
    const [serviceReportFileReading, setServiceReportFileReading] = useState(false);
    const [shopInvoiceFileReading, setShopInvoiceFileReading] = useState(false);
    const [changeServiceDateOpen, setChangeServiceDateOpen] = useState(false);
    const [changeServiceDateDraft, setChangeServiceDateDraft] = useState('');
    const [changeServiceDateSaving, setChangeServiceDateSaving] = useState(false);
    const serviceFormRef = useRef(null);
    const lastPrefillKeyRef = useRef('');
    const [viewerEmployeeId, setViewerEmployeeId] = useState('');
    const [viewerEmployeeObjectId, setViewerEmployeeObjectId] = useState('');
    const [viewerIsAdminUser, setViewerIsAdminUser] = useState(false);

    const activeWf = asset?.activeServiceWorkflow;
    const selectedServiceRecord = useMemo(() => {
        if (!serviceRecordId || !Array.isArray(asset?.services)) return null;
        return asset.services.find((s) => String(s?._id || '') === String(serviceRecordId)) || null;
    }, [asset?.services, serviceRecordId]);
    const activeMatchesSelected = useMemo(() => {
        if (!serviceRecordId) return true;
        return String(activeWf?.serviceRecordId || '') === String(serviceRecordId);
    }, [activeWf?.serviceRecordId, serviceRecordId]);
    const wf = useMemo(() => {
        if (activeMatchesSelected) return activeWf || null;
        const snap = selectedServiceRecord?.workflowSnapshot;
        if (snap && (snap.stage || (Array.isArray(snap.history) && snap.history.length))) return snap;
        return activeWf || null;
    }, [activeMatchesSelected, activeWf, selectedServiceRecord?.workflowSnapshot]);
    const stage = wf?.stage;
    const history = Array.isArray(wf?.history) ? wf.history : [];
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem('employeeUser') || localStorage.getItem('user');
            const parsed = raw ? JSON.parse(raw) : null;
            setViewerEmployeeId(String(parsed?.employeeId || '').trim());
            setViewerEmployeeObjectId(String(parsed?.employeeObjectId || parsed?._id || '').trim());
            const role = String(parsed?.role || parsed?.userRole || '').toLowerCase();
            const adminFlag =
                parsed?.isAdmin === true ||
                role === 'admin' ||
                role === 'root' ||
                role === 'asset controller';
            setViewerIsAdminUser(adminFlag);
        } catch {
            setViewerEmployeeId('');
            setViewerEmployeeObjectId('');
            setViewerIsAdminUser(false);
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

    // Keep UI controls strict to avoid showing actions that backend will reject.
    const canActOnWorkflow =
        activeMatchesSelected &&
        (
            asset?.canRespondToServiceWorkflow === true ||
            isCurrentApprover ||
            viewerIsAdminUser
        );
    const canActStrict = activeMatchesSelected && (isCurrentApprover || viewerIsAdminUser);

    const meta = useMemo(() => buildHistoryMeta(history), [history]);
    const currentIdx = useMemo(() => stageToCurrentIndex(stage), [stage]);
    const isScheduledStage = stage === 'scheduled_service';

    const inProgress = stage && !['complete', 'rejected'].includes(stage);
    const isComplete = stage === 'complete';
    const isRejected = stage === 'rejected';
    const blankWorkflowCard = !(inProgress || isComplete || isRejected);
    const holdInfo = wf?.accountsHold || null;
    const isHoldActive = stage === 'pending_accounts' && !!holdInfo?.holdUntilDate;

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
        const sid = serviceRecordId || wf?.serviceRecordId;
        if (!sid || !Array.isArray(asset?.services)) return null;
        return asset.services.find((s) => String(s._id) === String(sid)) || null;
    }, [serviceRecordId, wf?.serviceRecordId, asset?.services]);
    const accidentMeta = useMemo(
        () => parseVehicleServiceRemark(workflowServiceRecord) || {},
        [workflowServiceRecord]
    );
    const hasPersistedCompletionReport =
        !!String(workflowServiceRecord?.serviceCompletionReport || '').trim() ||
        (!!(
            accidentMeta?.serviceReportName ||
            accidentMeta?.serviceReportMime ||
            accidentMeta?.serviceReportUpdatedAt
        ) &&
            !!String(workflowServiceRecord?.invoice || '').trim());
    const hasPersistedShopInvoice =
        !!String(workflowServiceRecord?.shopInvoice || '').trim() ||
        !!(accidentMeta?.shopInvoiceName || accidentMeta?.shopInvoiceUpdatedAt);
    const isAccidentRepairRequest = String(workflowServiceRecord?.serviceType || '').trim() === 'Accident Repair';
    const garageOptions = useMemo(() => {
        const set = new Set();
        const add = (v) => {
            const x = String(v || '').trim();
            if (x) set.add(x);
        };
        STATIC_VENDOR_OPTIONS.forEach(add);
        add(accidentMeta?.vendorName);
        add(accidentMeta?.approvedQuotationChoice);
        if (Array.isArray(asset?.services)) {
            asset.services.forEach((srv) => {
                const r = parseVehicleServiceRemark(srv) || {};
                add(r.vendorName);
                add(r.approvedQuotationChoice);
            });
        }
        return Array.from(set);
    }, [asset?.services, accidentMeta?.vendorName, accidentMeta?.approvedQuotationChoice]);
    const workflowQuotationRows = useMemo(() => {
        const remark = parseVehicleServiceRemark(workflowServiceRecord) || {};
        const qAmounts = remark?.quotationAmounts || {};
        return [
            { key: 'q1', label: 'Quotation 1', url: workflowServiceRecord?.attachment, amount: qAmounts?.q1 },
            { key: 'q2', label: 'Quotation 2', url: workflowServiceRecord?.quotation2, amount: qAmounts?.q2 },
            { key: 'q3', label: 'Quotation 3', url: workflowServiceRecord?.quotation3, amount: qAmounts?.q3 },
        ].filter((q) => !!q.url);
    }, [workflowServiceRecord]);

    const canExtendWindow = isScheduledStage;
    const isOnServiceNow = String(asset?.status || '').trim().toLowerCase() === 'on service';
    const isAdminStage = stage === 'pending_admin';
    const isActionFormComplete = useMemo(() => {
        return (
            String(accidentActionForm.serviceDate || '').trim() !== '' &&
            String(accidentActionForm.garageName || '').trim() !== '' &&
            String(accidentActionForm.serviceDuration || '').trim() !== '' &&
            String(accidentActionForm.garageLocation || '').trim() !== '' &&
            String(accidentActionForm.serviceReturnDate || '').trim() !== ''
        );
    }, [accidentActionForm]);
    const canEditAdminActionForm = isAdminStage && canActStrict && !isOnServiceNow;

    const metaServiceStatusNorm = String(accidentMeta?.accidentServiceStatus || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    const vehicleServiceDoneFlag = String(accidentMeta?.vehicleServiceCompleted || '').trim().toLowerCase();
    const statusFormFieldsLocked =
        stage === 'complete' ||
        isComplete ||
        ['complete', 'completed'].includes(metaServiceStatusNorm) ||
        ['live', 'complete'].includes(vehicleServiceDoneFlag);

    const hrApproveEntry = useMemo(
        () => history.find((x) => x.stage === 'pending_hr' && x.action === 'approve') || null,
        [history]
    );
    const hrRejectEntry = useMemo(
        () => history.find((x) => x.stage === 'pending_hr' && x.action === 'reject') || null,
        [history]
    );
    const accountsApproveEntry = useMemo(
        () => history.find((x) => x.stage === 'pending_accounts' && x.action === 'approve') || null,
        [history]
    );
    const accountsHoldEntry = useMemo(
        () => history.find((x) => x.stage === 'pending_accounts' && x.action === 'hold') || null,
        [history]
    );
    const accountsRejectEntry = useMemo(
        () => history.find((x) => x.stage === 'pending_accounts' && x.action === 'reject') || null,
        [history]
    );
    const adminApproveEntry = useMemo(
        () => [...history].reverse().find((x) => x.stage === 'pending_admin' && x.action === 'approve') || null,
        [history]
    );
    const adminLiveEntry = useMemo(
        () => [...history].reverse().find((x) => x.stage === 'scheduled_service' && x.action === 'go_live') || null,
        [history]
    );
    const adminHeaderEntry = adminLiveEntry || adminApproveEntry;
    const canChangeScheduledFirstDay =
        !!workflowServiceRecord &&
        activeMatchesSelected &&
        isScheduledStage &&
        !!adminApproveEntry &&
        !isComplete &&
        !isRejected &&
        canActOnWorkflow;
    const scheduledAdminDisplayName =
        adminLiveEntry?.byName || adminApproveEntry?.byName || wf?.currentAssignee?.displayName?.trim?.() || '';
    const completionReportReady =
        !!(String(accidentStatusForm.serviceReport?.data || '').trim()) || hasPersistedCompletionReport;
    const shopInvoiceReady =
        !!(String(accidentStatusForm.returnShopInvoice?.data || '').trim()) || hasPersistedShopInvoice;
    const canSubmitStatusForm =
        isScheduledStage &&
        canActOnWorkflow &&
        isOnServiceNow &&
        !statusFormFieldsLocked &&
        !serviceReportFileReading &&
        !shopInvoiceFileReading &&
        completionReportReady &&
        shopInvoiceReady;
    const hrApproved = !!hrApproveEntry;
    const accountsApproved = !!accountsApproveEntry;
    const showAccountsSection =
        hrApproved ||
        ['pending_accounts', 'pending_admin', 'scheduled_service'].includes(String(stage || '').trim()) ||
        isComplete;
    const showActionFormSection =
        accountsApproved ||
        ['pending_admin', 'scheduled_service'].includes(String(stage || '').trim()) ||
        isComplete;
    const showStatusFormSection =
        ['scheduled_service'].includes(String(stage || '').trim()) ||
        isComplete;

    const scheduledReturnSubmitWaitingOnService =
        showStatusFormSection &&
        isScheduledStage &&
        canActOnWorkflow &&
        !isOnServiceNow &&
        !statusFormFieldsLocked;

    const derivedReturnFormServiceStatus = useMemo(
        () =>
            deriveReturnFormServiceStatus({
                stage,
                assetStatus: asset?.status,
                accidentServiceStatusFromRemark: accidentMeta?.accidentServiceStatus,
            }),
        [stage, asset?.status, accidentMeta?.accidentServiceStatus]
    );

    const wfStageStr = String(stage || '').trim();
    /** HR / Accounts boxes: only after the workflow has entered the HR step (or finished HR / moved on). */
    const showHrAccountsRow =
        !!workflowServiceRecord &&
        !!wf?.stage &&
        (wfStageStr === 'pending_hr' ||
            hrApproved ||
            !!hrRejectEntry ||
            ['pending_accounts', 'pending_admin', 'pending_management', 'scheduled_service'].includes(wfStageStr) ||
            isComplete ||
            isRejected);

    useEffect(() => {
        if (!showStatusFormSection) return;
        setAccidentStatusForm((prev) => {
            let v = derivedReturnFormServiceStatus;
            if (prev.returnMode === 'extend') {
                v = 'on_service';
            }
            if (!v) return prev;
            if (prev.serviceStatus === v) return prev;
            return { ...prev, serviceStatus: v };
        });
    }, [derivedReturnFormServiceStatus, showStatusFormSection, accidentStatusForm.returnMode]);

    useEffect(() => {
        const sid = String(workflowServiceRecord?._id || wf?.serviceRecordId || '');
        if (!sid) return;
        const prefillKey = [
            sid,
            String(workflowServiceRecord?.updatedAt || workflowServiceRecord?.date || ''),
            String(stage || ''),
        ].join('|');
        if (lastPrefillKeyRef.current === prefillKey) return;
        lastPrefillKeyRef.current = prefillKey;

        const parsedDuration = String(workflowServiceRecord?.serviceDuration || '').match(/\d+/)?.[0] || '';
        const durationDays = String(accidentMeta?.accidentRepairDurationDays || '').trim() || parsedDuration;
        const serviceDateIso = workflowServiceRecord?.date
            ? new Date(workflowServiceRecord.date).toISOString().slice(0, 10)
            : '';
        const defaultReturnDate = String(
            accidentMeta?.accidentReturnDate || accidentMeta?.serviceReturnDate || ''
        ).trim();

        setAccidentActionForm({
            serviceDate: serviceDateIso,
            garageName: String(accidentMeta?.vendorName || accidentMeta?.approvedQuotationChoice || '').trim(),
            serviceDuration: String(durationDays || '').trim(),
            garageLocation: String(accidentMeta?.garageLocation || '').trim(),
            serviceReturnDate: defaultReturnDate,
        });
        setAccidentStatusForm((prev) => ({
            ...prev,
            description: String(workflowServiceRecord?.description || ''),
            returnMode: String(accidentMeta?.returnMode || 'date').trim() || 'date',
            returnDate: String(accidentMeta?.accidentReturnDate || '').trim() || defaultReturnDate,
            extendDays: String(accidentMeta?.accidentExtendDays || ''),
            returnStatus: String(accidentMeta?.accidentReturnStatus || prev.returnStatus || 'Confirmed'),
        }));
    }, [
        workflowServiceRecord?._id,
        workflowServiceRecord?.updatedAt,
        workflowServiceRecord?.date,
        workflowServiceRecord?.serviceDuration,
        workflowServiceRecord?.description,
        accidentMeta?.vendorName,
        accidentMeta?.approvedQuotationChoice,
        accidentMeta?.accidentRepairDurationDays,
        accidentMeta?.garageLocation,
        accidentMeta?.serviceReturnDate,
        accidentMeta?.accidentReturnDate,
        accidentMeta?.accidentServiceStatus,
        accidentMeta?.returnMode,
        accidentMeta?.accidentExtendDays,
        accidentMeta?.accidentReturnStatus,
        wf?.serviceRecordId,
        stage,
    ]);

    useEffect(() => {
        if (!isAccidentRepairRequest) return;
        if (accidentStatusForm.returnMode !== 'date') return;
        const autoDate = computeReturnDateFromService(
            accidentActionForm.serviceReturnDate || accidentActionForm.serviceDate,
            accidentActionForm.serviceDuration
        );
        if (!autoDate) return;
        setAccidentActionForm((prev) => {
            if (String(prev.serviceReturnDate || '').trim() === autoDate) return prev;
            return { ...prev, serviceReturnDate: autoDate };
        });
        setAccidentStatusForm((prev) => {
            if (String(prev.returnDate || '').trim() === autoDate) return prev;
            return { ...prev, returnDate: autoDate };
        });
    }, [
        isAccidentRepairRequest,
        accidentStatusForm.returnMode,
        accidentActionForm.serviceDate,
        accidentActionForm.serviceDuration,
    ]);

    const buildWorkflowUploadPayload = (fileState) => {
        const raw = String(fileState?.data || '').trim();
        if (!raw) return undefined;
        return {
            name: String(fileState?.name || '').trim() || 'document.pdf',
            data: raw,
            mime: String(fileState?.mime || '').trim() || undefined,
        };
    };

    const handleServiceReportUpload = (file) => {
        if (!file) {
            setAccidentStatusForm((prev) => ({ ...prev, serviceReport: { name: '', data: '', mime: '' } }));
            return;
        }
        setServiceReportFileReading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            setServiceReportFileReading(false);
            const raw = String(reader.result || '').trim();
            if (!raw) {
                toast({
                    variant: 'destructive',
                    title: 'Read failed',
                    description: 'Could not read the selected file. Try again or use a smaller PDF/image.',
                });
                return;
            }
            setAccidentStatusForm((prev) => ({
                ...prev,
                serviceReport: {
                    name: file.name,
                    data: raw,
                    mime: file.type || 'application/pdf',
                },
            }));
        };
        reader.onerror = () => {
            setServiceReportFileReading(false);
            toast({
                variant: 'destructive',
                title: 'Read failed',
                description: 'The browser could not read this file.',
            });
        };
        reader.readAsDataURL(file);
    };

    const handleReturnShopInvoiceUpload = (file) => {
        if (!file) {
            setAccidentStatusForm((prev) => ({ ...prev, returnShopInvoice: { name: '', data: '', mime: '' } }));
            return;
        }
        setShopInvoiceFileReading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            setShopInvoiceFileReading(false);
            const raw = String(reader.result || '').trim();
            if (!raw) {
                toast({
                    variant: 'destructive',
                    title: 'Read failed',
                    description: 'Could not read the selected file. Try again or use a smaller PDF/image.',
                });
                return;
            }
            setAccidentStatusForm((prev) => ({
                ...prev,
                returnShopInvoice: {
                    name: file.name,
                    data: raw,
                    mime: file.type || 'application/pdf',
                },
            }));
        };
        reader.onerror = () => {
            setShopInvoiceFileReading(false);
            toast({
                variant: 'destructive',
                title: 'Read failed',
                description: 'The browser could not read this file.',
            });
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        if (!canChangeScheduledFirstDay) setChangeServiceDateOpen(false);
    }, [canChangeScheduledFirstDay]);

    const openChangeServiceDatePanel = () => {
        const cur =
            wf?.scheduledServiceDate &&
            !Number.isNaN(new Date(wf.scheduledServiceDate).getTime())
                ? new Date(wf.scheduledServiceDate).toISOString().slice(0, 10)
                : String(accidentActionForm.serviceDate || '').trim();
        setChangeServiceDateDraft(cur);
        setChangeServiceDateOpen(true);
    };

    const handleSaveScheduledServiceStart = async () => {
        const raw = String(changeServiceDateDraft || '').trim();
        if (!raw) {
            toast({
                variant: 'destructive',
                title: 'Date required',
                description: 'Choose the new first service day.',
            });
            return;
        }
        if (!assetId) return;
        try {
            setChangeServiceDateSaving(true);
            const { data } = await axiosInstance.post(`/AssetItem/${assetId}/service-workflow/period`, {
                action: 'change_service_start',
                scheduledServiceDate: raw,
                comment: 'First service day updated from vehicle workflow',
            });
            toast({
                title: 'Service date updated',
                description: data?.message || 'Scheduled window refreshed from the new start date.',
            });
            setChangeServiceDateOpen(false);
            const nextAsset = data?.asset;
            if (nextAsset?.activeServiceWorkflow?.scheduledServiceDate) {
                const iso = new Date(nextAsset.activeServiceWorkflow.scheduledServiceDate).toISOString().slice(0, 10);
                setAccidentActionForm((prev) => ({ ...prev, serviceDate: iso }));
            }
            if (typeof onUpdated === 'function') onUpdated(nextAsset);
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Update failed',
                description: e.response?.data?.message || e.message || 'Could not change service date.',
            });
        } finally {
            setChangeServiceDateSaving(false);
        }
    };

    useEffect(() => {
        const rs = String(accidentStatusForm.returnStatus || '').trim().toLowerCase();
        if (rs === 'extended' && accidentStatusForm.returnMode !== 'extend') {
            setAccidentStatusForm((prev) => ({ ...prev, returnMode: 'extend' }));
            return;
        }
        if (rs === 'confirmed' && accidentStatusForm.returnMode !== 'date') {
            setAccidentStatusForm((prev) => ({ ...prev, returnMode: 'date' }));
        }
    }, [accidentStatusForm.returnStatus, accidentStatusForm.returnMode]);

    const handleAccidentActionSend = async () => {
        if (isOnServiceNow) {
            toast({
                variant: 'destructive',
                title: 'Status check',
                description: 'Send is allowed only before service moves to On Service.',
            });
            return;
        }
        if (!isActionFormComplete) {
            toast({
                variant: 'destructive',
                title: 'Fill required fields',
                description: 'Service date, garage name, service duration, garage location, and service return date are mandatory.',
            });
            return;
        }
        if (!canActOnWorkflow || !isAdminStage) {
            toast({
                variant: 'destructive',
                title: 'Not allowed',
                description: 'This action is only available at Admin workflow step for assigned approver.',
            });
            return;
        }
        const durationDays = Math.max(1, Math.floor(Number(accidentActionForm.serviceDuration)));
        if (!Number.isFinite(durationDays)) {
            toast({
                variant: 'destructive',
                title: 'Invalid duration',
                description: 'Service duration must be at least 1 day.',
            });
            return;
        }

        const serviceUpdates = {
            scheduledServiceDate: accidentActionForm.serviceDate,
            serviceDurationDays: durationDays,
            description: String(accidentStatusForm.description || workflowServiceRecord?.description || '').trim(),
            remark: JSON.stringify({
                ...(accidentMeta || {}),
                vendorName: String(accidentActionForm.garageName || '').trim(),
                approvedQuotationChoice:
                    String(accidentMeta?.approvedQuotationChoice || '').trim() ||
                    String(accidentActionForm.garageName || '').trim(),
                garageLocation: String(accidentActionForm.garageLocation || '').trim(),
                serviceReturnDate: String(accidentActionForm.serviceReturnDate || '').trim(),
            }),
        };

        await respond('approve', serviceUpdates, undefined, `Admin action form submitted: ${accidentActionForm.garageName}`);
    };

    const handleAccidentStatusSubmit = async () => {
        if (!isOnServiceNow) {
            toast({
                variant: 'destructive',
                title: 'Status check',
                description: 'Submit is enabled only when service is On Service.',
            });
            return;
        }
        const normalizedReturnStatus = String(accidentStatusForm.returnStatus || '').trim().toLowerCase();
        const isExtendAction = normalizedReturnStatus === 'extended';
        const isConfirmAction = normalizedReturnStatus === 'confirmed';

        if (!String(accidentStatusForm.serviceStatus || '').trim()) {
            toast({
                variant: 'destructive',
                title: 'Status required',
                description: 'Please select a service status.',
            });
            return;
        }
        if (!String(accidentStatusForm.description || '').trim()) {
            toast({
                variant: 'destructive',
                title: 'Description required',
                description: 'Please enter description.',
            });
            return;
        }
        if (!String(accidentStatusForm.returnStatus || '').trim()) {
            toast({
                variant: 'destructive',
                title: 'Return status required',
                description: 'Please select return status.',
            });
            return;
        }
        if (!isExtendAction && !String(accidentStatusForm.returnDate || '').trim()) {
            toast({
                variant: 'destructive',
                title: 'Return date required',
                description: 'Please select a return date.',
            });
            return;
        }
        if (isExtendAction && (!Number.isFinite(Number(accidentStatusForm.extendDays)) || Number(accidentStatusForm.extendDays) < 1)) {
            toast({
                variant: 'destructive',
                title: 'Extend days required',
                description: 'Enter at least 1 day to extend.',
            });
            return;
        }
        const completionPayload = buildWorkflowUploadPayload(accidentStatusForm.serviceReport);
        const shopPayload = buildWorkflowUploadPayload(accidentStatusForm.returnShopInvoice);
        if (!completionPayload && !hasPersistedCompletionReport) {
            toast({
                variant: 'destructive',
                title: 'Service completion report required',
                description: 'Please upload a workshop / service completion report (PDF or image) before submit.',
            });
            return;
        }
        if (!shopPayload && !hasPersistedShopInvoice) {
            toast({
                variant: 'destructive',
                title: 'Shop invoice required',
                description: 'Please upload the shop / VAT invoice (PDF or image) before submit.',
            });
            return;
        }
        if (!assetId) return;
        try {
            setLoading(true);
            if (isConfirmAction) {
                await submitScheduledPeriod({
                    action: 'go_live',
                    comment: String(accidentStatusForm.description || '').trim(),
                    ...(completionPayload ? { completionReport: completionPayload } : {}),
                    ...(shopPayload ? { shopInvoice: shopPayload } : {}),
                });
                return;
            }

            const effectiveStatus =
                isExtendAction
                    ? 'on_service'
                    : String(accidentStatusForm.serviceStatus || '').trim();
            const normalizedStatus = effectiveStatus.toLowerCase().replace(/\s+/g, '_');
            const shouldCompleteNow =
                normalizedStatus === 'complete' ||
                normalizedStatus === 'completed';

            if (shouldCompleteNow) {
                await submitScheduledPeriod({
                    action: 'go_live',
                    comment: String(accidentStatusForm.description || '').trim(),
                    ...(completionPayload ? { completionReport: completionPayload } : {}),
                    ...(shopPayload ? { shopInvoice: shopPayload } : {}),
                });
                return;
            }

            const payload = {
                action: 'update_status',
                serviceStatus: effectiveStatus,
                description: String(accidentStatusForm.description || '').trim(),
                returnMode: isExtendAction ? 'extend' : 'date',
                returnDate: !isExtendAction ? String(accidentStatusForm.returnDate || '').trim() : undefined,
                extendDays: isExtendAction ? Math.max(1, Math.floor(Number(accidentStatusForm.extendDays) || 1)) : undefined,
                returnStatus: String(accidentStatusForm.returnStatus || '').trim(),
                comment: `Status update: ${effectiveStatus}`,
                ...(completionPayload
                    ? {
                          serviceReport: {
                              data: completionPayload.data,
                              name: completionPayload.name,
                              mime: accidentStatusForm.serviceReport.mime || 'application/pdf',
                          },
                      }
                    : {}),
                ...(shopPayload
                    ? {
                          shopInvoice: {
                              data: shopPayload.data,
                              name: shopPayload.name,
                              mime: accidentStatusForm.returnShopInvoice.mime || 'application/pdf',
                          },
                      }
                    : {}),
            };
            const { data } = await axiosInstance.post(`/AssetItem/${assetId}/service-workflow/period`, payload);
            toast({
                title: 'Saved',
                description: data?.message || 'Service status saved.',
            });
            if (typeof onUpdated === 'function') onUpdated(data?.asset);
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Save failed',
                description: e.response?.data?.message || e.message || 'Could not save service status.',
            });
        } finally {
            setLoading(false);
        }
    };

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
            setLiveShopInvoice({ name: '', data: '', mime: '' });
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

    const respond = async (action, serviceUpdates = undefined, holdPayload = undefined, commentOverride = undefined) => {
        if (!assetId) return;
        try {
            setLoading(true);
            const payload = {
                action,
                comment:
                    (typeof commentOverride === 'string' ? commentOverride.trim() : '') ||
                    comment.trim() ||
                    undefined,
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

    const handleAccountsApprove = async () => {
        await respond('approve', undefined, undefined, String(accountsReason || '').trim() || undefined);
    };

    const handleHrApproveConfirm = async () => {
        const vendor = String(hrVendorName || '').trim();
        const reason = String(hrReason || '').trim();
        const selectedQuotation = String(hrSelectedQuotation || '').trim();
        if (!vendor) {
            toast({
                variant: 'destructive',
                title: 'Vendor required',
                description: 'Please select vendor name.',
            });
            return;
        }
        if (!reason) {
            toast({
                variant: 'destructive',
                title: 'Reason required',
                description: 'Please enter approval reason.',
            });
            return;
        }
        if (workflowQuotationRows.length > 0 && !selectedQuotation) {
            toast({
                variant: 'destructive',
                title: 'Quotation required',
                description: 'HR must select one quotation before approval.',
            });
            return;
        }
        const serviceUpdates = {
            remark: JSON.stringify({
                ...(accidentMeta || {}),
                vendorName: vendor,
                approvedQuotationChoice: selectedQuotation || String(accidentMeta?.approvedQuotationChoice || '').trim(),
            }),
        };
        await respond('approve', serviceUpdates, undefined, `Vendor: ${vendor}. Reason: ${reason}`);
        setHrApproveDialogOpen(false);
    };

    const handleHrRejectConfirm = async () => {
        const reason = String(hrReason || '').trim();
        if (!reason) {
            toast({
                variant: 'destructive',
                title: 'Reason required',
                description: 'Reason is mandatory when rejecting from HR.',
            });
            return;
        }
        await respond('reject', undefined, undefined, reason);
        setHrRejectDialogOpen(false);
    };

    const handleAccountsApproveConfirm = async () => {
        await handleAccountsApprove();
        setAccountsApproveConfirmOpen(false);
    };

    const openAccountsHoldDialog = () => {
        setAccountsHoldDialogOpen(true);
    };

    const handleAccountsHoldConfirm = async () => {
        const reason = String(accountsReason || '').trim();
        if (!reason) {
            toast({
                variant: 'destructive',
                title: 'Reason required',
                description: 'Reason is mandatory when putting Accounts stage on hold.',
            });
            return;
        }
        const days = Math.floor(Number(accountsHoldDurationDays));
        if (!Number.isFinite(days) || days < 1) {
            toast({
                variant: 'destructive',
                title: 'Duration required',
                description: 'Enter hold duration in days (minimum 1).',
            });
            return;
        }
        const until = new Date();
        until.setDate(until.getDate() + days);
        const holdUntil = until.toISOString().slice(0, 10);
        await respond(
            'hold',
            undefined,
            { reason, holdUntilDate: holdUntil },
            reason
        );
        setAccountsHoldDialogOpen(false);
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
                subtitle: 'This workflow was rejected.',
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
                <p className="text-sm text-red-600 font-medium text-center max-w-md px-2">Workflow rejected.</p>
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

    const svcWorkflowStack = 'space-y-5 sm:space-y-6';
    const svcFormCard =
        'rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 overflow-hidden ring-1 ring-slate-950/[0.035]';
    const svcFormCardFlex = `${svcFormCard} min-h-0 flex flex-col`;

    const currentStageStep = PIPELINE.find((x) => x.key === stage);
    const modalSubtitle =
        currentIdx >= 0 && subtitles[currentIdx] && String(subtitles[currentIdx]).trim() !== ''
            ? subtitles[currentIdx]
            : currentStageStep?.subDefault;

    return (
        <>
            {!blankWorkflowCard ? (
                <div className="lg:col-span-12 rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 overflow-hidden ring-1 ring-slate-950/[0.03]">
                    <div
                        className={`px-4 py-3 border-b shrink-0 text-center ${workflowBanner.barClass}`}
                    >
                        <p className="text-sm font-bold tracking-tight">{workflowBanner.title}</p>
                        <p className="text-xs mt-0.5 opacity-90 leading-snug max-w-3xl mx-auto">{workflowBanner.subtitle}</p>
                        {wf?.serviceRecordId ? (
                            <p className="text-[10px] font-mono text-slate-700 mt-1.5">
                                Service record ID: {String(wf.serviceRecordId)}
                            </p>
                        ) : null}
                    </div>

                    {inProgress && canActOnWorkflow ? (
                        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-center gap-2 bg-white">
                            <p className="w-full text-center text-xs text-slate-500 mb-1">You are the assigned approver for this step.</p>
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
                                    <p className="w-full text-center text-[11px] text-slate-600 max-w-xl mx-auto">
                                        Submit from the form below. If return mode is Extend, the return date is extended.
                                        When the return date is reached, the request completes.
                                    </p>
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
                                        className="px-4 py-2 rounded-lg bg-white border border-slate-300/80 text-slate-800 text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors"
                                    >
                                        View
                                    </button>
                                    <p className="w-full text-center text-[11px] text-slate-500 max-w-xl mx-auto pt-1">
                                        Accept requires required fields (vendor + one quotation where applicable). Asset Controller
                                        approval requires service date and duration.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : null}

                    {inProgress && !canActOnWorkflow ? (
                        <div className="px-4 py-3 border-b border-slate-100 bg-white text-center">
                            <p className="text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
                                {wf?.currentAssignee?.displayName
                                    ? `This step is waiting on ${wf.currentAssignee.displayName}. Only they can approve or reject.`
                                    : 'This step is assigned to the role shown on the tracker. Only that approver can act.'}
                            </p>
                        </div>
                    ) : null}

                    {(inProgress || isComplete || isRejected) ? (
                        <div
                            className={`shrink-0 border-t px-3 py-3 max-h-[220px] overflow-y-auto overflow-x-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${
                                isRejected
                                    ? 'border-red-100 bg-gradient-to-b from-red-50/80 via-white to-red-50/40'
                                    : 'border-slate-200/85 bg-gradient-to-b from-slate-50 via-slate-50/90 to-slate-100/60'
                            }`}
                        >
                            <p
                                className={`text-[10px] font-bold uppercase tracking-[0.08em] mb-2 px-1 text-center ${
                                    isRejected ? 'text-red-900' : 'text-slate-500'
                                }`}
                            >
                                Progress tracker
                            </p>
                            <div className="flex justify-center min-w-0">{renderTrack()}</div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {workflowServiceRecord ? (
                <div className={`lg:col-span-12 ${svcWorkflowStack}`}>
                    <div className={svcFormCard}>
                        <div className="px-5 py-3.5 border-b border-rose-100/80 bg-gradient-to-r from-rose-50/95 via-white to-slate-50/40">
                            <div className="flex items-start gap-3">
                                <div
                                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/90 shadow-sm ring-1 ring-rose-200/60"
                                    aria-hidden
                                >
                                    <FileText className="h-4 w-4 text-rose-700" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    {(() => {
                                        const serviceTypeLabel =
                                            String(workflowServiceRecord?.serviceType || wf?.serviceTypeLabel || '')
                                                .trim() || 'Service';
                                        return (
                                            <p className="text-[11px] font-black tracking-widest text-rose-700 uppercase mb-1">
                                                {serviceTypeLabel}
                                            </p>
                                        );
                                    })()}
                                    <p className="text-sm font-black tracking-wide text-slate-900 uppercase">
                                        {isAccidentRepairRequest ? 'Accident repair — creation' : 'Service request — creation'}
                                    </p>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        {isAccidentRepairRequest
                                            ? 'Request details, documents, and photos submitted before HR review.'
                                            : 'Service details and quotations submitted before HR review.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 sm:p-6 space-y-5 text-[12px]">
                        {isAccidentRepairRequest ? (
                            <>
                                {/* r1 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Issue date</p>
                                        <p className="mt-1 font-semibold text-gray-800">{formatShortDate(workflowServiceRecord?.date) || '-'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">View history</p>
                                            <p className="mt-1 font-semibold text-gray-800">{formatShortDate(meta?.createdAt || workflowServiceRecord?.date) || '-'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (typeof window === 'undefined') return;
                                                const historyBtn = Array.from(document.querySelectorAll('button')).find(
                                                    (b) => String(b?.textContent || '').trim().toLowerCase() === 'history'
                                                );
                                                historyBtn?.click();
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold"
                                        >
                                            View
                                        </button>
                                    </div>
                                </div>

                                {/* r2 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Accident date</p>
                                        <p className="mt-1 font-semibold text-gray-800">{formatShortDate(accidentMeta?.accidentDate) || '-'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Accident owner</p>
                                        <p className="mt-1 font-semibold text-gray-800">{accidentMeta?.accidentOwner || '-'}</p>
                                    </div>
                                </div>

                                {/* r3 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {[
                                        { label: 'Police report', url: workflowServiceRecord?.attachment },
                                        { label: 'Client report', url: workflowServiceRecord?.quotation2 },
                                        { label: 'Insurance certificate', url: workflowServiceRecord?.quotation3 },
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between gap-3">
                                            <p className="text-[11px] font-semibold text-gray-700">{item.label}</p>
                                            <a
                                                href={item.url || '#'}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${item.url ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 pointer-events-none'}`}
                                            >
                                                View
                                            </a>
                                        </div>
                                    ))}
                                </div>

                                {/* r4 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Current km</p>
                                        <p className="mt-1 font-semibold text-gray-800">{workflowServiceRecord?.currentKm ?? '-'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Duration date</p>
                                        <p className="mt-1 font-semibold text-gray-800">{accidentMeta?.accidentRepairDurationDays ?? '-'} day(s)</p>
                                    </div>
                                </div>

                                {/* r5 */}
                                <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Description</p>
                                    <p className="mt-1 font-semibold text-gray-800 whitespace-pre-wrap">{workflowServiceRecord?.description || '-'}</p>
                                </div>

                                <div className="space-y-3">
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">Photos</p>
                                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                            {(Array.isArray(accidentMeta?.accidentImages) ? accidentMeta.accidentImages : []).map((img, idx) => {
                                                const imgUrl =
                                                    typeof img === 'string'
                                                        ? img
                                                        : (img?.url || img?.publicId || '');
                                                return (
                                                <a
                                                    key={`${imgUrl || idx}-${idx}`}
                                                    href={imgUrl || '#'}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className={`block w-24 h-14 rounded-lg overflow-hidden border border-slate-300 bg-white shadow-sm shrink-0 ${imgUrl ? '' : 'pointer-events-none opacity-50'}`}
                                                >
                                                    <img src={imgUrl || ''} alt={`Accident ${idx + 1}`} className="w-full h-full object-cover" />
                                                </a>
                                            )})}
                                            {(Array.isArray(accidentMeta?.accidentImages) ? accidentMeta.accidentImages.length : 0) === 0 ? (
                                                <p className="text-[11px] text-gray-400">No photos uploaded.</p>
                                            ) : null}
                                        </div>
                                        {(Array.isArray(accidentMeta?.accidentImages) ? accidentMeta.accidentImages.length : 0) > 0 ? (
                                            <p className="mt-2 text-[10px] text-slate-500">Use horizontal scroll to view all photos.</p>
                                        ) : null}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Police fine</p>
                                            <p className="mt-1 text-[13px] font-bold text-gray-800">
                                                {accidentMeta?.policeFineAmount != null ? `AED ${Number(accidentMeta.policeFineAmount).toLocaleString()}` : 'AED 0'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Insurance fine</p>
                                            <p className="mt-1 text-[13px] font-bold text-gray-800">
                                                {accidentMeta?.insuranceFineAmount != null ? `AED ${Number(accidentMeta.insuranceFineAmount).toLocaleString()}` : 'AED 0'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-emerald-200 p-3 bg-emerald-50/60">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total</p>
                                            <p className="mt-1 text-[13px] font-black text-emerald-700">
                                                {`AED ${(
                                                    Number(accidentMeta?.policeFineAmount || 0) +
                                                    Number(accidentMeta?.insuranceFineAmount || 0)
                                                ).toLocaleString()}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Date</p>
                                        <p className="mt-1 font-semibold text-gray-800">{formatShortDate(workflowServiceRecord?.date) || '-'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Payment type</p>
                                        <p className="mt-1 font-semibold text-gray-800">{workflowServiceRecord?.paidBy || '-'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Employee name</p>
                                        <p className="mt-1 font-semibold text-gray-800">
                                            {asset?.assignedTo
                                                ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim() || '-'
                                                : '-'}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Current km</p>
                                        <p className="mt-1 font-semibold text-gray-800">{workflowServiceRecord?.currentKm ?? '-'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Vehicle owner</p>
                                        <p className="mt-1 font-semibold text-gray-800">{asset?.assignedCompany?.name || 'Company'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Duration</p>
                                        <p className="mt-1 font-semibold text-gray-800">{workflowServiceRecord?.serviceDuration || '-'}</p>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Description</p>
                                    <p className="mt-1 font-semibold text-gray-800 whitespace-pre-wrap">{workflowServiceRecord?.description || '-'}</p>
                                </div>
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">Photos</p>
                                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                            {(() => {
                                                const imgs = [];
                                                const raw = parseVehicleServiceRemark(workflowServiceRecord) || {};
                                                const push = (x) => { if (x) imgs.push(x); };
                                                (raw.photos || raw.images || raw.accidentImages || []).forEach(push);
                                                if (imgs.length === 0) return <p className="text-[11px] text-gray-400">No photos uploaded.</p>;
                                                return imgs.map((img, idx) => {
                                                    const imgUrl = typeof img === 'string' ? img : (img?.url || img?.publicId || '');
                                                    return (
                                                        <a
                                                            key={`${imgUrl || idx}-${idx}`}
                                                            href={imgUrl || '#'}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className={`block w-24 h-14 rounded-lg overflow-hidden border border-slate-300 bg-white shadow-sm shrink-0 ${imgUrl ? '' : 'pointer-events-none opacity-50'}`}
                                                        >
                                                            <img src={imgUrl || ''} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                                                        </a>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        {(() => {
                                            const raw = parseVehicleServiceRemark(workflowServiceRecord) || {};
                                            const imgs = [...(raw.photos || []), ...(raw.images || []), ...(raw.accidentImages || [])].filter(Boolean);
                                            return imgs.length > 0 ? (
                                                <p className="mt-2 text-[10px] text-slate-500">Use horizontal scroll to view all photos.</p>
                                            ) : null;
                                        })()}
                                    </div>
                                    <div className="rounded-xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Quotation with amount</p>
                                            <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                                Click card to open
                                            </span>
                                        </div>
                                        {(() => {
                                            const quotationRows = workflowQuotationRows;
                                            if (quotationRows.length === 0) {
                                                return <p className="text-[11px] text-gray-400">No quotation uploaded.</p>;
                                            }
                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {quotationRows.map((q) => {
                                                        const selected = String(hrSelectedQuotation || accidentMeta?.approvedQuotationChoice || '').trim() === q.key;
                                                        return (
                                                            <div
                                                                key={q.key}
                                                                className={`rounded-xl border p-3 transition-all ${selected
                                                                        ? 'border-blue-400 bg-blue-50'
                                                                        : 'border-slate-300 bg-slate-100/70'
                                                                    }`}
                                                            >
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                                                                        {q.label}
                                                                    </p>
                                                                    <div className="flex items-center gap-2">
                                                                        <a
                                                                            href={q.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="inline-flex px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700"
                                                                        >
                                                                            View
                                                                        </a>
                                                                        {stage === 'pending_hr' && canActOnWorkflow ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setHrSelectedQuotation(q.key)}
                                                                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${selected
                                                                                        ? 'bg-emerald-600 text-white'
                                                                                        : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                                                                                    }`}
                                                                            >
                                                                                {selected ? 'Selected' : 'Select'}
                                                                            </button>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                                <p className="mt-3 text-[12px] text-slate-700">
                                                                    Amount
                                                                </p>
                                                                <p className="mt-0.5 text-[13px] font-black text-emerald-700">
                                                                    {q.amount != null && q.amount !== ''
                                                                        ? `AED ${Number(q.amount).toLocaleString()}`
                                                                        : (q.key === 'q1' && workflowServiceRecord?.value != null
                                                                            ? `AED ${Number(workflowServiceRecord.value).toLocaleString()}`
                                                                            : '-')}
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </>
                        )}
                        </div>
                    </div>

                    {showHrAccountsRow ? (
                    <div
                        className={`grid gap-4 ${showAccountsSection ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}
                    >
                        <div className={svcFormCardFlex}>
                            <div className="px-5 py-3 border-b border-amber-100/90 bg-gradient-to-r from-amber-50/95 via-amber-50/50 to-white shrink-0">
                                <div className="flex items-start gap-2">
                                    <UserCheck className="h-4 w-4 shrink-0 text-amber-900 mt-0.5" aria-hidden />
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black tracking-widest text-amber-950 uppercase">HR</p>
                                        <p className="text-[10px] text-amber-900/80 mt-0.5 font-medium leading-snug">Received and acknowledge</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 text-[12px] flex-1 min-h-0">
                                <div className="mt-2">
                                    <p className="text-[20px] leading-none font-bold tracking-wide text-slate-900">
                                        {hrApproveEntry?.byName
                                            ? hrApproveEntry.byName
                                            : hrRejectEntry?.byName
                                                ? hrRejectEntry.byName
                                                : 'HR'}
                                    </p>
                                </div>
                                {!hrApproveEntry?.byName && !hrRejectEntry?.byName ? (
                                    <p className="mt-1 text-[11px] text-slate-500">Pending HR action</p>
                                ) : null}
                                {stage === 'pending_hr' && canActOnWorkflow ? (
                                    <div className="mt-3">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => {
                                                    setHrVendorName((prev) => prev || accidentActionForm.garageName || '');
                                                    setHrSelectedQuotation((prev) => prev || String(accidentMeta?.approvedQuotationChoice || '').trim());
                                                    setHrReason('');
                                                    setHrApproveDialogOpen(true);
                                                }}
                                                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => {
                                                    setHrReason('');
                                                    setHrRejectDialogOpen(true);
                                                }}
                                                className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {showAccountsSection ? (
                            <div className={svcFormCardFlex}>
                                <div className="px-5 py-3 border-b border-sky-100/90 bg-gradient-to-r from-sky-50/95 via-sky-50/45 to-white shrink-0">
                                    <div className="flex items-start gap-2">
                                        <Layers className="h-4 w-4 shrink-0 text-sky-900 mt-0.5" aria-hidden />
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black tracking-widest text-sky-950 uppercase">Accounts</p>
                                            <p className="text-[10px] text-sky-900/80 mt-0.5 font-medium leading-snug">Received and acknowledge</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 text-[12px] flex-1 min-h-0">
                                    <div className="mt-2">
                                        <p className="text-[20px] leading-none font-bold tracking-wide text-slate-900">
                                            {accountsApproveEntry?.byName
                                                ? accountsApproveEntry.byName
                                                : accountsHoldEntry?.byName
                                                    ? accountsHoldEntry.byName
                                                    : accountsRejectEntry?.byName
                                                        ? accountsRejectEntry.byName
                                                        : 'Accounts'}
                                        </p>
                                    </div>
                                    {!accountsApproveEntry?.byName && !accountsHoldEntry?.byName && !accountsRejectEntry?.byName ? (
                                        <p className="mt-1 text-[11px] text-slate-500">Pending Accounts action</p>
                                    ) : null}
                                    {stage === 'pending_accounts' && canActStrict ? (
                                        <div className="mt-3 space-y-2">
                                            <div className="flex flex-wrap gap-2">
                                                {!isHoldActive ? (
                                                    <button
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={() => setAccountsApproveConfirmOpen(true)}
                                                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                                                    >
                                                        Approve
                                                    </button>
                                                ) : null}
                                                {isHoldActive ? (
                                                    <button
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={() => setConfirmUnholdOpen(true)}
                                                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold disabled:opacity-50"
                                                    >
                                                        Unhold (Live)
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={openAccountsHoldDialog}
                                                        className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold disabled:opacity-50"
                                                    >
                                                        Hold
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : stage === 'pending_accounts' && wf?.currentAssignee?.displayName ? (
                                        <p className="mt-2 text-[11px] font-semibold text-amber-700">
                                            Waiting for: {wf.currentAssignee.displayName}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                    ) : null}

                        {showActionFormSection ? (
                        <div className={svcFormCard}>
                            <div className="px-5 py-3 border-b border-violet-100/90 bg-gradient-to-r from-violet-50/95 via-violet-50/40 to-white">
                                <div className="flex items-start gap-2">
                                    <ClipboardList className="h-[18px] w-[18px] shrink-0 text-violet-900 mt-0.5" aria-hidden />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-violet-950">Admin — request & schedule</p>
                                        <p className="text-xs text-violet-900/80 mt-0.5 leading-relaxed">
                                            Planned service window, garage, and return date — then Send.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 sm:p-6">
                            {!canEditAdminActionForm && stage === 'pending_admin' ? (
                                <p className="mt-2 text-center text-[12px] font-semibold text-amber-700">
                                    Waiting for Admin: {wf?.currentAssignee?.displayName || 'Admin'}
                                </p>
                            ) : null}

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <label className="text-xs font-medium text-slate-700">Service date</label>
                                    <input
                                        type="date"
                                        lang="en-GB"
                                        value={accidentActionForm.serviceDate}
                                        onChange={(e) => setAccidentActionForm((prev) => ({ ...prev, serviceDate: e.target.value }))}
                                        disabled={!canEditAdminActionForm}
                                        className="mt-1.5 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                    />
                                </div>
                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <label className="text-xs font-medium text-slate-700">Garage name</label>
                                    <select
                                        value={accidentActionForm.garageName}
                                        onChange={(e) => setAccidentActionForm((prev) => ({ ...prev, garageName: e.target.value }))}
                                        disabled={!canEditAdminActionForm}
                                        className="mt-1.5 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                    >
                                        <option value="">Select vendor</option>
                                        {garageOptions.map((v) => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <label className="text-xs font-medium text-slate-700">Service duration</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={accidentActionForm.serviceDuration}
                                        onChange={(e) => setAccidentActionForm((prev) => ({ ...prev, serviceDuration: e.target.value }))}
                                        disabled={!canEditAdminActionForm}
                                        placeholder="Days"
                                        className="mt-1.5 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                    />
                                </div>
                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <label className="text-xs font-medium text-slate-700">Garage location</label>
                                    <input
                                        type="text"
                                        value={accidentActionForm.garageLocation}
                                        onChange={(e) => setAccidentActionForm((prev) => ({ ...prev, garageLocation: e.target.value }))}
                                        disabled={!canEditAdminActionForm}
                                        placeholder="Enter garage location"
                                        className="mt-1.5 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                    />
                                </div>

                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:col-span-2">
                                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,520px)_auto] gap-3 items-end">
                                        <div>
                                            <label className="text-xs font-medium text-slate-700">Service return date</label>
                                            <input
                                                type="date"
                                                lang="en-GB"
                                                value={accidentActionForm.serviceReturnDate}
                                                onChange={(e) => setAccidentActionForm((prev) => ({ ...prev, serviceReturnDate: e.target.value }))}
                                                disabled={!canEditAdminActionForm}
                                                className="mt-1.5 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                            />
                                        </div>
                                        {isAdminStage && canActOnWorkflow && !adminApproveEntry ? (
                                            <button
                                                type="button"
                                                onClick={handleAccidentActionSend}
                                                disabled={!canEditAdminActionForm}
                                                className="h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                                            >
                                                Send
                                            </button>
                                        ) : adminHeaderEntry?.byName ? (
                                            <p className="text-[16px] font-bold tracking-wide text-slate-900 whitespace-nowrap">
                                                {adminHeaderEntry.byName}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            </div>
                        </div>
                        ) : null}

                    {workflowServiceRecord && (showActionFormSection || showStatusFormSection) ? (
                        <div className={svcFormCard}>
                            <div className="px-5 py-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-100/95 via-white to-emerald-50/25">
                                <div className="flex items-start gap-2">
                                    <CalendarRange className="h-[18px] w-[18px] shrink-0 text-slate-700 mt-0.5" aria-hidden />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900">Change first service day</p>
                                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                            Sits between Admin schedule and return-to-live. Window length stays the same; only the start date moves.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 sm:p-6 space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            Current first service day
                                        </p>
                                        <p className="mt-1 text-base font-bold text-slate-900">
                                            {wf?.scheduledServiceDate && !Number.isNaN(new Date(wf.scheduledServiceDate).getTime())
                                                ? formatShortDate(wf.scheduledServiceDate)
                                                : '—'}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-600 max-w-xl">
                                            {canChangeScheduledFirstDay
                                                ? 'Admin schedule is set. You can move the first shop day.'
                                                : isScheduledStage && !adminApproveEntry
                                                    ? 'Unlocks after Asset Controller approves the schedule (Admin — request & schedule) while in the scheduled step.'
                                                    : !isScheduledStage
                                                        ? 'Available when the workflow is in the scheduled service step after Admin confirms dates.'
                                                        : 'You do not have permission to change this date, or the request is closed.'}
                                        </p>
                                    </div>
                                    {canChangeScheduledFirstDay ? (
                                        <button
                                            type="button"
                                            disabled={changeServiceDateSaving}
                                            onClick={() => (changeServiceDateOpen ? setChangeServiceDateOpen(false) : openChangeServiceDatePanel())}
                                            className="shrink-0 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold disabled:opacity-50"
                                        >
                                            {changeServiceDateOpen ? 'Close' : 'Change service date'}
                                        </button>
                                    ) : null}
                                </div>
                                {changeServiceDateOpen && canChangeScheduledFirstDay ? (
                                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 pt-3 border-t border-slate-200">
                                        <div className="min-w-[200px]">
                                            <label className="text-xs font-medium text-slate-700">New first service day</label>
                                            <input
                                                type="date"
                                                lang="en-GB"
                                                value={changeServiceDateDraft}
                                                onChange={(e) => setChangeServiceDateDraft(e.target.value)}
                                                disabled={changeServiceDateSaving}
                                                className="mt-1.5 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={changeServiceDateSaving || !String(changeServiceDateDraft || '').trim()}
                                            onClick={handleSaveScheduledServiceStart}
                                            className="h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                                        >
                                            {changeServiceDateSaving ? 'Saving…' : 'Save new date'}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                        {showStatusFormSection ? (
                        <div className={svcFormCard}>
                            <div className="px-5 py-3 border-b border-emerald-100/90 bg-gradient-to-r from-emerald-50/95 via-emerald-50/35 to-white">
                                <div className="flex items-start gap-2">
                                    <Check className="h-[18px] w-[18px] shrink-0 text-emerald-800 mt-0.5" aria-hidden />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-emerald-950">Return from service to live</p>
                                        <p className="text-xs text-emerald-900/80 mt-0.5 leading-relaxed">
                                            Status follows the workflow and vehicle automatically. Upload{' '}
                                            <span className="font-semibold">completion report</span> and{' '}
                                            <span className="font-semibold">shop invoice</span> (both mandatory), then set dates and Submit or
                                            Extend.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 sm:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <label className="text-xs font-medium text-slate-700">Status</label>
                                    <div className="mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 bg-slate-50">
                                        {serviceStatusFormLabel(
                                            accidentStatusForm.returnMode === 'extend'
                                                ? 'on_service'
                                                : accidentStatusForm.serviceStatus || derivedReturnFormServiceStatus
                                        )}
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-500">
                                        {accidentStatusForm.returnMode === 'extend'
                                            ? 'Extend mode treats the vehicle as on service for this update.'
                                            : 'From workflow stage and vehicle state.'}
                                    </p>
                                    {statusFormFieldsLocked ? (
                                        <p className="mt-1 text-[10px] text-slate-500">This request is closed.</p>
                                    ) : null}
                                </div>
                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <label className="text-xs font-medium text-slate-700">
                                        Service completion report (upload) <span className="text-red-600 font-semibold">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                                        onChange={(e) => handleServiceReportUpload(e.target.files?.[0])}
                                        disabled={statusFormFieldsLocked || serviceReportFileReading}
                                        className="mt-1.5 w-full text-sm disabled:opacity-50"
                                    />
                                    {serviceReportFileReading ? (
                                        <p className="mt-1 text-[11px] text-slate-500">Reading file…</p>
                                    ) : null}
                                    {accidentStatusForm.serviceReport.name ? (
                                        <p className="mt-1 text-[11px] font-semibold text-slate-600 truncate">
                                            New file: {accidentStatusForm.serviceReport.name}
                                        </p>
                                    ) : null}
                                    {(hasPersistedCompletionReport || accidentMeta?.serviceReportName) &&
                                    !accidentStatusForm.serviceReport.name ? (
                                        <p className="mt-1 text-[11px] text-emerald-800">
                                            Saved completion report: {accidentMeta?.serviceReportName || 'On file'} — choose a file above to replace.
                                        </p>
                                    ) : null}
                                </div>
                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:col-span-2 xl:col-span-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        Shop invoice (upload) <span className="text-red-600 font-semibold">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                                        onChange={(e) => handleReturnShopInvoiceUpload(e.target.files?.[0])}
                                        disabled={statusFormFieldsLocked || shopInvoiceFileReading}
                                        className="mt-1.5 w-full text-sm disabled:opacity-50"
                                    />
                                    {shopInvoiceFileReading ? (
                                        <p className="mt-1 text-[11px] text-slate-500">Reading file…</p>
                                    ) : null}
                                    {accidentStatusForm.returnShopInvoice.name ? (
                                        <p className="mt-1 text-[11px] font-semibold text-slate-600 truncate">
                                            New file: {accidentStatusForm.returnShopInvoice.name}
                                        </p>
                                    ) : null}
                                    {(hasPersistedShopInvoice || accidentMeta?.shopInvoiceName) &&
                                    !accidentStatusForm.returnShopInvoice.name ? (
                                        <p className="mt-1 text-[11px] text-emerald-800">
                                            Saved invoice: {accidentMeta?.shopInvoiceName || 'On file'} — choose a file above to replace.
                                        </p>
                                    ) : null}
                                </div>

                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:col-span-3 md:col-span-2">
                                    <label className="text-xs font-medium text-slate-700">Description</label>
                                    <textarea
                                        rows={3}
                                        value={accidentStatusForm.description}
                                        onChange={(e) => setAccidentStatusForm((prev) => ({ ...prev, description: e.target.value }))}
                                        disabled={statusFormFieldsLocked}
                                        className="mt-1.5 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white resize-y disabled:bg-slate-50 disabled:text-slate-500"
                                    />
                                </div>

                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <label className="text-xs font-medium text-slate-700">Return date</label>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        <select
                                            value={accidentStatusForm.returnMode}
                                            onChange={(e) => setAccidentStatusForm((prev) => ({ ...prev, returnMode: e.target.value }))}
                                            disabled={statusFormFieldsLocked}
                                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white disabled:bg-slate-50"
                                        >
                                            <option value="date">Date</option>
                                            <option value="extend">Extend</option>
                                        </select>
                                        {accidentStatusForm.returnMode === 'date' ? (
                                            <input
                                                type="date"
                                                lang="en-GB"
                                                value={accidentStatusForm.returnDate}
                                                onChange={(e) => setAccidentStatusForm((prev) => ({ ...prev, returnDate: e.target.value }))}
                                                disabled={statusFormFieldsLocked}
                                                className="flex-1 min-w-[150px] px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white disabled:bg-slate-50"
                                            />
                                        ) : (
                                            <input
                                                type="number"
                                                min={1}
                                                value={accidentStatusForm.extendDays}
                                                onChange={(e) => setAccidentStatusForm((prev) => ({ ...prev, extendDays: e.target.value }))}
                                                placeholder="Extend days"
                                                disabled={statusFormFieldsLocked}
                                                className="flex-1 min-w-[150px] px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white disabled:bg-slate-50"
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <label className="text-xs font-medium text-slate-700">Return status</label>
                                    <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2 items-center">
                                        <select
                                            value={accidentStatusForm.returnStatus}
                                            onChange={(e) => setAccidentStatusForm((prev) => ({ ...prev, returnStatus: e.target.value }))}
                                            disabled={statusFormFieldsLocked}
                                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white disabled:bg-slate-50"
                                        >
                                            <option value="">Select status</option>
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Extended">Extended</option>
                                            <option value="Rejected">Rejected</option>
                                        </select>
                                        {canActOnWorkflow ? (
                                            <button
                                                type="button"
                                                onClick={handleAccidentStatusSubmit}
                                                disabled={!canSubmitStatusForm}
                                                className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
                                            >
                                                {String(accidentStatusForm.returnStatus || '').trim().toLowerCase() === 'extended'
                                                    ? 'Extend'
                                                    : 'Submit'}
                                            </button>
                                        ) : null}
                                    </div>
                                    {scheduledAdminDisplayName ? (
                                        <p className="mt-2 text-[11px] text-slate-600">
                                            Admin:{' '}
                                            <span className="font-semibold text-slate-800">{scheduledAdminDisplayName}</span>
                                        </p>
                                    ) : null}
                                    {scheduledReturnSubmitWaitingOnService ? (
                                        <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                                            You can submit return / complete only when this vehicle&apos;s asset status is{' '}
                                            <span className="font-semibold">On Service</span> (scheduled first shop day).
                                            Until then the button stays disabled even for Asset Controller.
                                        </p>
                                    ) : null}
                                    {!statusFormFieldsLocked &&
                                    isScheduledStage &&
                                    isOnServiceNow &&
                                    canActOnWorkflow &&
                                    (!completionReportReady || !shopInvoiceReady) ? (
                                        <p className="mt-2 text-[11px] text-amber-900/90 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                                            <span className="font-semibold">Required:</span> upload both{' '}
                                            <span className="font-semibold">completion report</span> and{' '}
                                            <span className="font-semibold">shop invoice</span>. Submit stays disabled until both are attached
                                            or already saved on this request.
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            </div>
                        </div>
                        ) : null}
                </div>
            ) : null}

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
                                    assetController={asset?.assetController}
                                    assetControllerId={asset?.assetControllerId}
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
                                                lang="en-GB"
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
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-y focus:ring-2 focus:ring-teal-500/15 focus:border-teal-400 outline-none bg-white"
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
                                        ? 'Upload completion report and shop invoice (required), add description, then complete.'
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
                                        <>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700">
                                                    Service completion report <span className="text-red-500">*</span>
                                                </label>
                                                <div
                                                    className={`mt-1 relative flex items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${liveInvoice.name ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
                                                >
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) {
                                                                setLiveInvoice({ name: '', data: '', mime: '' });
                                                                return;
                                                            }
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                const raw = String(reader.result || '').trim();
                                                                setLiveInvoice({
                                                                    name: file.name,
                                                                    data: raw,
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
                                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Upload completion report</p>
                                                                <p className="text-[10px] text-slate-400 mt-1">PDF, JPG, PNG</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700">
                                                    Shop invoice <span className="text-red-500">*</span>
                                                </label>
                                                <div
                                                    className={`mt-1 relative flex items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${liveShopInvoice.name ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
                                                >
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) {
                                                                setLiveShopInvoice({ name: '', data: '', mime: '' });
                                                                return;
                                                            }
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                const raw = String(reader.result || '').trim();
                                                                setLiveShopInvoice({
                                                                    name: file.name,
                                                                    data: raw,
                                                                    mime: file.type || 'application/pdf',
                                                                });
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }}
                                                    />
                                                    <div className="text-center pointer-events-none px-2">
                                                        {liveShopInvoice.name ? (
                                                            <>
                                                                <p className="text-[11px] font-semibold text-slate-700 truncate max-w-[260px]">{liveShopInvoice.name}</p>
                                                                <p className="text-[10px] text-violet-800 font-bold mt-1">Click to change</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Upload shop invoice</p>
                                                                <p className="text-[10px] text-slate-400 mt-1">PDF, JPG, PNG</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
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
                                    disabled={
                                        loading ||
                                        (schedModal === 'live' &&
                                            (!liveNote.trim() ||
                                                !liveInvoice.data ||
                                                !liveShopInvoice.data))
                                    }
                                    onClick={() => {
                                        const liveCompletionPayload = schedModal === 'live' ? buildWorkflowUploadPayload(liveInvoice) : undefined;
                                        const liveShopPayload = schedModal === 'live' ? buildWorkflowUploadPayload(liveShopInvoice) : undefined;
                                        submitScheduledPeriod({
                                            action: schedModal === 'reject' ? 'reject' : 'go_live',
                                            comment: liveNote.trim() || undefined,
                                            ...(schedModal === 'live' && liveCompletionPayload
                                                ? { completionReport: liveCompletionPayload }
                                                : {}),
                                            ...(schedModal === 'live' && liveShopPayload ? { shopInvoice: liveShopPayload } : {}),
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

            <AlertDialog open={accountsHoldDialogOpen} onOpenChange={setAccountsHoldDialogOpen}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Put Accounts on hold</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter hold duration and reason to pause this request.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Duration (days)</label>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={accountsHoldDurationDays}
                                onChange={(e) => setAccountsHoldDurationDays(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Reason</label>
                            <textarea
                                rows={3}
                                value={accountsReason}
                                onChange={(e) => setAccountsReason(e.target.value)}
                                placeholder="Enter hold reason"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={loading}
                            onClick={(e) => {
                                e.preventDefault();
                                handleAccountsHoldConfirm();
                            }}
                        >
                            {loading ? 'Saving...' : 'Confirm Hold'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={hrApproveDialogOpen} onOpenChange={setHrApproveDialogOpen}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>HR Approve</AlertDialogTitle>
                        <AlertDialogDescription>
                            Select vendor and enter reason to move this request to Accounts.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Vendor name</label>
                            <select
                                value={hrVendorName}
                                onChange={(e) => setHrVendorName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                            >
                                <option value="">Select vendor</option>
                                {garageOptions.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>
                        {workflowQuotationRows.length > 0 ? (
                            <div>
                                <label className="text-xs font-semibold text-slate-700">Select quotation</label>
                                <select
                                    value={hrSelectedQuotation}
                                    onChange={(e) => setHrSelectedQuotation(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                >
                                    <option value="">Select quotation</option>
                                    {workflowQuotationRows.map((q) => (
                                        <option key={q.key} value={q.key}>{q.label}</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Reason</label>
                            <textarea
                                rows={3}
                                value={hrReason}
                                onChange={(e) => setHrReason(e.target.value)}
                                placeholder="Enter approval reason"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={loading}
                            onClick={(e) => {
                                e.preventDefault();
                                handleHrApproveConfirm();
                            }}
                        >
                            {loading ? 'Approving...' : 'Approve'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={hrRejectDialogOpen} onOpenChange={setHrRejectDialogOpen}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>HR Reject</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter rejection reason to stop this workflow request.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div>
                        <label className="text-xs font-semibold text-slate-700">Reason</label>
                        <textarea
                            rows={3}
                            value={hrReason}
                            onChange={(e) => setHrReason(e.target.value)}
                            placeholder="Enter rejection reason"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={loading}
                            onClick={(e) => {
                                e.preventDefault();
                                handleHrRejectConfirm();
                            }}
                        >
                            {loading ? 'Rejecting...' : 'Reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={accountsApproveConfirmOpen} onOpenChange={setAccountsApproveConfirmOpen}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve at Accounts?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will approve Accounts stage and move request to Admin.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={loading}
                            onClick={(e) => {
                                e.preventDefault();
                                handleAccountsApproveConfirm();
                            }}
                        >
                            {loading ? 'Approving...' : 'Approve'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
