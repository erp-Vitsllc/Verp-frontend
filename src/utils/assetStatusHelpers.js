/** Mirrors backend parking / on-service status rules in assetItemController.js */

export const normalizeAssetStatusKey = (status) => String(status || '').toLowerCase().trim();

export const isParkingStatus = (status) => normalizeAssetStatusKey(status) === 'on leave';

export const isServiceOperationalStatus = (status) => {
    const key = normalizeAssetStatusKey(status);
    return (
        key === 'service' ||
        key === 'on service' ||
        key === 'waiting for service' ||
        key === 'maintenance'
    );
};

export const hasActiveParkingContext = (asset) =>
    isParkingStatus(asset?.status) ||
    asset?.onLeaveEndDate != null ||
    asset?.onLeaveStartDate != null ||
    (asset?.onLeaveDuration != null && asset?.onLeaveDuration !== '');

export const getAssetById = (assets, id) =>
    (assets || []).find((a) => String(a?._id || a?.id) === String(id));

export const categorizeAssetsForBulkLeave = (assets, selectedIds) => {
    const idSet = new Set((selectedIds || []).map(String));
    const selected = (assets || []).filter((a) => idSet.has(String(a?._id || a?.id)));

    const onService = [];
    const alreadyOnLeave = [];
    const leaveApply = [];

    for (const asset of selected) {
        if (isServiceOperationalStatus(asset?.status)) {
            onService.push(asset);
        } else if (hasActiveParkingContext(asset)) {
            alreadyOnLeave.push(asset);
        } else {
            leaveApply.push(asset);
        }
    }

    const leaveRequestIds = leaveApply.map((a) => String(a._id || a.id));

    return {
        selected,
        onService,
        alreadyOnLeave,
        alreadyParked: alreadyOnLeave,
        leaveApply,
        leaveRequestIds,
        canSubmitLeave: leaveRequestIds.length > 0,
    };
};

export const isTransferBlockedForAsset = (asset) =>
    isParkingStatus(asset?.status) || hasActiveParkingContext(asset);

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
    const label = formatRemainingDaysLabel(getRemainingDaysUntil(getParkingEndDate(asset)));
    return label ? ` · ${label}` : '';
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

export const categorizeAssetsForBulkReturnOrEos = (assets, selectedIds) => {
    const idSet = new Set((selectedIds || []).map(String));
    const selected = (assets || []).filter((a) => idSet.has(String(a?._id || a?.id)));

    const blocked = [];
    const eligible = [];

    for (const asset of selected) {
        if (isServiceOperationalStatus(asset?.status)) {
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

export const getAssetStatusBadgeClass = (status) => {
    const key = normalizeAssetStatusKey(status);
    if (key === 'assigned') return 'bg-indigo-100 text-indigo-700';
    if (key === 'unassigned') return 'bg-emerald-100 text-emerald-700';
    if (key === 'pending') return 'bg-amber-100 text-amber-700';
    if (key === 'service' || key === 'on service') return 'bg-rose-100 text-rose-700';
    if (key === 'waiting for service' || key === 'maintenance') return 'bg-orange-100 text-orange-700';
    if (key === 'on leave') return 'bg-sky-100 text-sky-800';
    if (key === 'returned') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-700';
};

export const formatAssetListSummary = (assets, max = 3) => {
    const names = (assets || []).map((a) => a.assetId || a.name || 'Asset');
    if (names.length <= max) return names.join(', ');
    return `${names.slice(0, max).join(', ')} +${names.length - max} more`;
};
