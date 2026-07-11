import { isHandoverHrStage } from './vehicleHandoverAssignActions';
import {
    BODY_CONDITION_PHOTO_SOURCE,
    BODY_CONDITION_VIEW_FIELDS,
    buildBodyConditionEditableFormState,
} from './vehicleHandoverBodyCondition';
import {
    buildAssessmentComparisonRows,
    buildBodyConditionComparisonRows,
} from './vehicleHandoverPhotoComparison';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    hasAssessmentPhoto,
    normalizeHandoverPhotoIdentity,
    resolveAssessmentMediaUrl,
} from './vehicleHandoverReceiverAssessment';

/** Props for AddVehicleFineModal when recording handover item damage. */
export const HANDOVER_DAMAGE_FINE_MODAL_PROPS = {
    fineCategory: 'Damage',
    fineTypeName: 'Vehicle Damage',
    allowMultipleImages: true,
};

/** Payload fields so handover fines always classify as Vehicle Damage. */
export function buildHandoverVehicleDamageFineTypeFields() {
    return {
        category: HANDOVER_DAMAGE_FINE_MODAL_PROPS.fineCategory,
        subCategory: HANDOVER_DAMAGE_FINE_MODAL_PROPS.fineTypeName,
        fineType: HANDOVER_DAMAGE_FINE_MODAL_PROPS.fineTypeName,
    };
}

function formatHandoverPresentLabel(value) {
    if (value === true) return 'Present';
    if (value === false) return 'Not present';
    return null;
}

function extractPhotoPublicId(value) {
    if (!value) return null;
    if (typeof value === 'object') {
        const publicId = value.publicId || value.path;
        if (typeof publicId === 'string' && publicId.trim()) {
            return publicId.trim();
        }
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !trimmed.startsWith('http') && !trimmed.startsWith('data:')) {
            return trimmed;
        }
    }
    return null;
}

function buildHandoverDamageAttachments({
    photo,
    previousPhoto,
    photos,
    itemLabel,
    photoUrl = null,
    previousPhotoUrl = null,
}) {
    const attachments = [];
    const seenIdentities = new Set();
    const label = String(itemLabel || 'handover').trim() || 'handover';

    const addPhoto = (value, suffix, explicitUrl = null) => {
        if (!value && !explicitUrl) return;

        const identity = normalizeHandoverPhotoIdentity(value || explicitUrl);
        if (identity) {
            if (seenIdentities.has(identity)) return;
            seenIdentities.add(identity);
        }

        const url = explicitUrl || resolveAssessmentMediaUrl(value);
        const publicId = extractPhotoPublicId(value);

        if (!url && !publicId) return;

        attachments.push({
            url: url || '',
            ...(publicId ? { publicId } : {}),
            name: `${label}-${suffix}.jpg`,
        });
    };

    if (Array.isArray(photos)) {
        photos.forEach((entry, index) => {
            if (entry && typeof entry === 'object' && ('photo' in entry || 'url' in entry)) {
                addPhoto(
                    entry.photo ?? entry.url,
                    entry.suffix || `image-${index + 1}`,
                    entry.photoUrl ?? entry.url ?? null,
                );
            } else {
                addPhoto(entry, `image-${index + 1}`);
            }
        });
    }

    addPhoto(previousPhoto, 'previous', previousPhotoUrl);
    addPhoto(photo, 'current', photoUrl);

    return attachments;
}

function mergeHandoverDamageAttachments(attachmentLists = []) {
    const attachments = [];
    const seenIdentities = new Set();

    attachmentLists.forEach((list) => {
        (Array.isArray(list) ? list : []).forEach((entry) => {
            const url = String(entry?.url || '').trim();
            const identity =
                normalizeHandoverPhotoIdentity(entry?.publicId || entry) ||
                (url ? url.split('?')[0] : '');
            if (!identity || seenIdentities.has(identity)) return;
            seenIdentities.add(identity);
            attachments.push({
                url,
                ...(entry?.publicId ? { publicId: entry.publicId } : {}),
                name: String(entry?.name || 'handover-image.jpg').trim() || 'handover-image.jpg',
            });
        });
    });

    return attachments;
}

