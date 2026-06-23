import { hasLiveMoaInDocuments } from '@/utils/companyDocumentLive';
import { mergePendingReactivationForActivationSnapshot } from '@/utils/mergeCompanyPendingActivationProposed';
import {
    validateOwnerDetailsFields,
    validateOwnerDetailsOwnersPayload,
} from '@/utils/ownerDetailsValidation';
import { validateOwnerPassportFields } from '@/utils/ownerPassportValidation';
import { validateOwnerEmiratesIdFields } from '@/utils/ownerEmiratesIdValidation';

const hasValue = (v) => !(v === undefined || v === null || (typeof v === 'string' && v.trim() === ''));

const isExpiredDate = (value) => {
    if (!hasValue(value)) return false;
    const exp = new Date(value);
    if (Number.isNaN(exp.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return exp < today;
};

const hasOwnerDocAttachment = (att) => {
    if (!hasValue(att)) return false;
    if (typeof att === 'object' && att !== null) {
        return hasValue(att.url) || hasValue(att.publicId) || hasValue(att.data);
    }
    return true;
};

const companyOwnersList = (company = {}) => (Array.isArray(company.owners) ? company.owners : []);

const isOwnerPassportActivationComplete = (passport, owners, ownerIndex) => {
    if (!passport || typeof passport !== 'object') return false;
    if (isExpiredDate(passport.expiryDate)) return false;
    const errors = validateOwnerPassportFields(passport, {
        owners,
        ownerIndex,
        requireAttachment: true,
    });
    if (Object.keys(errors).length > 0) return false;
    return hasOwnerDocAttachment(passport.attachment);
};

const isOwnerEmiratesIdActivationComplete = (emiratesId, owners, ownerIndex) => {
    if (!emiratesId || typeof emiratesId !== 'object') return false;
    if (isExpiredDate(emiratesId.expiryDate)) return false;
    const errors = validateOwnerEmiratesIdFields(emiratesId, {
        owners,
        ownerIndex,
        requireAttachment: true,
    });
    if (Object.keys(errors).length > 0) return false;
    return hasOwnerDocAttachment(emiratesId.attachment);
};

const areOwnersPassportsActivationComplete = (owners = []) => {
    if (!owners.length) return false;
    return owners.some((owner, i) => isOwnerPassportActivationComplete(owner?.passport, owners, i));
};

const areOwnersEmiratesIdsActivationComplete = (owners = []) => {
    if (!owners.length) return false;
    return owners.some((owner, i) => isOwnerEmiratesIdActivationComplete(owner?.emiratesId, owners, i));
};

const isOwnerDetailsRowActivationComplete = (owner, owners, ownerIndex) => {
    const errors = validateOwnerDetailsFields(owner, {
        requireEmail: true,
        owners,
        ownerIndex,
    });
    return Object.keys(errors).length === 0;
};

const ownerLabel = (owner, index, total) => {
    const name = String(owner?.name || '').trim();
    if (total <= 1) return name || 'Owner';
    return name || `Owner ${index + 1}`;
};

export function getOwnerEmiratesIdActivationBlockers(owners = []) {
    if (!owners.length) return ['Add an owner with a complete Emirates ID card'];
    if (owners.some((owner, i) => isOwnerEmiratesIdActivationComplete(owner?.emiratesId, owners, i))) {
        return [];
    }
    const blockers = [];
    owners.forEach((owner, i) => {
        const eid = owner?.emiratesId;
        if (!eid || typeof eid !== 'object') return;
        const prefix = owners.length > 1 ? `${ownerLabel(owner, i, owners.length)}: ` : '';
        const errors = validateOwnerEmiratesIdFields(eid, {
            owners,
            ownerIndex: i,
            requireAttachment: true,
        });
        for (const msg of Object.values(errors)) {
            blockers.push(`${prefix}${msg}`);
        }
        if (Object.keys(errors).length === 0 && !hasOwnerDocAttachment(eid.attachment)) {
            blockers.push(`${prefix}Emirates ID PDF attachment is required`);
        }
    });
    if (blockers.length) return blockers;
    return ['At least one owner needs a complete Emirates ID card (784…, dates, PDF attachment)'];
}

const getOwnerPassportActivationBlockers = (owners = []) => {
    if (!owners.length) return ['Add an owner with a complete passport card'];
    if (owners.some((owner, i) => isOwnerPassportActivationComplete(owner?.passport, owners, i))) {
        return [];
    }
    const blockers = [];
    owners.forEach((owner, i) => {
        const passport = owner?.passport;
        if (!passport || typeof passport !== 'object') return;
        const prefix = owners.length > 1 ? `${ownerLabel(owner, i, owners.length)}: ` : '';
        const errors = validateOwnerPassportFields(passport, {
            owners,
            ownerIndex: i,
            requireAttachment: true,
        });
        for (const msg of Object.values(errors)) {
            blockers.push(`${prefix}${msg}`);
        }
        if (Object.keys(errors).length === 0 && !hasOwnerDocAttachment(passport.attachment)) {
            blockers.push(`${prefix}Passport PDF attachment is required`);
        }
    });
    if (blockers.length) return blockers;
    return ['At least one owner needs a complete passport card (number, dates, PDF attachment)'];
};

const getOwnerDetailsActivationBlockers = (owners = []) => {
    if (!owners.length) return ['Add at least one owner'];
    const rosterCheck = validateOwnerDetailsOwnersPayload(owners, { profileActive: false });
    if (!rosterCheck.ok) return [rosterCheck.message];
    if (owners.some((owner, i) => isOwnerDetailsRowActivationComplete(owner, owners, i))) {
        return [];
    }
    const blockers = [];
    owners.forEach((owner, i) => {
        const errors = validateOwnerDetailsFields(owner, {
            requireEmail: true,
            owners,
            ownerIndex: i,
        });
        const msgs = Object.values(errors);
        if (!msgs.length) return;
        const prefix = owners.length > 1 ? `${ownerLabel(owner, i, owners.length)}: ` : '';
        blockers.push(`${prefix}${msgs[0]}`);
    });
    if (blockers.length) return blockers;
    return ['At least one owner needs complete details (email, phone, nationality)'];
};

const areOwnerDetailsActivationComplete = (owners = []) => {
    if (!owners.length) return false;
    const rosterCheck = validateOwnerDetailsOwnersPayload(owners, { profileActive: false });
    if (!rosterCheck.ok) return false;
    return owners.some((owner, i) => isOwnerDetailsRowActivationComplete(owner, owners, i));
};

/**
 * Mirrors backend `calculateCompanyActivationProgress` for optimistic UI before API refresh.
 */
export function calculateCompanyActivationProgress(company = {}) {
    const co = mergePendingReactivationForActivationSnapshot(company, {
        includeAllQueuedOwnerDocs: true,
    });
    const owners = companyOwnersList(co);

    const tradeLicenseExpired = isExpiredDate(co.tradeLicenseExpiry);
    const establishmentCardExpired = isExpiredDate(co.establishmentCardExpiry);

    const checks = [
        {
            key: 'basicDetails',
            label: 'Basic details',
            completed: [
                co.name,
                co.nickName,
                co.companyId,
                co.email,
                co.phone,
                co.establishedDate,
            ].every(hasValue),
        },
        {
            key: 'tradeLicense',
            label: tradeLicenseExpired ? 'Renew Trade License' : 'Trade License',
            completed:
                !tradeLicenseExpired &&
                [co.tradeLicenseNumber, co.tradeLicenseIssueDate, co.tradeLicenseExpiry].every(hasValue) &&
                !!co.tradeLicenseAttachment,
        },
        {
            key: 'establishmentCard',
            label: establishmentCardExpired ? 'Renew Establishment Card' : 'Establishment Card Details',
            completed:
                !establishmentCardExpired &&
                [co.establishmentCardNumber, co.establishmentCardExpiry].every(hasValue) &&
                !!co.establishmentCardAttachment,
        },
        {
            key: 'moa',
            label: 'MOA',
            completed: hasLiveMoaInDocuments(co.documents),
        },
        {
            key: 'ownerDetails',
            label: 'Owner Details Card',
            completed: areOwnerDetailsActivationComplete(owners),
            blockers: areOwnerDetailsActivationComplete(owners)
                ? []
                : getOwnerDetailsActivationBlockers(owners),
        },
        {
            key: 'ownerPassport',
            label: owners.some((owner) => isExpiredDate(owner?.passport?.expiryDate))
                ? 'Renew Passport of Owner'
                : 'Passport of Owner',
            completed: areOwnersPassportsActivationComplete(owners),
            blockers: areOwnersPassportsActivationComplete(owners)
                ? []
                : getOwnerPassportActivationBlockers(owners),
        },
        {
            key: 'ownerEmiratesId',
            label: owners.some((owner) => isExpiredDate(owner?.emiratesId?.expiryDate))
                ? 'Renew EID of Owner'
                : 'EID of Owner',
            completed: areOwnersEmiratesIdsActivationComplete(owners),
            blockers: areOwnersEmiratesIdsActivationComplete(owners)
                ? []
                : getOwnerEmiratesIdActivationBlockers(owners),
        },
    ];

    const completed = checks.filter((c) => c.completed).length;
    const total = checks.length;
    const percentage = Math.round((completed / total) * 100);
    const missing = checks.filter((c) => !c.completed).map((c) => c.label);

    return { checks, completed, total, percentage, missing };
}
