/**
 * Shared Request Command Center Inbox counting.
 * Team Performance rows must use the same rules as a user's dashboard Inbox cards.
 */

import {
    isDashboardPendingItem,
    isSubmitterRejectedFollowup,
} from '@/utils/activationNotificationFilters';
import { groupCommandCenterByModule } from '@/utils/dashboardCommandCenterInbox';
import { isEmployeeNotificationHiddenType } from '@/utils/employeePageNotifications';
import { mergeExpiryNotificationDedupe } from '@/utils/expiryNotificationFallbacks';
import { fetchEmployeeDashboardStats } from '@/utils/employeeDashboardStatsFetch';
import {
    loadModuleNotificationFeeds,
    buildModuleNotificationBundle,
    mergeUserStatsWithModuleBundle,
    rememberModuleNotificationBundle,
} from '@/utils/moduleNotifications';

const COMPANY_DASHBOARD_ACTION_TYPES = new Set([
    'Company Activation',
    'Company Document Not Renew',
    'Document Expiry Reminder',
]);

export const companyTaskBelongsInInbox = (item) => {
    if (!item || !COMPANY_DASHBOARD_ACTION_TYPES.has(item.type)) return false;
    const st = String(item.status || '');
    return st === 'Pending' || st === 'On Hold' || (st === 'Rejected' && item.type === 'Company Activation');
};

export const employeeTaskBelongsInInbox = (item) => {
    if (!item) return false;
    if (item._fromModulePageNotifications && item.moduleCategory === 'Employees') return true;
    const type = String(item.type || '').trim();
    if (type === 'Notice Request') return false;
    return (
        type === 'Profile Activation' ||
        type === 'Profile Incomplete' ||
        type === 'Employee Document Expiry Reminder' ||
        type === 'Probation Change' ||
        type === 'Employee Document Not Renew'
    );
};