function isHandoverItemIncludedInApprovalFine({ hasFine = false, changed = false, isWaived = false } = {}) {
    if (isWaived) return false;
    return hasFine || changed;
}

function buildHandoverDamageDescription({
    itemLabel,
    itemKey,
    itemType,
    comment,
    previousComment,
    present,
    previousPresent,
    photoChanged = false,
}) {
    const label = String(itemLabel || itemKey || 'item').trim();
    const lines = [`Vehicle handover damage — ${label}`];

    if (itemType === 'body') {
        const previous = String(previousComment || '').trim();
        const current = String(comment || '').trim();
        if (previous) lines.push(`Previous comment: ${previous}`);
        if (current) lines.push(`Current comment: ${current}`);
        if (photoChanged) lines.push('Photo changed: Yes');
    } else if (itemType === 'accessory') {
        const previousStatus = formatHandoverPresentLabel(previousPresent);
        const currentStatus = formatHandoverPresentLabel(present);
        if (previousStatus) lines.push(`Previous status: ${previousStatus}`);
        if (currentStatus) lines.push(`Current status: ${currentStatus}`);
        if (photoChanged) lines.push('Photo changed: Yes');
        const note = String(comment || '').trim();
        if (note) lines.push(`Notes: ${note}`);
    } else {
        const note = String(comment || '').trim();
        if (note) lines.push(note);
    }

    return lines.join('\n');
}

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

/** HR aggregate "Approve with fine" record — no per-item keys on context. */
export function resolveHandoverAggregateApprovalFine(fines = [], historyId) {
    const targetHistoryId = String(historyId || '');
    if (!targetHistoryId) return null;

    return (
        (Array.isArray(fines) ? fines : []).find((fine) => {
            const ctx = fine?.handoverApprovalContext;
            if (!ctx || String(ctx.historyId || '') !== targetHistoryId) return false;
            if (ctx.itemType && ctx.itemKey) return false;
            return Boolean(fine.handoverHrApproval || fine.handoverApprovalFine);
        }) || null
    );
}

/** Item-level fine, or aggregate handover fine when the item is still changed. */
export function resolveHandoverItemFineForCard({
    fineIndex,
    fines = [],
    historyId,
    itemType,
    itemKey,
    changed = false,
    isWaived = false,
} = {}) {
    const itemFine = resolveHandoverItemFine(fineIndex, itemType, itemKey);
    if (itemFine) return itemFine;
    if (isWaived || !changed) return null;
    return resolveHandoverAggregateApprovalFine(fines, historyId);
}

export function indexHandoverItemFineWaivers(historyEntry) {
    const index = {};
    const list = historyEntry?.details?.handoverItemFineWaivers;
    if (!Array.isArray(list)) return index;

    list.forEach((entry) => {
        const itemType = String(entry?.itemType || '').trim();
        const itemKey = String(entry?.itemKey || '').trim();
        if (!itemType || !itemKey) return;
        index[buildHandoverItemFineKey(itemType, itemKey)] = true;
    });

    return index;
}

export function indexHandoverItemFineInclusions(historyEntry) {
    const index = {};
    const list = historyEntry?.details?.handoverItemFineInclusions;
    if (!Array.isArray(list)) return index;

    list.forEach((entry) => {
        const itemType = String(entry?.itemType || '').trim();
        const itemKey = String(entry?.itemKey || '').trim();
        if (!itemType || !itemKey) return;
        index[buildHandoverItemFineKey(itemType, itemKey)] = true;
    });

    return index;
}

export function isHandoverItemFineWaived(waiverIndex, itemType, itemKey) {
    if (!waiverIndex || !itemType || !itemKey) return false;
    return Boolean(waiverIndex[buildHandoverItemFineKey(itemType, itemKey)]);
}

export function isHandoverItemFineIncluded(inclusionIndex, itemType, itemKey) {
    if (!inclusionIndex || !itemType || !itemKey) return false;
    return Boolean(inclusionIndex[buildHandoverItemFineKey(itemType, itemKey)]);
}

