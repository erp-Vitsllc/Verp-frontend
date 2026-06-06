/** DOM id prefix for company profile cards (`activation-${focusCard}`). */
export const COMPANY_ACTIVATION_FOCUS_PREFIX = 'activation-';

const OWNER_DOC_LABEL_RE =
    /^(.*?)\s*[-\u2013\u2014]\s*(Passport|Visa|Visit Visa|Employment Visa|Spouse Visa|Emirates ID|Medical Insurance|Driving License|Labour Card)\s*$/i;

export function extractNotificationLabelText(text = '') {
    const raw = String(text || '').trim();
    const prefix = 'Expiry follow-up required:';
    const withoutPrefix = raw.toLowerCase().startsWith(prefix.toLowerCase())
        ? raw.slice(prefix.length).trim()
        : raw;
    return withoutPrefix.replace(/\s*\(Exp:\s*[^)]+\)\s*$/i, '').trim();
}

/** Map notification / expiry label text → company `focusCard` query value. */
export function resolveCompanyFocusCardFromText(text = '') {
    const label = extractNotificationLabelText(text);
    if (!label) return null;
    const l = label.toLowerCase();

    if (l.includes('complete:')) {
        const stripped = label.replace(/^Complete:\s*/i, '').trim().toLowerCase();
        if (stripped.includes('owner details')) return 'ownerDetails';
        if (stripped.includes('passport')) return 'ownerPassport';
        if (stripped.includes('eid') || stripped.includes('emirates')) return 'ownerEmiratesId';
        if (stripped.includes('trade license')) return 'tradeLicense';
        if (stripped.includes('establishment')) return 'establishmentCard';
        if (stripped.includes('moa')) return 'moa';
        if (stripped.includes('basic')) return 'basicDetails';
    }

    if (l.includes('trade license')) return 'tradeLicense';
    if (l.includes('establishment card') || l.includes('establishment')) return 'establishmentCard';
    if (l.includes('ejari')) return 'ejari';
    if (l.includes('moa')) return 'moa';
    if (l.includes('owner details') || l.includes('owner detail')) return 'ownerDetails';

    const ownerMatch = label.match(OWNER_DOC_LABEL_RE);
    if (ownerMatch) {
        const doc = ownerMatch[2].trim().toLowerCase();
        if (doc.includes('passport')) return 'ownerPassport';
        if (doc.includes('emirates')) return 'ownerEmiratesId';
        if (doc.includes('visit visa')) return 'ownerVisitVisa';
        if (doc.includes('employment visa')) return 'ownerEmploymentVisa';
        if (doc.includes('spouse visa')) return 'ownerSpouseVisa';
        if (doc.includes('labour')) return 'ownerLabourCard';
        if (doc.includes('medical')) return 'ownerMedical';
        if (doc.includes('driving')) return 'ownerDrivingLicense';
        if (doc.includes('visa')) return 'ownerVisitVisa';
    }

    if (l.includes('passport')) return 'ownerPassport';
    if (l.includes('emirates') || /\beid\b/.test(l)) return 'ownerEmiratesId';
    if (l.includes('basic detail')) return 'basicDetails';

    return null;
}

const appendQuery = (path, key, value) => {
    if (!path || value == null || value === '') return path;
    const [base, hash = ''] = String(path).split('#');
    const sep = base.includes('?') ? '&' : '?';
    const withQuery = `${base}${sep}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    return hash ? `${withQuery}#${hash}` : withQuery;
};

/** Append owner tab + focus card for scroll/highlight after notification navigation. */
export function buildCompanyPathWithFocus(path, { focusCard, ownerTab } = {}) {
    let out = String(path || '');
    if (Number.isInteger(ownerTab) && ownerTab >= 0) {
        out = appendQuery(out, 'ownerTab', ownerTab);
    }
    if (focusCard) {
        out = appendQuery(out, 'focusCard', focusCard);
    }
    return out;
};

