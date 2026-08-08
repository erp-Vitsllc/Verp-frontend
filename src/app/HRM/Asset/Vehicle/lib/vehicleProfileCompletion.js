import { isVehicleDocumentOld, parseVehicleDocumentMeta } from '../utils/vehicleDocumentLifecycle';

const normDocType = (t) => String(t || '').toLowerCase().trim();

function liveDocsOfType(asset, type) {
    const docs = Array.isArray(asset?.documents) ? asset.documents : [];
    const want = normDocType(type);
    return docs.filter((d) => normDocType(d.type) === want && !isVehicleDocumentOld(d));
}

function pickPrimaryLiveDoc(docs) {
    if (!docs?.length) return null;
    return [...docs].sort((a, b) => {
        const ta = new Date(a.issueDate || a.expiryDate || a.createdAt || 0).getTime();
        const tb = new Date(b.issueDate || b.expiryDate || b.createdAt || 0).getTime();
        return tb - ta;
    })[0];
}

export function getVehicleBrandLabel(asset) {
    return String(asset?.vehicleBrand || asset?.typeId?.name || asset?.type || '').trim();
}

export function isVehicleBasicDetailsComplete(asset) {
    if (!asset) return false;
    const brand = getVehicleBrandLabel(asset);
    const model = String(asset.name || '').trim();
    const hasModelYear = asset.modelYear != null && String(asset.modelYear).trim() !== '';
    const plateDigits = String(asset.plateNumber || '').replace(/\D/g, '');
    return Boolean(brand && model && hasModelYear && plateDigits.length >= 1);
}

/**
 * Mulkia (Registration) — live doc/card required for progress.
 * Expiry is shown on the card + expiry notifications; it does not reduce progress %.
 */
export function isVehicleRegistrationCardComplete(asset) {
    const registrationDocs = liveDocsOfType(asset, 'registration');
    const registrationAttachments = liveDocsOfType(asset, 'registration attachment');
    const registrationDoc = pickPrimaryLiveDoc(registrationDocs);
    if (!registrationDoc && registrationAttachments.length === 0) {
        return false;
    }

    const registrationMeta = parseVehicleDocumentMeta(registrationDoc);
    return Boolean(
        registrationDoc?.issueDate ||
            registrationDoc?.expiryDate ||
            registrationDoc?.attachment ||
            registrationMeta?.fee != null ||
            registrationAttachments.length > 0,
    );
}

/**
 * Insurance Details — live doc/card required for progress.
 * Expiry is shown on the card + expiry notifications; it does not reduce progress %.
 */
export function isVehicleInsuranceCardComplete(asset) {
    const insuranceDocs = liveDocsOfType(asset, 'insurance');
    const insuranceAttachments = liveDocsOfType(asset, 'insurance attachment');
    const insuranceDoc = pickPrimaryLiveDoc(insuranceDocs);
    if (!insuranceDoc && insuranceAttachments.length === 0) {
        return false;
    }

    const insuranceMeta = parseVehicleDocumentMeta(insuranceDoc);
    return Boolean(
        insuranceDoc?.issueDate ||
            insuranceDoc?.expiryDate ||
            insuranceDoc?.attachment ||
            (insuranceMeta?.policy && String(insuranceMeta.policy).trim()) ||
            (insuranceMeta?.company && String(insuranceMeta.company).trim()) ||
            insuranceMeta?.premiumAmount != null ||
            insuranceMeta?.excessCharge != null ||
            insuranceAttachments.length > 0,
    );
}

export function isVehicleProfilePictureComplete(asset) {
    return Boolean(asset?.imagePreview || asset?.photo || asset?.images?.[0]?.url);
}

/**
 * Inspection counts only when HR-approved / active — draft & pending_hr reduce progress.
 */
export function isVehicleInspectionComplete(asset) {
    const status = String(asset?.vehicleInspectionStatus || '').toLowerCase();
    return status === 'active';
}

const PROFILE_EDIT_SECTION_TO_CHECK = {
    basic: 'Basic Details',
    registration: 'Mulkia (Registration)',
    insurance: 'Insurance Details',
    profile_picture: 'Profile Picture',
    warranty: 'Warranty',
    permit: 'Permit',
    petrol: 'Petrol Card',
    toll: 'Toll Card',
    documents: 'Documents',
    mortgage: 'Mortgage',
};

export const VEHICLE_PROFILE_ACTIVATION_SECTION_IDS = [
    'basic',
    'registration',
    'insurance',
    'profile_picture',
    'warranty',
    'permit',
    'petrol',
    'toll',
    'documents',
    'mortgage',
];

function getQueuedProfileEditSectionLabels(asset) {
    const profileActive = String(asset?.vehicleProfileActivationStatus || '').toLowerCase() === 'active';
    if (!profileActive) return new Set();

    const reviewStatus = String(asset?.vehicleProfileEditReviewStatus || 'none').toLowerCase();
    if (!['draft', 'pending_hr'].includes(reviewStatus)) return new Set();

    const pending = Array.isArray(asset?.vehiclePendingProfileEdits) ? asset.vehiclePendingProfileEdits : [];
    const labels = new Set();
    pending.forEach((entry) => {
        const label = PROFILE_EDIT_SECTION_TO_CHECK[entry?.sectionId];
        if (label) labels.add(label);
    });
    return labels;
}

/**
 * Progress bar sections (equal weight). Missing live card / pending-HR inspection reduce %.
 * Expiry does not reduce progress — that is handled by card EXPIRED badge + expiry notifications.
 * After profile is active, adding/editing a section queues HR approval and keeps that
 * section incomplete until HR approves.
 */
export function buildVehicleProfileCompletionChecks(asset) {
    const queuedEditLabels = getQueuedProfileEditSectionLabels(asset);

    const markComplete = (label, baseComplete) => {
        if (queuedEditLabels.has(label)) return false;
        return baseComplete;
    };

    return [
        {
            label: 'Basic Details',
            completed: markComplete('Basic Details', isVehicleBasicDetailsComplete(asset)),
        },
        {
            label: 'Mulkia (Registration)',
            completed: markComplete('Mulkia (Registration)', isVehicleRegistrationCardComplete(asset)),
        },
        {
            label: 'Insurance Details',
            completed: markComplete('Insurance Details', isVehicleInsuranceCardComplete(asset)),
        },
        {
            label: 'Profile Picture',
            completed: markComplete('Profile Picture', isVehicleProfilePictureComplete(asset)),
        },
        {
            label: 'Vehicle Inspection',
            completed: isVehicleInspectionComplete(asset),
        },
    ];
}

export function computeVehicleProfileCompletionPercent(asset) {
    const checks = buildVehicleProfileCompletionChecks(asset);
    const total = checks.length || 1;
    const completed = checks.filter((c) => c.completed).length;
    return {
        profilePct: Math.round((completed / total) * 100),
        completionChecks: checks,
        pendingChecks: checks.filter((c) => !c.completed),
    };
}
