import {
    BODY_CONDITION_VIEW_FIELDS,
    buildBodyConditionCurrentFormState,
    hasBodyConditionReportData,
} from './vehicleHandoverBodyCondition';
import { hasAssessmentPhoto } from './vehicleHandoverReceiverAssessment';

export const SERVICE_NEW_CONDITION_PHOTO_SLOTS = BODY_CONDITION_VIEW_FIELDS.length;

export const SERVICE_BODY_PART_OPTIONS = BODY_CONDITION_VIEW_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
}));

/** 3 body-part cells per row (matches Complete Service layout request). */
export const SERVICE_BODY_PART_CARDS_PER_ROW = 3;

const BODY_PART_KEY_SET = new Set(SERVICE_BODY_PART_OPTIONS.map((opt) => opt.key));

export function isValidServiceBodyPartKey(key) {
    return BODY_PART_KEY_SET.has(String(key || '').trim());
}

export function labelForServiceBodyPartKey(key) {
    const match = SERVICE_BODY_PART_OPTIONS.find((opt) => opt.key === key);
    return match?.label || '';
}

export function getServiceBodyPartRowChunks(cardsPerRow = SERVICE_BODY_PART_CARDS_PER_ROW) {
    const chunks = [];
    for (let index = 0; index < BODY_CONDITION_VIEW_FIELDS.length; index += cardsPerRow) {
        chunks.push(BODY_CONDITION_VIEW_FIELDS.slice(index, index + cardsPerRow));
    }
    return chunks;
}

/** Body-part keys already taken by other images (excluding `excludeIndex`). */
export function usedServiceBodyPartKeys(images = [], excludeIndex = -1) {
    const used = new Set();
    (Array.isArray(images) ? images : []).forEach((img, idx) => {
        if (idx === excludeIndex) return;
        const key = String(img?.bodyPartKey || '').trim();
        if (key && isValidServiceBodyPartKey(key)) used.add(key);
    });
    return used;
}

/**
 * Effective current body-condition photos keyed by view (Front View, Back View, …).
 * Walks handover history newest-first per body part so gaps on the latest row
 * still fill from an earlier inspection / handover that has that photo.
 */
export function buildLatestBodyConditionPhotosByKey(assetHistory = []) {
    if (!Array.isArray(assetHistory) || !assetHistory.length) return {};

    const sorted = [...assetHistory].sort((a, b) => {
        const aTs = new Date(a?.createdAt || a?.date || 0).getTime();
        const bTs = new Date(b?.createdAt || b?.date || 0).getTime();
        if (bTs !== aTs) return bTs - aTs;
        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });

    const out = {};
    BODY_CONDITION_VIEW_FIELDS.forEach((field) => {
        for (const entry of sorted) {
            if (!hasBodyConditionReportData(entry)) continue;
            const form = buildBodyConditionCurrentFormState(entry);
            const block = form[field.key] || {};
            if (!hasAssessmentPhoto(block.photo)) continue;
            out[field.key] = {
                photo: block.photo,
                comment: String(block.comment || '').trim(),
            };
            break;
        }
    });
    return out;
}

export function findNewConditionImageForBodyPart(images = [], bodyPartKey) {
    const key = String(bodyPartKey || '').trim();
    if (!key) return null;
    const list = Array.isArray(images) ? images : [];
    return list.find((img) => String(img?.bodyPartKey || '').trim() === key) || null;
}

export function validateNewConditionBodyPartMappings(formData) {
    const errors = {};
    const newImages = Array.isArray(formData?.newConditionImages) ? formData.newConditionImages : [];
    if (!newImages.length) return errors;

    const seen = new Set();
    newImages.forEach((img, idx) => {
        const key = String(img?.bodyPartKey || '').trim();
        if (!key || !isValidServiceBodyPartKey(key)) {
            errors.newConditionImages = `Select a body part for new condition photo ${idx + 1}`;
            return;
        }
        if (seen.has(key)) {
            errors.newConditionImages = `Body part "${labelForServiceBodyPartKey(key)}" can only be selected once`;
            return;
        }
        seen.add(key);
    });
    return errors;
}

export function buildNewConditionImagesPayload(images = []) {
    return (Array.isArray(images) ? images : [])
        .filter((img) => img?.data && img?.name && isValidServiceBodyPartKey(img.bodyPartKey))
        .map((img) => ({
            name: img.name,
            data: img.data,
            mimeType: img.mimeType || 'image/jpeg',
            bodyPartKey: String(img.bodyPartKey).trim(),
        }));
}
