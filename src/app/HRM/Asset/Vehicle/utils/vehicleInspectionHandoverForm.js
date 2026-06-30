export const INSPECTION_CONDITION_OPTIONS = [
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
];

export function buildInspectionFormState(historyEntry) {
    const raw = historyEntry?.details?.vehicleInspectionForm || {};
    return {
        inspectionDate: String(raw.inspectionDate || '').trim(),
        odometerReading: String(raw.odometerReading ?? '').trim(),
        overallCondition: String(raw.overallCondition || '').trim().toLowerCase(),
        notes: String(raw.notes || '').trim(),
    };
}

export function isInspectionFormComplete(historyEntry, vehicle = null) {
    const formStatus = String(historyEntry?.details?.inspectionFormStatus || '').toLowerCase();
    if (formStatus === 'complete') return true;
    const inspStatus = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();
    return inspStatus === 'pending_hr' || inspStatus === 'active';
}

export function validateInspectionForm(form) {
    const errors = {};
    if (!String(form.inspectionDate || '').trim()) {
        errors.inspectionDate = 'Inspection date is required.';
    }
    if (!String(form.odometerReading ?? '').trim()) {
        errors.odometerReading = 'Odometer reading is required.';
    } else {
        const km = Number(form.odometerReading);
        if (!Number.isFinite(km) || km < 0) {
            errors.odometerReading = 'Enter a valid odometer reading.';
        }
    }
    if (!INSPECTION_CONDITION_OPTIONS.some((opt) => opt.value === form.overallCondition)) {
        errors.overallCondition = 'Select overall condition.';
    }
    return errors;
}

export function mergeInspectionFormIntoEntry(entry, historyRecord) {
    if (!entry || !historyRecord) return entry;
    return {
        ...entry,
        details: {
            ...(entry.details || {}),
            ...(historyRecord.details || {}),
        },
    };
}
