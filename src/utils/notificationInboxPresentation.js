/**
 * Shared notification / pending-inbox row presentation for bells, Command Center, and modals.
 */

import { parseExpiryLabelToDate } from '@/utils/expiryNotificationFallbacks';
import { getDaysUntil } from '@/utils/documentExpiryReminderStages';

function asDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

const EXPIRY_REMINDER_TYPES = new Set([
    'Employee Document Expiry Reminder',
    'Document Expiry Reminder',
    'Vehicle Document Expiry Reminder',
]);

function extractExpLabelFromExtra1(extra1 = '') {
    const m = String(extra1 || '').match(/\(Exp:\s*([^)]+)\)/i);
    return m?.[1] ? String(m[1]).trim() : '';
}

/**
 * Footer for document-expiry cards: "expired 8 days ago" / "expires in 2 days"
 * based on (Exp: …) in extra1 vs today — not the notification sent time.
 */
export function formatNotificationExpiryRelative(raw) {
    const type = String(raw?.type || raw?.requestType || '').trim();
    if (!EXPIRY_REMINDER_TYPES.has(type)) return '';

    const expDate = parseExpiryLabelToDate(extractExpLabelFromExtra1(raw?.extra1));
    if (!expDate) return '';

    const days = getDaysUntil(expDate);
    if (days == null) return '';

    if (days < 0) {
        const n = Math.abs(days);
        return n === 1 ? 'expired 1 day ago' : `expired ${n} days ago`;
    }
    if (days === 0) return 'expires today';
    return days === 1 ? 'expires in 1 day' : `expires in ${days} days`;
}

function parseExtra3(extra3) {
    if (extra3 == null || extra3 === '') return null;
    if (typeof extra3 === 'object') return extra3;
    try {
        return JSON.parse(extra3);
    } catch {
        return null;
    }
}

