import { calculateCompanyActivationProgress } from '@/utils/companyActivationProgress';

export const COMPANY_ACTIVATION_INCOMPLETE_TYPE = 'Company Activation Incomplete';

/** Mirrors backend isCompanyFullyActivated — profile activated, not draft/submitted/hold review. */
const isCompanyFullyActivated = (company = {}) => {
    const status = String(company?.status || '').trim().toLowerCase();
    const activationStatus = String(company?.activationStatus || '').trim().toLowerCase();
    return status === 'active' && activationStatus === 'active';
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
    if (String(meta?.kind || '') === 'mandatory-cards') {
        return `/Company/${encodeURIComponent(String(companyId))}?tab=basic`;
    }
    const sectionKey = String(meta?.activationSection || '').trim();
    const params = new URLSearchParams();
    params.set('tab', 'basic');
    if (sectionKey) params.set('focusCard', sectionKey);
    return `/Company/${encodeURIComponent(String(companyId))}?${params.toString()}`;
}

export function formatCompanyActivationIncompleteDisplay(item = {}) {
    if (String(item?.type || '').trim() !== COMPANY_ACTIVATION_INCOMPLETE_TYPE) return null;
    const message = String(item?.extra1 || '').trim();
    const companyLine = String(item?.extra2 || '').trim();
    if (/missing mandatory cards/i.test(message)) {
        return { headline: message, detail: companyLine };
    }
    const label = message.replace(/^Complete:\s*/i, '').trim();
    return {
        headline: label ? `Complete ${label}` : 'Complete activation profile',
        detail: companyLine,
    };
}

/** One HR task per active company below 100% activation progress. */
export function collectCompanyActivationIncompleteNotifications(companies = []) {
    const items = [];
    const nowIso = new Date().toISOString();
    const seen = new Set();

    for (const company of companies || []) {
        if (!company?._id || !isCompanyFullyActivated(company)) continue;

        const progress = calculateCompanyActivationProgress(company);
        const percentage = Number(progress?.percentage);
        if (!Number.isFinite(percentage) || percentage >= 100) continue;

        const companyKey = String(company.companyId || company._id);
        if (seen.has(companyKey)) continue;
        seen.add(companyKey);

        const displayName = company?.name || 'Company';

        items.push({
            id: company._id,
            actionId: null,
            type: COMPANY_ACTIVATION_INCOMPLETE_TYPE,
            requestedBy: 'System',
            requestedDate: nowIso,
            status: 'Pending',
            extra1: `${displayName} is missing mandatory cards. Please complete them.`,
            extra2: `${displayName} (${companyKey})`.trim(),
            extra3: JSON.stringify({ kind: 'mandatory-cards' }),
            scope: 'inbox',
        });
    }

    return items;
}
