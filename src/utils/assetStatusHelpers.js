/** Mirrors backend assetOperationalFlags.js — onService / onLeave are separate from asset.status */

/** Maximum total leave / parking duration (initial request + extensions). */
export const MAX_ASSET_LEAVE_DAYS = 40;

/** Maximum total service duration (initial request + extensions). */
export const MAX_ASSET_SERVICE_DAYS = 30;

export const normalizeAssetStatusKey = (status) => String(status || '').toLowerCase().trim();

const TERMINAL_ASSET_STATUSES = new Set(['lost', 'end of life', 'out of service']);

export const isTerminalAssetStatus = (statusOrAsset) => {
    const status =
        statusOrAsset && typeof statusOrAsset === 'object' && !Array.isArray(statusOrAsset)
            ? statusOrAsset.status
            : statusOrAsset;
    return TERMINAL_ASSET_STATUSES.has(normalizeAssetStatusKey(status));
};

/** True when the asset is actively held by an employee/company (not lost/EOL and not mid-action). */
export const isAssetActivelyAssigned = (asset) => {
    if (!asset || isTerminalAssetStatus(asset)) return false;
    if (asset.pendingAction) return false;
    const st = normalizeAssetStatusKey(asset.status);
    if (st === 'unassigned' || st === 'returned') return false;
    if (!(asset.assignedTo || asset.assignedCompany)) return false;
    return st === 'assigned' || asset.acceptanceStatus === 'Accepted' || asset.acceptanceStatus === 'Approved';
};

export const empDisplayNameFromRef = (ref) => {
    if (!ref || typeof ref !== 'object') return '';
    const n = `${ref.firstName || ''} ${ref.lastName || ''}`.trim();
    if (n) return n;
    if (ref.employeeId) return String(ref.employeeId);
    return '';
};

export const assetPersonRefId = (ref) => {
    if (!ref) return '';
    if (typeof ref === 'object') return String(ref._id || ref.id || '');
    return String(ref);
};

/** Employee/company assignment waiting on accept/reject — not creation approval. */
export const isAssetAssignmentAcknowledgmentPending = (asset) => {
    if (!asset) return false;
    if (asset.pendingAction) return false;
    if (String(asset.acceptanceStatus || '') !== 'Pending') return false;
    const status = String(asset.status || '');
    if (status !== 'Pending' && status !== 'Assigned') return false;
    return !!(asset.assignedTo || asset.assignedCompany);
};

const OWNER_APPROVAL_WAITING_ACTIONS = new Set(['Leave', 'End of Life', 'Return Asset']);

const isWaitingOnPrimaryReportee = ({
    arId,
    assigneeId,
    reporteeId,
    delegatedToReportee,
    assigneeHasNoPortal,
    ackSaysNoSelf,
    pendingAction,
}) => {
    if (delegatedToReportee) return true;
    if (arId && reporteeId && arId === reporteeId) return true;
    const ownerApprovalAction = !pendingAction || OWNER_APPROVAL_WAITING_ACTIONS.has(String(pendingAction));
    if (
        ownerApprovalAction &&
        arId &&
        assigneeId &&
        arId === assigneeId &&
        reporteeId &&
        (assigneeHasNoPortal || ackSaysNoSelf)
    ) {
        return true;
    }
    return false;
};

/**
 * Who the list and details should name as the waiting person.
 * `kind: 'reportee'` when the assigned employee cannot act and their primary reportee must.
 */