const OWNER_DOC_FOCUS_BY_KEY = {
    passport: 'ownerPassport',
    emiratesId: 'ownerEmiratesId',
    visitVisa: 'ownerVisitVisa',
    employmentVisa: 'ownerEmploymentVisa',
    spouseVisa: 'ownerSpouseVisa',
    labourCard: 'ownerLabourCard',
    medical: 'ownerMedical',
    drivingLicense: 'ownerDrivingLicense',
};

export function resolveCompanyOwnerDocFocusCard(docKey = '') {
    return OWNER_DOC_FOCUS_BY_KEY[String(docKey || '').trim()] || null;
}

export function buildCompanyOwnerFocusElementId(focusCard, ownerTabIndex) {
    const card = String(focusCard || '').trim();
    if (!card) return '';
    const base = `${COMPANY_ACTIVATION_FOCUS_PREFIX}${card}`;
    if (Number.isInteger(ownerTabIndex) && ownerTabIndex >= 0 && card.startsWith('owner')) {
        return `${base}-${ownerTabIndex}`;
    }
    return base;
}

/** Map label → employee basic/doc section element id (hash / scroll target). */
export function resolveEmployeeFocusElementId(label = '') {
    const l = extractNotificationLabelText(label).toLowerCase();
    if (!l) return null;
    if (l.includes('passport')) return 'passport';
    if (l.includes('visit visa') || l.includes('employment visa') || l.includes('spouse visa') || l.includes('visa')) {
        return 'visa';
    }
    if (l.includes('emirates') || l.includes('eid')) return 'emirates-id';
    if (l.includes('labour')) return 'labour-card';
    if (l.includes('medical')) return 'medical-insurance';
    if (l.includes('driving')) return 'driving-license';
    if (l.includes('basic detail')) return 'basic-details';
    if (l.includes('document with expiry') || l.includes('moa') || l.includes('memo') || l.includes('certificate')) {
        const slug = l.replace(/\s+/g, '-');
        return `doc-${slug}`;
    }
    return null;
}

export function buildEmployeePathWithFocus(basePath, label = '') {
    const id = resolveEmployeeFocusElementId(label);
    if (!id) return basePath;
    const withoutHash = String(basePath || '').split('#')[0];
    return appendQuery(withoutHash, 'focusCard', id);
}

export const NOTIFICATION_FOCUS_HIGHLIGHT_CLASSES = [
    'ring-2',
    'ring-blue-500',
    'ring-offset-2',
    'transition-all',
    'duration-1000',
];

/** Scroll + blue ring highlight (shared by company + employee profile pages). */
export function runNotificationFocusScroll(targetId, { attempts = 12, intervalMs = 150, highlightMs = 3000 } = {}) {
    if (!targetId || typeof document === 'undefined') return () => {};
    let tries = 0;
    const timer = setInterval(() => {
        const el = document.getElementById(targetId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add(...NOTIFICATION_FOCUS_HIGHLIGHT_CLASSES);
            setTimeout(() => {
                el.classList.remove(...NOTIFICATION_FOCUS_HIGHLIGHT_CLASSES);
            }, highlightMs);
            clearInterval(timer);
        }
        tries += 1;
        if (tries >= attempts) clearInterval(timer);
    }, intervalMs);
    return () => clearInterval(timer);
}

export function resolveNotificationFocusTargetId({
    focusCard = '',
    focusCardPrefix = COMPANY_ACTIVATION_FOCUS_PREFIX,
    hash = '',
    ownerTabIndex = null,
} = {}) {
    const card = String(focusCard || '').trim();
    if (card) {
        if (Number.isInteger(ownerTabIndex) && ownerTabIndex >= 0 && card.startsWith('owner')) {
            return buildCompanyOwnerFocusElementId(card, ownerTabIndex);
        }
        return focusCardPrefix ? `${focusCardPrefix}${card}` : card;
    }
    const hashId = String(hash || '').replace(/^#/, '').trim();
    return hashId ? decodeURIComponent(hashId) : '';
}