/** Display amount from the linked handover item fine when present. */
export function resolveHandoverItemFineDisplayAmount(existingFine, fallbackAmount = null) {
    if (!existingFine) return fallbackAmount;
    const raw =
        existingFine.fineAmount ??
        existingFine.employeeAmount ??
        existingFine.amount ??
        null;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
    const fallback = Number(fallbackAmount);
    return Number.isFinite(fallback) ? fallback : null;
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

/** Item-level Add/Edit Fine is only available to HR during the HR approval stage. */
export function canManageHandoverItemFines({
    isFlowchartHr = false,
    vehicle = null,
    historyEntry = null,
} = {}) {
    if (!isFlowchartHr) return false;

    const lifecycle = String(historyEntry?.details?.handoverLifecycleStatus || '')
        .trim()
        .toLowerCase();
    if (lifecycle === 'approved') return false;

    return isHandoverHrStage(vehicle, historyEntry);
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
    photo = null,
    previousPhoto = null,
    comment = null,
    previousComment = null,
    present = null,
    previousPresent = null,
    photos = null,
    photoUrl = null,
    previousPhotoUrl = null,
    photoChanged = false,
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
        ...buildHandoverVehicleDamageFineTypeFields(),
        handoverApprovalContext: {
            historyId: historyEntry?._id ? String(historyEntry._id) : null,
            vehicleId: vehicle?._id ? String(vehicle._id) : null,
            itemType,
            itemKey,
            itemLabel: itemLabel || itemKey || '',
        },
        description: buildHandoverDamageDescription({
            itemLabel,
            itemKey,
            itemType,
            comment,
            previousComment,
            present,
            previousPresent,
            photoChanged,
        }),
    };

    if (existingFine?._id) {
        const existingAttachments = [];
        if (Array.isArray(existingFine.attachments) && existingFine.attachments.length > 0) {
            existingAttachments.push(...existingFine.attachments);
        } else if (existingFine.attachment?.url || existingFine.attachment?.name) {
            existingAttachments.push(existingFine.attachment);
        }

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
            description: existingFine.description || base.description,
            attachment: existingFine.attachment || existingAttachments[0] || null,
            attachments: existingAttachments.length > 0 ? existingAttachments : undefined,
        };
    }

    const amount =
        suggestedAmount != null && suggestedAmount !== '' && Number.isFinite(Number(suggestedAmount))
            ? Number(suggestedAmount)
            : null;

    const attachments = buildHandoverDamageAttachments({
        photo,
        previousPhoto,
        photos,
        itemLabel,
        photoUrl,
        previousPhotoUrl,
    });

    return {
        ...base,
        fineAmount: amount != null ? String(amount) : '',
        attachments: attachments.length > 0 ? attachments : undefined,
    };
}

/** True when body condition or accessories have changed / fined items requiring HR fine choice. */
export function hasHandoverApprovalFineItems({
    vehicle,
    historyEntry,
    assetHistory = [],
    handoverItemFineIndex = {},
    handoverItemFineWaiverIndex = {},
} = {}) {
    if (!historyEntry) return false;

    const bodyForm = buildBodyConditionEditableFormState(historyEntry, {
        assetHistory,
        currentEntry: historyEntry,
    });
    const bodyComparisons = buildBodyConditionComparisonRows(historyEntry, assetHistory);
    const bodyComparisonByKey = Object.fromEntries(bodyComparisons.map((row) => [row.key, row]));

    const accessoryComparisons = buildAssessmentComparisonRows(historyEntry, assetHistory, vehicle);
    const accessoryComparisonByKey = Object.fromEntries(
        accessoryComparisons.map((row) => [row.key, row]),
    );

    for (const view of BODY_CONDITION_VIEW_FIELDS) {
        const existingFine = resolveHandoverItemFine(handoverItemFineIndex, 'body', view.key);
        const isWaived = isHandoverItemFineWaived(handoverItemFineWaiverIndex, 'body', view.key);
        const formRow = bodyForm[view.key] || {};
        const comparison = bodyComparisonByKey[view.key] || {};
        const hasPreviousBaseline =
            hasAssessmentPhoto(comparison.previous?.photo) || Boolean(comparison.previous?.photoUrl);
        const hasCurrentPhoto = hasAssessmentPhoto(formRow.photo);
        const rawChanged =
            hasCurrentPhoto &&
            formRow.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW &&
            hasPreviousBaseline;
        const changed = resolveHandoverComparisonChanged(rawChanged, historyEntry);
        if (
            isHandoverItemIncludedInApprovalFine({
                hasFine: Boolean(existingFine),
                changed,
                isWaived,
            })
        ) {
            return true;
        }
    }

    for (const item of RECEIVER_ASSESSMENT_ITEMS) {
        const existingFine = resolveHandoverItemFine(handoverItemFineIndex, 'accessory', item.key);
        const isWaived = isHandoverItemFineWaived(handoverItemFineWaiverIndex, 'accessory', item.key);
        const comparison = accessoryComparisonByKey[item.key] || {};
        const changed = resolveHandoverComparisonChanged(comparison.changed, historyEntry);
        if (
            isHandoverItemIncludedInApprovalFine({
                hasFine: Boolean(existingFine),
                changed,
                isWaived,
            })
        ) {
            return true;
        }
    }

    return false;
}

