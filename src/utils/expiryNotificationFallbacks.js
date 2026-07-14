import { collectCompanyExpiryDocuments, buildEmployeeManualDocumentExpiryLabel, resolveCompanyCertificateExpiryNavigationMeta, certificateTypeSectionId } from '@/utils/companyExpiryScanUtils';
import {
    getCalendarDaysUntilExpiry,
    isExpiryHrTaskDueForDoc,
} from '@/utils/documentExpiryReminderStages';
import {
    buildCompanyPathWithFocus,
    resolveCompanyFocusCardFromText,
    resolveCompanyOwnerDocFocusCard,
} from '@/utils/notificationFocusNavigation';
import { sortNotificationsStackOrder } from '@/utils/notificationSortOrder';

export { getCalendarDaysUntilExpiry };

/** Dashboard / bell: surface follow-ups within expiry task window (≤10 days or overdue). */
export function isExpiryNotificationWindow(days, options = {}) {
    return isExpiryHrTaskDueForDoc(days, options);
}

/** Parse `(Exp: …)` labels produced by toLocaleDateString('en-GB') / ISO. */
export function parseExpiryLabelToDate(expLabel = '') {
    const raw = String(expLabel || '').trim();
    if (!raw) return null;

    const dmy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        const year = Number(dmy[3]);
        const d = new Date(year, month - 1, day);
        if (!Number.isNaN(d.getTime())) return d;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

const normalizeExpiryLabelKey = (label = '') =>
    String(label || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

/** Resolve current live expiry date for an employee reminder label. */
export function resolveEmployeeLiveExpiryDate(emp, reminderLabel = '') {
    if (!emp) return null;
    const label = normalizeExpiryLabelKey(reminderLabel);
    if (!label) return null;

    if (label === 'passport') return emp?.passportDetails?.expiryDate || emp?.passportExp || null;
    if (label === 'emirates id') return emp?.eidExp || emp?.emiratesIdDetails?.expiryDate || null;
    if (label === 'medical insurance') return emp?.medExp || emp?.medicalInsuranceDetails?.expiryDate || null;
    if (label === 'labour card') return emp?.labourCardExp || emp?.labourCardDetails?.expiryDate || null;
    if (label === 'driving license' || label === 'driving licence') {
        return emp?.drivingLicenceDetails?.expiryDate || emp?.drivingLicenseExp || null;
    }
    if (label === 'visit visa') return emp?.visaDetails?.visit?.expiryDate || null;
    if (label === 'employment visa') return emp?.visaDetails?.employment?.expiryDate || null;
    if (label === 'spouse visa') return emp?.visaDetails?.spouse?.expiryDate || null;
    if (label === 'contract expiry') return emp?.contractExpiryDate || null;

    for (const doc of emp?.documents || []) {
        const docLabel = normalizeExpiryLabelKey(buildEmployeeManualDocumentExpiryLabel(doc));
        if (docLabel === label) return doc?.expiryDate || null;
    }
    return null;
}

const isCertificateExpiryLabel = (label = '') =>
    String(label || '')
        .trim()
        .toLowerCase()
        .includes('certificate');

/**
 * Keep expiry reminders only when the live card expiry is still ≤ today+10 (or overdue).
 * Stale API rows after renew/edit are dropped even if their old Exp text still looks "due".
 */
export function isEmployeeExpiryReminderStillDue(item, emp) {
    const type = String(item?.type || '').trim();
    if (type !== 'Employee Document Expiry Reminder') return true;
    if (!emp) return true;

    const label = extractExpiryReminderLabel(item?.extra1 || '');
    const liveDate = resolveEmployeeLiveExpiryDate(emp, label);
    if (!liveDate) return false;

    const days = getCalendarDaysUntilExpiry(liveDate);
    return isExpiryHrTaskDueForDoc(days, { isCertificate: isCertificateExpiryLabel(label) });
}

export function isCompanyExpiryReminderStillDue(item, company) {
    const type = String(item?.type || '').trim();
    if (type !== 'Document Expiry Reminder') return true;
    if (!company) return true;

    const label = normalizeExpiryLabelKey(extractExpiryReminderLabel(item?.extra1 || ''));
    if (!label) return true;

    const dueDocs = collectCompanyExpiryDocuments(company).filter((doc) => {
        const days = getCalendarDaysUntilExpiry(doc.expiryDate);
        return isExpiryHrTaskDueForDoc(days, { isCertificate: !!doc.isCertificate });
    });

    return dueDocs.some((doc) => normalizeExpiryLabelKey(doc.label) === label);
}

function indexEmployeesForExpiryFilter(employees = []) {
    const byMongoId = new Map();
    const byHumanId = new Map();
    for (const emp of employees || []) {
        if (emp?._id != null) byMongoId.set(String(emp._id), emp);
        if (emp?.employeeId) byHumanId.set(String(emp.employeeId).trim(), emp);
    }
    return { byMongoId, byHumanId };
}

function indexCompaniesForExpiryFilter(companies = []) {
    const byMongoId = new Map();
    for (const company of companies || []) {
        if (company?._id != null) byMongoId.set(String(company._id), company);
    }
    return byMongoId;
}

/** Drop expiry notifications whose live card is outside the ≤10-day window (or gone). */
export function filterExpiryRemindersAgainstLiveEntities(
    items = [],
    { employees = null, companies = null } = {},
) {
    const empIndex =
        Array.isArray(employees) && employees.length > 0 ? indexEmployeesForExpiryFilter(employees) : null;
    const companyIndex =
        Array.isArray(companies) && companies.length > 0 ? indexCompaniesForExpiryFilter(companies) : null;

    return (items || []).filter((item) => {
        const type = String(item?.type || '').trim();

        if (type === 'Employee Document Expiry Reminder' && empIndex) {
            const emp =
                empIndex.byMongoId.get(String(item?.id ?? '')) ||
                empIndex.byHumanId.get(String(item?.targetEmployeeId || '').trim());
            if (!emp) return true;
            return isEmployeeExpiryReminderStillDue(item, emp);
        }

        if (type === 'Document Expiry Reminder' && companyIndex) {
            const company = companyIndex.get(String(item?.id ?? ''));
            if (!company) return true;
            return isCompanyExpiryReminderStillDue(item, company);
        }

        // Soft check from notification Exp text (covers vehicle + rows without entity lists).
        if (
            type === 'Document Expiry Reminder' ||
            type === 'Employee Document Expiry Reminder' ||
            type === 'Vehicle Document Expiry Reminder'
        ) {
            const expLabel = extractExpiryDateLabelFromExtra1(item?.extra1 || '');
            const expDate = parseExpiryLabelToDate(expLabel);
            if (!expDate) return true;
            const days = getCalendarDaysUntilExpiry(expDate);
            const label = extractExpiryReminderLabel(item?.extra1 || '');
            return isExpiryHrTaskDueForDoc(days, { isCertificate: isCertificateExpiryLabel(label) });
        }

        return true;
    });
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
    if (fieldKey === 'visitVisa') return String(owner?.visitVisa?.number || '').trim().toLowerCase();
    if (fieldKey === 'employmentVisa') return String(owner?.employmentVisa?.number || '').trim().toLowerCase();
    if (fieldKey === 'spouseVisa') return String(owner?.spouseVisa?.number || '').trim().toLowerCase();
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
    const pushIfDue = (company, label, expiryDate, extraFields = {}, isCertificate = false) => {
        if (!company || !expiryDate) return;
        const daysRemaining = getCalendarDaysUntilExpiry(expiryDate);
        if (!isExpiryHrTaskDueForDoc(daysRemaining, { isCertificate })) return;
        const d = new Date(expiryDate);
        if (Number.isNaN(d.getTime())) return;
        const expLabel = d.toLocaleDateString('en-GB');
        list.push({
            id: company._id,
            actionId: null,
            type: 'Document Expiry Reminder',
            requestedBy: 'System',
            requestedDate: new Date().toISOString(),
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
        collectCompanyExpiryDocuments(company).forEach((doc) => {
            const isOwnerDoc = doc.key.includes(':owner:');
            if (isOwnerDoc) {
                const owner = company?.owners?.[doc.ownerIdx];
                const d = new Date(doc.expiryDate);
                if (Number.isNaN(d.getTime())) return;
                const expLabel = d.toLocaleDateString('en-GB');
                const fp = ownerLinkedExpiryFingerprintFrontend(owner, doc.ownerDocField, expLabel);
                if (ownerExpiryFingerprintsSeen.has(fp)) return;
                ownerExpiryFingerprintsSeen.add(fp);
                pushIfDue(company, doc.label, doc.expiryDate, {
                    extra3: JSON.stringify({
                        ownerExpiryDedupe: true,
                        ownerTabIndex: doc.ownerIdx,
                        ownerDocField: doc.ownerDocField,
                    }),
                });
                return;
            }
            const certMeta =
                doc.isCertificate && doc.documentRow
                    ? resolveCompanyCertificateExpiryNavigationMeta(company, doc.documentRow)
                    : null;
            pushIfDue(
                company,
                doc.label,
                doc.expiryDate,
                certMeta ? { extra3: JSON.stringify(certMeta) } : {},
                doc.isCertificate,
            );
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
    const pushIfDue = (emp, label, expiryDate, isCertificate = false) => {
        if (!emp || !expiryDate) return;
        const daysRemaining = getCalendarDaysUntilExpiry(expiryDate);
        if (!isExpiryHrTaskDueForDoc(daysRemaining, { isCertificate })) return;
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
            requestedDate: new Date().toISOString(),
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
            const isCertificate = String(doc?.context || '').toLowerCase() === 'certificate';
            pushIfDue(
                emp,
                buildEmployeeManualDocumentExpiryLabel(doc),
                doc?.expiryDate,
                isCertificate,
            );
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
        label.includes('document with expiry') ||
        label.includes('moa') ||
        label.includes('memo') ||
        label.includes('certificate');
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

/** Route for Flowchart HR: company profile tab + optional owner sub-tab index + focus scroll. */
export function buildCompanyDocumentExpiryPath(companyId, extra1, extra3Raw) {
    if (!companyId) return '';
    const tab = resolveCompanyExpiryTabFromExtra1(extra1);
    const raw = String(extra1 || '').trim();
    const prefix = 'Expiry follow-up required:';
    const rest = raw.toLowerCase().startsWith(prefix.toLowerCase()) ? raw.slice(prefix.length).trim() : raw;
    const rl = rest.replace(/\s*\(Exp:\s*[^)]+\)\s*$/i, '').trim().toLowerCase();
    let focusCard = resolveCompanyFocusCardFromText(extra1);

    let path = `/Company/${encodeURIComponent(companyId)}?tab=${encodeURIComponent(tab)}`;
    if (rl.includes('memo')) {
        path += '&docStatusTab=memo';
    } else if (rl.includes('certificate')) {
        path += '&docStatusTab=certificate';
    } else if (
        rl.includes('moa') ||
        rl.includes('document with expiry') ||
        rl.includes('insurance')
    ) {
        path += '&docStatusTab=live';
    }

    let ownerTab = null;
    if (extra3Raw) {
        try {
            const m = typeof extra3Raw === 'string' ? JSON.parse(extra3Raw) : extra3Raw;
            if (Number.isInteger(m?.ownerTabIndex) && m.ownerTabIndex >= 0) {
                ownerTab = m.ownerTabIndex;
                if (tab !== 'owner') {
                    path = `/Company/${encodeURIComponent(companyId)}?tab=owner`;
                }
            }
            const fromField = resolveCompanyOwnerDocFocusCard(m?.ownerDocField);
            if (fromField) focusCard = fromField;

            if (m?.certificateSectionId) {
                const sep = path.includes('?') ? '&' : '?';
                path += `${sep}certSection=${encodeURIComponent(String(m.certificateSectionId))}`;
            }
            if (Number.isInteger(m?.certificateSectionPage) && m.certificateSectionPage > 1) {
                path += `&sectionPage=${encodeURIComponent(String(m.certificateSectionPage))}`;
            }
            if (m?.certificateDocumentId) {
                path += `&focusCertificate=${encodeURIComponent(String(m.certificateDocumentId))}`;
            }
        } catch {
            /* ignore */
        }
    }

    return buildCompanyPathWithFocus(path, { focusCard, ownerTab });
}

const OWNER_DOC_LABEL_RE =
    /^(.*?)\s*[-\u2013\u2014]\s*(Passport|Visa|Visit Visa|Employment Visa|Spouse Visa|Emirates ID|Medical Insurance|Driving License|Labour Card)\s*$/i;

const CERTIFICATE_EXPIRY_LABEL_RE = /^certificate\s*[-\u2013\u2014]\s*(.+)$/i;

/**
 * Human-readable expiry wording for notifications.
 * Ex: "Visa Expiry", "RAZAAAN ASLAM's Passport Expiry"
 */
export function formatExpiryNotificationDisplay(item = {}) {
    const t = String(item?.type || '').trim();
    if (
        t !== 'Document Expiry Reminder' &&
        t !== 'Employee Document Expiry Reminder' &&
        t !== 'Vehicle Document Expiry Reminder'
    ) {
        return null;
    }

    const label = extractExpiryReminderLabel(item?.extra1 || '');
    if (!label) return null;
    const ownerMatch = label.match(OWNER_DOC_LABEL_RE);
    const certificateMatch = label.match(CERTIFICATE_EXPIRY_LABEL_RE);
    const certificateDetail = certificateMatch ? certificateMatch[1].trim() : '';
    const headline = ownerMatch
        ? `${ownerMatch[1].trim() || 'Owner'}'s ${ownerMatch[2].trim()} Expiry`
        : certificateDetail
            ? (certificateDetail.toLowerCase().endsWith('expiry')
                ? certificateDetail
                : `${certificateDetail} Expiry`)
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
    /\s[-\u2013\u2014]\s(Passport|Visa|Visit Visa|Employment Visa|Spouse Visa|Emirates ID|Medical Insurance|Driving License|Labour Card)\s*\(/i;

const normalizeExpiryExtra1ForDedupe = (e1) => String(e1 || '').trim().replace(/\s+/g, ' ').toLowerCase();

const parseTrailingCompanyHumanIdFromExtra2 = (extra2) => {
    const m = String(extra2 || '').match(/\(([^)]*)\)\s*$/);
    return m ? String(m[1]).trim() : '';
};

const certificateLabelDetail = (extra1 = '') => {
    const label = extractExpiryReminderLabel(extra1);
    const match = label.match(CERTIFICATE_EXPIRY_LABEL_RE);
    return match ? match[1].trim() : '';
};

const isCertificateTypeOnlyDetail = (detail = '') => {
    const d = String(detail || '').trim().toLowerCase();
    return ['installer', 'safety', 'administration', 'others', 'certificate'].includes(d);
};

const certificateReminderScore = (item = {}) => {
    let score = certificateLabelDetail(item?.extra1 || '').length;
    if (item?.actionId) score += 50;
    if (item?.extra3) {
        try {
            const meta = typeof item.extra3 === 'string' ? JSON.parse(item.extra3) : item.extra3;
            if (meta?.certificateDocumentId) score += 1000;
            if (meta?.certificateSectionPage) score += 10;
        } catch {
            /* ignore */
        }
    }
    if (isCertificateTypeOnlyDetail(certificateLabelDetail(item?.extra1 || ''))) {
        score -= 200;
    }
    return score;
};

const parseCertificateMetaFromItem = (item = {}) => {
    if (!item?.extra3) return null;
    try {
        return typeof item.extra3 === 'string' ? JSON.parse(item.extra3) : item.extra3;
    } catch {
        return null;
    }
};

/** Drop type-only certificate rows (e.g. "Installer") when a description row exists for same company + expiry. */
const removeCertificateTypeOnlyDuplicates = (items = []) => {
    const descriptiveKeys = new Set();
    for (const item of items || []) {
        if (String(item?.type || '').trim() !== 'Document Expiry Reminder') continue;
        const detail = certificateLabelDetail(item?.extra1 || '');
        if (!detail || isCertificateTypeOnlyDetail(detail)) continue;
        const exp = extractExpiryDateLabelFromExtra1(item?.extra1 || '');
        if (!exp) continue;
        descriptiveKeys.add(`${String(item?.id ?? '')}|${exp}`);
    }

    return (items || []).filter((item) => {
        if (String(item?.type || '').trim() !== 'Document Expiry Reminder') return true;
        const detail = certificateLabelDetail(item?.extra1 || '');
        if (!detail || !isCertificateTypeOnlyDetail(detail)) return true;
        const exp = extractExpiryDateLabelFromExtra1(item?.extra1 || '');
        if (!exp) return true;
        return !descriptiveKeys.has(`${String(item?.id ?? '')}|${exp}`);
    });
};

/** Collapse duplicate certificate reminders (type-only vs description) for the same document/expiry. */
const dedupeCertificateExpiryReminders = (items = []) => {
    const groups = new Map();
    const passthrough = [];

    for (const item of items || []) {
        if (String(item?.type || '').trim() !== 'Document Expiry Reminder') {
            passthrough.push(item);
            continue;
        }
        const detail = certificateLabelDetail(item?.extra1 || '');
        if (!detail) {
            passthrough.push(item);
            continue;
        }

        const exp = extractExpiryDateLabelFromExtra1(item?.extra1 || '');
        const companyKey = String(item?.id ?? '');
        const meta = parseCertificateMetaFromItem(item);
        const groupKey = meta?.certificateDocumentId
            ? `doc|${companyKey}|${meta.certificateDocumentId}`
            : `cert|${companyKey}|${exp}|${meta?.certificateSectionId || certificateTypeSectionId(detail)}`;

        const bucket = groups.get(groupKey) || [];
        bucket.push(item);
        groups.set(groupKey, bucket);
    }

    const merged = [...passthrough];
    for (const bucket of groups.values()) {
        if (bucket.length === 1) {
            merged.push(bucket[0]);
            continue;
        }
        bucket.sort((a, b) => certificateReminderScore(b) - certificateReminderScore(a));
        merged.push(bucket[0]);
    }

    return merged;
};

const pickBetterDuplicateDocumentExpiryReminder = (a, b) => {
    const scoreA = certificateReminderScore(a);
    const scoreB = certificateReminderScore(b);
    if (scoreA !== scoreB) return scoreA > scoreB ? a : b;
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
    if (t === 'Company Activation Incomplete') {
        const companyId = String(x.id ?? '').trim();
        if (companyId) return `CAI|${companyId}|mandatory-cards`;
        return `CAI|${x.id}|${String(x.extra1 || '').trim()}`;
    }
    if (t === 'Profile Incomplete') {
        const empKey = String(x.targetEmployeeId ?? x.id ?? '').trim();
        if (empKey) return `PI|${empKey}|mandatory-cards`;
        return `PI|${empKey}|${String(x.extra1 || '').trim()}`;
    }
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
    if (t === 'Employee Document Expiry Reminder' && e1) {
        const empKey = String(x.targetEmployeeId ?? x.id ?? '').trim();
        return `EDE|${empKey}|${normalizeExpiryExtra1ForDedupe(e1)}`;
    }
    if (t === 'Vehicle Document Expiry Reminder' && e1) {
        const vehicleKey = String(x.id ?? '').trim();
        return `VDE|${vehicleKey}|${normalizeExpiryExtra1ForDedupe(e1)}`;
    }
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
    if (
        t !== 'Document Expiry Reminder' &&
        t !== 'Employee Document Expiry Reminder' &&
        t !== 'Vehicle Document Expiry Reminder'
    ) {
        return true;
    }
    if (isOldExpiryReminderLabel(item?.extra1 || '')) return false;

    // Always enforce ≤ today+10 (or overdue) from the Exp label when present.
    const expLabel = extractExpiryDateLabelFromExtra1(item?.extra1 || '');
    const expDate = parseExpiryLabelToDate(expLabel);
    if (!expDate) return true;
    const days = getCalendarDaysUntilExpiry(expDate);
    const label = extractExpiryReminderLabel(item?.extra1 || '');
    return isExpiryHrTaskDueForDoc(days, { isCertificate: isCertificateExpiryLabel(label) });
};

/**
 * Merge API expiry rows with live scans.
 * When entity lists are provided, drop reminders whose live card is no longer within ≤10 days.
 * When preferLiveForTypes is set, live rows replace API rows for those types (authoritative after renew/edit).
 */
export function mergeExpiryNotificationDedupe(apiItems = [], fallbackItems = [], options = {}) {
    const {
        employees = null,
        companies = null,
        preferLiveForTypes = [],
    } = options || {};

    const preferTypes = new Set(
        (Array.isArray(preferLiveForTypes) ? preferLiveForTypes : [])
            .map((t) => String(t || '').trim())
            .filter(Boolean),
    );

    let apiFiltered = (apiItems || []).filter(shouldKeepExpiryNotification);
    apiFiltered = filterExpiryRemindersAgainstLiveEntities(apiFiltered, { employees, companies });
    if (preferTypes.size > 0) {
        apiFiltered = apiFiltered.filter((item) => !preferTypes.has(String(item?.type || '').trim()));
    }

    const liveFiltered = filterExpiryRemindersAgainstLiveEntities(
        (fallbackItems || []).filter(shouldKeepExpiryNotification),
        { employees, companies },
    );

    const apiBest = dedupeExpiryItemsByMergeKeyKeepBest(apiFiltered);
    const seen = new Set(apiBest.keys());
    const merged = Array.from(apiBest.values());
    liveFiltered.forEach((x) => {
        const key = mergeDedupeKey(x);
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(x);
        }
    });
    return sortNotificationsStackOrder(
        removeCertificateTypeOnlyDuplicates(dedupeCertificateExpiryReminders(merged)),
    );
}
