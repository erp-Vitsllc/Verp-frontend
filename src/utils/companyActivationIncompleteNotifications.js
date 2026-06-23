import { calculateCompanyActivationProgress } from '@/utils/companyActivationProgress';
import {
    validateOwnerDetailsFields,
    validateOwnerDetailsOwnersPayload,
} from '@/utils/ownerDetailsValidation';
import { validateOwnerPassportFields } from '@/utils/ownerPassportValidation';
import { validateOwnerEmiratesIdFields } from '@/utils/ownerEmiratesIdValidation';

export const COMPANY_ACTIVATION_INCOMPLETE_TYPE = 'Company Activation Incomplete';

const hasOwnerDocAttachment = (att) => {
    if (att === undefined || att === null || (typeof att === 'string' && att.trim() === '')) return false;
    if (typeof att === 'object' && att !== null) {
        return Boolean(
            (att.url && String(att.url).trim()) ||
                (att.publicId && String(att.publicId).trim()) ||
                (att.data && String(att.data).trim()),
        );
    }
    return true;
};

const ownersList = (company = {}) => (Array.isArray(company?.owners) ? company.owners : []);

/** Mirrors backend isCompanyFullyActivated — profile activated, not draft/submitted/hold review. */
const isCompanyFullyActivated = (company = {}) => {
    const status = String(company?.status || '').trim().toLowerCase();
    const activationStatus = String(company?.activationStatus || '').trim().toLowerCase();
    return status === 'active' && activationStatus === 'active';
};

const isOwnerDetailsRowComplete = (owner, owners, ownerIndex) =>
    Object.keys(
        validateOwnerDetailsFields(owner, {
            requireEmail: true,
            owners,
            ownerIndex,
        }),
    ).length === 0;

const isOwnerPassportRowComplete = (owner, owners, ownerIndex) => {
    const passport = owner?.passport;
    if (!passport || typeof passport !== 'object') return false;
    const errors = validateOwnerPassportFields(passport, {
        owners,
        ownerIndex,
        requireAttachment: true,
    });
    if (Object.keys(errors).length > 0) return false;
    return hasOwnerDocAttachment(passport.attachment);
};

const isOwnerEmiratesIdRowComplete = (owner, owners, ownerIndex) => {
    const eid = owner?.emiratesId;
    if (!eid || typeof eid !== 'object') return false;
    const errors = validateOwnerEmiratesIdFields(eid, {
        owners,
        ownerIndex,
        requireAttachment: true,
    });
    if (Object.keys(errors).length > 0) return false;
    return hasOwnerDocAttachment(eid.attachment);
};

/** Prefer the first owner that still needs work for this activation section. */
export function resolveActivationOwnerTabIndex(company = {}, sectionKey = '') {
    const owners = ownersList(company);
    if (!owners.length) return 0;

    const key = String(sectionKey || '').trim();
    if (key === 'ownerDetails') {
        const rosterCheck = validateOwnerDetailsOwnersPayload(owners, { profileActive: false });
        if (!rosterCheck.ok) return 0;
        const incomplete = owners.findIndex((owner, i) => !isOwnerDetailsRowComplete(owner, owners, i));
        return incomplete >= 0 ? incomplete : 0;
    }
    if (key === 'ownerPassport') {
        const incomplete = owners.findIndex((owner, i) => !isOwnerPassportRowComplete(owner, owners, i));
        return incomplete >= 0 ? incomplete : 0;
    }
    if (key === 'ownerEmiratesId') {
        const incomplete = owners.findIndex((owner, i) => !isOwnerEmiratesIdRowComplete(owner, owners, i));
        return incomplete >= 0 ? incomplete : 0;
    }
    return 0;
}

const SECTION_ROUTE = {
    basicDetails: { tab: 'basic', focusCard: 'basicDetails' },
    tradeLicense: { tab: 'basic', focusCard: 'tradeLicense' },
    establishmentCard: { tab: 'basic', focusCard: 'establishmentCard' },
    moa: { tab: 'moa', focusCard: 'moa' },
    ownerDetails: { tab: 'owner', focusCard: 'ownerDetails', ownerScoped: true },
    ownerPassport: { tab: 'owner', focusCard: 'ownerPassport', ownerScoped: true },
    ownerEmiratesId: { tab: 'owner', focusCard: 'ownerEmiratesId', ownerScoped: true },
};

export function buildCompanyActivationIncompletePath(companyId, extra3Raw) {
    if (!companyId) return '';
    let meta = {};
    if (extra3Raw) {
        try {
            meta = typeof extra3Raw === 'string' ? JSON.parse(extra3Raw) : extra3Raw;
        } catch {
            meta = {};
        }
    }
    const sectionKey = String(meta?.activationSection || '').trim();
    const route = SECTION_ROUTE[sectionKey] || { tab: 'basic', focusCard: sectionKey || 'basicDetails' };
    const params = new URLSearchParams();
    params.set('tab', route.tab);
    if (route.focusCard) params.set('focusCard', route.focusCard);
    if (route.ownerScoped && Number.isInteger(meta?.ownerTabIndex) && meta.ownerTabIndex >= 0) {
        params.set('ownerTab', String(meta.ownerTabIndex));
    }
    if (route.tab === 'moa') params.set('docStatusTab', 'live');
    return `/Company/${encodeURIComponent(String(companyId))}?${params.toString()}`;
}

export function formatCompanyActivationIncompleteDisplay(item = {}) {
    if (String(item?.type || '').trim() !== COMPANY_ACTIVATION_INCOMPLETE_TYPE) return null;
    const label = String(item?.extra1 || '').replace(/^Complete:\s*/i, '').trim();
    const companyLine = String(item?.extra2 || '').trim();
    return {
        headline: label ? `Complete ${label}` : 'Complete activation profile',
        detail: companyLine,
    };
}

/**
 * Synthetic HR tasks mirroring the profile progress-bar checklist — active companies below 100% only.
 * Merged into the Companies page notification bell alongside API dashboard rows.
 */
export function collectCompanyActivationIncompleteNotifications(companies = []) {
    const items = [];
    const nowIso = new Date().toISOString();

    for (const company of companies || []) {
        if (!company?._id || !isCompanyFullyActivated(company)) continue;

        // Always recompute — list API activationProgress used slim owner rows and over-counted pending items.
        const progress = calculateCompanyActivationProgress(company);

        const percentage = Number(progress?.percentage);
        if (!Number.isFinite(percentage) || percentage >= 100) continue;

        const checks = Array.isArray(progress?.checks) ? progress.checks : [];
        // Same rows as the profile progress-bar tooltip (`pendingActivationItems`).
        for (const check of checks) {
            if (!check || check.completed) continue;
            const sectionKey = String(check.key || '').trim();
            if (!sectionKey) continue;

            const route = SECTION_ROUTE[sectionKey] || { tab: 'basic', focusCard: sectionKey };
            const ownerTabIndex = route.ownerScoped
                ? resolveActivationOwnerTabIndex(company, sectionKey)
                : undefined;
            const meta = {
                activationSection: sectionKey,
                ...(Number.isInteger(ownerTabIndex) ? { ownerTabIndex } : {}),
            };

            items.push({
                id: company._id,
                actionId: null,
                type: COMPANY_ACTIVATION_INCOMPLETE_TYPE,
                requestedBy: 'System',
                requestedDate: nowIso,
                status: 'Pending',
                extra1: `Complete: ${check.label || sectionKey}`,
                extra2: `${company?.name || 'Company'} (${company?.companyId || ''})`.trim(),
                extra3: JSON.stringify(meta),
                scope: 'inbox',
            });
        }
    }

    return items;
}
