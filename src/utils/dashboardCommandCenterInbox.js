import {
    dedupeAssetPendingInboxItems,
    countVisibleAssetPendingInbox,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { isPendingInboxRowVisible } from '@/app/HRM/Asset/utils/assetRequestLabels';
import { countVisibleFinePendingInbox } from '@/app/HRM/Fine/utils/finePendingInboxCount';
import { countVisiblePaymentPendingInbox } from '@/app/Accounts/Payments/utils/paymentPendingInboxCount';
import { countVisibleRewardPendingInbox } from '@/app/HRM/Reward/utils/rewardPendingInboxCount';
import { filterActionableDashboardItems } from '@/utils/activationNotificationFilters';
import { buildCompanyPageNotifications } from '@/utils/companyPageNotifications';
import { buildEmployeePageNotifications } from '@/utils/employeePageNotifications';
import {
    CARD_DELETED_PROGRESS_TYPE,
    includesCardDeletedNotificationType,
} from '@/utils/cardDeletedNotifications';
import { COMPANY_ACTIVATION_INCOMPLETE_TYPE } from '@/utils/companyActivationIncompleteNotifications';
import { PROFILE_INCOMPLETE_TYPE } from '@/utils/employeeProfileIncompleteNotifications';

/** Types owned by Fine / Payment / Asset / Reward pending-inbox APIs (same as sidebar bells). */
export const FINE_MODULE_TYPES = new Set(['Fine', 'Group Fine Request']);
export const PAYMENT_MODULE_TYPES = new Set(['Payment Approval']);
export const REWARD_MODULE_TYPES = new Set(['Reward']);
export const LOAN_MODULE_TYPES = new Set(['Loan', 'Loan Request', 'Advance', 'Loan and Advance']);

export const VEHICLE_MODULE_TYPES = new Set([
    'Vehicle Service Request',
    'Vehicle Profile Activation',
    'Vehicle Profile Edit',
    'Vehicle Inspection',
    'Vehicle Mortgage Close',
    'Vehicle Disposition Request',
    'Vehicle Document Expiry Reminder',
]);

export const ASSET_MODULE_TYPES = new Set([
    'Asset',
    'Asset Approval',
    'Asset Assignment',
    'Asset Transfer',
    'Asset Loss Damage',
    'Asset End of Life',
    'Asset Accessory',
    'Asset Accessory Approval',
    'Asset Accessory Unattach',
    'Asset Return',
    'Asset Leave',
    'Asset Owner On Duty',
    'Asset On Duty Request',
    'Asset Bulk Action',
    'Asset Overdue',
]);

/** Company page bell types — Card Deleted Progress is excluded from Command Center / sidebar. */
export const COMPANY_MODULE_TYPES = new Set([
    'Company Activation',
    COMPANY_ACTIVATION_INCOMPLETE_TYPE,
    'Document Expiry Reminder',
    'Company Document Not Renew',
]);

export const EMPLOYEE_MODULE_TYPES = new Set([
    'Profile Activation',
    PROFILE_INCOMPLETE_TYPE,
    'Employee Document Expiry Reminder',
    'Probation Change',
    'Employee Document Not Renew',
    'Notice Request',
]);

/** Sidebar module order for Command Center sections. */
export const SIDEBAR_MODULE_CATEGORY_ORDER = [
    'Company',
    'Employees',
    'Fine',
    'Loan and Advance',
    'Reward',
    'Vehicle Asset',
    'Tools Asset',
    'Payments',
    'Other',
];

/** Types replaced by Fine / Payment / Asset / Reward pending-inbox APIs (not expiry reminders). */
const MODULE_PENDING_INBOX_TYPES = new Set([
    ...FINE_MODULE_TYPES,
    ...PAYMENT_MODULE_TYPES,
    ...REWARD_MODULE_TYPES,
    'Vehicle Service Request',
    'Vehicle Profile Activation',
    'Vehicle Profile Edit',
    'Vehicle Inspection',
    'Vehicle Mortgage Close',
    'Vehicle Disposition Request',
    ...ASSET_MODULE_TYPES,
]);

/**
 * Convert a module pending-inbox row into the dashboard Command Center item shape
 * so existing routing / table UI keep working.
 */
export function pendingInboxRowToDashboardItem(row, { moduleCategory } = {}) {
    const requestType = String(row?.requestType || '').trim() || 'Request';
    const id =
        row?.reward?.rewardId ||
        row?.reward?._id ||
        row?.primaryFineId ||
        row?.fine?._id ||
        row?.primaryAssetId ||
        row?.asset?._id ||
        row?.requestObjectId ||
        row?.dashboardActionId ||
        '';

    return {
        id: id ? String(id) : String(row?.dashboardActionId || ''),
        actionId: row?.dashboardActionId ? String(row.dashboardActionId) : '',
        type: requestType,
        requestedBy: row?.requestedByName || row?.subjectName || 'Unknown',
        employeeName: row?.subjectName || row?.reward?.employeeName || '',
        requestedDate: row?.requestedDate,
        actionedDate: null,
        status: 'Pending',
        extra1: row?.extra1 || '',
        extra2: row?.extra2 || '',
        extra3: row?.extra3 || '',
        subjectName: row?.subjectName || '',
        scope: 'inbox',
        requestType,
        dashboardActionId: row?.dashboardActionId,
        primaryFineId: row?.primaryFineId || row?.requestObjectId,
        primaryAssetId: row?.primaryAssetId || row?.requestObjectId,
        requestObjectId: row?.requestObjectId,
        fine: row?.fine || null,
        asset: row?.asset || null,
        reward: row?.reward || null,
        payment: row?.payment || null,
        isGroup: row?.isGroup === true || requestType === 'Group Fine Request',
        isBulk: row?.isBulk,
        bulkAssetIds: row?.bulkAssetIds,
        bulkKind: row?.bulkKind,
        moduleCategory: moduleCategory || resolveDashboardModuleCategory({ type: requestType }),
        _fromModulePendingInbox: true,
    };
}

function tagModuleCategory(item, moduleCategory) {
    return {
        ...item,
        moduleCategory,
        scope: item?.scope || 'inbox',
        status: item?.status || 'Pending',
        _fromModulePageNotifications: true,
    };
}

export function isCommandCenterHiddenType(type) {
    return includesCardDeletedNotificationType(type) || String(type || '').trim() === CARD_DELETED_PROGRESS_TYPE;
}

/** Map any notification to a sidebar module label. */
export function resolveDashboardModuleCategory(item = {}) {
    if (item?.moduleCategory) return item.moduleCategory;

    const type = String(item?.type || item?.requestType || '').trim();
    const low = type.toLowerCase();

    if (isCommandCenterHiddenType(type)) return null;
    if (FINE_MODULE_TYPES.has(type) || low.includes('fine')) return 'Fine';
    if (PAYMENT_MODULE_TYPES.has(type) || low.includes('payment')) return 'Payments';
    if (REWARD_MODULE_TYPES.has(type) || low.includes('reward')) return 'Reward';
    if (LOAN_MODULE_TYPES.has(type) || low.includes('loan') || low.includes('advance')) {
        return 'Loan and Advance';
    }
    if (VEHICLE_MODULE_TYPES.has(type) || low.startsWith('vehicle')) return 'Vehicle Asset';
    if (ASSET_MODULE_TYPES.has(type) || low.startsWith('asset')) return 'Tools Asset';
    if (COMPANY_MODULE_TYPES.has(type) || low.includes('company') || type === 'Document Expiry Reminder') {
        return 'Company';
    }
    if (
        EMPLOYEE_MODULE_TYPES.has(type) ||
        low.includes('profile') ||
        low.includes('employee') ||
        low.includes('probation') ||
        low.includes('notice')
    ) {
        return 'Employees';
    }
    return 'Other';
}

function notificationDedupeKey(item = {}) {
    return String(
        item?.actionId ||
            item?.dashboardActionId ||
            `${item?.type || ''}:${item?.id || ''}:${item?.extra1 || ''}:${item?.requestedDate || ''}`,
    );
}

function dedupeByActionKey(items = []) {
    const seen = new Set();
    return items.filter((item) => {
        const k = notificationDedupeKey(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

function isCompanyOwnedPendingType(type) {
    const t = String(type || '').trim();
    return COMPANY_MODULE_TYPES.has(t) || isCommandCenterHiddenType(t) || t === 'Document Expiry Reminder';
}

function isEmployeeOwnedPendingType(type) {
    const t = String(type || '').trim();
    if (isCompanyOwnedPendingType(t)) return false;
    return EMPLOYEE_MODULE_TYPES.has(t);
}

/**
 * Exact module notification copies used by Company / Employees page bells +
 * Fine / Reward / Asset / Payment pending-inbox bells.
 * Card Deleted Progress is excluded (not shown on Command Center / sidebar).
 */
export function buildExactModuleNotificationLists({
    userStatsItems = [],
    companiesList = [],
    employeesList = [],
    liveExpiryHrView = false,
    mandatoryCardsHrLive = false,
    fineItems = [],
    paymentItems = [],
    toolsItems = [],
    vehicleItems = [],
    rewardItems = [],
} = {}) {
    const pendingItems = filterActionableDashboardItems(userStatsItems).filter(
        (item) => !isCommandCenterHiddenType(item?.type),
    );

    const companyNotifications = buildCompanyPageNotifications(
        pendingItems,
        companiesList,
        liveExpiryHrView,
        mandatoryCardsHrLive,
    )
        .filter((item) => !isCommandCenterHiddenType(item?.type))
        .map((item) => tagModuleCategory(item, 'Company'));

    const employeeNotifications = buildEmployeePageNotifications(
        pendingItems,
        employeesList,
        liveExpiryHrView,
        mandatoryCardsHrLive,
    )
        .filter((item) => !isCommandCenterHiddenType(item?.type))
        .map((item) => tagModuleCategory(item, 'Employees'));

    const fineRows = Array.isArray(fineItems) ? fineItems : [];
    const paymentRows = Array.isArray(paymentItems) ? paymentItems : [];
    const rewardRows = Array.isArray(rewardItems) ? rewardItems : [];
    const toolsVisible = dedupeAssetPendingInboxItems(toolsItems).filter(isPendingInboxRowVisible);
    const vehicleVisible = dedupeAssetPendingInboxItems(vehicleItems).filter(isPendingInboxRowVisible);

    const fineNotifications = fineRows.map((row) =>
        pendingInboxRowToDashboardItem(row, { moduleCategory: 'Fine' }),
    );
    const paymentNotifications = paymentRows.map((row) =>
        pendingInboxRowToDashboardItem(row, { moduleCategory: 'Payments' }),
    );
    const rewardNotifications = rewardRows.map((row) =>
        pendingInboxRowToDashboardItem(row, { moduleCategory: 'Reward' }),
    );
    const toolsNotifications = toolsVisible.map((row) =>
        pendingInboxRowToDashboardItem(row, { moduleCategory: 'Tools Asset' }),
    );
    const vehicleNotifications = vehicleVisible.map((row) =>
        pendingInboxRowToDashboardItem(row, { moduleCategory: 'Vehicle Asset' }),
    );

    const loanNotifications = pendingItems
        .filter((item) => resolveDashboardModuleCategory(item) === 'Loan and Advance')
        .map((item) => tagModuleCategory(item, 'Loan and Advance'));

    const counts = {
        company: companyNotifications.length,
        employee: employeeNotifications.length,
        fine: countVisibleFinePendingInbox(fineRows),
        reward: countVisibleRewardPendingInbox(rewardRows),
        payment: countVisiblePaymentPendingInbox(paymentRows),
        toolsAsset: countVisibleAssetPendingInbox(toolsItems),
        vehicleAsset: countVisibleAssetPendingInbox(vehicleItems),
        loan: loanNotifications.length,
    };

    counts.asset = (counts.toolsAsset || 0) + (counts.vehicleAsset || 0);
    counts.hrm =
        (counts.company || 0) +
        (counts.employee || 0) +
        (counts.fine || 0) +
        (counts.reward || 0) +
        (counts.toolsAsset || 0) +
        (counts.vehicleAsset || 0) +
        (counts.loan || 0);

    const hrmPendingItems = dedupeByActionKey([
        ...companyNotifications,
        ...employeeNotifications,
        ...fineNotifications,
        ...loanNotifications,
        ...rewardNotifications,
        ...toolsNotifications,
        ...vehicleNotifications,
    ]);

    const allPendingItems = dedupeByActionKey([
        ...hrmPendingItems,
        ...paymentNotifications,
    ]);

    return {
        companyNotifications,
        employeeNotifications,
        fineNotifications,
        loanNotifications,
        rewardNotifications,
        paymentNotifications,
        toolsNotifications,
        vehicleNotifications,
        counts,
        hrmPendingItems,
        allPendingItems,
    };
}

/**
 * Replace module-owned pending rows from user-stats with the exact same
 * notification lists used by sidebar + module page bells.
 */
export function mergeCommandCenterWithModuleInboxes(
    userStatsItems = [],
    {
        fineItems = [],
        paymentItems = [],
        toolsItems = [],
        vehicleItems = [],
        rewardItems = [],
        companiesList = [],
        employeesList = [],
        liveExpiryHrView = false,
        mandatoryCardsHrLive = false,
    } = {},
) {
    const base = Array.isArray(userStatsItems) ? userStatsItems : [];
    const exact = buildExactModuleNotificationLists({
        userStatsItems: base,
        companiesList,
        employeesList,
        liveExpiryHrView,
        mandatoryCardsHrLive,
        fineItems,
        paymentItems,
        toolsItems,
        vehicleItems,
        rewardItems,
    });

    const kept = base.filter((item) => {
        if (item?._fromModulePendingInbox || item?._fromModulePageNotifications) return false;
        if (isCommandCenterHiddenType(item?.type)) return false;
        if (item?.scope === 'outgoing') return true;

        const type = String(item?.type || '').trim();
        const actionable = filterActionableDashboardItems([item]).length > 0;
        if (!actionable) return true;

        if (isCompanyOwnedPendingType(type)) return false;
        if (isEmployeeOwnedPendingType(type)) return false;
        if (MODULE_PENDING_INBOX_TYPES.has(type)) return false;
        if (resolveDashboardModuleCategory(item) === 'Loan and Advance') return false;
        // Keep Vehicle Asset section = exact vehicle pending-inbox (sidebar badge), not stats-only expiry.
        if (type === 'Vehicle Document Expiry Reminder') return false;
        return true;
    });

    // Module bell copies first so Company / Employees / Tools are never pushed out of view.
    return dedupeByActionKey([
        ...exact.companyNotifications,
        ...exact.employeeNotifications,
        ...exact.fineNotifications,
        ...exact.loanNotifications,
        ...exact.rewardNotifications,
        ...exact.toolsNotifications,
        ...exact.vehicleNotifications,
        ...exact.paymentNotifications,
        ...kept,
    ]).filter((item) => !isCommandCenterHiddenType(item?.type));
}

/** Module badge counts — same helpers / lists as Sidebar + Command Center. */
export function countModulePendingInboxBundles({
    fineItems = [],
    paymentItems = [],
    toolsItems = [],
    vehicleItems = [],
    rewardItems = [],
    userStatsItems = [],
    companiesList = [],
    employeesList = [],
    liveExpiryHrView = false,
    mandatoryCardsHrLive = false,
} = {}) {
    return buildExactModuleNotificationLists({
        userStatsItems,
        companiesList,
        employeesList,
        liveExpiryHrView,
        mandatoryCardsHrLive,
        fineItems,
        paymentItems,
        toolsItems,
        vehicleItems,
        rewardItems,
    }).counts;
}

/** Group Command Center rows by sidebar module (Company, Employees, Fine, …). */
export function groupCommandCenterByModule(items = []) {
    const groups = new Map();
    for (const item of items) {
        if (isCommandCenterHiddenType(item?.type)) continue;
        const category = resolveDashboardModuleCategory(item);
        if (!category) continue;
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category).push(item);
    }

    return SIDEBAR_MODULE_CATEGORY_ORDER.filter((key) => groups.has(key) && groups.get(key).length > 0).map(
        (key) => ({
            category: key,
            items: groups.get(key),
        }),
    );
}

/** Friendly subtype label under a module category heading (row detail). */
export function formatCommandCenterSubtype(item = {}) {
    const type = String(item?.type || '').trim();
    if (!type) return '';
    if (type === 'Employee Document Expiry Reminder') return 'Document Expiry Reminder';
    if (type === 'Document Expiry Reminder') return 'Document Expiry Reminder';
    if (type === 'Asset Overdue') return 'Service overdue';
    if (type === 'Group Fine Request') return 'Group Fine';
    if (type === 'Fine') return 'Fine Request';
    if (type === 'Reward') return 'Reward Request';
    if (type === 'Payment Approval') return 'Payment Approval';
    if (type.startsWith('Asset ')) {
        return type.replace(/^Asset\s+/, '').replace('Loss Damage', 'Loss & Damage');
    }
    if (type.startsWith('Vehicle ')) {
        return type.replace(/^Vehicle\s+/, '');
    }
    return type;
}
