/**
 * Shared notification / pending-inbox row presentation for bells, Command Center, and modals.
 */

function asDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
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
        case 'Utility Entry Status Change':
            return 'asset-settings-service';
        case 'Vehicle Service Request':
            return 'asset-settings-service';
        case 'Vehicle Profile Activation':
        case 'Vehicle Profile Edit':
        case 'Vehicle Inspection':
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

function baseRow(item = {}, index = 0) {
    const type = String(item.requestType || item.type || '').trim();
    const meta = parseExtra3(item.extra3);
    const key =
        String(item.dashboardActionId || item._id || item.id || item.requestId || index) +
        `:${type}`;
    const requestedDate =
        item.requestedDate || item.createdAt || item.updatedAt || item.actionedDate || null;

    return {
        key,
        title: buildExpiryReminderTitle(item) || type || 'Request',
        source: String(item.requestedByName || item.requestedBy || item.source || '').trim(),
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
        status: String(item.status || 'Pending').trim() || 'Pending',
        requestedDate,
        href: '',
        iconVariant: resolveNotificationIconVariant(type),
        raw: item,
    };
}

/** Dashboard / page-bell notification item → inbox row. */
export function mapDashboardNotificationToRow(item = {}, index = 0) {
    const row = baseRow(item, index);
    const type = String(item.type || item.requestType || '').trim();
    row.title = buildExpiryReminderTitle(item) || type || row.title;
    if (item.extra1) {
        row.category = String(item.extra1).trim() || row.category;
    }
    if (item.extra2 && !row.highlight) {
        const e2 = String(item.extra2).trim();
        if (/exp|expiry|due/i.test(e2)) row.highlight = e2;
        else if (!row.category || row.category === 'Pending task') row.category = e2;
    }
    return row;
}

/** Generic pending-inbox API row (Fine / Reward / Payment). */
export function mapPendingInboxToRow(item = {}, index = 0) {
    const row = baseRow(item, index);
    const type = String(item.requestType || item.type || '').trim();
    row.title = buildExpiryReminderTitle(item) || type || row.title;
    if (item.extra1) row.category = String(item.extra1).trim() || row.category;
    return row;
}

/** Asset pending-inbox API row. */
export function mapAssetPendingInboxToRow(item = {}, index = 0) {
    const row = baseRow(item, index);
    const type = String(item.requestType || item.type || '').trim();
    row.title = buildExpiryReminderTitle(item) || type || row.title;
    if (item.extra1) row.category = String(item.extra1).trim() || row.category;
    if (item.asset?.name) row.entityName = String(item.asset.name).trim();
    if (item.asset?.assetId) row.entityId = String(item.asset.assetId).trim();
    return row;
}
