import { normalizeVisaTypeLabel } from '@/utils/ownerVisaValidation';
import { ownerDocHasContent } from '@/utils/companyPermissionModules';

const OWNER_VISA_SLOT_KEYS = ['visitVisa', 'employmentVisa', 'spouseVisa', 'visa'];

const VISA_KEY_BY_TYPE = {
    visit: 'visitVisa',
    employment: 'employmentVisa',
    spouse: 'spouseVisa',
};

export function legacyVisaDocKey(owner) {
    if (!owner?.visa || typeof owner.visa !== 'object') return null;
    const type = normalizeVisaTypeLabel(owner.visa.type).toLowerCase();
    return VISA_KEY_BY_TYPE[type] || null;
}

/** Map legacy `visa` subdoc onto typed visit/employment/spouse slots for display and save. */
export function migrateLegacyOwnerVisa(owner) {
    if (!owner || typeof owner !== 'object') return owner;
    const next = { ...owner };
    const legacyKey = legacyVisaDocKey(owner);
    if (!legacyKey || next[legacyKey]?.number) return next;
    const { visa } = owner;
    next[legacyKey] = {
        number: visa.number || '',
        type: visa.type || '',
        issueDate: visa.issueDate || '',
        expiryDate: visa.expiryDate || '',
        sponsor: visa.sponsor || '',
        attachment: visa.attachment || null,
    };
    return next;
}

export function migrateLegacyOwnersVisa(owners = []) {
    return (owners || []).map((o) => migrateLegacyOwnerVisa(o));
}

export function isOwnerVisaDocKey(docKey) {
    return docKey === 'visitVisa' || docKey === 'employmentVisa' || docKey === 'spouseVisa' || docKey === 'visa';
}

/** True when this owner already has any visa card (visit, employment, spouse, or legacy visa). */
export function ownerHasAnyVisaCard(owner) {
    if (!owner || typeof owner !== 'object') return false;
    return OWNER_VISA_SLOT_KEYS.some((key) => ownerDocHasContent(owner[key]));
}

/** Owner docs that save live without HR reactivation (visa, labour card, medical, driving license). */
export function isOwnerLiveUpdateDocKey(docKey) {
    return isOwnerVisaDocKey(docKey) || docKey === 'labourCard' || docKey === 'medical' || docKey === 'drivingLicense';
}
