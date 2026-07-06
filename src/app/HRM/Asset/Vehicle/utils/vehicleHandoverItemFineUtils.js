export function buildHandoverItemFineKey(itemType, itemKey) {
    return `${String(itemType || '')}:${String(itemKey || '')}`;
}

export function indexHandoverItemFines(fines = [], historyId) {
    const index = {};
    const targetHistoryId = String(historyId || '');
    if (!targetHistoryId) return index;

    fines.forEach((fine) => {
        const ctx = fine?.handoverApprovalContext;
        if (!ctx || String(ctx.historyId || '') !== targetHistoryId) return;
        if (!ctx.itemType || !ctx.itemKey) return;
        index[buildHandoverItemFineKey(ctx.itemType, ctx.itemKey)] = fine;
    });

    return index;
}

export function resolveHandoverItemFine(fineIndex, itemType, itemKey) {
    if (!fineIndex || !itemType || !itemKey) return null;
    return fineIndex[buildHandoverItemFineKey(itemType, itemKey)] || null;
}

export function isHandoverApprovedWithoutFine(historyEntry) {
    const lifecycle = String(historyEntry?.details?.handoverLifecycleStatus || '')
        .trim()
        .toLowerCase();
    if (lifecycle !== 'approved') return false;
    return historyEntry?.details?.handoverApprovedWithFine !== true;
}

export function resolveHandoverComparisonChanged(changed, historyEntry) {
    if (!changed) return false;
    if (isHandoverApprovedWithoutFine(historyEntry)) return false;
    return true;
}

export function buildHandoverItemFineInitialData({
    vehicle,
    historyEntry,
    itemType,
    itemKey,
    itemLabel,
    suggestedAmount = null,
    existingFine = null,
    assignee = null,
}) {
    const employeeId =
        assignee?.employeeId ||
        historyEntry?.assignedTo?.employeeId ||
        vehicle?.assignedTo?.employeeId ||
        '';

    const base = {
        vehicleId: vehicle?._id || '',
        assetId: vehicle?.assetId || '',
        employeeId,
        assignedEmployees: employeeId ? [{ employeeId }] : [],
        handoverApprovalContext: {
            historyId: historyEntry?._id ? String(historyEntry._id) : null,
            vehicleId: vehicle?._id ? String(vehicle._id) : null,
            itemType,
            itemKey,
            itemLabel: itemLabel || itemKey || '',
        },
        description: `Vehicle handover — ${itemLabel || itemKey}`.trim(),
    };

    if (existingFine?._id) {
        return {
            ...base,
            _id: existingFine._id,
            fineAmount: String(existingFine.fineAmount ?? ''),
            serviceCharge: String(existingFine.serviceCharge ?? ''),
            responsibleFor: existingFine.responsibleFor || 'Employee',
            employeeAmount:
                existingFine.employeeAmount != null ? String(existingFine.employeeAmount) : '',
            companyAmount:
                existingFine.companyAmount != null ? String(existingFine.companyAmount) : '',
            payableDuration: String(existingFine.payableDuration || '1'),
            monthStart: existingFine.monthStart || '',
            companyDescription: existingFine.companyDescription || '',
            fineStatus: existingFine.fineStatus,
            attachment: existingFine.attachment || null,
        };
    }

    const amount =
        suggestedAmount != null && suggestedAmount !== '' && Number.isFinite(Number(suggestedAmount))
            ? Number(suggestedAmount)
            : null;

    return {
        ...base,
        fineAmount: amount != null ? String(amount) : '',
    };
}

export function resolveHandoverItemVisualStatus({
    changed,
    hasFine,
    hasBaseline = true,
    acceptedWithoutFine = false,
}) {
    if (hasFine) return 'fined';
    if (acceptedWithoutFine && changed && hasBaseline) return 'unchanged';
    if (changed && hasBaseline) return 'changed';
    if (hasBaseline && !changed) return 'unchanged';
    return 'neutral';
}

export function handoverItemVisualClasses(status) {
    if (status === 'fined') {
        return {
            card: 'border-2 border-amber-400 bg-amber-50/30 shadow-sm shadow-amber-100',
            frame: 'ring-2 ring-amber-400 ring-offset-1',
            badge: 'bg-amber-100 text-amber-800',
            badgeLabel: 'In Fine',
        };
    }
    if (status === 'changed') {
        return {
            card: 'border-2 border-red-400 bg-red-50/30 shadow-sm shadow-red-100',
            frame: 'ring-2 ring-red-400 ring-offset-1',
            badge: 'bg-red-100 text-red-700',
            badgeLabel: 'Changed',
        };
    }
    if (status === 'unchanged') {
        return {
            card: 'border-2 border-emerald-400 bg-emerald-50/30 shadow-sm shadow-emerald-100',
            frame: 'ring-2 ring-emerald-400 ring-offset-1',
            badge: 'bg-emerald-100 text-emerald-800',
            badgeLabel: 'OK',
        };
    }
    return {
        card: 'border border-gray-100 bg-white shadow-sm',
        frame: '',
        badge: '',
        badgeLabel: '',
    };
}