export const getAssetWaitingForMeta = (asset) => {
    if (!asset) return { name: '', kind: '' };

    const arName = empDisplayNameFromRef(asset.actionRequiredBy);
    const arId = assetPersonRefId(asset.actionRequiredBy);
    const assigneeId = assetPersonRefId(asset.assignedTo);
    const reporteeId =
        assetPersonRefId(asset.assignedTo?.primaryReportee) ||
        (asset.assignmentAck?.primaryReporteeId ? String(asset.assignmentAck.primaryReporteeId) : '');
    const assigneeName = empDisplayNameFromRef(asset.assignedTo);
    const reporteeName = empDisplayNameFromRef(asset.assignedTo?.primaryReportee);
    const assigneeHasNoPortal = asset.assignedTo?.enablePortalAccess === false;
    const ackSaysNoSelf = asset.assignmentAck?.assigneeCanSelfAcknowledge === false;

    if (asset.pendingAction) {
        const stampedName = String(asset.waitingForName || '').trim();
        if (stampedName) {
            return { name: stampedName, kind: asset.waitingForKind || 'other' };
        }
        const storedName = String(asset.pendingActionDetails?.waitingForName || '').trim();
        const waitingId =
            asset.pendingActionDetails?.waitingForId
                ? assetPersonRefId(asset.pendingActionDetails.waitingForId)
                : arId;
        const role = String(asset.pendingActionDetails?.requestedByRole || '').toLowerCase();
        const requestedById = assetPersonRefId(asset.pendingActionDetails?.requestedBy);
        const assigneeStarted =
            role === 'assignee' ||
            role === 'companycoordinator' ||
            (!!requestedById && !!assigneeId && requestedById === assigneeId);
        const acId =
            assetPersonRefId(asset.designatedAssetController) ||
            assetPersonRefId(asset.assetController);
        const delegatedToReportee =
            asset.pendingActionDetails?.ownerApprovalDelegated === true ||
            (!!waitingId && !!reporteeId && waitingId === reporteeId);

        if (asset.pendingAction === 'Leave') {
            const name =
                storedName ||
                arName ||
                empDisplayNameFromRef(asset.designatedAssetController) ||
                empDisplayNameFromRef(asset.assetController);
            if (!name) return { name: '', kind: '' };
            return { name, kind: 'other' };
        }

        const pendingReturn = asset.pendingAction === 'Return Asset';
        const showingAc =
            pendingReturn &&
            !assigneeStarted &&
            !!acId &&
            ((waitingId && waitingId === acId) || (arId && arId === acId));

        if (!assigneeStarted && pendingReturn) {
            if (delegatedToReportee && reporteeName) {
                return { name: reporteeName, kind: 'reportee' };
            }
            if (showingAc) {
                const noCompanyEmail = !String(asset.assignedTo?.companyEmail || '').trim();
                if ((assigneeHasNoPortal || noCompanyEmail) && reporteeName) {
                    return { name: reporteeName, kind: 'reportee' };
                }
                if (assigneeName) return { name: assigneeName, kind: 'employee' };
                if (reporteeName) return { name: reporteeName, kind: 'reportee' };
            }
        }

        const name = storedName || arName;
        if (!name) return { name: '', kind: '' };
        if (delegatedToReportee) return { name: reporteeName || name, kind: 'reportee' };
        if (waitingId && assigneeId && waitingId === assigneeId) return { name, kind: 'employee' };
        return { name, kind: 'other' };
    }

    if (isAssetAssignmentAcknowledgmentPending(asset)) {
        if (asset.assignedToType === 'Company' || (asset.assignedCompany && !asset.assignedTo)) {
            return { name: arName || 'Company coordinator', kind: 'other' };
        }
        if (
            isWaitingOnPrimaryReportee({
                arId,
                assigneeId,
                reporteeId,
                delegatedToReportee: false,
                assigneeHasNoPortal,
                ackSaysNoSelf,
                pendingAction: '',
            })
        ) {
            const ackName = String(asset.assignmentAck?.waitingForName || '').trim();
            return { name: reporteeName || ackName || arName, kind: 'reportee' };
        }
        const ackName = String(asset.assignmentAck?.waitingForName || '').trim();
        if (arId && assigneeId && arId === assigneeId && (assigneeName || ackName)) {
            return { name: assigneeName || ackName, kind: 'employee' };
        }
        if (ackName) {
            const kind =
                reporteeId &&
                (assetPersonRefId(asset.assignmentAck?.waitingForId) === reporteeId ||
                    ackSaysNoSelf ||
                    assigneeHasNoPortal)
                    ? 'reportee'
                    : 'employee';
            return { name: ackName, kind };
        }
        if (arName) {
            const kind = arId && assigneeId && arId === assigneeId ? 'employee' : 'other';
            return { name: arName, kind };
        }
        return { name: assigneeName || reporteeName || 'Acknowledgment', kind: assigneeName ? 'employee' : 'other' };
    }

    const st = String(asset.status || '').trim();
    if (st === 'Submitted for Approval' || st === 'Draft') {
        const name =
            empDisplayNameFromRef(asset.creationApprover) ||
            empDisplayNameFromRef(asset.designatedAssetController) ||
            empDisplayNameFromRef(asset.assetController) ||
            arName ||
            'Asset controller approval';
        return { name, kind: 'other' };
    }

    return { name: arName || '', kind: arName ? 'other' : '' };
};

