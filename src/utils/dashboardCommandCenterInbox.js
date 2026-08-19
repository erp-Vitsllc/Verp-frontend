/**
 * Command Center presentation helpers.
 * Notification data itself comes from `@/utils/moduleNotifications` (shared with page bells).
 */

import {
    buildModuleNotificationBundle,
    mergeUserStatsWithModuleBundle,
    MODULE_ORDER,
} from '@/utils/moduleNotifications';
import { isCardDeletedNotificationHiddenType } from '@/utils/cardDeletedNotifications';
import { COMPANY_ACTIVATION_INCOMPLETE_TYPE } from '@/utils/companyActivationIncompleteNotifications';
import { EMPLOYEE_NOTIFICATION_TYPES } from '@/utils/employeePageNotifications';
import { mapDashboardNotificationToRow } from '@/utils/notificationInboxPresentation';
import { shortenUrlsForDisplay } from '@/utils/shortenUrlsForDisplay';
import {
    isUtilityBillInboxRow,
    isVehicleAssetInboxRow,
} from '@/utils/assetInboxScope';
import { isDashboardPendingItem } from '@/utils/activationNotificationFilters';

export const FINE_MODULE_TYPES = new Set(['Fine', 'Group Fine Request', 'Employee Fine Request']);
export const PAYMENT_MODULE_TYPES = new Set(['Payment Approval']);
export const REWARD_MODULE_TYPES = new Set(['Reward']);
export const LOAN_MODULE_TYPES = new Set(['Loan', 'Loan Request', 'Advance', 'Loan and Advance', 'Loan/Advance', 'Employee Advance Request', 'Employee Loan Request']);

export const VEHICLE_MODULE_TYPES = new Set([
    'Vehicle Service Request',
    'Vehicle Profile Activation',
    'Vehicle Profile Edit',
    'Vehicle Profile Incomplete',
    'Vehicle Inspection',
    'Vehicle Assignment Photo Review',
    'Vehicle Mortgage Close',
    'Vehicle Disposition Request',
    'Vehicle Document Expiry Reminder',
    'Employee Vehicle Request',
]);

export const UTILITY_BILL_MODULE_TYPES = new Set([
    'Utility Bill Payment',
    'Utility Bill Payment Reminder',
    'Utility Contract Expiry',
    'Utility Entry Status Change',
    'Employee Utility Request',
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
    'Employee Asset Request',
]);

export const COMPANY_MODULE_TYPES = new Set([
    'Company Activation',
    COMPANY_ACTIVATION_INCOMPLETE_TYPE,
    'Document Expiry Reminder',
    'Company Document Not Renew',
]);

export const EMPLOYEE_MODULE_TYPES = new Set([...EMPLOYEE_NOTIFICATION_TYPES]);

export const SIDEBAR_MODULE_CATEGORY_ORDER = [...MODULE_ORDER, 'Other'];

export function isCommandCenterHiddenType(typeOrItem) {
    const type =
        typeof typeOrItem === 'string'
            ? typeOrItem
            : String(typeOrItem?.type || typeOrItem?.requestType || '').trim();
    if (isCardDeletedNotificationHiddenType(type)) return true;
    // Utility contract expiry bells are disabled — other expiry types stay.
    if (type === 'Utility Contract Expiry') return true;
    // Flowchart responsibility acceptance lives on Settings → FlowChart, not Command Center.
    return type === 'Responsibility Approval';
}