/** Aggregate description + damage photos for HR "Approve with fine" modal. */
export function buildHandoverApprovalFineInitialData({
    vehicle,
    historyEntry,
    assetHistory = [],
    handoverItemFineIndex = {},
    handoverItemFineWaiverIndex = {},
    assignee = null,
} = {}) {
    const employeeId =
        assignee?.employeeId ||
        historyEntry?.assignedTo?.employeeId ||
        vehicle?.assignedTo?.employeeId ||
        '';
    const assetId = vehicle?.assetId || '';

    const base = {
        handoverApprovalFine: true,
        handoverApprovalContext: {
            historyId: historyEntry?._id || null,
            vehicleId: vehicle?._id || null,
        },
        vehicleId: vehicle?._id || '',
        assetId,
        employeeId,
        assignedEmployees: employeeId ? [{ employeeId }] : [],
    };

    if (!historyEntry) {
        return {
            ...base,
            description: `Vehicle handover damage fine — ${assetId}`.trim(),
        };
    }

    const bodyForm = buildBodyConditionEditableFormState(historyEntry, {
        assetHistory,
        currentEntry: historyEntry,
    });
    const bodyComparisons = buildBodyConditionComparisonRows(historyEntry, assetHistory);
    const bodyComparisonByKey = Object.fromEntries(bodyComparisons.map((row) => [row.key, row]));

    const accessoryComparisons = buildAssessmentComparisonRows(historyEntry, assetHistory, vehicle);
    const accessoryComparisonByKey = Object.fromEntries(
        accessoryComparisons.map((row) => [row.key, row]),
    );

    const bodyDescriptions = [];
    const accessoryDescriptions = [];
    const attachmentLists = [];
    let suggestedTotal = 0;

    BODY_CONDITION_VIEW_FIELDS.forEach((view) => {
        const existingFine = resolveHandoverItemFine(handoverItemFineIndex, 'body', view.key);
        const isWaived = isHandoverItemFineWaived(handoverItemFineWaiverIndex, 'body', view.key);
        const formRow = bodyForm[view.key] || {};
        const comparison = bodyComparisonByKey[view.key] || {};
        const hasPreviousBaseline =
            hasAssessmentPhoto(comparison.previous?.photo) || Boolean(comparison.previous?.photoUrl);
        const hasCurrentPhoto = hasAssessmentPhoto(formRow.photo);
        const rawChanged =
            hasCurrentPhoto &&
            formRow.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW &&
            hasPreviousBaseline;
        const changed = resolveHandoverComparisonChanged(rawChanged, historyEntry);
        const hasFine = Boolean(existingFine);

        if (!isHandoverItemIncludedInApprovalFine({ hasFine, changed, isWaived })) return;

        bodyDescriptions.push(
            buildHandoverDamageDescription({
                itemLabel: view.label,
                itemKey: view.key,
                itemType: 'body',
                comment: formRow.comment,
                previousComment: comparison.previous?.comment,
                photoChanged: comparison.photoChanged,
            }),
        );

        attachmentLists.push(
            buildHandoverDamageAttachments({
                photo: formRow.photo,
                previousPhoto: comparison.previous?.photo,
                itemLabel: view.label,
                photoUrl: comparison.current?.photoUrl,
                previousPhotoUrl: comparison.previous?.photoUrl,
            }),
        );

        if (existingFine) {
            const amount = resolveHandoverItemFineDisplayAmount(existingFine, 0);
            if (Number.isFinite(amount)) suggestedTotal += amount;
        }
    });

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const existingFine = resolveHandoverItemFine(handoverItemFineIndex, 'accessory', item.key);
        const isWaived = isHandoverItemFineWaived(handoverItemFineWaiverIndex, 'accessory', item.key);
        const comparison = accessoryComparisonByKey[item.key] || {};
        const changed = resolveHandoverComparisonChanged(comparison.changed, historyEntry);
        const hasFine = Boolean(existingFine);

        if (!isHandoverItemIncludedInApprovalFine({ hasFine, changed, isWaived })) return;

        accessoryDescriptions.push(
            buildHandoverDamageDescription({
                itemLabel: item.label,
                itemKey: item.key,
                itemType: 'accessory',
                present: comparison.current?.present,
                previousPresent: comparison.previous?.present,
                photoChanged: comparison.photoChanged,
            }),
        );

        attachmentLists.push(
            buildHandoverDamageAttachments({
                photo: comparison.current?.photo,
                previousPhoto: comparison.previous?.photo,
                itemLabel: item.label,
                photoUrl: comparison.current?.photoUrl,
                previousPhotoUrl: comparison.previous?.photoUrl,
            }),
        );

        if (existingFine) {
            const amount = resolveHandoverItemFineDisplayAmount(existingFine, 0);
            if (Number.isFinite(amount)) suggestedTotal += amount;
        }
    });

    const descriptionParts = [`Vehicle handover damage fine — ${assetId}`.trim()];
    if (bodyDescriptions.length > 0) {
        descriptionParts.push('', 'Body condition:', ...bodyDescriptions);
    }
    if (accessoryDescriptions.length > 0) {
        descriptionParts.push('', 'Accessories:', ...accessoryDescriptions);
    }

    const attachments = mergeHandoverDamageAttachments(attachmentLists);

    return {
        ...base,
        description: descriptionParts.join('\n'),
        fineAmount: suggestedTotal > 0 ? String(suggestedTotal) : '',
        attachments: attachments.length > 0 ? attachments : undefined,
    };
}