/** Who currently holds Leave / Return / EOL / L&D approval (name only). */
export const getPendingAssetActionWaitingName = (asset) => {
    if (!asset?.pendingAction) return '';
    return getAssetWaitingForMeta(asset).name;
};

/**
 * Single waiting-person name for asset list + details.
 * Assigned employee when they can act; otherwise their primary reportee.
 */
export const getAssetWaitingForDisplayName = (asset) => getAssetWaitingForMeta(asset).name;

/** Same chip text on list and details: "Waiting: Emp" or "Waiting for reportee: Name". */
export const formatAssetWaitingChipText = (asset) => {
    const { name, kind } = getAssetWaitingForMeta(asset);
    if (!name) return '';
    if (kind === 'reportee') return `Waiting for reportee: ${name}`;
    return `Waiting: ${name}`;
};

const normEmpKey = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

/** True when the logged-in employee must Approve/Reject a pending Leave / EOS / Return / L&D. */
export const userIsPendingAssetActionApprover = (asset, { employeeObjectId, employeeId, isAdmin, isAssetController } = {}) => {
    if (!asset?.pendingAction) return false;
    const meOid = employeeObjectId ? String(employeeObjectId) : '';
    const meEmpId = normEmpKey(employeeId);
    const arId = assetPersonRefId(asset.actionRequiredBy);
    const arEmpId = normEmpKey(asset.actionRequiredBy?.employeeId);
    const waitingId = asset.pendingActionDetails?.waitingForId
        ? assetPersonRefId(asset.pendingActionDetails.waitingForId)
        : '';
    if (meOid && waitingId && meOid === waitingId) return true;
    if (meOid && arId && arId === meOid) return true;
    if (meEmpId && arEmpId && arEmpId === meEmpId) return true;
    const delegated = asset.pendingActionDetails?.ownerApprovalDelegated === true;
    const reporteeId = assetPersonRefId(asset.assignedTo?.primaryReportee);
    const reporteeEmpId = normEmpKey(asset.assignedTo?.primaryReportee?.employeeId);
    if (delegated || (waitingId && reporteeId && waitingId === reporteeId)) {
        if (meOid && reporteeId && meOid === reporteeId) return true;
        if (meEmpId && reporteeEmpId && meEmpId === reporteeEmpId) return true;
    }
    // Legacy Leave sat on employees with no login. Super User / Asset Controller can clear it.
    if ((isAdmin || isAssetController) && String(asset.pendingAction) === 'Leave') return true;
    return false;
};

export const getAssetDetailsPrimaryStatusLabel = (asset) => {
    if (!asset) return '—';
    if (isTerminalAssetStatus(asset)) {
        const st = String(asset.status || '').trim();
        return st || 'Lost';
    }
    if (asset.pendingAction) {
        return `Pending — ${asset.pendingAction}`;
    }
    if (isAssetActivelyAssigned(asset)) return 'Assigned';
    if (asset.assignedTo || asset.assignedCompany) {
        const st = String(asset.status || '').trim();
        if (st) return st;
    }
    return asset.status || 'Unassigned';
};

const LEGACY_SERVICE = new Set(['service', 'on service', 'waiting for service', 'maintenance']);

/** True while parking transfer is pending acceptance — still treated as on leave. */
export const isParkingTransferInProgress = (asset) =>
    asset?.pendingActionDetails?.parkingReassignContext?.isParkingReassign === true;

export const isLeaveActive = (asset) => {
    if (!asset) return false;
    if (asset.onLeaveActive === true) return true;
    if (isParkingTransferInProgress(asset)) return true;
    return normalizeAssetStatusKey(asset.status) === 'on leave';
};

export const isServiceActive = (asset) => {
    if (!asset) return false;
    if (asset.onServiceActive === true) return true;
    return LEGACY_SERVICE.has(normalizeAssetStatusKey(asset.status));
};

/** Strict flag-only checks for AC Parking / On Service tabs. */
export const isOnLeaveFlagActive = (asset) => asset?.onLeaveActive === true;

export const isOnServiceFlagActive = (asset) => asset?.onServiceActive === true;

export const filterOnLeaveFlagActiveAssets = (assets) =>
    (assets || []).filter(isOnLeaveFlagActive);

export const filterOnServiceFlagActiveAssets = (assets) =>
    (assets || []).filter(isOnServiceFlagActive);