export function formatNotificationTime(requestedDate, raw) {
    const d =
        asDate(requestedDate) ||
        asDate(raw?.requestedDate) ||
        asDate(raw?.createdAt) ||
        asDate(raw?.actionedDate);
    if (!d) return '';
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatNotificationPendingSince(requestedDate, raw, status) {
    const s = String(status || raw?.status || '').toLowerCase();
    if (s && s !== 'pending') return '';
    const d =
        asDate(requestedDate) ||
        asDate(raw?.requestedDate) ||
        asDate(raw?.createdAt);
    if (!d) return '';
    const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
}

/** Absolute calendar date (notification received / created). */
export function formatNotificationDateShort(value) {
    const d = asDate(value);
    if (!d) return '';
    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Timeline dates for inbox bars: when the notification arrived, plus optional start/end.
 * Does not remove or replace existing relative/expiry formatters.
 */
export function getNotificationTimelineDates(row) {
    const raw = row?.raw ?? row;
    const meta = parseExtra3(raw?.extra3);
    const received =
        asDate(row?.requestedDate) ||
        asDate(raw?.requestedDate) ||
        asDate(raw?.createdAt) ||
        asDate(raw?.updatedAt) ||
        null;
    const start =
        asDate(meta?.startDate) ||
        asDate(meta?.fromDate) ||
        asDate(raw?.startDate) ||
        asDate(raw?.fromDate) ||
        null;
    const end =
        asDate(meta?.endDate) ||
        asDate(meta?.expiryDate) ||
        asDate(raw?.endDate) ||
        asDate(raw?.expiryDate) ||
        parseExpiryLabelToDate(extractExpLabelFromExtra1(raw?.extra1)) ||
        null;
    return { received, start, end };
}

/** Day bounds for date-range filtering (inclusive). */
export function notificationReceivedDayMs(row) {
    const { received } = getNotificationTimelineDates(row);
    if (!received) return null;
    const day = new Date(received);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
}

export function notificationStatusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved' || s === 'paid' || s === 'completed') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (s === 'rejected' || s === 'cancelled') {
        return 'bg-red-50 text-red-700 border-red-200';
    }
    if (s.includes('pending')) {
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function groupNotificationsByDate(rows = []) {
    const groups = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    (rows || []).forEach((row) => {
        const d =
            asDate(row?.requestedDate) ||
            asDate(row?.raw?.requestedDate) ||
            asDate(row?.raw?.createdAt) ||
            new Date();
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        let label = day.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        if (day.getTime() === today.getTime()) label = 'Today';
        else if (day.getTime() === yesterday.getTime()) label = 'Yesterday';
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(row);
    });

    return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

export function resolveNotificationIconVariant(typeOrItem) {
    const type =
        typeof typeOrItem === 'string'
            ? typeOrItem
            : String(typeOrItem?.type || typeOrItem?.requestType || '').trim();

    switch (type) {
        case 'Employee Document Expiry Reminder':
            return 'expiry-idcard';
        case 'Document Expiry Reminder':
            return 'expiry-idcard-teal';
        case 'Vehicle Document Expiry Reminder':
            return 'expiry-idcard-amber';
        case 'Employee Document Not Renew':
            return 'renew-idcard';
        case 'Company Activation Incomplete':
            return 'incomplete-settings';
        case 'Probation Change':
            return 'probation-settings';
        case 'Left User Request':
            return 'activation-profile';
        case 'Payment Approval':
            return 'payment-card';
        case 'Fine':
            return 'fine-book';
        case 'Group Fine Request':
            return 'fine-group';
        case 'Reward':
            return 'reward-award';
        case 'Asset Accessory':
            return 'asset-settings-accessory';
        case 'Asset Accessory Approval':
            return 'asset-badge-accessory';
        case 'Asset Accessory Unattach':
            return 'asset-settings-unattach';
        case 'Utility Bill Payment':
        case 'Utility Bill Payment Reminder':
        case 'Utility Contract Expiry':
        case 'Utility Entry Status Change':
            return 'asset-settings-service';
        case 'Vehicle Service Request':
            return 'asset-settings-service';
        case 'Vehicle Profile Activation':
        case 'Vehicle Profile Edit':
        case 'Vehicle Profile Incomplete':
        case 'Vehicle Inspection':
        case 'Vehicle Assignment Photo Review':
        case 'Vehicle Mortgage Close':
            return 'asset-badge-vehicle';
        case 'Asset Bulk Action':
            return 'asset-settings-bulk';
        case 'Asset Overdue':
            return 'asset-settings-urgent';
        case 'Asset Owner On Duty':
        case 'Asset On Duty Request':
            return 'asset-badge-duty';
        case 'Asset':
            return 'asset-settings';
        default:
            if (type.startsWith('Asset ')) return 'asset-settings';
            if (type.startsWith('Vehicle ')) return 'asset-badge-vehicle';
            if (type.toLowerCase().includes('loan')) return 'payment-card';
            if (type.toLowerCase().includes('activat')) return 'activation-profile';
            return 'asset-settings';
    }
}

/** Pull document label from "Expiry follow-up required: Passport (Exp: …)". */
function extractExpiryDocLabel(extra1 = '') {
    const raw = String(extra1 || '').trim();
    if (!raw) return '';
    const prefix = 'Expiry follow-up required:';
    const body = raw.toLowerCase().startsWith(prefix.toLowerCase())
        ? raw.slice(prefix.length).trim()
        : raw;
    return body.replace(/\s*\(Exp:\s*[^)]+\)\s*$/i, '').trim();
}

/** Subject name from subjectName, or "Name (ID)" in extra2. */
function extractExpirySubjectName(item = {}) {
    const fromSubject = String(item.subjectName || '').trim();
    if (fromSubject) return fromSubject;
    const extra2 = String(item.extra2 || '').trim();
    if (!extra2) return '';
    const withoutId = extra2.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return withoutId || extra2;
}

/**
 * Employee / Company / Vehicle document expiry titles:
 * "{Name} {Doc} Expiry Reminder" instead of the static requestType.
 */
export function buildExpiryReminderTitle(item = {}) {
    const type = String(item.type || item.requestType || '').trim();
    const isEmployee = type === 'Employee Document Expiry Reminder';
    const isCompany = type === 'Document Expiry Reminder';
    const isVehicle = type === 'Vehicle Document Expiry Reminder';
    if (!isEmployee && !isCompany && !isVehicle) return type || 'Request';

    const name = extractExpirySubjectName(item);
    const doc = extractExpiryDocLabel(item.extra1);
    const fallbackOwner = isEmployee ? 'Employee' : isCompany ? 'Company' : 'Vehicle';

    if (name && doc) return `${name} ${doc} Expiry Reminder`;
    if (name) return `${name} Document Expiry Reminder`;
    if (doc) return `${fallbackOwner} ${doc} Expiry Reminder`;
    return type;
}

/**
 * Pull the approval stage so Vehicle pending headers can show it at a glance.
 * New copy: "Current stage: Ready to Service". Older rows: garage / created / HR / Accounts.
 */
function vehicleServiceStageFromInboxItem(item = {}) {
    const e2 = sanitizeNotificationText(item.extra2 || '');
    const fromCurrent = e2.match(/Current stage:\s*([^.,]+)/i);
    if (fromCurrent?.[1]) return fromCurrent[1].trim();
    const youHave = e2.match(/You have\s+(.+?)\s+pending/i);
    if (youHave?.[1] && !/^complete service$/i.test(youHave[1].trim())) {
        return youHave[1].trim();
    }
    const t = `${item.extra1 || ''} ${e2}`.toLowerCase();
    if (/\bmake payment\b/.test(t) || /accounts billing/.test(t) || /zoho bill/.test(t)) return 'Make Payment';
    if (/zoho expense/.test(t)) return 'Zoho Expense';
    if (/accounts approve|awaiting accounts/.test(t)) return 'Accounts Approve';
    if (/ready to service/.test(t)) return 'Ready to Service';
    if (/\bon service\b/.test(t)) return 'On Service';
    if (/hr approval|awaiting hr/.test(t)) return 'HR Approval';
    if (/schedule|garage|reschedule/.test(t)) return 'Schedule';
    if (/created by|please complete/.test(t)) return 'Created';
    return '';
}

function appendVehicleServiceStageToTitle(title, item = {}) {
    const stage = vehicleServiceStageFromInboxItem(item);
    if (!stage) return title;
    const head = String(title || '').trim();
    if (!head) return stage;
    if (head.toLowerCase().includes(stage.toLowerCase())) return head;
    return `${head} — ${stage}`;
}

/**
 * Clear task title for utility (and other) inbox rows so the action is obvious.
 */
export function buildUnderstandableNotificationTitle(item = {}) {
    const type = String(item.type || item.requestType || '').trim();
    const expiryTitle = buildExpiryReminderTitle(item);
    if (
        type === 'Employee Document Expiry Reminder' ||
        type === 'Document Expiry Reminder' ||
        type === 'Vehicle Document Expiry Reminder'
    ) {
        return expiryTitle;
    }

    switch (type) {
        case 'Utility Contract Expiry':
            return 'Utility Contract Expiry — Renew or Deactivate';
        case 'Utility Bill Payment Reminder': {
            const extra2 = String(item.extra2 || '').trim();
            if (extra2) return extra2;
            const meta = parseExtra3(item.extra3);
            const billMonth = String(meta?.billMonth || meta?.yearMonth || '').trim();
            const utilityType = String(meta?.utilityType || '').trim() || 'utility';
            const accountNo = String(meta?.accountNo || '').trim() || 'account';
            if (/^\d{4}-\d{2}$/.test(billMonth)) {
                const [y, m] = billMonth.split('-');
                const probe = new Date(Number(y), Number(m) - 1, 1);
                const monthName = probe.toLocaleDateString('en-GB', { month: 'long' });
                return `${monthName} bill payment day on ${utilityType} on the ${accountNo}, please pay the bill`;
            }
            return 'Utility bill payment day, please pay the bill';
        }
        case 'Utility Bill Payment':
            return 'Utility Bill Payment — Review / Pay';
        case 'Utility Entry Status Change':
            return 'Utility Activate / Deactivate Request';
        case 'Salary Enrollment':
            return String(item.extra1 || '').trim() || 'Salary profile approval';
        case 'Salary DMF Approval': {
            const raw = String(item.extra1 || '').trim();
            const cleaned = raw
                .replace(/\s*payroll DMF is waiting on\s*/i, ' payroll waiting for ')
                .replace(/\s*DMF is waiting on\s*/i, ' payroll waiting for ')
                .replace(/\bDMF\b/gi, '')
                .replace(/\s{2,}/g, ' ')
                .replace(/\s+\./g, '.')
                .trim();
            return cleaned || 'Payroll waiting for approval';
        }
        case 'Vehicle Service Request': {
            const e1 = sanitizeNotificationText(item.extra1 || '');
            const title = e1 || 'Vehicle Service Request';
            return appendVehicleServiceStageToTitle(title, item);
        }
        default:
            return expiryTitle || type || 'Request';
    }
}

function baseRow(item = {}, index = 0) {
    const type = String(item.requestType || item.type || '').trim();
    const meta = parseExtra3(item.extra3);
    // Prefer DashboardAction _id (actionId / dashboardActionId). Falling back to request
    // subject id alone collides when one employee has multiple expiry reminders.
    const stableActionId =
        item.dashboardActionId || item.actionId || item._id || null;
    const subjectId = item.id || item.requestId || item.requestObjectId || '';
    const serviceHint = String(meta?.serviceRecordId || meta?.oilStage || meta?.historyId || '')
        .trim()
        .slice(0, 48);
    const extraHint = String(item.extra1 || item.extra2 || '')
        .trim()
        .slice(0, 96);
    const key = stableActionId
        ? `${String(stableActionId)}:${type}${serviceHint ? `:${serviceHint}` : ''}`
        : `${String(subjectId || 'row')}:${type}:${serviceHint || extraHint}:${index}`;
    const requestedDate =
        item.requestedDate || item.createdAt || item.updatedAt || item.actionedDate || null;

    return {
        key,
        title: buildUnderstandableNotificationTitle(item) || type || 'Request',
        source: String(
            item.subjectName ||
            item.requestedByName ||
            item.requestedBy ||
            item.source ||
            '',
        ).trim(),
        category: String(item.extra2 || item.extra1 || '').trim() || 'Pending task',
        highlight: '',
        entityName: String(
            item.entityName ||
            item.asset?.name ||
            meta?.utilityType ||
            meta?.entityName ||
            '',
        ).trim(),
        entityId: String(
            item.entityDisplayId ||
            item.asset?.assetId ||
            item.primaryAssetId ||
            meta?.entryId ||
            meta?.batchId ||
            '',
        ).trim(),
        status: String(
            item.status ||
            item.approvalStatus ||
            item.loan?.approvalStatus ||
            item.loan?.status ||
            'Pending',
        ).trim() || 'Pending',
        requestedDate,
        href: '',
        iconVariant: resolveNotificationIconVariant(type),
        raw: item,
    };
}

/** Fix UTF-8 mojibake / normalize dash separators in notification text. */
function sanitizeNotificationText(value = '') {
    return String(value || '')
        .replace(/â€”/g, '—')
        .replace(/â€“/g, '–')
        .replace(/\u00a0/g, ' ')
        .trim();
}

/**
 * Secondary line: what account / bill, plus the action hint from extra2.
 */
function buildUtilityCategoryLine(item = {}) {
    const type = String(item.type || item.requestType || '').trim();
    const e1 = sanitizeNotificationText(item.extra1 || '');
    const e2 = sanitizeNotificationText(item.extra2 || '');
    if (type === 'Vehicle Service Request') {
        return e2 || e1 || 'Pending task';
    }
    if (type === 'Utility Bill Payment Reminder') {
        return e1 || e2 || 'Pending utility task';
    }
    const isUtility =
        type === 'Utility Contract Expiry' ||
        type === 'Utility Bill Payment Reminder' ||
        type === 'Utility Bill Payment' ||
        type === 'Utility Entry Status Change';
    if (!isUtility) return e1 || e2 || 'Pending task';

    if (e1 && e2 && e2 !== e1) return `${e1} — ${e2}`;
    return e1 || e2 || 'Pending utility task';
}

/** Dashboard / page-bell notification item → inbox row. */
export function mapDashboardNotificationToRow(item = {}, index = 0) {
    const row = baseRow(item, index);
    const type = String(item.type || item.requestType || '').trim();
    row.title = sanitizeNotificationText(
        buildUnderstandableNotificationTitle(item) || type || row.title,
    );
    row.category = buildUtilityCategoryLine(item) || row.category;
    if (item.extra2 && !/Utility/.test(type)) {
        const e2 = sanitizeNotificationText(item.extra2);
        if (/exp|expiry|due/i.test(e2)) row.highlight = e2;
    }
    return row;
}

/** Generic pending-inbox API row (Fine / Reward / Payment). */
export function mapPendingInboxToRow(item = {}, index = 0) {
    const row = baseRow(item, index);
    const type = String(item.requestType || item.type || '').trim();
    row.title = sanitizeNotificationText(
        buildUnderstandableNotificationTitle(item) || type || row.title,
    );
    row.category = buildUtilityCategoryLine(item) || row.category;
    return row;
}

/** Asset pending-inbox API row. */
export function mapAssetPendingInboxToRow(item = {}, index = 0) {
    const row = baseRow(item, index);
    const type = String(item.requestType || item.type || '').trim();
    row.title = sanitizeNotificationText(
        buildUnderstandableNotificationTitle(item) || type || row.title,
    );
    row.category = buildUtilityCategoryLine(item) || row.category;
    if (item.asset?.name) row.entityName = String(item.asset.name).trim();
    if (item.asset?.assetId) row.entityId = String(item.asset.assetId).trim();
    return row;
}
