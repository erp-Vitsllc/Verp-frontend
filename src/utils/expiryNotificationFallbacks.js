/**
 * Calendar days until expiry — matches backend documentExpiryReminderStages (start-of-day, rounded).
 */
export function getCalendarDaysUntilExpiry(expiryDate) {
    if (!expiryDate) return null;
    const startOfDay = (d) => {
        const x = new Date(d);
        if (Number.isNaN(x.getTime())) return null;
        x.setHours(0, 0, 0, 0);
        return x;
    };
    const today = startOfDay(new Date());
    const exp = startOfDay(expiryDate);
    if (!today || !exp) return null;
    return Math.round((exp - today) / (1000 * 60 * 60 * 24));
}

/** Dashboard / bell: surface follow-ups within 10 days or overdue */
export function isExpiryNotificationWindow(days) {
    return days != null && days <= 10;
}

const comparableOwnerName = (name) =>
    String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

function ownerDocIdPart(owner, fieldKey) {
    if (!owner || typeof owner !== 'object') return '';
    if (fieldKey === 'passport') return String(owner?.passport?.number || '').trim().toLowerCase();
    if (fieldKey === 'visa') return String(owner?.visa?.number || '').trim().toLowerCase();
    if (fieldKey === 'emiratesId') return String(owner?.emiratesId?.number || '').trim().toLowerCase();
    if (fieldKey === 'labourCard') return String(owner?.labourCard?.number || '').trim().toLowerCase();
    if (fieldKey === 'medical')
        return String(owner?.medical?.number || owner?.medical?.policyNumber || '').trim().toLowerCase();
    if (fieldKey === 'drivingLicense')
        return String(owner?.drivingLicense?.number || '').trim().toLowerCase();
    return '';
}

/** Same fingerprint as backend `ownerLinkedExpiryFingerprint` (calendar label en-GB). */
function ownerLinkedExpiryFingerprintFrontend(owner, fieldKey, expLabel) {
    const nm = comparableOwnerName(owner?.name);
    const idPart = ownerDocIdPart(owner, fieldKey);
    return `olf::${nm}::${fieldKey}::${idPart}::${expLabel}`;
}

/** Prefer lower human companyId first (matches backend canonical pick). */
function sortCompaniesForOwnerDedupe(companies = []) {
    return [...companies].sort((a, b) => {
        const ah = String(a?.companyId || '').trim();
        const bh = String(b?.companyId || '').trim();
        if (ah && bh && ah !== bh) return ah.localeCompare(bh);
        if (ah && !bh) return -1;
        if (!ah && bh) return 1;
        return String(a?._id || '').localeCompare(String(b?._id || ''));
    });
}