export function resolveHandoverItemVisualStatus({
    changed,
    hasFine,
    isWaived = false,
    isIncluded = false,
    hasBaseline = true,
    acceptedWithoutFine = false,
}) {
    if (isWaived) return 'unchanged';
    if (hasFine || isIncluded) return 'fined';
    if (acceptedWithoutFine && changed && hasBaseline) return 'unchanged';
    if (changed && hasBaseline) return 'changed';
    if (hasBaseline && !changed) return 'unchanged';
    return 'neutral';
}

export function shouldShowHandoverItemFineActions({
    canManageItemFines = false,
    changed = false,
    hasFine = false,
    isWaived = false,
    isIncluded = false,
} = {}) {
    if (!canManageItemFines) return false;
    return changed || hasFine || isWaived || isIncluded;
}

/** Changed / fined cards that still need an HR include/exclude decision. */
export function listHandoverApprovalFineDecisionItems({
    vehicle,
    historyEntry,
    assetHistory = [],
    handoverItemFineIndex = {},
    handoverItemFineWaiverIndex = {},
    handoverItemFineInclusionIndex = {},
} = {}) {
    if (!historyEntry) return [];

    const bodyForm = buildBodyConditionEditableFormState(historyEntry, {
        assetHistory,
        currentEntry: historyEntry,
    });
    const bodyComparisons = buildBodyConditionComparisonRows(historyEntry, assetHistory);
    const bodyComparisonByKey = Object.fromEntries(bodyComparisons.map((row) => [row.key, row]));
    const accessoryComparisons = buildAssessmentComparisonRows(historyEntry, assetHistory, vehicle);
    const accessoryComparisonByKey = Object.fromEntries(
        accessoryComparisons.map((row) => [row.key, row]),
    );

    const items = [];

    BODY_CONDITION_VIEW_FIELDS.forEach((view) => {
        const existingFine = resolveHandoverItemFine(handoverItemFineIndex, 'body', view.key);
        const isWaived = isHandoverItemFineWaived(handoverItemFineWaiverIndex, 'body', view.key);
        const isIncluded = isHandoverItemFineIncluded(
            handoverItemFineInclusionIndex,
            'body',
            view.key,
        );
        const formRow = bodyForm[view.key] || {};
        const comparison = bodyComparisonByKey[view.key] || {};
        const hasPreviousBaseline =
            hasAssessmentPhoto(comparison.previous?.photo) || Boolean(comparison.previous?.photoUrl);
        const hasCurrentPhoto = hasAssessmentPhoto(formRow.photo);
        const rawChanged =
            hasCurrentPhoto &&
            formRow.photoSource === BODY_CONDITION_PHOTO_SOURCE.NEW &&
            hasPreviousBaseline;
        const changed = resolveHandoverComparisonChanged(rawChanged, historyEntry);

        if (!changed && !existingFine && !isIncluded && !isWaived) return;

        items.push({
            itemType: 'body',
            itemKey: view.key,
            itemLabel: view.label,
            changed,
            hasFine: Boolean(existingFine),
            isWaived,
            isIncluded: isIncluded || Boolean(existingFine),
            decided: isWaived || isIncluded || Boolean(existingFine),
            needsDecision: Boolean(changed || existingFine || isIncluded || isWaived),
            existingFine,
            formRow,
            comparison,
        });
    });

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const existingFine = resolveHandoverItemFine(handoverItemFineIndex, 'accessory', item.key);
        const isWaived = isHandoverItemFineWaived(handoverItemFineWaiverIndex, 'accessory', item.key);
        const isIncluded = isHandoverItemFineIncluded(
            handoverItemFineInclusionIndex,
            'accessory',
            item.key,
        );
        const comparison = accessoryComparisonByKey[item.key] || {};
        const changed = resolveHandoverComparisonChanged(comparison.changed, historyEntry);

        if (!changed && !existingFine && !isIncluded && !isWaived) return;

        items.push({
            itemType: 'accessory',
            itemKey: item.key,
            itemLabel: item.label,
            changed,
            hasFine: Boolean(existingFine),
            isWaived,
            isIncluded: isIncluded || Boolean(existingFine),
            decided: isWaived || isIncluded || Boolean(existingFine),
            needsDecision: Boolean(changed || existingFine || isIncluded || isWaived),
            existingFine,
            comparison,
        });
    });

    return items.filter((row) => row.needsDecision);
}

