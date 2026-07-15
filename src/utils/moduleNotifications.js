/**
 * Single source of truth for module notifications.
 *
 * - Company / Employees / Fine / Reward / Vehicle / Tools / Payments / Loan page bells
 * - Sidebar badge counts
 * - Dashboard Command Center
 *
 * All use the same builders so lists and counts match everywhere.
 * Dashboard only aggregates (copies) these module lists into one view.
 */

import {
    dedupeAssetPendingInboxItems,
    countVisibleAssetPendingInbox,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { isPendingInboxRowVisible } from '@/app/HRM/Asset/utils/assetRequestLabels';
import { countVisibleFinePendingInbox } from '@/app/HRM/Fine/utils/finePendingInboxCount';
import { countVisiblePaymentPendingInbox } from '@/app/Accounts/Payments/utils/paymentPendingInboxCount';
import { countVisibleRewardPendingInbox } from '@/app/HRM/Reward/utils/rewardPendingInboxCount';
import { filterActionableDashboardItems } from '@/utils/activationNotificationFilters';
import {
    buildCompanyPageNotifications,
    loadCompanyNotificationBundle,
} from '@/utils/companyPageNotifications';
import { buildEmployeeListBellFromStats, isEmployeeNotificationHiddenType } from '@/utils/employeePageNotifications';
import { includesCardDeletedNotificationType } from '@/utils/cardDeletedNotifications';
import {
    fetchAssetPendingInbox,
    fetchFinePendingInbox,
    fetchPaymentPendingInbox,
    fetchRewardPendingInbox,
} from '@/utils/pendingInboxFetch';
import {
    filterToolsAssetInboxRows,
    filterVehicleAssetInboxRows,
    isToolsAssetInboxRow,
    isUtilityBillInboxRow,
    isVehicleAssetInboxRow,
} from '@/utils/assetInboxScope';
import {
    getViewerEmployeeObjectIdFromStorage,
    isFlowchartHrForExpiryTasks,
} from '@/utils/flowchartHrExpiryVisibility';
import { isAdmin } from '@/utils/permissions';
import { COMPANY_ACTIVATION_INCOMPLETE_TYPE } from '@/utils/companyActivationIncompleteNotifications';

export const MODULE_ORDER = [
    'Company',
    'Employees',
    'Fine',
    'Loan and Advance',
    'Reward',
    'Vehicle Asset',
    'Tools Asset',
    'Utility Bills',
    'Payments',
];

const LOAN_TYPES = new Set(['Loan', 'Loan Request', 'Advance', 'Loan and Advance', 'Loan/Advance']);

function valueOr(settled, idx, fallback) {
    return settled[idx]?.status === 'fulfilled' ? settled[idx].value : fallback;
}

function tagModule(item, moduleCategory) {
    return {
        ...item,
        moduleCategory,
        scope: 'inbox',
        status: item?.status || 'Pending',
        _fromModuleNotifications: true,
        _fromModulePageNotifications: true,
    };
}

function pendingInboxToItem(row, moduleCategory) {
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

    return tagModule(
        {
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
            _fromModulePendingInbox: true,
        },
        moduleCategory,
    );
}

function dedupeKey(item = {}) {
    const base = String(
        item?.actionId ||
            item?.dashboardActionId ||
            `${item?.type || ''}:${item?.id || ''}:${item?.extra1 || ''}:${item?.requestedDate || ''}`,
    );
    // Module-scoped key so Company/Employees/Vehicle twins never delete each other.
    const cat = String(item?.moduleCategory || '').trim();
    return cat ? `${cat}|${base}` : base;
}

function isLoanNotification(item = {}) {
    const type = String(item?.type || item?.requestType || '').trim();
    const low = type.toLowerCase();
    if (LOAN_TYPES.has(type)) return true;
    if (low.includes('loan')) return true;
    // Avoid matching unrelated strings that merely contain "advance" as a substring.
    return low === 'advance' || low.startsWith('advance ');
}

function dedupe(items = []) {
    const seen = new Set();
    return items.filter((item) => {
        const k = dedupeKey(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

function resolveHrFlags(statsData, { asEmployeeObjectId = null } = {}) {
    const flowchartHrId = statsData?.flowchartHrEmployeeObjectId ?? null;
    const sessionViewerId =
        typeof window !== 'undefined' ? getViewerEmployeeObjectIdFromStorage() : null;
    // Team / selectedUser: evaluate as the TARGET employee — never the manager's admin/HR session.
    const viewerId = asEmployeeObjectId || sessionViewerId;
    const allowSessionAdmin = !asEmployeeObjectId;
    const liveExpiryHrView =
        typeof window !== 'undefined' &&
        ((allowSessionAdmin && isAdmin()) || isFlowchartHrForExpiryTasks(flowchartHrId, viewerId));
    const mandatoryCardsHrLive =
        typeof window !== 'undefined' && isFlowchartHrForExpiryTasks(flowchartHrId, viewerId);
    return { liveExpiryHrView, mandatoryCardsHrLive, flowchartHrId, viewerId };
}

/** Same list as Company page notification bell. */
export function buildCompanyListBellFromStats(statsData, companiesList = []) {
    const items = Array.isArray(statsData?.items) ? statsData.items : [];
    const pendingItems = filterActionableDashboardItems(items);
    const { liveExpiryHrView, mandatoryCardsHrLive } = resolveHrFlags(statsData);
    return buildCompanyPageNotifications(
        pendingItems,
        companiesList,
        liveExpiryHrView,
        mandatoryCardsHrLive,
    );
}

/**
 * Load every feed the module bells need (one place for sidebar + dashboard).
 * Cached + deduped so dashboard and sidebar don't stampede the same APIs.
 *
 * Options:
 * - skipEmployees: skip heavy /Employee?limit=500 (fast path; expiry live rows fill later)
 * - statsData: reuse already-fetched user-stats (avoid second user-stats hop via company bundle)
 * - force: bypass cache
 */
const FEEDS_CACHE_TTL_MS = 90 * 1000;
let cachedFeeds = null;
let cachedFeedsAt = 0;
let feedsInFlight = null;

/** Fired whenever shared module feeds/counts refresh — Sidebar + Dashboard stay in sync. */
export const MODULE_NOTIFICATIONS_UPDATED = 'verp:module-notifications-updated';

let cachedBundle = null;

export function getCachedModuleNotificationFeeds() {
    if (cachedFeeds && Date.now() - cachedFeedsAt < FEEDS_CACHE_TTL_MS) return cachedFeeds;
    return null;
}

export function getCachedModuleNotificationBundle() {
    if (!cachedBundle) return null;
    if (!getCachedModuleNotificationFeeds()) return null;
    return cachedBundle;
}

export function clearModuleNotificationFeedsCache() {
    cachedFeeds = null;
    cachedFeedsAt = 0;
    feedsInFlight = null;
    cachedBundle = null;
}

function publishModuleNotificationBundle(feeds, bundle) {
    cachedBundle = bundle || null;
    if (typeof window === 'undefined' || !bundle?.counts) return;
    window.dispatchEvent(
        new CustomEvent(MODULE_NOTIFICATIONS_UPDATED, {
            detail: {
                counts: bundle.counts,
                cacheKey: feeds?._cacheKey || null,
            },
        }),
    );
}

/** Remember + broadcast counts so Sidebar badge matches Dashboard Command Center. */
export function rememberModuleNotificationBundle(feeds, bundle) {
    if (feeds) {
        cachedFeeds = feeds;
        cachedFeedsAt = Date.now();
    }
    publishModuleNotificationBundle(feeds, bundle);
}

export async function loadModuleNotificationFeeds(
    axiosInstance,
    {
        skipExpirySync = true,
        skipEmployees = false,
        statsData: providedStats = null,
        force = false,
        /** When set, load Fine/Asset/Reward/Payment bells for that employee (team Command Center). */
        targetUserId = null,
    } = {},
) {
    const targetKey = targetUserId ? String(targetUserId) : 'self';
    const cacheKey = `${skipEmployees ? 'fast' : 'full'}:${targetKey}`;

    // Never reuse the logged-in user's cached bells for another employee.
    if (!force && !targetUserId) {
        const cached = getCachedModuleNotificationFeeds();
        if (cached && cached._cacheKey === cacheKey) return cached;
        if (cached && cacheKey === 'fast:self' && cached._cacheKey === 'full:self') return cached;
        // Prefer fuller cache when caller asked for fast (self only)
        if (cached && cacheKey.startsWith('fast:') && cached._cacheKey?.startsWith('full:') && !targetUserId) {
            return cached;
        }
    }

    // Targeted team loads should not share the self in-flight promise.
    if (feedsInFlight && !force && !targetUserId) return feedsInFlight;

    const run = (async () => {
        const sessionViewerId =
            typeof window !== 'undefined' ? getViewerEmployeeObjectIdFromStorage() : null;
        const asEmployeeObjectId = targetUserId ? String(targetUserId) : null;
        // Prefer provided target user-stats so flowchart HR id is known before company live sync.
        const earlyFlags = resolveHrFlags(providedStats || {}, {
            asEmployeeObjectId,
        });
        const hrLiveGuess = asEmployeeObjectId
            ? Boolean(earlyFlags.liveExpiryHrView)
            : typeof window !== 'undefined' &&
              (isAdmin() || isFlowchartHrForExpiryTasks(null, sessionViewerId));

        const inboxOpts = targetUserId ? { targetUserId, force: true } : {};

        const requests = [
            fetchAssetPendingInbox(axiosInstance, {
                inboxScope: 'tools',
                skipSync: true,
                skipToast: true,
                ...inboxOpts,
            }),
            fetchAssetPendingInbox(axiosInstance, {
                inboxScope: 'vehicle',
                skipSync: true,
                skipToast: true,
                ...inboxOpts,
            }),
            fetchFinePendingInbox(axiosInstance, { skipToast: true, ...inboxOpts }),
            fetchPaymentPendingInbox(axiosInstance, { skipToast: true, ...inboxOpts }),
            fetchRewardPendingInbox(axiosInstance, { skipToast: true, ...inboxOpts }),
            loadCompanyNotificationBundle(axiosInstance, {
                hrLive: hrLiveGuess,
                cachedCompanies: [],
                skipExpirySync,
            }),
        ];

        if (!skipEmployees) {
            requests.push(
                axiosInstance
                    .get('/Employee', { params: { limit: 500 }, skipToast: true })
                    .catch(() => ({ data: {} })),
            );
        }

        const settled = await Promise.allSettled(requests);

        const toolsItems = valueOr(settled, 0, []);
        const vehicleItems = valueOr(settled, 1, []);
        const fineItems = valueOr(settled, 2, []);
        const paymentItems = valueOr(settled, 3, []);
        const rewardItems = valueOr(settled, 4, []);
        const notificationBundle = valueOr(settled, 5, {
            statsRes: { data: { items: [] } },
            companiesList: [],
        });
        const empRes = skipEmployees ? { data: {} } : valueOr(settled, 6, { data: {} });
        const empPayload = empRes?.data?.employees ?? empRes?.data;

        const statsData = providedStats || notificationBundle?.statsRes?.data || { items: [] };
        const companiesList = Array.isArray(notificationBundle?.companiesList)
            ? notificationBundle.companiesList
            : [];
        const employeesList = Array.isArray(empPayload) ? empPayload : [];

        const hrFlags = resolveHrFlags(statsData, { asEmployeeObjectId });

        const feeds = {
            _cacheKey: skipEmployees && employeesList.length === 0 ? `fast:${targetKey}` : `full:${targetKey}`,
            _targetUserId: targetUserId || null,
            statsData,
            userStatsItems: Array.isArray(statsData.items) ? statsData.items : [],
            companiesList,
            employeesList,
            toolsItems: Array.isArray(toolsItems) ? toolsItems : [],
            vehicleItems: Array.isArray(vehicleItems) ? vehicleItems : [],
            fineItems: Array.isArray(fineItems) ? fineItems : [],
            paymentItems: Array.isArray(paymentItems) ? paymentItems : [],
            rewardItems: Array.isArray(rewardItems) ? rewardItems : [],
            ...hrFlags,
        };

        // Only cache / publish for the logged-in user's own bells (sidebar).
        if (!targetUserId) {
            cachedFeeds = feeds;
            cachedFeedsAt = Date.now();
        }
        return feeds;
    })().finally(() => {
        if (!targetUserId) feedsInFlight = null;
    });

    if (!targetUserId) feedsInFlight = run;
    return run;
}

/**
 * Build every module’s notification list with the same rules as each page bell.
 * Dashboard copies these lists; sidebar counts `.counts`.
 */
export function buildModuleNotificationBundle(feeds = {}) {
    const {
        statsData = null,
        userStatsItems = [],
        companiesList = [],
        employeesList = [],
        toolsItems = [],
        vehicleItems = [],
        fineItems = [],
        paymentItems = [],
        rewardItems = [],
        liveExpiryHrView: liveFlag,
        mandatoryCardsHrLive: mandatoryFlag,
    } = feeds;

    const flags = statsData
        ? resolveHrFlags(statsData, {
              asEmployeeObjectId: feeds._targetUserId || null,
          })
        : {};
    const liveExpiryHrView = liveFlag ?? flags.liveExpiryHrView ?? false;
    const mandatoryCardsHrLive = mandatoryFlag ?? flags.mandatoryCardsHrLive ?? false;

    const items = Array.isArray(userStatsItems)
        ? userStatsItems
        : Array.isArray(statsData?.items)
          ? statsData.items
          : [];

    const pendingItems = filterActionableDashboardItems(items);

    const company = buildCompanyPageNotifications(
        pendingItems,
        companiesList,
        liveExpiryHrView,
        mandatoryCardsHrLive,
    ).map((row) => tagModule(row, 'Company'));

    // Card Deleted lives on Company for shared sidebar/dashboard counts (emp page bell still shows it).
    // Pass the same HR flags as Company so team view never uses the manager's isAdmin()/session viewer.
    const employees = buildEmployeeListBellFromStats(
        statsData || { items, flowchartHrEmployeeObjectId: flags.flowchartHrId },
        employeesList,
        {
            asEmployeeObjectId: feeds._targetUserId || null,
            liveExpiryHrView,
            mandatoryCardsHrLive,
        },
    )
        .filter((row) => !includesCardDeletedNotificationType(row?.type))
        .map((row) => tagModule(row, 'Employees'));

    const fine = (Array.isArray(fineItems) ? fineItems : []).map((row) =>
        pendingInboxToItem(row, 'Fine'),
    );
    const payments = (Array.isArray(paymentItems) ? paymentItems : []).map((row) =>
        pendingInboxToItem(row, 'Payments'),
    );
    const reward = (Array.isArray(rewardItems) ? rewardItems : []).map((row) =>
        pendingInboxToItem(row, 'Reward'),
    );

    const toolsRawVisible = dedupeAssetPendingInboxItems(toolsItems).filter(isPendingInboxRowVisible);
    const toolsVisible = filterToolsAssetInboxRows(toolsRawVisible);
    const vehicleVisible = filterVehicleAssetInboxRows(
        dedupeAssetPendingInboxItems(vehicleItems).filter(isPendingInboxRowVisible),
    );

    const toolsAsset = toolsVisible.map((row) => pendingInboxToItem(row, 'Tools Asset'));
    const utilityBillVisible = toolsRawVisible.filter(isUtilityBillInboxRow);
    const utilityBill = utilityBillVisible.map((row) => pendingInboxToItem(row, 'Utility Bills'));
    const vehicleFromInbox = vehicleVisible.map((row) => pendingInboxToItem(row, 'Vehicle Asset'));
    // Stats rows for vehicle document expiry (pending-inbox also returns these once types include it).
    const vehicleExpiryFromStats = pendingItems
        .filter((item) => String(item?.type || '').trim() === 'Vehicle Document Expiry Reminder')
        .map((row) => tagModule(row, 'Vehicle Asset'));
    // Untagged fleet shared Asset * rows from stats belong under Vehicle (never Tools).
    const vehicleSharedFromStats = pendingItems
        .filter((item) => {
            const type = String(item?.type || '').trim();
            if (type !== 'Asset Approval' && type !== 'Asset Assignment' && type !== 'Asset Return') {
                return false;
            }
            return isVehicleAssetInboxRow(item);
        })
        .map((row) => tagModule({ ...row, scope: 'inbox' }, 'Vehicle Asset'));
    const vehicleAsset = dedupe([...vehicleFromInbox, ...vehicleExpiryFromStats, ...vehicleSharedFromStats]);

    const loan = pendingItems
        .filter((item) => isLoanNotification(item))
        .map((row) => tagModule(row, 'Loan and Advance'));

    const byModule = {
        Company: company,
        Employees: employees,
        Fine: fine,
        'Loan and Advance': loan,
        Reward: reward,
        'Vehicle Asset': vehicleAsset,
        'Tools Asset': toolsAsset,
        'Utility Bills': utilityBill,
        Payments: payments,
    };

    const counts = {
        company: company.length,
        employee: employees.length,
        fine: countVisibleFinePendingInbox(fineItems),
        reward: countVisibleRewardPendingInbox(rewardItems),
        payment: countVisiblePaymentPendingInbox(paymentItems),
        toolsAsset: countVisibleAssetPendingInbox(toolsVisible),
        // Match Vehicle Asset section length (inbox + vehicle document expiry).
        vehicleAsset: vehicleAsset.length,
        utilityBill: utilityBillVisible.length,
        loan: loan.length,
    };
    counts.asset =
        (counts.toolsAsset || 0) + (counts.vehicleAsset || 0) + (counts.utilityBill || 0);
    counts.hrm =
        (counts.company || 0) +
        (counts.employee || 0) +
        (counts.fine || 0) +
        (counts.reward || 0) +
        (counts.loan || 0) +
        (counts.toolsAsset || 0) +
        (counts.vehicleAsset || 0) +
        (counts.utilityBill || 0);

    const all = dedupe([
        ...company,
        ...employees,
        ...fine,
        ...loan,
        ...reward,
        ...vehicleAsset,
        ...toolsAsset,
        ...utilityBill,
        ...payments,
    ]);

    return { byModule, counts, all, pendingItems };
}

/** Convenience: load feeds + build bundle (sidebar + dashboard). */
export async function loadModuleNotificationBundle(axiosInstance, options = {}) {
    const feeds = await loadModuleNotificationFeeds(axiosInstance, options);
    const bundle = buildModuleNotificationBundle(feeds);
    publishModuleNotificationBundle(feeds, bundle);
    return {
        feeds,
        bundle,
    };
}

/**
 * Merge module-bell copies into user-stats for Command Center.
 * Pending module rows become exact page-bell copies; other history stays.
 */
export function mergeUserStatsWithModuleBundle(userStatsItems = [], bundle) {
    const base = Array.isArray(userStatsItems) ? userStatsItems : [];
    const moduleAll = Array.isArray(bundle?.all) ? bundle.all : [];

    const moduleTypes = new Set(
        moduleAll.map((item) => String(item?.type || '').trim()).filter(Boolean),
    );

    // Also own types that page bells cover even if list is empty right now
    const ownedPrefixes = [
        'Company Activation',
        COMPANY_ACTIVATION_INCOMPLETE_TYPE,
        'Document Expiry Reminder',
        'Company Document Not Renew',
        'Card Deleted Progress',
        'Profile Activation',
        'Profile Incomplete',
        'Employee Document Expiry Reminder',
        'Probation Change',
        'Employee Document Not Renew',
        'Fine',
        'Group Fine Request',
        'Payment Approval',
        'Utility Bill Payment',
        'Utility Bill Payment Reminder',
        'Reward',
        'Loan',
        'Loan/Advance',
        'Loan Request',
        'Advance',
        'Vehicle Service Request',
        'Vehicle Profile Activation',
        'Vehicle Profile Edit',
        'Vehicle Inspection',
        'Vehicle Mortgage Close',
        'Vehicle Disposition Request',
        'Vehicle Document Expiry Reminder',
    ];

    const isModuleOwnedPending = (item) => {
        if (String(item?.status || '') !== 'Pending' && String(item?.status || '') !== 'On Hold') {
            // Keep rejected follow-ups / history unless already replaced as a module row
            if (item?.scope === 'outgoing') return false;
        }
        const type = String(item?.type || '').trim();
        if (moduleTypes.has(type)) return true;
        if (ownedPrefixes.some((p) => type === p || type.startsWith('Asset'))) return true;
        if (isLoanNotification({ type })) return true;
        return false;
    };

    const kept = base.filter((item) => {
        // Notice Request: hide from dashboard (also removed from Employees bell).
        if (isEmployeeNotificationHiddenType(item?.type)) return false;
        if (item?._fromModuleNotifications || item?._fromModulePageNotifications || item?._fromModulePendingInbox) {
            return false;
        }
        // Keep outgoing history; replace actionable module pending with exact bell copies
        if (item?.scope === 'outgoing') {
            // Still hide Notice Request on My Requests if it appears there as outgoing
            if (isEmployeeNotificationHiddenType(item?.type)) return false;
            return true;
        }
        const actionable = filterActionableDashboardItems([item]).length > 0;
        if (!actionable) return true;
        return !isModuleOwnedPending(item);
    });

    return dedupe([...moduleAll, ...kept]).filter(
        (item) => !isEmployeeNotificationHiddenType(item?.type),
    );
}

function statsItemToPendingInboxRow(item = {}) {
    return {
        requestType: item.type || item.requestType,
        requestObjectId: item.id,
        dashboardActionId: item.actionId || item.dashboardActionId,
        primaryAssetId: item.id,
        primaryFineId: item.id,
        requestedDate: item.requestedDate,
        requestedByName: item.requestedBy,
        subjectName: item.employeeName || item.subjectName,
        extra1: item.extra1,
        extra2: item.extra2,
        extra3: item.extra3,
        asset: item.asset,
        fine: item.fine,
        reward: item.reward,
        payment: item.payment,
        isBulk: item.isBulk,
        isGroup: item.isGroup,
        status: item.status || 'Pending',
    };
}

/**
 * Prepare another employee's Command Center items with the SAME merge pipeline as self,
 * using that employee's user-stats as the module-bell source (never the viewer's session bells).
 * This is the single prepare path for Teams rows + selectedUser for a target employee.
 */
export function prepareCommandCenterItemsForEmployee(userStatsItems = [], statsData = null) {
    const items = Array.isArray(userStatsItems) ? userStatsItems : [];
    const statsPayload = statsData && typeof statsData === 'object' ? { ...statsData, items } : { items };

    const pending = filterActionableDashboardItems(items).filter(
        (i) =>
            i?.scope !== 'outgoing' &&
            !isEmployeeNotificationHiddenType(i?.type),
    );

    const finePending = pending.filter((i) => {
        const t = String(i?.type || '').trim();
        return t === 'Fine' || t === 'Group Fine Request';
    });
    const paymentPending = pending.filter((i) => String(i?.type || '').trim() === 'Payment Approval');
    const rewardPending = pending.filter((i) => String(i?.type || '').trim() === 'Reward');
    const toolsPending = pending.filter((i) => isToolsAssetInboxRow(i));
    const utilityPending = pending.filter((i) => isUtilityBillInboxRow(i));
    const vehiclePending = pending.filter((i) => isVehicleAssetInboxRow(i));

    const bundle = buildModuleNotificationBundle({
        userStatsItems: items,
        statsData: statsPayload,
        companiesList: [],
        employeesList: [],
        // Utility bills arrive via tools-scope API but are partitioned in the bundle.
        toolsItems: [...toolsPending, ...utilityPending].map(statsItemToPendingInboxRow),
        vehicleItems: vehiclePending.map(statsItemToPendingInboxRow),
        fineItems: finePending.map(statsItemToPendingInboxRow),
        paymentItems: paymentPending.map(statsItemToPendingInboxRow),
        rewardItems: rewardPending.map(statsItemToPendingInboxRow),
    });

    return mergeUserStatsWithModuleBundle(items, bundle);
}
