import { BODY_CONDITION_VIEW_FIELDS } from './vehicleHandoverBodyCondition';

export const SERVICE_NEW_CONDITION_PHOTO_SLOTS = 8;

export const SERVICE_BODY_PART_OPTIONS = BODY_CONDITION_VIEW_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
}));

const BODY_PART_KEY_SET = new Set(SERVICE_BODY_PART_OPTIONS.map((opt) => opt.key));

export function isValidServiceBodyPartKey(key) {
    return BODY_PART_KEY_SET.has(String(key || '').trim());
}

export function labelForServiceBodyPartKey(key) {
    const match = SERVICE_BODY_PART_OPTIONS.find((opt) => opt.key === key);
    return match?.label || '';
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

export function validateNewConditionBodyPartMappings(formData) {
    const errors = {};
    const newImages = Array.isArray(formData?.newConditionImages) ? formData.newConditionImages : [];
    if (!newImages.length) return errors;

    const seen = new Set();
    newImages.forEach((img, idx) => {
        const key = String(img?.bodyPartKey || '').trim();
        if (!key || !isValidServiceBodyPartKey(key)) {
            errors.newConditionImages = `Select Replace to body part for photo ${idx + 1}`;
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
        .filter((img) => img?.data && img?.name)
        .map((img) => ({
            name: img.name,
            data: img.data,
            mimeType: img.mimeType || 'image/jpeg',
            bodyPartKey: isValidServiceBodyPartKey(img.bodyPartKey) ? String(img.bodyPartKey).trim() : undefined,
        }));
}