export function areAllHandoverFineItemsDecided(args) {
    const items = listHandoverApprovalFineDecisionItems(args);
    if (!items.length) return true;
    return items.every((row) => row.decided);
}

export function listIncludedHandoverFineItems(args) {
    return listHandoverApprovalFineDecisionItems(args).filter(
        (row) => row.isIncluded && !row.isWaived,
    );
}

export async function updateHandoverItemFineWaiver(axiosInstance, historyId, { itemType, itemKey, waived, decision }) {
    if (!historyId || String(historyId).startsWith('live-')) {
        throw new Error('Save the handover record before updating item fines.');
    }
    const body = { itemType, itemKey };
    if (decision === 'include' || decision === 'exclude') {
        body.decision = decision;
    } else {
        body.waived = Boolean(waived);
        if (waived === false) body.included = true;
    }
    const { data } = await axiosInstance.put(
        `/AssetItem/history-record/${historyId}/handover-item-fine-waiver`,
        body,
        { skipActionDedupe: true },
    );
    return data;
}

export function handoverItemVisualClasses(status) {
    if (status === 'fined') {
        return {
            card: 'border-2 border-red-400 bg-red-50/30 shadow-sm shadow-red-100',
            frame: 'ring-2 ring-red-400 ring-offset-1',
            badge: 'bg-red-100 text-red-700',
            badgeLabel: 'Added in fine',
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