/** Synthetic items when DashboardAction cron rows are delayed; merged with `/Employee/dashboard/user-stats`. */
export function collectCompanyLiveExpiryNotifications(companies = []) {
    const list = [];
    const isOldLikeRow = (row = {}) => {
        const text = `${row?.type || ''} ${row?.description || ''}`.toLowerCase();
        return text.includes('previous') || text.includes('not renew') || text.includes('not renewed');
    };
    const pushIfDue = (company, label, expiryDate, extraFields = {}) => {
        if (!company || !expiryDate) return;
        const daysRemaining = getCalendarDaysUntilExpiry(expiryDate);
        if (!isExpiryNotificationWindow(daysRemaining)) return;
        const d = new Date(expiryDate);
        if (Number.isNaN(d.getTime())) return;
        const expLabel = d.toLocaleDateString('en-GB');
        list.push({
            id: company._id,
            actionId: null,
            type: 'Document Expiry Reminder',
            requestedBy: 'System',
            requestedDate: d.toISOString(),
            status: 'Pending',
            extra1: `Expiry follow-up required: ${label} (Exp: ${expLabel})`,
            extra2: `${company?.name || ''} (${company?.companyId || ''})`,
            scope: 'inbox',
            ...extraFields,
        });
    };

    const sorted = sortCompaniesForOwnerDedupe(companies || []);
    const ownerExpiryFingerprintsSeen = new Set();

    sorted.forEach((company) => {
        pushIfDue(company, 'Trade License', company?.tradeLicenseExpiry);
        pushIfDue(company, 'Establishment Card', company?.establishmentCardExpiry);
        (company?.documents || []).forEach((doc) => {
            if (isOldLikeRow(doc)) return;
            pushIfDue(company, doc?.type || 'Company Document', doc?.expiryDate);
        });
        (company?.ejari || []).forEach((ej) => {
            if (isOldLikeRow(ej)) return;
            pushIfDue(company, ej?.type ? `Ejari — ${ej.type}` : 'Ejari', ej?.expiryDate);
        });
        (company?.insurance || []).forEach((ins) => {
            if (isOldLikeRow(ins)) return;
            pushIfDue(company, ins?.type ? `Insurance — ${ins.type}` : 'Insurance', ins?.expiryDate);
        });
        const ownerFields = [
            ['passport', 'Passport'],
            ['visa', 'Visa'],
            ['emiratesId', 'Emirates ID'],
            ['medical', 'Medical Insurance'],
            ['drivingLicense', 'Driving License'],
            ['labourCard', 'Labour Card'],
        ];
        (company?.owners || []).forEach((owner, idx) => {
            ownerFields.forEach(([k, lbl]) => {
                const exp = owner?.[k]?.expiryDate;
                if (!exp) return;
                const daysRemaining = getCalendarDaysUntilExpiry(exp);
                if (!isExpiryNotificationWindow(daysRemaining)) return;
                const d = new Date(exp);
                if (Number.isNaN(d.getTime())) return;
                const expLabel = d.toLocaleDateString('en-GB');
                const fp = ownerLinkedExpiryFingerprintFrontend(owner, k, expLabel);
                if (ownerExpiryFingerprintsSeen.has(fp)) return;
                ownerExpiryFingerprintsSeen.add(fp);
                const extra3 = JSON.stringify({
                    ownerExpiryDedupe: true,
                    ownerTabIndex: idx,
                    ownerDocField: k,
                });
                pushIfDue(company, `${owner?.name || 'Owner'} - ${lbl}`, exp, { extra3 });
            });
        });
    });

    return list;
}

function employeeDisplayName(emp) {
    const n = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim();
    return n || emp?.employeeId || '';
}

/**
 * Synthetic employee document expiry rows from list payload (matches fields from GET /Employee aggregate).
 */
export function collectEmployeeLiveExpiryNotifications(employees = []) {
    const list = [];
    const pushIfDue = (emp, label, expiryDate) => {
        if (!emp || !expiryDate) return;
        const daysRemaining = getCalendarDaysUntilExpiry(expiryDate);
        if (!isExpiryNotificationWindow(daysRemaining)) return;
        const d = new Date(expiryDate);
        if (Number.isNaN(d.getTime())) return;
        const expLabel = d.toLocaleDateString('en-GB');
        const subjectName = employeeDisplayName(emp);
        const eid = emp.employeeId;
        list.push({
            id: emp._id,
            actionId: null,
            type: 'Employee Document Expiry Reminder',
            requestedBy: 'System',
            requestedDate: d.toISOString(),
            status: 'Pending',
            extra1: `Expiry follow-up required: ${label} (Exp: ${expLabel})`,
            extra2: `${subjectName} (${eid})`,
            scope: 'inbox',
            targetEmployeeId: eid,
        });
    };

    for (const emp of employees || []) {
        const passportExp = emp?.passportDetails?.expiryDate || emp?.passportExp;
        pushIfDue(emp, 'Passport', passportExp);
        pushIfDue(emp, 'Emirates ID', emp?.eidExp);
        pushIfDue(emp, 'Medical Insurance', emp?.medExp);
        pushIfDue(emp, 'Labour Card', emp?.labourCardExp);

        const vd = emp?.visaDetails;
        if (vd) {
            pushIfDue(emp, 'Visit Visa', vd?.visit?.expiryDate);
            pushIfDue(emp, 'Employment Visa', vd?.employment?.expiryDate);
            pushIfDue(emp, 'Spouse Visa', vd?.spouse?.expiryDate);
        }

        (emp?.documents || []).forEach((doc) => {
            pushIfDue(emp, doc?.type || 'Employee Document', doc?.expiryDate);
        });

        pushIfDue(emp, 'Contract Expiry', emp?.contractExpiryDate);
    }

    return list;
}