/** @deprecated Use isLeaveActive(asset) */
export const isParkingStatus = (status) => normalizeAssetStatusKey(status) === 'on leave';

/** @deprecated Use isServiceActive(asset) */
export const isServiceOperationalStatus = (statusOrAsset) => {
    if (statusOrAsset && typeof statusOrAsset === 'object' && !Array.isArray(statusOrAsset)) {
        return isServiceActive(statusOrAsset);
    }
    return LEGACY_SERVICE.has(normalizeAssetStatusKey(statusOrAsset));
};

export const hasActiveParkingContext = (asset) => isLeaveActive(asset);

export const getAssetById = (assets, id) =>
    (assets || []).find((a) => String(a?._id || a?.id) === String(id));

export const categorizeAssetsForBulkLeave = (assets, selectedIds) => {
    const idSet = new Set((selectedIds || []).map(String));
    const selected = (assets || []).filter((a) => idSet.has(String(a?._id || a?.id)));

    const alreadyOnLeave = [];
    const leaveApply = [];

    for (const asset of selected) {
        if (hasActiveParkingContext(asset) || isOnLeaveFlagActive(asset)) {
            alreadyOnLeave.push(asset);
        } else {
            leaveApply.push(asset);
        }
    }

    const leaveRequestIds = leaveApply.map((a) => String(a._id || a.id));

    return {
        selected,
        onService: [],
        alreadyOnLeave,
        alreadyParked: alreadyOnLeave,
        leaveApply,
        leaveRequestIds,
        canSubmitLeave: leaveRequestIds.length > 0,
    };
};

export const canReassignDuringParking = () => false;

export const isTransferBlockedForAsset = (asset) =>
    isLeaveActive(asset) || hasActiveParkingContext(asset);

const startOfCalendarDay = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
};

