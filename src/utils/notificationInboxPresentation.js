import { formatCompanyActivationIncompleteDisplay } from '@/utils/companyActivationIncompleteNotifications';
import { formatEmployeeProfileIncompleteDisplay } from '@/utils/employeeProfileIncompleteNotifications';
import { formatEmployeeProfileActivationDisplay, resolveEmployeeProfileNotificationEntity } from '@/utils/employeeProfileNotificationMessages';
import { formatExpiryNotificationDisplay } from '@/utils/expiryNotificationFallbacks';
import { myRequestNotificationSecondaryText } from '@/utils/dashboardNotificationRouting';
import { getNotificationSortTime } from '@/utils/notificationSortOrder';
import { formatAssetDashboardRequestType } from '@/app/HRM/Asset/utils/assetRequestLabels';

export function parseEntityFromExtra2(extra2) {
    const raw = String(extra2 || '').trim();
    if (!raw) return { entityName: null, entityId: null };
    const match = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (!match) return { entityName: raw, entityId: null };
    return { entityName: match[1].trim(), entityId: match[2].trim() };
}

function dashboardNotificationTitle(item) {
    const type = String(item?.type || '').trim();
    if (type === 'Employee Document Expiry Reminder' || type === 'Document Expiry Reminder') {
        const expiry = formatExpiryNotificationDisplay(item);
        if (expiry?.headline) return expiry.headline;
        return 'Document Expiry Reminder';
    }
    if (type === 'Probation Change') return 'Probation Change';
    if (type === 'Card Deleted Progress') return 'Card Deleted Progress';
    if (type === 'Profile Incomplete') return 'Profile Incomplete';
    if (type === 'Company Activation Incomplete') return 'Company Activation Incomplete';
    return type || 'Request';
}

function dashboardNotificationCategory(item) {
    const type = String(item?.type || '').trim();
    if (type.includes('Expiry')) return 'Document expiry reminder';
    if (type === 'Card Deleted Progress') return 'Profile progress update';
    if (type === 'Profile Activation' || type === 'Company Activation') return 'Activation request';
    if (type === 'Profile Incomplete' || type === 'Company Activation Incomplete') {
        return 'Activation follow-up';
    }
    if (type === 'Probation Change') return 'Probation workflow';
    const secondary = myRequestNotificationSecondaryText(item);
    return secondary || 'Pending task';
}

function expiryIconVariantFromText(...parts) {
    const label = parts.filter(Boolean).join(' ').toLowerCase();
    if (
        label.includes('visit visa') ||
        label.includes('employment visa') ||
        label.includes('spouse visa') ||
        /\bvisa\b/.test(label)
    ) {
        return 'expiry-plane';
    }
    if (label.includes('passport')) return 'expiry-idcard';
    if (label.includes('emirates') || label.includes('eid') || label.includes('labour card')) {
        return 'expiry-idcard-teal';
    }
    if (label.includes('driving') || label.includes('license') || label.includes('licence')) {
        return 'expiry-idcard-amber';
    }
    if (label.includes('medical') || label.includes('insurance')) return 'expiry-book-violet';
    return 'expiry-book-warm';
}

function dashboardIconVariant(item) {
    const type = String(item?.type || '').trim();
    const context = [
        item?.extra1,
        item?.extra2,
        dashboardNotificationTitle(item),
    ].join(' ');

    if (type === 'Card Deleted Progress') return 'progress-check';
    if (type === 'Employee Document Not Renew' || type === 'Company Document Not Renew') {
        const docVariant = expiryIconVariantFromText(context);
        if (docVariant === 'expiry-plane') return 'renew-plane';
        if (docVariant.startsWith('expiry-idcard')) return 'renew-idcard';
        return 'renew-book';
    }
    if (type.includes('Expiry')) return expiryIconVariantFromText(context);
    if (type === 'Company Activation' || type === 'Vehicle Profile Activation') return 'activation-company';
    if (type === 'Profile Activation') return 'activation-profile';
    if (type === 'Company Activation Incomplete' || type === 'Profile Incomplete') {
        return 'incomplete-settings';
    }
    if (type === 'Probation Change') return 'probation-settings';
    if (type.includes('Activation')) return 'activation-profile';
    return 'default-bell';
}