export const isCommandCenterOverdue = (date, status, type = '') => {
    if (!date || (status !== 'Pending' && status !== 'On Hold')) return false;

    const requested = new Date(date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    requested.setHours(0, 0, 0, 0);

    const typeLow = String(type || '').toLowerCase();
    const isExpiryReminder = typeLow.includes('expiry') || typeLow.includes('reminder');

    if (isExpiryReminder) {
        return requested <= now;
    }

    const diffTime = now - requested;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3;
};

/** Module-bell copies always belong to the logged-in session — never another person's inbox. */
export const isModuleNotificationCopy = (item) =>
    Boolean(
        item?._fromModuleNotifications ||
            item?._fromModulePageNotifications ||
            item?._fromModulePendingInbox,
    );

export const stripModuleNotificationCopies = (items = []) =>
    (Array.isArray(items) ? items : []).filter((item) => !isModuleNotificationCopy(item));

/**
 * True only when Command Center is showing the logged-in employee's own inbox.
 * selectedUser comes from hierarchy (EmployeeBasic); sessionUser from localStorage.
 */
export const isViewingOwnCommandCenter = (selectedUser, sessionUser) => {
    if (!selectedUser) return true;
    if (!sessionUser) return false;

    if (
        sessionUser.employeeObjectId &&
        String(selectedUser._id) === String(sessionUser.employeeObjectId)
    ) {
        return true;
    }
    if (
        sessionUser.employeeId &&
        selectedUser.employeeId &&
        String(selectedUser.employeeId) === String(sessionUser.employeeId)
    ) {
        return true;
    }
    return false;
};

/**
 * Same Incoming/Inbox membership as Request Command Center.
 * viewerIds = that person's EmployeeBasic `_id` and optional string employeeId.
 * allowModuleCopies: only true for the logged-in user's own dashboard (their bells).
 */
export const isIncomingCommandCenterItem = (
    item,
    viewerIds = {},
    { allowModuleCopies = true } = {},
) => {
    if (!item) return false;
    if (isEmployeeNotificationHiddenType(item.type)) return false;

    if (isModuleNotificationCopy(item)) {
        return allowModuleCopies;
    }

    if (item.scope) {
        if (item.scope === 'inbox') return true;
        if (companyTaskBelongsInInbox(item)) return true;
        if (employeeTaskBelongsInInbox(item)) return true;
        return false;
    }

    const { objectId, empCode } = viewerIds;
    if (!objectId && !empCode) return true;
    const requesterId =
        item.employeeId?._id || item.employeeId || item.requestedById || item.targetEmployeeId;
    const isRequester =
        (objectId && String(requesterId) === String(objectId)) ||
        (empCode && String(requesterId) === String(empCode));
    return !isRequester;
};

/** Same card math as Request Command Center Incoming (`scopedStats`). */
export const computeIncomingCommandCenterStats = (items = []) => {
    let completed = 0;
    let approved = 0;
    let rejected = 0;
    let overdue = 0;
    const pendingItems = [];
    for (const i of items) {
        if (i.status === 'Approved') {
            approved += 1;
            completed += 1;
        } else if (i.status === 'Rejected') {
            rejected += 1;
            if (!isSubmitterRejectedFollowup(i)) completed += 1;
        }
        if (isDashboardPendingItem(i)) pendingItems.push(i);
        if (isCommandCenterOverdue(i.requestedDate, i.status, i.type)) overdue += 1;
    }
    const pending = groupCommandCenterByModule(pendingItems).reduce(
        (sum, group) => sum + (group.items?.length || 0),
        0,
    );
    return {
        total: items.length,
        completed,
        pending,
        approved,
        rejected,
        overdue,
    };
};

/** Filter + count Inbox cards for one user — copy of dashboard Incoming. */
export const countCommandCenterInboxStats = (
    items = [],
    viewerIds = {},
    { allowModuleCopies = true } = {},
) => {
    const inboxItems = (Array.isArray(items) ? items : []).filter((item) =>
        isIncomingCommandCenterItem(item, viewerIds, { allowModuleCopies }),
    );
    return computeIncomingCommandCenterStats(inboxItems);
};

/**
 * Single source of truth: user-stats for employee E + E's module pending-inbox bells + merge.
 * Used for own Dashboard, Teams rows, and click-into that user.
 */
export async function loadPreparedCommandCenterItems(
    axiosInstance,
    {
        targetUserId = null,
        statsPayload = null,
        skipEmployees = true,
        force = false,
    } = {},
) {
    let payload = statsPayload && typeof statsPayload === 'object' ? statsPayload : null;

    if (!payload) {
        const res = targetUserId
            ? await axiosInstance.get('/Employee/dashboard/user-stats', {
                  params: { targetUserId },
                  skipToast: true,
              })
            : await fetchEmployeeDashboardStats(axiosInstance, { skipToast: true });
        payload = res?.data && typeof res.data === 'object' ? res.data : {};
    }

    const rawItems = mergeExpiryNotificationDedupe(
        Array.isArray(payload.items) ? payload.items : [],
        [],
    );
    const base = stripModuleNotificationCopies(rawItems);

    const feeds = await loadModuleNotificationFeeds(axiosInstance, {
        skipExpirySync: true,
        skipEmployees,
        statsData: { ...payload, items: base },
        force: Boolean(targetUserId) || force,
        targetUserId: targetUserId || null,
    });
    feeds.userStatsItems = base;
    feeds.statsData = { ...(feeds.statsData || {}), ...payload, items: base };

    const bundle = buildModuleNotificationBundle(feeds);
    if (!targetUserId) {
        rememberModuleNotificationBundle(feeds, bundle);
    }

    return {
        payload: { ...payload, items: base },
        items: mergeUserStatsWithModuleBundle(base, bundle),
        feeds,
    };
}

/**
 * Inbox card numbers for one employee — same prepared list as their Request Command Center.
 */
export async function fetchCommandCenterInboxStatsForUser(
    axiosInstance,
    { targetUserId, empCode = null, preloadedItems = null, isOwnDashboard = false } = {},
) {
    if (!targetUserId) {
        return { total: 0, completed: 0, overdue: 0, pending: 0, approved: 0, rejected: 0 };
    }

    let items;
    if (isOwnDashboard && Array.isArray(preloadedItems)) {
        items = preloadedItems;
    } else {
        const prepared = await loadPreparedCommandCenterItems(axiosInstance, {
            targetUserId,
            skipEmployees: true,
        });
        items = prepared.items;
    }

    return countCommandCenterInboxStats(
        items,
        {
            objectId: targetUserId,
            empCode: empCode || undefined,
        },
        { allowModuleCopies: true },
    );
}

export function flattenHierarchyNodes(nodes = []) {
    const out = [];
    const walk = (node) => {
        if (!node) return;
        out.push(node);
        (node.children || []).forEach(walk);
    };
    (Array.isArray(nodes) ? nodes : []).forEach(walk);
    return out;
}

export function sumCommandCenterInboxStats(statsList = []) {
    return (Array.isArray(statsList) ? statsList : []).reduce(
        (acc, s) => {
            if (!s || typeof s.pending !== 'number') return acc;
            return {
                total: acc.total + (s.total || 0),
                completed: acc.completed + (s.completed || 0),
                overdue: acc.overdue + (s.overdue || 0),
                pending: acc.pending + (s.pending || 0),
                approved: acc.approved + (s.approved || 0),
                rejected: acc.rejected + (s.rejected || 0),
            };
        },
        { total: 0, completed: 0, overdue: 0, pending: 0, approved: 0, rejected: 0 },
    );
}