/** Same tab rules as dashboard `resolveCompanyExpiryTab` (deep links after notification click). */
export function resolveCompanyExpiryTabFromExtra1(extra1 = '') {
    const raw = String(extra1 || '').trim();
    const prefix = 'Expiry follow-up required:';
    const label = (
        raw.toLowerCase().startsWith(prefix.toLowerCase()) ? raw.slice(prefix.length).trim() : raw
    )
        .replace(/\s*\(Exp:\s*[^)]+\)\s*$/i, '')
        .trim()
        .toLowerCase();

    const openDocs =
        label.includes('document with expiry') || label.includes('moa') || label.includes('memo');
    if (openDocs) return 'others';
    if (label.includes('trade license') || label.includes('establishment') || label.includes('ejari')) return 'basic';
    if (
        label.includes('passport') ||
        label.includes('visa') ||
        label.includes('emirates') ||
        label.includes('medical') ||
        label.includes('driving') ||
        label.includes('labour')
    ) {
        return 'owner';
    }
    if (label.includes('insurance') || label.includes('document')) return 'others';
    // Custom company document types (arbitrary labels) live under the Documents tab (`others` in URL).
    return 'others';
}

/** Route for Flowchart HR: company profile tab + optional owner sub-tab index. */
export function buildCompanyDocumentExpiryPath(companyId, extra1, extra3Raw) {
    if (!companyId) return '';
    const tab = resolveCompanyExpiryTabFromExtra1(extra1);
    let path = `/Company/${encodeURIComponent(companyId)}?tab=${encodeURIComponent(tab)}`;
    if (!extra3Raw) return path;
    try {
        const m = typeof extra3Raw === 'string' ? JSON.parse(extra3Raw) : extra3Raw;
        if (Number.isInteger(m?.ownerTabIndex) && m.ownerTabIndex >= 0) {
            path = `/Company/${encodeURIComponent(companyId)}?tab=owner&ownerTab=${encodeURIComponent(m.ownerTabIndex)}`;
        }
    } catch {
        /* ignore */
    }
    return path;
}

const OWNER_DOC_LABEL_RE =
    /^(.*?)\s*[-\u2013\u2014]\s*(Passport|Visa|Emirates ID|Medical Insurance|Driving License|Labour Card)\s*$/i;

const extractExpiryReminderLabel = (extra1 = '') => {
    const raw = String(extra1 || '').trim();
    const prefix = 'Expiry follow-up required:';
    const withoutPrefix = raw.toLowerCase().startsWith(prefix.toLowerCase())
        ? raw.slice(prefix.length).trim()
        : raw;
    return withoutPrefix.replace(/\s*\(Exp:\s*[^)]+\)\s*$/i, '').trim();
};

const extractExpiryDateLabelFromExtra1 = (extra1 = '') => {
    const m = String(extra1 || '').match(/\(Exp:\s*([^)]+)\)/i);
    return m?.[1] ? String(m[1]).trim() : '';
};

/**
 * Human-readable expiry wording for notifications.
 * Ex: "Visa Expiry", "RAZAAAN ASLAM's Passport Expiry"
 */
export function formatExpiryNotificationDisplay(item = {}) {
    const t = String(item?.type || '').trim();
    if (t !== 'Document Expiry Reminder' && t !== 'Employee Document Expiry Reminder') return null;

    const label = extractExpiryReminderLabel(item?.extra1 || '');
    if (!label) return null;
    const ownerMatch = label.match(OWNER_DOC_LABEL_RE);
    const headline = ownerMatch
        ? `${ownerMatch[1].trim() || 'Owner'}'s ${ownerMatch[2].trim()} Expiry`
        : label.toLowerCase().endsWith('expiry')
            ? label
            : `${label} Expiry`;

    const exp = extractExpiryDateLabelFromExtra1(item?.extra1 || '');
    const location = String(item?.extra2 || '').trim();
    const detail = [exp ? `Exp: ${exp}` : '', location].filter(Boolean).join(' • ');

    return { headline, detail };
}