function assetIconVariant(row) {
    const requestType = String(row?.requestType || '').trim();

    switch (requestType) {
        case 'Asset Leave':
            return 'asset-clock';
        case 'Asset Overdue':
            return 'asset-settings-urgent';
        case 'Asset Owner On Duty':
            return 'asset-badge-duty';
        case 'Asset On Duty Request':
            return 'asset-badge-request';
        case 'Asset Assignment':
            return 'asset-badge-assign';
        case 'Asset Approval':
            return 'asset-badge-approve';
        case 'Asset Transfer':
            return 'asset-plane';
        case 'Asset Loss Damage':
            return 'asset-book-loss';
        case 'Asset End of Life':
            return 'asset-clock-eol';
        case 'Asset Return':
            return 'asset-check-return';
        case 'Asset Accessory':
            return 'asset-settings-accessory';
        case 'Asset Accessory Approval':
            return 'asset-badge-accessory';
        case 'Asset Accessory Unattach':
            return 'asset-settings-unattach';
        case 'Vehicle Service Request':
            return 'asset-settings-service';
        case 'Vehicle Profile Activation':
        case 'Vehicle Profile Edit':
        case 'Vehicle Inspection':
        case 'Vehicle Mortgage Close':
            return 'asset-badge-vehicle';
        case 'Asset Bulk Action':
            return 'asset-settings-bulk';
        case 'Asset':
            return 'asset-settings';
        default:
            break;
    }

    const category = formatAssetDashboardRequestType(row?.requestType, row).toLowerCase();
    if (row?.isBulk && row?.bulkAssetIds?.length > 1) return 'asset-settings-bulk';
    if (category.includes('leave')) return 'asset-clock';
    if (category.includes('overdue')) return 'asset-settings-urgent';
    if (category.includes('loss') || category.includes('damage')) return 'asset-book-loss';
    if (category.includes('assignment')) return 'asset-badge-assign';
    if (category.includes('transfer')) return 'asset-plane';
    if (category.includes('return')) return 'asset-check-return';
    if (category.includes('service')) return 'asset-settings-service';
    return 'asset-settings';
}

function pendingInboxIconVariant(row) {
    const requestType = String(row?.requestType || '').trim();
    if (requestType === 'Payment Approval') return 'payment-card';
    if (requestType === 'Group Fine Request') return 'fine-group';
    if (requestType.includes('Fine')) return 'fine-book';
    if (requestType === 'Reward') return 'reward-award';
    return assetIconVariant(row);
}

function extractHighlightFromExtra1(extra1 = '') {
    const match = String(extra1 || '').match(/\(Exp:\s*([^)]+)\)/i);
    return match ? match[1].trim() : null;
}

export function mapDashboardNotificationToRow(item, index = 0) {
    const expiry = formatExpiryNotificationDisplay(item);
    const profileActivation = formatEmployeeProfileActivationDisplay(item);
    const profileIncomplete = formatEmployeeProfileIncompleteDisplay(item);
    const companyIncomplete = formatCompanyActivationIncompleteDisplay(item);
    const entity = parseEntityFromExtra2(item?.extra2);
    const profileEntity = resolveEmployeeProfileNotificationEntity(item);
    const isProfileEmployeeNotice =
        String(item?.type || '').trim() === 'Profile Activation' ||
        String(item?.type || '').trim() === 'Profile Incomplete';

    let title = dashboardNotificationTitle(item);
    let category = dashboardNotificationCategory(item);
    let highlight = extractHighlightFromExtra1(item?.extra1);
    if (!highlight && expiry?.detail) {
        const expMatch = expiry.detail.match(/Exp:\s*([^•]+)/i);
        highlight = expMatch ? expMatch[1].trim() : null;
    }
    if (!highlight && companyIncomplete?.headline) highlight = companyIncomplete.headline;

    if (profileActivation?.headline) {
        title = profileActivation.headline;
        highlight = null;
        category = String(item?.status || 'Pending') === 'Pending' ? 'Action required' : `Status: ${item.status}`;
    } else if (profileIncomplete?.headline) {
        title = profileIncomplete.headline;
        highlight = null;
        category = 'Complete mandatory profile cards';
    }

    const entityName = isProfileEmployeeNotice
        ? profileEntity.employeeName || null
        : entity.entityName;
    const entityId = isProfileEmployeeNotice
        ? profileEntity.employeeId || null
        : entity.entityId;

    return {
        key: `${item?.type || 'item'}-${item?.actionId || item?.id || index}-${item?.extra1 || ''}`,
        title,
        source: item?.requestedBy || item?.subjectName || 'System',
        category,
        highlight,
        entityName,
        entityId,
        status: item?.status || 'Pending',
        requestedDate: item?.requestedDate,
        iconVariant: dashboardIconVariant(item),
        raw: item,
    };
}

function normalizeInboxEntityName(value) {
    const s = String(value || '').trim();
    if (!s || s === 'undefined undefined' || s === 'undefined') return null;
    return s;
}

