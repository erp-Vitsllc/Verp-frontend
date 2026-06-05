import { hasLiveMoaInDocuments } from '@/utils/companyDocumentLive';
import { mergePendingReactivationForActivationSnapshot } from '@/utils/mergeCompanyPendingActivationProposed';
import { validateOwnerDetailsOwnersPayload } from '@/utils/ownerDetailsValidation';
import { validateOwnerPassportFields } from '@/utils/ownerPassportValidation';
import { validateOwnerEmiratesIdFields } from '@/utils/ownerEmiratesIdValidation';

const hasValue = (v) => !(v === undefined || v === null || (typeof v === 'string' && v.trim() === ''));

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
    return owners.every((owner, i) => isOwnerPassportActivationComplete(owner?.passport, owners, i));
};

const areOwnersEmiratesIdsActivationComplete = (owners = []) => {
    if (!owners.length) return false;
    return owners.every((owner, i) => isOwnerEmiratesIdActivationComplete(owner?.emiratesId, owners, i));
};

const areOwnerDetailsActivationComplete = (owners = []) =>
    validateOwnerDetailsOwnersPayload(owners, { profileActive: true }).ok;

/**
 * Mirrors backend `calculateCompanyActivationProgress` for optimistic UI before API refresh.
 */
export function calculateCompanyActivationProgress(company = {}) {
    const co = mergePendingReactivationForActivationSnapshot(company, {
        includeAllQueuedOwnerDocs: true,
    });
    const owners = companyOwnersList(co);

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
            label: 'Trade License',
            completed:
                [co.tradeLicenseNumber, co.tradeLicenseIssueDate, co.tradeLicenseExpiry].every(hasValue) &&
                !!co.tradeLicenseAttachment,
        },
        {
            key: 'establishmentCard',
            label: 'Establishment Card Details',
            completed:
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
        },
        {
            key: 'ownerPassport',
            label: 'Passport of Owner',
            completed: areOwnersPassportsActivationComplete(owners),
        },
        {
            key: 'ownerEmiratesId',
            label: 'EID of Owner',
            completed: areOwnersEmiratesIdsActivationComplete(owners),
        },
    ];

    const completed = checks.filter((c) => c.completed).length;
    const total = checks.length;
    const percentage = Math.round((completed / total) * 100);
    const missing = checks.filter((c) => !c.completed).map((c) => c.label);

    return { checks, completed, total, percentage, missing };
}