export function resolveDashboardModuleCategory(item = {}) {
    if (item?.moduleCategory) return item.moduleCategory;

    const type = String(item?.type || item?.requestType || '').trim();
    const low = type.toLowerCase();

    if (isCardDeletedNotificationHiddenType(type)) return 'Other';

    if (type === 'Employee Leave Request' || type === 'Attendance Leave Request') return 'Attendance';

    // Exact types first so Document Expiry never fuzzy-matches into Loan / other modules.
    if (FINE_MODULE_TYPES.has(type)) return 'Fine';
    if (PAYMENT_MODULE_TYPES.has(type)) return 'Payments';
    if (REWARD_MODULE_TYPES.has(type)) return 'Reward';
    if (LOAN_MODULE_TYPES.has(type)) return 'Loan and Advance';
    if (UTILITY_BILL_MODULE_TYPES.has(type)) return 'Utility Bills';
    if (VEHICLE_MODULE_TYPES.has(type)) return 'Vehicle Asset';
    if (type === 'Employee Asset Request') {
        if (isUtilityBillInboxRow(item)) return 'Utility Bills';
        return isVehicleAssetInboxRow(item) ? 'Vehicle Asset' : 'Tools Asset';
    }
    // Fleet shared Asset Approval / Assignment / Return → Vehicle; equipment → Tools.
    if (
        type === 'Asset Approval' ||
        type === 'Asset Assignment' ||
        type === 'Asset Return'
    ) {
        return isVehicleAssetInboxRow(item) ? 'Vehicle Asset' : 'Tools Asset';
    }
    if (ASSET_MODULE_TYPES.has(type)) return 'Tools Asset';
    if (COMPANY_MODULE_TYPES.has(type) || type === 'Document Expiry Reminder') return 'Company';
    if (EMPLOYEE_MODULE_TYPES.has(type)) return 'Employees';

    if (low.includes('fine')) return 'Fine';
    if (low.includes('utility bill')) return 'Utility Bills';
    if (low.includes('payment')) return 'Payments';
    if (low.includes('reward')) return 'Reward';
    if (low.includes('loan') || low === 'advance' || low.startsWith('advance ')) {
        return 'Loan and Advance';
    }
    if (low.startsWith('vehicle')) return 'Vehicle Asset';
    if (low.startsWith('asset')) {
        return isVehicleAssetInboxRow(item) ? 'Vehicle Asset' : 'Tools Asset';
    }
    if (low.includes('company')) return 'Company';
    if (
        low.includes('profile') ||
        low.includes('employee') ||
        low.includes('probation')
    ) {
        return 'Employees';
    }
    return 'Other';
}

/** @deprecated use buildModuleNotificationBundle from moduleNotifications */
export function buildExactModuleNotificationLists(args = {}) {
    const bundle = buildModuleNotificationBundle({
        userStatsItems: args.userStatsItems,
        companiesList: args.companiesList,
        employeesList: args.employeesList,
        toolsItems: args.toolsItems,
        vehicleItems: args.vehicleItems,
        fineItems: args.fineItems,
        paymentItems: args.paymentItems,
        rewardItems: args.rewardItems,
        loanItems: args.loanItems,
        liveExpiryHrView: args.liveExpiryHrView,
        mandatoryCardsHrLive: args.mandatoryCardsHrLive,
        statsData: args.statsMeta
            ? { ...(args.statsMeta || {}), items: args.userStatsItems }
            : { items: args.userStatsItems, flowchartHrEmployeeObjectId: args.statsMeta?.flowchartHrEmployeeObjectId },
    });

    return {
        companyNotifications: bundle.byModule.Company || [],
        employeeNotifications: bundle.byModule.Employees || [],
        fineNotifications: bundle.byModule.Fine || [],
        loanNotifications: bundle.byModule['Loan and Advance'] || [],
        rewardNotifications: bundle.byModule.Reward || [],
        paymentNotifications: bundle.byModule.Payments || [],
        toolsNotifications: bundle.byModule['Tools Asset'] || [],
        vehicleNotifications: bundle.byModule['Vehicle Asset'] || [],
        utilityBillNotifications: bundle.byModule['Utility Bills'] || [],
        counts: bundle.counts,
        hrmPendingItems: bundle.all.filter((i) => i.moduleCategory !== 'Payments'),
        allPendingItems: bundle.all,
    };
}

