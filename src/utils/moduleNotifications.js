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
import {
    countVisibleFinePendingInbox,
    filterFinePendingInboxApprovalItems,
} from '@/app/HRM/Fine/utils/finePendingInboxCount';
import { countVisiblePaymentPendingInbox } from '@/app/Accounts/Payments/utils/paymentPendingInboxCount';
import { countVisibleRewardPendingInbox } from '@/app/HRM/Reward/utils/rewardPendingInboxCount';
import { countVisibleLoanPendingInbox } from '@/app/HRM/LoanAndAdvance/utils/loanPendingInboxCount';
import { countVisibleAttendancePendingInbox } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import { countVisibleLeavePendingInbox } from '@/app/HRM/Leave/utils/leavePendingInboxCount';
import { countVisibleSalaryPendingInbox } from '@/app/HRM/Salary/utils/salaryPendingInboxCount';
import { filterActionableDashboardItems } from '@/utils/activationNotificationFilters';
import {
    buildCompanyPageNotifications,
    loadCompanyNotificationBundle,
} from '@/utils/companyPageNotifications';
import { buildEmployeeListBellFromStats, isEmployeeNotificationHiddenType } from '@/utils/employeePageNotifications';
import { isCardDeletedNotificationHiddenType } from '@/utils/cardDeletedNotifications';
import {
    hiddenNotificationTypesFromMap,
    invalidateNotificationChannelMap,
    isNotificationTypeHidden,
    loadNotificationChannelMap,
} from '@/utils/notificationChannelPermissionUi';
import {
    fetchAssetPendingInbox,
    fetchFinePendingInbox,
    fetchPaymentPendingInbox,
    fetchRewardPendingInbox,
    fetchLoanPendingInbox,
    fetchAttendancePendingInbox,
    fetchLeavePendingInbox,
    fetchSalaryPendingInbox,
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
import { sortNotificationsStackOrder } from '@/utils/notificationSortOrder';

export const MODULE_ORDER = [
    'Company',
    'Employees',
    'Attendance',
    'Leave',
    'Salary',
    'Fine',
    'Loan and Advance',
    'Reward',
    'Vehicle Asset',
    'Tools Asset',
    'Utility Bills',
    'Payments',
];

const LOAN_TYPES = new Set(['Loan', 'Loan Request', 'Advance', 'Loan and Advance', 'Loan/Advance', 'Employee Advance Request', 'Employee Loan Request']);

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
        row?.loan?.loanId ||
        row?.loan?._id ||
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
            employeeName:
                row?.subjectName ||
                row?.loan?.applicantName ||
                row?.reward?.employeeName ||
                '',
            requestedDate: row?.requestedDate,
            actionedDate: null,
            status: 'Pending',
            extra1: row?.extra1 || row?.date || '',
            extra2:
                row?.extra2 ||
                row?.message ||
                (moduleCategory === 'Salary'
                    ? String(row?.requestType || '').trim() === 'Salary DMF Approval'
                        ? 'Payroll approval'
                        : 'Enrolment approval'
                    : moduleCategory === 'Leave'
                    ? 'Leave request'
                    : moduleCategory === 'Attendance'
                    ? String(row?.leaveRequestKind || '') === 'yellow'
                        ? `Clarification: mark as Present`
                        : `Leave change: ${row?.requestedStatusLabel || 'status update'}`
                    : ''),
            extra3: row?.extra3 || '',
            employeeMongoId: row?.employeeMongoId || '',
            href: row?.href || '',
            subjectEmployeeId: row?.subjectEmployeeId || '',
            targetEmployeeId: row?.subjectEmployeeId || row?.targetEmployeeId || '',
            assetType: row?.assetType || '',
            hubRequest: row?.hubRequest === true,
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
            loan: row?.loan || null,
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
    if (low === 'advance' || low.startsWith('advance ')) return true;
    // Pay-to-employee tasks often keep type Loan/Advance with this extra1 prefix.
    const extra1 = String(item?.extra1 || '').toLowerCase();
    if (extra1.includes('pay to employee')) return true;
    return false;
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
    const pendingItems = filterActionableDashboardItems(items).filter(
        (item) => !isCardDeletedNotificationHiddenType(item?.type),
    );
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
const FEEDS_CACHE_TTL_MS = 180 * 1000;
const SIDEBAR_COUNTS_STORAGE_KEY = 'verp:sidebar-badge-counts';
let cachedFeeds = null;
let cachedFeedsAt = 0;
let feedsInFlight = null;
let feedsGen = 0;

/** Fired whenever shared module feeds/counts refresh — Sidebar + Dashboard stay in sync. */
export const MODULE_NOTIFICATIONS_UPDATED = 'verp:module-notifications-updated';

let cachedBundle = null;

function currentNotificationUserKey() {
    if (typeof window === 'undefined') return '';
    try {
        const raw = localStorage.getItem('employeeUser') || localStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        return String(user?.employeeObjectId || user?._id || user?.employeeId || '');
    } catch {
        return '';
    }
}

function persistModuleNotificationCounts(counts) {
    if (typeof window === 'undefined' || !counts) return;
    try {
        sessionStorage.setItem(
            SIDEBAR_COUNTS_STORAGE_KEY,
            JSON.stringify({
                userKey: currentNotificationUserKey(),
                counts,
                at: Date.now(),
            }),
        );
    } catch {
        /* quota / private mode */
    }
}

export function readPersistedModuleNotificationCounts() {
    if (typeof window === 'undefined') return null;
    try {
        const parsed = JSON.parse(sessionStorage.getItem(SIDEBAR_COUNTS_STORAGE_KEY) || 'null');
        if (!parsed?.counts) return null;
        if (parsed.userKey && parsed.userKey !== currentNotificationUserKey()) return null;
        return parsed.counts;
    } catch {
        return null;
    }
}

export function getCachedModuleNotificationFeeds() {
    if (cachedFeeds && Date.now() - cachedFeedsAt < FEEDS_CACHE_TTL_MS) return cachedFeeds;
    return null;
}

/** Last built bundle, even after TTL — for instant sidebar paint. */
export function peekCachedModuleNotificationBundle() {
    return cachedBundle;
}

export function getCachedModuleNotificationBundle() {
    if (!cachedBundle) return null;
    if (!getCachedModuleNotificationFeeds()) return null;
    return cachedBundle;
}

/** Expire TTL so the next load refetches, but keep last counts on screen. */
export function invalidateModuleNotificationFeedsCache() {
    feedsGen += 1;
    cachedFeeds = null;
    cachedFeedsAt = 0;
    feedsInFlight = null;
}

export function clearModuleNotificationFeedsCache() {
    feedsGen += 1;
    cachedFeeds = null;
    cachedFeedsAt = 0;
    feedsInFlight = null;
    cachedBundle = null;
}

function rollupModuleCounts(counts = {}) {
    const next = { ...counts };
    next.asset =
        (Number(next.toolsAsset) || 0) +
        (Number(next.vehicleAsset) || 0) +
        (Number(next.utilityBill) || 0);
    next.hrm =
        (Number(next.company) || 0) +
        (Number(next.employee) || 0) +
        (Number(next.attendance) || 0) +
        (Number(next.leave) || 0) +
        (Number(next.salary) || 0) +
        (Number(next.fine) || 0) +
        (Number(next.reward) || 0) +
        (Number(next.loan) || 0) +
        (Number(next.toolsAsset) || 0) +
        (Number(next.vehicleAsset) || 0) +
        (Number(next.utilityBill) || 0);
    return next;
}

/** Update badge numbers without waiting for every module. Keeps an existing full bundle. */
function publishModuleNotificationCounts(counts) {
    const next = rollupModuleCounts(counts);
    if (cachedBundle) {
        cachedBundle = { ...cachedBundle, counts: next };
    }
    persistModuleNotificationCounts(next);
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent(MODULE_NOTIFICATIONS_UPDATED, {
            detail: { counts: next },
        }),
    );
}

