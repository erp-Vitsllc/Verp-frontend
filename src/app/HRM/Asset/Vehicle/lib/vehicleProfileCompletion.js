const normDocType = (t) => String(t || '').toLowerCase().trim();

function parseDocDescription(doc) {
    if (!doc?.description) return {};
    try {
        return JSON.parse(doc.description);
    } catch {
        return {};
    }
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

export function isVehicleRegistrationCardComplete(asset) {
    const docs = Array.isArray(asset?.documents) ? asset.documents : [];
    const registrationDoc = docs.find((d) => normDocType(d.type) === 'registration') || null;
    const registrationAttachments = docs.filter((d) => normDocType(d.type) === 'registration attachment');
    const registrationMeta = parseDocDescription(registrationDoc);

    return Boolean(
        registrationDoc?.issueDate ||
            registrationDoc?.expiryDate ||
            registrationDoc?.attachment ||
            registrationMeta?.fee != null ||
            registrationAttachments.length > 0,
    );
}

export function isVehicleInsuranceCardComplete(asset) {
    const docs = Array.isArray(asset?.documents) ? asset.documents : [];
    const insuranceDoc = docs.find((d) => normDocType(d.type) === 'insurance') || null;
    const insuranceAttachments = docs.filter((d) => normDocType(d.type) === 'insurance attachment');
    const insuranceMeta = parseDocDescription(insuranceDoc);

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

export function isVehicleInspectionComplete(asset) {
    const status = String(asset?.vehicleInspectionStatus || '').toLowerCase();
    if (status === 'active') return true;
    return (asset?.documents || []).some(
        (doc) => String(doc?.type || '').trim().toLowerCase() === 'vehicle inspection',
    );
}

const PROFILE_EDIT_SECTION_TO_CHECK = {
    basic: 'Basic Details',
    registration: 'Registration Card',
    insurance: 'Insurance Card',
    profile_picture: 'Profile Picture',
    warranty: 'Warranty Card',
    permit: 'Permit Card',
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

/** Mandatory sections for fleet profile progress bar (100% = all five complete). */
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
            label: 'Registration Card',
            completed: markComplete('Registration Card', isVehicleRegistrationCardComplete(asset)),
        },
        {
            label: 'Insurance Card',
            completed: markComplete('Insurance Card', isVehicleInsuranceCardComplete(asset)),
        },
        {
            label: 'Profile Picture',
            completed: markComplete('Profile Picture', isVehicleProfilePictureComplete(asset)),
        },
        { label: 'Vehicle Inspection', completed: isVehicleInspectionComplete(asset) },
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