/** Dashboard merge — copy exact module-bell lists into Command Center. */
export function mergeCommandCenterWithModuleInboxes(userStatsItems = [], feeds = {}) {
    const bundle = buildModuleNotificationBundle({
        userStatsItems,
        companiesList: feeds.companiesList,
        employeesList: feeds.employeesList,
        toolsItems: feeds.toolsItems,
        vehicleItems: feeds.vehicleItems,
        fineItems: feeds.fineItems,
        paymentItems: feeds.paymentItems,
        rewardItems: feeds.rewardItems,
        loanItems: feeds.loanItems,
        liveExpiryHrView: feeds.liveExpiryHrView,
        mandatoryCardsHrLive: feeds.mandatoryCardsHrLive,
        statsData: feeds.statsMeta
            ? { ...feeds.statsMeta, items: userStatsItems }
            : { items: userStatsItems, flowchartHrEmployeeObjectId: feeds.statsMeta?.flowchartHrEmployeeObjectId },
    });
    return mergeUserStatsWithModuleBundle(userStatsItems, bundle);
}

export function countModulePendingInboxBundles(args = {}) {
    return buildExactModuleNotificationLists(args).counts;
}

export function groupCommandCenterByModule(items = []) {
    const groups = new Map();
    for (const item of items) {
        if (isCommandCenterHiddenType(item)) continue;
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

const PENDING_ACTIVITY_TYPE_ORDER = [
    'Fine',
    'Loan',
    'Advance',
    'Reward',
    'Attendance',
    'Employees',
    'Company',
    'Vehicle Asset',
    'Tools Asset',
    'Utility Bills',
    'Payments',
    'Other',
];

const PENDING_ACTIVITY_TYPE_COLORS = {
    Fine: '#ef4444',
    Loan: '#3b82f6',
    Advance: '#8b5cf6',
    Reward: '#f97316',
    Attendance: '#eab308',
    Employees: '#6366f1',
    Company: '#0ea5e9',
    'Vehicle Asset': '#14b8a6',
    'Tools Asset': '#64748b',
    'Utility Bills': '#06b6d4',
    Payments: '#10b981',
    Other: '#94a3b8',
};

const PENDING_ACTIVITY_FALLBACK_COLORS = ['#f59e0b', '#ec4899', '#84cc16', '#a855f7'];

/** Split Loan vs Advance for the home Request Activity chart; other types follow module category. */
export function resolvePendingActivityType(item = {}) {
    const raw = String(item?.type || item?.requestType || '').trim();
    const low = raw.toLowerCase();
    if (low === 'advance' || (low.includes('advance') && !low.includes('loan'))) return 'Advance';
    if (LOAN_MODULE_TYPES.has(raw) || low.includes('loan')) return 'Loan';
    return resolveDashboardModuleCategory(item) || 'Other';
}

export function pendingActivityTypeLegendLabel(label) {
    const map = {
        'Vehicle Asset': 'Vehicle',
        'Tools Asset': 'Tools',
        'Utility Bills': 'Utility',
        Employees: 'Employee',
        Payments: 'Payment',
    };
    return map[label] || label;
}

/** Pending inbox items only, grouped by request type (Fine, Loan, Advance, …). */
export function computePendingActivityByType(items = []) {
    const pending = (Array.isArray(items) ? items : []).filter(
        (item) => isDashboardPendingItem(item) && !isCommandCenterHiddenType(item),
    );
    const counts = new Map();
    for (const item of pending) {
        const label = resolvePendingActivityType(item);
        counts.set(label, (counts.get(label) || 0) + 1);
    }
    const labels = [...counts.keys()].sort((a, b) => {
        const ia = PENDING_ACTIVITY_TYPE_ORDER.indexOf(a);
        const ib = PENDING_ACTIVITY_TYPE_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    let fallbackIdx = 0;
    const segments = labels.map((label) => ({
        label,
        count: counts.get(label) || 0,
        color:
            PENDING_ACTIVITY_TYPE_COLORS[label] ||
            PENDING_ACTIVITY_FALLBACK_COLORS[fallbackIdx++ % PENDING_ACTIVITY_FALLBACK_COLORS.length],
    }));
    return { total: pending.length, segments };
}

export function formatCommandCenterSubtype(item = {}) {
    const type = String(item?.type || '').trim();
    if (!type) return '';
    // Distinct labels so Company / Employees / Vehicle expiry does not look "cloned".
    if (type === 'Employee Leave Request') return 'Leave request';
    if (type === 'Employee Fine Request') return 'Fine request';
    if (type === 'Employee Advance Request') return 'Advance request';
    if (type === 'Employee Loan Request') return 'Loan request';
    if (type === 'Employee Salary Request') return 'Early salary request';
    if (type === 'Employee Certificate Request') return 'Salary certificate request';
    if (type === 'Employee Asset Request') {
        if (isUtilityBillInboxRow(item)) return 'Utility bill request';
        if (isVehicleAssetInboxRow(item)) return 'Vehicle request';
        return 'Tools request';
    }
    if (type === 'Employee Vehicle Request') return 'Vehicle request';
    if (type === 'Employee Utility Request') return 'Utility bill request';
    if (type === 'Employee Document Expiry Reminder') return 'Employee Document Expiry';
    if (type === 'Document Expiry Reminder') return 'Company Document Expiry';
    if (type === 'Vehicle Document Expiry Reminder') return 'Vehicle Document Expiry';
    if (type === 'Asset Overdue') return 'Service overdue';
    if (type === 'Group Fine Request') return 'Group Fine';
    if (type === 'Fine') return 'Fine Request';
    if (type === 'Reward') return 'Reward Request';
    if (type === 'Payment Approval') return 'Payment Approval';
    if (type === 'Utility Bill Payment') return 'Utility Bill Payment — Review / Pay';
    if (type === 'Utility Bill Payment Reminder') return 'Utility Payment Day — Clear Bill';
    if (type === 'Utility Contract Expiry') return 'Utility Contract Expiry — Renew / Deactivate';
    if (type === 'Utility Entry Status Change') return 'Utility Activate / Deactivate';
    if (type === 'Loan' || type === 'Loan/Advance') return 'Loan';
    if (type === 'Advance') return 'Advance';
    if (type === 'Card Deleted Progress') return 'Card deleted';
    if (type.startsWith('Asset ')) {
        return type.replace(/^Asset\s+/, '').replace('Loss Damage', 'Loss & Damage');
    }
    if (type.startsWith('Vehicle ')) {
        return type.replace(/^Vehicle\s+/, '');
    }
    return type;
}

/**
 * Same message body the notification inbox shows (title + secondary line).
 * Used by Command Center + home Pending Approvals so dashboard text matches the bell.
 */
export function formatCommandCenterNotificationMessage(item = {}) {
    const row = mapDashboardNotificationToRow(item);
    const subtype = formatCommandCenterSubtype(item);
    const title = String(row?.title || subtype || item?.type || 'Request').trim();

    const detailParts = [];
    if (row?.category && row.category !== title && row.category !== 'Pending task') {
        detailParts.push(row.category);
    }
    if (row?.highlight) detailParts.push(row.highlight);
    if (row?.entityName) {
        detailParts.push(row.entityId ? `${row.entityName} (${row.entityId})` : row.entityName);
    }

    let detail = detailParts.filter(Boolean).join(' · ');
    if (!detail && item?.extra1) {
        const raw = shortenUrlsForDisplay(String(item.extra1));
        if (raw && raw !== title) detail = raw;
    }

    // Prefer the rich notification title over the generic subtype chip when they differ.
    const chip = subtype && subtype !== title ? subtype : '';

    return { title, detail, chip, source: row?.source || item?.requestedBy || '' };
}