export function mapAssetPendingInboxToRow(row, index = 0) {
    const asset = row?.asset;
    let title = formatAssetDashboardRequestType(row?.requestType, row);
    if (row?.requestType === 'Asset Owner On Duty') {
        title = `${row.subjectName || 'Parked assets'} — review`;
    } else if (row?.isBulk && row?.bulkAssetIds?.length > 1) {
        title = `Bulk request (${row.bulkAssetIds.length} assets)`;
    } else if (asset?.name) {
        title = asset.name;
    }

    const entityName =
        normalizeInboxEntityName(row?.subjectName) ||
        normalizeInboxEntityName(asset?.name) ||
        null;

    return {
        key: String(row?.dashboardActionId || index),
        title,
        source: row?.requestedByName || 'System',
        category: formatAssetDashboardRequestType(row?.requestType, row) || 'Asset request',
        highlight: null,
        entityName,
        entityId: asset?.assetId || null,
        status: 'Pending',
        requestedDate: row?.requestedDate,
        iconVariant: assetIconVariant(row),
        raw: row,
    };
}

export function mapPendingInboxToRow(row, index = 0) {
    const entityName = row?.subjectName || null;
    const entityId =
        row?.fine?.fineId ||
        row?.payment?.paymentId ||
        row?.asset?.assetId ||
        row?.reward?.rewardId ||
        row?.requestObjectId ||
        null;

    let title = row?.requestType || 'Pending request';
    if (title === 'Group Fine Request') title = 'Group Fine Request';
    if (title === 'Fine') title = 'Fine Request';
    if (title === 'Payment Approval') title = 'Payment Approval';
    if (title === 'Reward') title = 'Reward Request';

    const iconVariant = pendingInboxIconVariant(row);

    return {
        key: String(row?.dashboardActionId || index),
        title,
        source: row?.requestedByName || 'System',
        category: row?.extra1 || 'Approval required',
        highlight: row?.extra2 || null,
        entityName,
        entityId: entityId ? String(entityId) : null,
        status: 'Pending',
        requestedDate: row?.requestedDate,
        iconVariant,
        raw: row,
    };
}

export function groupNotificationsByDate(rows = []) {
    const groups = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    for (const row of rows) {
        const source = row?.raw ?? row;
        const d = new Date(getNotificationSortTime(source));
        const day = new Date(d);
        if (Number.isNaN(day.getTime())) {
            const label = 'OLDER';
            if (!groups.has(label)) groups.set(label, []);
            groups.get(label).push(row);
            continue;
        }
        day.setHours(0, 0, 0, 0);

        let label;
        if (day.getTime() === today.getTime()) {
            label = 'TODAY';
        } else if (day.getTime() === yesterday.getTime()) {
            label = 'YESTERDAY';
        } else {
            label = day
                .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                .toUpperCase();
        }

        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(row);
    }

    return Array.from(groups.entries())
        .map(([label, items]) => ({
            label,
            items,
            sortKey: Math.max(...items.map((row) => getNotificationSortTime(row?.raw ?? row))),
        }))
        .sort((a, b) => b.sortKey - a.sortKey)
        .map(({ label, items }) => ({ label, items }));
}

export function formatNotificationTime(requestedDate, sourceItem = null) {
    const raw = getNotificationDateRaw(requestedDate, sourceItem);
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getNotificationDateRaw(requestedDate, sourceItem = null) {
    return (
        sourceItem?.createdAt ??
        sourceItem?.requestedDate ??
        sourceItem?.requestedAt ??
        requestedDate ??
        null
    );
}

/** Whole calendar days from notification date through today (inclusive of today as 0). */
export function getNotificationPendingDays(requestedDate, sourceItem = null) {
    const raw = getNotificationDateRaw(requestedDate, sourceItem);
    if (!raw) return null;
    const start = new Date(raw);
    if (Number.isNaN(start.getTime())) return null;
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Number.isFinite(days) ? Math.max(0, days) : null;
}

export function formatNotificationPendingSince(requestedDate, sourceItem = null, status = 'Pending') {
    const value = String(status || 'Pending').trim();
    if (value !== 'Pending' && value !== 'On Hold') return '';

    const days = getNotificationPendingDays(requestedDate, sourceItem);
    if (days == null) return '';
    if (days === 0) return 'Pending since today';
    if (days === 1) return 'Pending since 1 day';
    return `Pending since ${days} days`;
}

export function notificationStatusClass(status) {
    const value = String(status || 'Pending').trim();
    if (value === 'Pending') return 'border-slate-800 text-slate-800 bg-white';
    if (value === 'On Hold') return 'border-orange-500 text-orange-700 bg-orange-50';
    if (value === 'Approved') return 'border-emerald-600 text-emerald-700 bg-emerald-50';
    if (value === 'Rejected') return 'border-rose-600 text-rose-700 bg-rose-50';
    return 'border-slate-500 text-slate-600 bg-slate-50';
}
