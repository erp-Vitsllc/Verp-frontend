import { normalizeVisaTypeLabel } from '@/utils/ownerVisaValidation';

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