export const getRemainingDaysUntil = (endDate) => {
    const target = startOfCalendarDay(endDate);
    if (!target) return null;
    const today = startOfCalendarDay(new Date());
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

export const formatRemainingDaysLabel = (diffDays) => {
    if (diffDays == null || !Number.isFinite(diffDays)) return null;
    if (diffDays > 1) return `${diffDays} days left`;
    if (diffDays === 1) return '1 day left';
    if (diffDays === 0) return 'ends today';
    if (diffDays === -1) return '1 day overdue';
    return `${Math.abs(diffDays)} days overdue`;
};

export const getParkingEndDate = (asset) => {
    if (asset?.onLeaveEndDate) return asset.onLeaveEndDate;
    if (asset?.onLeaveStartDate && asset?.onLeaveDuration != null && asset?.onLeaveDuration !== '') {
        const start = new Date(asset.onLeaveStartDate);
        if (Number.isNaN(start.getTime())) return null;
        const end = new Date(start);
        const days = parseInt(asset.onLeaveDuration, 10);
        if (!Number.isFinite(days)) return null;
        end.setDate(start.getDate() + days);
        return end;
    }
    return null;
};

export const getActiveServiceRecord = (asset) => {
    const services = asset?.services;
    if (!Array.isArray(services) || services.length === 0) return null;
    for (let i = services.length - 1; i >= 0; i -= 1) {
        const svc = services[i];
        if (svc?.expiryDate && svc?.durationCompleteSentAt == null) return svc;
    }
    const last = services[services.length - 1];
    return last?.expiryDate ? last : null;
};

export const formatOnLeaveStatusSuffix = (asset) => {
    const remainLabel = formatRemainingDaysLabel(getRemainingDaysUntil(getParkingEndDate(asset)));
    if (remainLabel) return ` · ${remainLabel}`;
    const totalDays = parseInt(asset?.onLeaveDuration, 10);
    if (Number.isFinite(totalDays) && totalDays > 0) {
        return ` · ${totalDays} day${totalDays === 1 ? '' : 's'}`;
    }
    return '';
};

export const formatOnServiceStatusSuffix = (asset) => {
    const svc = getActiveServiceRecord(asset);
    if (!svc?.expiryDate) return '';
    const label = formatRemainingDaysLabel(getRemainingDaysUntil(svc.expiryDate));
    return label ? ` · ${label}` : '';
};

export const formatOnLeaveStatusLine = (asset, assigneeStr = '') => {
    const suffix = formatOnLeaveStatusSuffix(asset);
    if (assigneeStr) return `${assigneeStr} (On Leave${suffix})`;
    return `On Leave${suffix}`;
};

export const formatOnServiceStatusLine = (asset, assigneeStr = '') => {
    const suffix = formatOnServiceStatusSuffix(asset);
    if (assigneeStr) return `${assigneeStr} (On Service${suffix})`;
    return `On Service${suffix}`;
};

/** List / profile status — shows On Service and/or On Leave when flags are set (incl. Assigned + flags). */

/** Assets that may be assigned from the controller pool (fresh assign or return-to-pool). */
export const isPoolAssignableAssetStatus = (status) => {
    const st = String(status ?? '').trim().toLowerCase();
    return st === 'unassigned' || st === 'returned';
};

export const formatAssetAssignmentStatusLine = (asset, assigneeStr = '') => {
    const service = isOnServiceFlagActive(asset);
    const leave = isOnLeaveFlagActive(asset);

    const statusStr = String(asset?.status || '');
    const statusKey = statusStr.toLowerCase();
    if (statusKey === 'unassigned' || statusKey === 'returned') {
        if (service || leave) {
            const flagParts = [];
            if (service) flagParts.push(formatOnServiceStatusLine(asset, '').trim());
            if (leave) flagParts.push(formatOnLeaveStatusLine(asset, '').trim());
            const flags = flagParts.join(' · ');
            const base = statusStr || 'Unassigned';
            return flags ? `${base} · ${flags}` : base;
        }
        return statusStr || 'Unassigned';
    }

    if (service || leave) {
        const flagParts = [];
        if (service) flagParts.push(formatOnServiceStatusLine(asset, '').trim());
        if (leave) flagParts.push(formatOnLeaveStatusLine(asset, '').trim());
        const flags = flagParts.join(' · ');
        if (assigneeStr) return `${assigneeStr} (${flags})`;
        return flags;
    }

    if (asset?.assignedTo || asset?.assignedCompany) {
        return assigneeStr ? `Assigned - ${assigneeStr}` : 'Assigned';
    }
    if (statusStr === 'Assigned') {
        return assigneeStr ? `Assigned - ${assigneeStr}` : statusStr;
    }
    return statusStr || '—';
};

/** Display label for list badges — base status + operational flags */
export const formatAssetOperationalDisplay = (asset) => {
    const base = asset?.status || '—';
    const parts = [base];
    if (isServiceActive(asset)) parts.push('On Service');
    if (isLeaveActive(asset)) parts.push('On Leave');
    return parts.join(' · ');
};

export const categorizeAssetsForBulkReturnOrEos = (assets, selectedIds) => {
    const idSet = new Set((selectedIds || []).map(String));
    const selected = (assets || []).filter((a) => idSet.has(String(a?._id || a?.id)));

    const blocked = [];
    const eligible = [];

    for (const asset of selected) {
        if (isServiceActive(asset)) {
            blocked.push({ asset, reason: 'on service' });
        } else if (hasActiveParkingContext(asset)) {
            blocked.push({ asset, reason: 'on leave / parking' });
        } else {
            eligible.push(asset);
        }
    }

    return {
        selected,
        blocked,
        eligible,
        eligibleIds: eligible.map((a) => String(a._id || a.id)),
        canSubmit: eligible.length > 0,
    };
};

export const getAssetStatusBadgeClass = (status, asset = null) => {
    if (asset && isServiceActive(asset)) return 'bg-rose-100 text-rose-700';
    if (asset && isLeaveActive(asset)) return 'bg-sky-100 text-sky-800';
    const key = normalizeAssetStatusKey(status);
    if (key === 'assigned') return 'bg-indigo-100 text-indigo-700';
    if (key === 'unassigned') return 'bg-emerald-100 text-emerald-700';
    if (key === 'pending') return 'bg-amber-100 text-amber-700';
    if (LEGACY_SERVICE.has(key)) return 'bg-rose-100 text-rose-700';
    if (key === 'on leave') return 'bg-sky-100 text-sky-800';
    if (key === 'returned') return 'bg-blue-100 text-blue-700';
    if (key === 'lost') return 'bg-rose-100 text-rose-800';
    if (key === 'end of life' || key === 'out of service') return 'bg-slate-200 text-slate-800';
    return 'bg-slate-100 text-slate-700';
};

export const formatAssetListSummary = (assets, max = 3) => {
    const names = (assets || []).map((a) => a.assetId || a.name || 'Asset');
    if (names.length <= max) return names.join(', ');
    return `${names.slice(0, max).join(', ')} +${names.length - max} more`;
};