function publishModuleNotificationBundle(feeds, bundle) {
    cachedBundle = bundle || null;
    if (bundle?.counts) persistModuleNotificationCounts(bundle.counts);
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
        /** When set, load Fine/Asset/Reward/Payment/Loan bells for that employee (team Command Center). */
        targetUserId = null,
        onPartial = null,
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
        const gen = feedsGen;
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
            fetchLoanPendingInbox(axiosInstance, { skipToast: true, ...inboxOpts }),
            fetchAttendancePendingInbox(axiosInstance, { skipToast: true, ...inboxOpts }),
            fetchLeavePendingInbox(axiosInstance, { skipToast: true, ...inboxOpts }),
            fetchSalaryPendingInbox(axiosInstance, { skipToast: true, ...inboxOpts }),
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

        const countKeysByIndex = [
            ['toolsAsset', 'utilityBill'],
            ['vehicleAsset'],
            ['fine'],
            ['payment'],
            ['reward'],
            ['loan'],
            ['attendance'],
            ['leave'],
            ['salary'],
            ['company', 'employee', 'vehicleAsset'],
            ['employee'],
        ];
        const partial = {
            statsData: providedStats || { items: [] },
            companiesList: [],
            employeesList: [],
            toolsItems: [],
            vehicleItems: [],
            fineItems: [],
            paymentItems: [],
            rewardItems: [],
            loanItems: [],
            attendanceItems: [],
            leaveItems: [],
            salaryItems: [],
        };

        const tracked = requests.map((request, index) =>
            Promise.resolve(request).then((value) => {
                if (index <= 8) {
                    const field = [
                        'toolsItems',
                        'vehicleItems',
                        'fineItems',
                        'paymentItems',
                        'rewardItems',
                        'loanItems',
                        'attendanceItems',
                        'leaveItems',
                        'salaryItems',
                    ][index];
                    partial[field] = Array.isArray(value) ? value : [];
                } else if (index === 9) {
                    partial.statsData = providedStats || value?.statsRes?.data || partial.statsData;
                    partial.companiesList = Array.isArray(value?.companiesList) ? value.companiesList : [];
                } else {
                    const empPayload = value?.data?.employees ?? value?.data;
                    partial.employeesList = Array.isArray(empPayload) ? empPayload : [];
                }
                if (!targetUserId && gen === feedsGen && typeof onPartial === 'function') {
                    const hrFlags = resolveHrFlags(partial.statsData || {}, { asEmployeeObjectId });
                    onPartial({
                        keys: countKeysByIndex[index] || [],
                        feeds: {
                            _targetUserId: null,
                            statsData: partial.statsData,
                            userStatsItems: Array.isArray(partial.statsData?.items) ? partial.statsData.items : [],
                            companiesList: partial.companiesList,
                            employeesList: partial.employeesList,
                            toolsItems: partial.toolsItems,
                            vehicleItems: partial.vehicleItems,
                            fineItems: partial.fineItems,
                            paymentItems: partial.paymentItems,
                            rewardItems: partial.rewardItems,
                            loanItems: partial.loanItems,
                            attendanceItems: partial.attendanceItems,
                            leaveItems: partial.leaveItems,
                            salaryItems: partial.salaryItems,
                            ...hrFlags,
                        },
                    });
                }
                return value;
            }),
        );

        const settled = await Promise.allSettled(tracked);

        const toolsItems = valueOr(settled, 0, []);
        const vehicleItems = valueOr(settled, 1, []);
        const fineItems = valueOr(settled, 2, []);
        const paymentItems = valueOr(settled, 3, []);
        const rewardItems = valueOr(settled, 4, []);
        const loanItems = valueOr(settled, 5, []);
        const attendanceItems = valueOr(settled, 6, []);
        const leaveItems = valueOr(settled, 7, []);
        const salaryItems = valueOr(settled, 8, []);
        const notificationBundle = valueOr(settled, 9, {
            statsRes: { data: { items: [] } },
            companiesList: [],
        });
        const empRes = skipEmployees ? { data: {} } : valueOr(settled, 10, { data: {} });
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
            loanItems: Array.isArray(loanItems) ? loanItems : [],
            attendanceItems: Array.isArray(attendanceItems) ? attendanceItems : [],
            leaveItems: Array.isArray(leaveItems) ? leaveItems : [],
            salaryItems: Array.isArray(salaryItems) ? salaryItems : [],
            ...hrFlags,
        };

        // Only cache for the logged-in user's own bells (sidebar) if this run is still current.
        if (!targetUserId && gen === feedsGen) {
            cachedFeeds = feeds;
            cachedFeedsAt = Date.now();
        }
        return feeds;
    })().finally(() => {
        if (!targetUserId && feedsInFlight === run) feedsInFlight = null;
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
        loanItems = [],
        attendanceItems = [],
        leaveItems = [],
        salaryItems = [],
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

    const pendingItems = filterActionableDashboardItems(items).filter(
        (item) => !isCardDeletedNotificationHiddenType(item?.type),
    );

    const company = buildCompanyPageNotifications(
        pendingItems,
        companiesList,
        liveExpiryHrView,
        mandatoryCardsHrLive,
    ).map((row) => tagModule(row, 'Company'));

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
        .map((row) => tagModule(row, 'Employees'));

    const visibleFineItems = filterFinePendingInboxApprovalItems(fineItems);
    const fine = visibleFineItems.map((row) =>
        pendingInboxToItem(row, 'Fine'),
    );
    const payments = (Array.isArray(paymentItems) ? paymentItems : []).map((row) =>
        pendingInboxToItem(row, 'Payments'),
    );
    const reward = (Array.isArray(rewardItems) ? rewardItems : []).map((row) =>
        pendingInboxToItem(row, 'Reward'),
    );
    const loan = (Array.isArray(loanItems) ? loanItems : []).map((row) =>
        pendingInboxToItem(row, 'Loan and Advance'),
    );
    const attendance = (Array.isArray(attendanceItems) ? attendanceItems : []).map((row) =>
        pendingInboxToItem(row, 'Attendance'),
    );
    const leave = (Array.isArray(leaveItems) ? leaveItems : []).map((row) =>
        pendingInboxToItem(row, 'Leave'),
    );
    const salary = (Array.isArray(salaryItems) ? salaryItems : []).map((row) =>
        pendingInboxToItem(row, 'Salary'),
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

    const byModule = {
        Company: sortNotificationsStackOrder(company),
        Employees: sortNotificationsStackOrder(employees),
        Attendance: sortNotificationsStackOrder(attendance),
        Leave: sortNotificationsStackOrder(leave),
        Salary: sortNotificationsStackOrder(salary),
        Fine: sortNotificationsStackOrder(fine),
        'Loan and Advance': sortNotificationsStackOrder(loan),
        Reward: sortNotificationsStackOrder(reward),
        'Vehicle Asset': sortNotificationsStackOrder(vehicleAsset),
        'Tools Asset': sortNotificationsStackOrder(toolsAsset),
        'Utility Bills': sortNotificationsStackOrder(utilityBill),
        Payments: sortNotificationsStackOrder(payments),
    };

    const counts = {
        company: company.length,
        employee: employees.length,
        attendance: countVisibleAttendancePendingInbox(attendanceItems),
        leave: countVisibleLeavePendingInbox(leaveItems),
        salary: countVisibleSalaryPendingInbox(salaryItems),
        fine: countVisibleFinePendingInbox(visibleFineItems),
        reward: countVisibleRewardPendingInbox(rewardItems),
        payment: countVisiblePaymentPendingInbox(paymentItems),
        toolsAsset: countVisibleAssetPendingInbox(toolsVisible),
        // Match Vehicle Asset section length (inbox + vehicle document expiry).
        vehicleAsset: vehicleAsset.length,
        utilityBill: utilityBillVisible.length,
        loan: countVisibleLoanPendingInbox(loanItems),
    };
    counts.asset =
        (counts.toolsAsset || 0) + (counts.vehicleAsset || 0) + (counts.utilityBill || 0);
    counts.hrm =
        (counts.company || 0) +
        (counts.employee || 0) +
        (counts.attendance || 0) +
        (counts.leave || 0) +
        (counts.salary || 0) +
        (counts.fine || 0) +
        (counts.reward || 0) +
        (counts.loan || 0) +
        (counts.toolsAsset || 0) +
        (counts.vehicleAsset || 0) +
        (counts.utilityBill || 0);

    const all = sortNotificationsStackOrder(
        dedupe([
            ...company,
            ...employees,
            ...attendance,
            ...leave,
            ...salary,
            ...fine,
            ...loan,
            ...reward,
            ...vehicleAsset,
            ...toolsAsset,
            ...utilityBill,
            ...payments,
        ]),
    );

    return { byModule, counts, all, pendingItems };
}

export function filterBundleByNotificationPermission(bundle, byDashboardType) {
    if (!bundle || !byDashboardType || typeof byDashboardType !== 'object') return bundle;
    const hiddenNotificationTypes = hiddenNotificationTypesFromMap(byDashboardType);
    const hiddenTypes = new Set(hiddenNotificationTypes);
    const allow = (item) => !isNotificationTypeHidden(item, hiddenTypes);
    const byModule = {};
    for (const [key, rows] of Object.entries(bundle.byModule || {})) {
        byModule[key] = (Array.isArray(rows) ? rows : []).filter(allow);
    }
    const all = (Array.isArray(bundle.all) ? bundle.all : []).filter(allow);
    const pendingItems = (Array.isArray(bundle.pendingItems) ? bundle.pendingItems : []).filter(allow);
    const counts = { ...(bundle.counts || {}) };
    counts.company = byModule.Company?.length || 0;
    counts.employee = byModule.Employees?.length || 0;
    counts.attendance = byModule.Attendance?.length || 0;
    counts.leave = byModule.Leave?.length || 0;
    counts.salary = byModule.Salary?.length || 0;
    counts.fine = byModule.Fine?.length || 0;
    counts.loan = byModule['Loan and Advance']?.length || 0;
    counts.reward = byModule.Reward?.length || 0;
    counts.payment = byModule.Payments?.length || 0;
    counts.toolsAsset = byModule['Tools Asset']?.length || 0;
    counts.vehicleAsset = byModule['Vehicle Asset']?.length || 0;
    counts.utilityBill = byModule['Utility Bills']?.length || 0;
    counts.asset = (counts.toolsAsset || 0) + (counts.vehicleAsset || 0) + (counts.utilityBill || 0);
    counts.hrm =
        (counts.company || 0) +
        (counts.employee || 0) +
        (counts.attendance || 0) +
        (counts.leave || 0) +
        (counts.salary || 0) +
        (counts.fine || 0) +
        (counts.reward || 0) +
        (counts.loan || 0) +
        (counts.toolsAsset || 0) +
        (counts.vehicleAsset || 0) +
        (counts.utilityBill || 0);
    return { ...bundle, byModule, counts, all, pendingItems, hiddenNotificationTypes };
}

export { invalidateNotificationChannelMap, loadNotificationChannelMap };

/** Convenience: load feeds + build bundle (sidebar + dashboard). */
export async function loadModuleNotificationBundle(axiosInstance, options = {}) {
    const gen = feedsGen;
    let channelMap = null;
    const mapPromise = loadNotificationChannelMap(axiosInstance).then((map) => {
        channelMap = map;
        return map;
    });
    const onPartial = ({ keys, feeds }) => {
        if (options.targetUserId || gen !== feedsGen) return;
        const raw = buildModuleNotificationBundle(feeds);
        const bundle = channelMap ? filterBundleByNotificationPermission(raw, channelMap) : raw;
        const previous =
            peekCachedModuleNotificationBundle()?.counts ||
            readPersistedModuleNotificationCounts() ||
            {};
        const counts = { ...previous };
        for (const key of keys || []) {
            if (bundle?.counts && Object.prototype.hasOwnProperty.call(bundle.counts, key)) {
                counts[key] = bundle.counts[key];
            }
        }
        publishModuleNotificationCounts(counts);
    };
    const [feeds, byDashboardType] = await Promise.all([
        loadModuleNotificationFeeds(axiosInstance, { ...options, onPartial }),
        mapPromise,
    ]);
    const raw = buildModuleNotificationBundle(feeds);
    const bundle = filterBundleByNotificationPermission(raw, byDashboardType);
    if (gen === feedsGen) {
        publishModuleNotificationBundle(feeds, bundle);
    }
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
    const hiddenTypes = new Set(bundle?.hiddenNotificationTypes || []);

    const moduleTypes = new Set(
        moduleAll.map((item) => String(item?.type || '').trim()).filter(Boolean),
    );

    // Also own types that page bells cover even if list is empty right now
    const ownedPrefixes = [
        'Company Activation',
        COMPANY_ACTIVATION_INCOMPLETE_TYPE,
        'Document Expiry Reminder',
        'Company Document Not Renew',
        'Profile Activation',
        'Profile Incomplete',
        'Employee Document Expiry Reminder',
        'Probation Change',
        'Left User Request',
        'Employee Document Not Renew',
        'Fine',
        'Group Fine Request',
        'Payment Approval',
        'Utility Bill Payment',
        'Utility Bill Payment Reminder',
        'Utility Contract Expiry',
        'Utility Entry Status Change',
        'Reward',
        'Loan',
        'Loan/Advance',
        'Loan Request',
        'Advance',
        'Attendance Leave Request',
        'Employee Leave Request',
        'Salary Enrollment',
        'Salary DMF Approval',
        'Vehicle Service Request',
        'Vehicle Profile Activation',
        'Vehicle Profile Edit',
        'Vehicle Profile Incomplete',
        'Vehicle Inspection',
        'Vehicle Assignment Photo Review',
        'Vehicle Mortgage Close',
        'Vehicle Disposition Request',
        'Vehicle Document Expiry Reminder',
        'Vehicle Access Fuel Reminder',
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
        if (isNotificationTypeHidden(item, hiddenTypes)) return false;
        if (isCardDeletedNotificationHiddenType(item?.type)) return false;
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

    return sortNotificationsStackOrder(
        dedupe([...moduleAll, ...kept]).filter(
            (item) =>
                !isNotificationTypeHidden(item, hiddenTypes) &&
                !isEmployeeNotificationHiddenType(item?.type) &&
                !isCardDeletedNotificationHiddenType(item?.type),
        ),
    );
}

/** Module / stats notification → pending-inbox row shape (Vehicle bell + modal). */
export function moduleNotificationToPendingInboxRow(item = {}) {
    const requestObjectId =
        item.requestObjectId || item.primaryAssetId || item.id || item.requestId || null;
    return {
        requestType: item.type || item.requestType,
        requestObjectId,
        dashboardActionId: item.actionId || item.dashboardActionId || null,
        primaryAssetId: item.primaryAssetId || item.id || requestObjectId,
        primaryFineId: item.primaryFineId || item.id,
        requestedDate: item.requestedDate,
        requestedByName: item.requestedBy || item.requestedByName,
        subjectName: item.employeeName || item.subjectName,
        extra1: item.extra1,
        extra2: item.extra2,
        extra3: item.extra3,
        assetType: item.assetType || '',
        hubRequest: item.hubRequest === true,
        asset: item.asset,
        fine: item.fine,
        reward: item.reward,
        payment: item.payment,
        loan: item.loan,
        isBulk: item.isBulk,
        bulkAssetIds: item.bulkAssetIds,
        bulkKind: item.bulkKind,
        isGroup: item.isGroup,
        status: item.status || 'Pending',
        dashboardStatus: item.status || 'Pending',
    };
}

function statsItemToPendingInboxRow(item = {}) {
    return moduleNotificationToPendingInboxRow(item);
}

/**
 * Same Vehicle Asset rows the sidebar badge uses (pending-inbox + stats supplements).
 * Use for Vehicle Dashboard / list bells so count and modal match the sidebar.
 */
export function getVehicleModuleInboxRows(bundle = null) {
    // Prefer live cache even if feeds TTL lapsed — sidebar still shows that count.
    const b = bundle || cachedBundle || getCachedModuleNotificationBundle();
    const rows = Array.isArray(b?.byModule?.['Vehicle Asset']) ? b.byModule['Vehicle Asset'] : [];
    return rows.map(moduleNotificationToPendingInboxRow);
}

export function getVehicleModuleInboxCount(bundle = null) {
    const b = bundle || cachedBundle || getCachedModuleNotificationBundle();
    if (typeof b?.counts?.vehicleAsset === 'number') return b.counts.vehicleAsset;
    return getVehicleModuleInboxRows(b).length;
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
            !isEmployeeNotificationHiddenType(i?.type) &&
            !isCardDeletedNotificationHiddenType(i?.type),
    );

    const finePending = pending.filter((i) => {
        const t = String(i?.type || '').trim();
        return t === 'Fine' || t === 'Group Fine Request' || t === 'Employee Fine Request';
    });
    const paymentPending = pending.filter((i) => String(i?.type || '').trim() === 'Payment Approval');
    const rewardPending = pending.filter((i) => String(i?.type || '').trim() === 'Reward');
    const loanPending = pending.filter((i) => isLoanNotification(i));
    const salaryPending = pending.filter((i) => {
        const t = String(i?.type || '').trim();
        return t === 'Salary Enrollment' || t === 'Salary DMF Approval';
    });
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
        loanItems: loanPending.map(statsItemToPendingInboxRow),
        salaryItems: salaryPending.map(statsItemToPendingInboxRow),
    });

    return mergeUserStatsWithModuleBundle(items, bundle);
}
