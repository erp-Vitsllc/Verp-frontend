import { resolveClientApiBaseUrl } from '@/utils/axios';

const MONGO_OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const S3_PATH_PREFIXES = [
    'admin-deletion-archive',
    'asset-documents',
    'asset-invoices',
    'asset-photos',
    'asset-service-invoices',
    'asset-service-attachments',
    'asset-services',
    'asset-history',
    'asset-accessories',
    'employee-documents',
    'employee-profiles',
    'employee-signatures',
    'profile-pictures',
    'user-profiles',
    'signatures',
    'uploads',
];

function isResolvableRelativeMediaPath(value) {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || MONGO_OBJECT_ID_RE.test(trimmed)) return false;
    if (trimmed.includes('/')) return true;
    return S3_PATH_PREFIXES.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}/`));
}

function resolveApiOrigin() {
    const apiUrl = resolveClientApiBaseUrl();
    try {
        const parsed = new URL(
            apiUrl,
            typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000',
        );
        return parsed.origin;
    } catch {
        return String(apiUrl || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    }
}

export const RECEIVER_ASSESSMENT_ITEMS = [
    { key: 'spareTyre', label: 'Spare type' },
    { key: 'toolsKit', label: 'Tools Kit' },
    { key: 'scissorJack', label: 'Scissor Jack' },
    { key: 'firstAidKit', label: 'First Aid Kit' },
    { key: 'fireExtinguisher', label: 'Fire extinguisher' },
];

/** Landscape photo slot on handover assign / assessment cards */
export const HANDOVER_LANDSCAPE_PHOTO_BOX_CLASS = 'h-[100px] w-full';

/** Keeps assessment / body-condition cards aligned in a 2-column grid */
export const HANDOVER_ASSESSMENT_CARD_MIN_HEIGHT_CLASS = 'min-h-[248px]';

function normalizePresent(value) {
    if (value === true || value === 'true' || value === 'yes' || value === 'Yes') return true;
    if (value === false || value === 'false' || value === 'no' || value === 'No') return false;
    return null;
}

function pickItemBlock(source, key) {
    if (!source || typeof source !== 'object') return null;

    const nested = source[key];
    if (nested && typeof nested === 'object' && ('present' in nested || 'photo' in nested || 'image' in nested)) {
        return {
            present: normalizePresent(nested.present ?? nested.hasItem ?? nested.value ?? nested.answer),
            photo: nested.photo ?? nested.image ?? nested.attachment ?? null,
        };
    }

    const present = normalizePresent(nested ?? source[`${key}Present`] ?? source[`${key}Answer`]);
    const photo = source[`${key}Photo`] ?? source[`${key}Image`] ?? null;

    if (present === null && !photo) return null;
    return { present, photo };
}

function hasAssessmentData(source) {
    if (!source || typeof source !== 'object') return false;

    return RECEIVER_ASSESSMENT_ITEMS.some((item) => {
        const block = pickItemBlock(source, item.key);
        return block?.present === true || block?.present === false || Boolean(block?.photo);
    });
}

export function resolveReceiverAssessmentSource(historyEntry, vehicle) {
    const candidates = [
        historyEntry?.details?.receiverAssessment,
        historyEntry?.details?.vehicleAssessmentReportByReceiver,
        historyEntry?.receiverAssessment,
        vehicle?.receiverAssessment,
        historyEntry?.details?.receiverAssessmentReport,
    ];

    return candidates.find((item) => hasAssessmentData(item)) || null;
}

function resolveAssessmentItemBlock(historyEntry, vehicle, key) {
    const historySources = [
        historyEntry?.details?.receiverAssessment,
        historyEntry?.details?.vehicleAssessmentReportByReceiver,
        historyEntry?.receiverAssessment,
        historyEntry?.details?.receiverAssessmentReport,
    ];

    for (const source of historySources) {
        const block = pickItemBlock(source, key);
        if (block?.present === true || block?.present === false || block?.photo) {
            return block;
        }
    }

    return pickItemBlock(vehicle?.receiverAssessment, key);
}

export function buildReceiverAssessmentRows(historyEntry, vehicle) {
    const source = resolveReceiverAssessmentSource(historyEntry, vehicle);

    return RECEIVER_ASSESSMENT_ITEMS.map((item) => {
        const block = pickItemBlock(source, item.key);
        const present = block?.present ?? null;
        const photo = block?.photo ?? null;

        return {
            ...item,
            present,
            photo,
            yesLabel: present === true ? 'Yes' : present === false ? 'No' : '—',
            photoRequired: present === true,
            photoMissing: present === true && !resolveAssessmentMediaUrl(photo),
        };
    });
}

export function resolveAssessmentMediaUrl(value) {
    if (!value) return null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
        if (trimmed.startsWith('data:') || trimmed.startsWith('http')) return trimmed;
        if (!isResolvableRelativeMediaPath(trimmed)) return null;
        const origin = resolveApiOrigin();
        return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
    }

    if (typeof value === 'object') {
        if (typeof value.url === 'string') {
            const direct = value.url.trim();
            if (direct.startsWith('http') || direct.startsWith('data:')) return direct;
        }
        const nested = value.url || value.publicId || value.path || value.data || null;
        return resolveAssessmentMediaUrl(nested);
    }

    return null;
}

export function resolveVehiclePreviewImage(vehicle) {
    return (
        resolveAssessmentMediaUrl(vehicle?.imagePreview) ||
        resolveAssessmentMediaUrl(vehicle?.photo) ||
        null
    );
}

export function buildAssessmentFormState(historyEntry, vehicle) {
    const form = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const block = resolveAssessmentItemBlock(historyEntry, vehicle, item.key);
        form[item.key] = {
            present: block?.present ?? null,
            photo: block?.photo ?? null,
        };
    });

    return form;
}

export function hasStoredAssessmentPhoto(photo) {
    if (!photo) return false;
    if (typeof photo === 'string') {
        const trimmed = photo.trim();
        return Boolean(trimmed && trimmed !== 'undefined' && trimmed !== 'null');
    }
    if (typeof photo === 'object') {
        return Boolean(photo.url || photo.publicId || photo.data || photo.path || photo.image);
    }
    return false;
}

export function hasAssessmentPhoto(photo) {
    return hasStoredAssessmentPhoto(photo) || Boolean(resolveAssessmentMediaUrl(photo));
}

export function isAssessmentFormComplete(form) {
    return Object.keys(validateAssessmentForm(form)).length === 0;
}

export function validateAssessmentForm(form) {
    const errors = {};

    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = form?.[item.key];
        if (!row || row.present !== true && row.present !== false) {
            errors[item.key] = 'Select Yes or No (required)';
            return;
        }
        if (row.present === true && !hasAssessmentPhoto(row.photo)) {
            errors[item.key] = 'Photo required (mandatory) when Yes is selected';
        }
    });

    return errors;
}

export function buildAssessmentPayload(form) {
    const payload = {};
    RECEIVER_ASSESSMENT_ITEMS.forEach((item) => {
        const row = form[item.key];
        payload[item.key] = {
            present: row?.present === true ? true : row?.present === false ? false : null,
            photo: row?.present === true ? row.photo : null,
        };
    });
    return payload;
}

export function mergeReceiverAssessmentIntoEntry(historyEntry, receiverAssessment) {
    if (!historyEntry) return historyEntry;
    return {
        ...historyEntry,
        details: {
            ...(historyEntry.details && typeof historyEntry.details === 'object' ? historyEntry.details : {}),
            receiverAssessment,
        },
    };
}

export function isReceiverAssessmentMarkedDone(historyEntry) {
    return historyEntry?.details?.receiverAssessmentCompleted === true;
}

export function mergeAssessmentCompletedIntoEntry(historyEntry) {
    if (!historyEntry) return historyEntry;
    return {
        ...historyEntry,
        details: {
            ...(historyEntry.details && typeof historyEntry.details === 'object' ? historyEntry.details : {}),
            receiverAssessmentCompleted: true,
        },
    };
}