/** Company owner rows — allow ASCII/en/em dash before document type label. */
const COMPANY_OWNER_EXPIRY_BODY =
    /\s[-\u2013\u2014]\s(Passport|Visa|Emirates ID|Medical Insurance|Driving License|Labour Card)\s*\(/i;

const normalizeExpiryExtra1ForDedupe = (e1) => String(e1 || '').trim().replace(/\s+/g, ' ').toLowerCase();

const parseTrailingCompanyHumanIdFromExtra2 = (extra2) => {
    const m = String(extra2 || '').match(/\(([^)]*)\)\s*$/);
    return m ? String(m[1]).trim() : '';
};

const pickBetterDuplicateDocumentExpiryReminder = (a, b) => {
    const ah = parseTrailingCompanyHumanIdFromExtra2(a?.extra2);
    const bh = parseTrailingCompanyHumanIdFromExtra2(b?.extra2);
    if (ah && bh && ah !== bh) return ah.localeCompare(bh) < 0 ? a : b;
    if (ah && !bh) return a;
    if (!ah && bh) return b;
    const ai = String(a?.id ?? '');
    const bi = String(b?.id ?? '');
    return ai.localeCompare(bi) < 0 ? a : b;
};

const dedupeExpiryItemsByMergeKeyKeepBest = (items = []) => {
    const map = new Map();
    for (const x of items || []) {
        const k = mergeDedupeKey(x);
        const cur = map.get(k);
        map.set(k, cur ? pickBetterDuplicateDocumentExpiryReminder(cur, x) : x);
    }
    return map;
};

const mergeDedupeKey = (x) => {
    const t = x?.type || '';
    const e1 = String(x.extra1 || '').trim();
    let ownerDedupeHint = false;
    if (e1 && (x?.extra3 || '')) {
        try {
            const m = typeof x.extra3 === 'string' ? JSON.parse(x.extra3) : x.extra3;
            ownerDedupeHint = m?.ownerExpiryDedupe === true;
        } catch {
            /* ignore */
        }
    }
    if (t === 'Document Expiry Reminder' && e1 && (ownerDedupeHint || COMPANY_OWNER_EXPIRY_BODY.test(e1))) {
        return `CDE|OWNER|${normalizeExpiryExtra1ForDedupe(e1)}`;
    }
    if (t === 'Employee Document Expiry Reminder' && e1) return `EDE|${normalizeExpiryExtra1ForDedupe(e1)}`;
    return `${t}|${x.id}|${e1}`;
};

const isOldExpiryReminderLabel = (extra1 = '') => {
    const raw = String(extra1 || '').trim();
    if (!raw) return false;
    const prefix = 'Expiry follow-up required:';
    const label = raw.toLowerCase().startsWith(prefix.toLowerCase())
        ? raw.slice(prefix.length).trim().toLowerCase()
        : raw.toLowerCase();
    return (
        label.startsWith('previous ') ||
        label.includes(' old ') ||
        label.includes('not renew') ||
        label.includes('not renewed')
    );
};

const shouldKeepExpiryNotification = (item) => {
    const t = String(item?.type || '').trim();
    if (t !== 'Document Expiry Reminder' && t !== 'Employee Document Expiry Reminder') return true;
    return !isOldExpiryReminderLabel(item?.extra1 || '');
};

export function mergeExpiryNotificationDedupe(apiItems = [], fallbackItems = []) {
    const apiBest = dedupeExpiryItemsByMergeKeyKeepBest((apiItems || []).filter(shouldKeepExpiryNotification));
    const seen = new Set(apiBest.keys());
    const merged = Array.from(apiBest.values());
    (fallbackItems || []).filter(shouldKeepExpiryNotification).forEach((x) => {
        const key = mergeDedupeKey(x);
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(x);
        }
    });
    merged.sort((a, b) => new Date(b.requestedDate || 0) - new Date(a.requestedDate || 0));
    return merged;
}
