'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { useRouter, useSearchParams } from 'next/navigation';

import Sidebar from '@/components/Sidebar';

import Navbar from '@/components/Navbar';

import axiosInstance from '@/utils/axios';

import { mergeExpiryNotificationDedupe } from '@/utils/expiryNotificationFallbacks';
import { buildDashboardNotificationPath } from '@/utils/dashboardNotificationRouting';
import {
    resolveBulkAssignmentGroupId,
    isBulkActionInboxRow,
    withBulkActionAssetIds,
} from '@/utils/assetNotificationRouting';
import BulkAssignmentAcknowledgeModal from '@/app/HRM/Asset/components/BulkAssignmentAcknowledgeModal';
import BulkPendingResolveModal from '@/app/HRM/Asset/components/BulkPendingResolveModal';
import { ASSET_PENDING_INBOX_CHANGED, invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import {
    serviceIdFromNotificationHref,
    vehicleIdFromNotificationHref,
    warmVehicleDetailLight,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleDetailWarmCache';
import { ensureAssetFlowchartRoleMeta } from '@/utils/assetFlowchartModuleAccess';
import { fetchEmployeeDashboardStats } from '@/utils/employeeDashboardStatsFetch';
import {
    groupCommandCenterByModule,
    formatCommandCenterNotificationMessage,
    computePendingActivityByType,
    resolvePendingActivityType,
    pendingActivityTypeLegendLabel,
} from '@/utils/dashboardCommandCenterInbox';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';
import { FINE_PENDING_INBOX_CHANGED } from '@/app/HRM/Fine/utils/finePendingInboxCount';
import { PAYMENT_PENDING_INBOX_CHANGED } from '@/app/Accounts/Payments/utils/paymentPendingInboxCount';
import { REWARD_PENDING_INBOX_CHANGED } from '@/app/HRM/Reward/utils/rewardPendingInboxCount';
import { LOAN_PENDING_INBOX_CHANGED } from '@/app/HRM/LoanAndAdvance/utils/loanPendingInboxCount';
import { ATTENDANCE_PENDING_INBOX_CHANGED } from '@/app/HRM/Attendance/utils/attendancePendingInboxCount';
import DashboardAttendanceCalendar from '@/app/dashboard/components/DashboardAttendanceCalendar';
import DashboardCheckInOutCard from '@/app/dashboard/components/DashboardCheckInOutCard';
import DashboardEmployeeHrCards from '@/app/dashboard/components/DashboardEmployeeHrCards';
import DashboardEmployeeAssetCards from '@/app/dashboard/components/DashboardEmployeeAssetCards';
import DashboardMyLeaveCard from '@/app/dashboard/components/DashboardMyLeaveCard';
import DashboardMyRequestsCard from '@/app/dashboard/components/DashboardMyRequestsCard';
import DashboardRequestHub from '@/app/dashboard/components/DashboardRequestHub';
import ActivityPieChart from '@/app/dashboard/components/ActivityPieChart';
import { dashboardGrid, dashboardHover, dashboardItem, dashboardStagger } from '@/app/dashboard/components/dashboardMotion';

import {
    isDashboardPendingItem,
} from '@/utils/activationNotificationFilters';
import {
    isCommandCenterOverdue,
    isIncomingCommandCenterItem,
    isViewingOwnCommandCenter,
    stripModuleNotificationCopies,
    computeIncomingCommandCenterStats,
    countCommandCenterInboxStats,
    fetchCommandCenterInboxStatsForUser,
    loadPreparedCommandCenterItems,
    flattenHierarchyNodes,
    sumCommandCenterInboxStats,
} from '@/utils/commandCenterInboxStats';
import { navHrefProps } from '@/utils/linkContextMenu';

import {

    X,

    LayoutGrid,

    ChevronDown,

    ChevronRight,

    ArrowUpRight,

    PlayCircle,

    Users,

    Network

} from 'lucide-react';



import { useToast } from '@/hooks/use-toast';

import HierarchySelector from '@/components/HierarchySelector';

const isOverdue = isCommandCenterOverdue;

function DashboardContent() {
    const router = useRouter();
    const reduceMotion = useReducedMotion();

    const [loading, setLoading] = useState(true);

    const [userName, setUserName] = useState('User');

    const [currentUserId, setCurrentUserId] = useState(null);

    const [currentUserEmpId, setCurrentUserEmpId] = useState(null); // String ID (VEGA-xxx)

    const [requestScope, setRequestScope] = useState('incoming'); // 'incoming' (To Action) or 'outgoing' (My Requests)

    const [userStats, setUserStats] = useState({ pending: 0, approved: 0, rejected: 0, accepted: 0, total: 0, items: [] });

    const [derivedStats, setDerivedStats] = useState({ completed: 0, overdue: 0 });

    const [isExpanded, setIsExpanded] = useState(false);



    const [filter, setFilter] = useState('Pending');
    const [activityPieMode, setActivityPieMode] = useState('Pending');
    const [activityTypeFilter, setActivityTypeFilter] = useState(null);



    const [viewMode, setViewMode] = useState('requests'); // 'requests' or 'teams'

    const [hierarchyData, setHierarchyData] = useState([]);

    const [teamStats, setTeamStats] = useState({}); // Cache for employee stats: { empId: { pending: 0... } }

    const [expandedRows, setExpandedRows] = useState({}); // { empId: true/false }



    // Hierarchy State

    const [showHierarchyModal, setShowHierarchyModal] = useState(false);

    const [selectedUser, setSelectedUser] = useState(null); // null = self

    const [bulkAssignmentGroupId, setBulkAssignmentGroupId] = useState(null);
    const [bulkActionRow, setBulkActionRow] = useState(null);

    const [hasTeam, setHasTeam] = useState(false);



    const searchParams = useSearchParams();

    const [deepLinkHandled, setDeepLinkHandled] = useState(false);



    useEffect(() => {
        const scopeParam = searchParams.get('scope');
        if (scopeParam === 'outgoing' || scopeParam === 'incoming') {
            setRequestScope(scopeParam);
        }
    }, [searchParams]);



    useEffect(() => {

        if (!deepLinkHandled && userStats.items && userStats.items.length > 0) {

            const requestId = searchParams.get('requestId');

            if (requestId) {

                const item = userStats.items.find(

                    (i) => String(i.id) === String(requestId) || String(i.actionId) === String(requestId)

                );

                if (item) {

                    console.log(`[Dashboard] Handling deep link for requestId: ${requestId}`);

                    setDeepLinkHandled(true);

                    const typeLow = (item.type || '').toLowerCase();

                    const isAcPending =

                        item.status === 'Pending' &&

                        typeLow.includes('responsibility') &&

                        (item.extra1 || '').toLowerCase() === 'assetcontroller';

                    if (isAcPending) {

                        router.push('/Settings/FlowChart');

                    } else {

                        handleRowClick(item);

                    }

                }

            }

        }

    }, [userStats.items, searchParams, deepLinkHandled, router]);



    useEffect(() => {

        const token = localStorage.getItem('token');

        if (!token) {

            router.replace('/login');

            return;

        }



        const userData = localStorage.getItem('user');
        let sessionUser = null;

        if (userData) {

            try {

                sessionUser = JSON.parse(userData);

                setUserName(sessionUser.name || sessionUser.firstName || 'User');

                // Prefer employeeObjectId (Employee Model ID), fallback to _id (User Model ID)

                setCurrentUserId(sessionUser.employeeObjectId || sessionUser._id);

                setCurrentUserEmpId(sessionUser.employeeId); // String ID

            } catch (e) {

                console.error("Error parsing user", e);

            }

        }

        let cancelled = false;
        const viewingOwnInbox = isViewingOwnCommandCenter(selectedUser, sessionUser);

        // Drop previous person's (or own merged) list immediately so logged-in pending never flashes in.
        setUserStats({ pending: 0, approved: 0, rejected: 0, accepted: 0, total: 0, items: [] });
        setDerivedStats({ completed: 0, overdue: 0 });



        const fetchUserStats = async () => {

            try {

                setLoading(true);

                const targetUserId = viewingOwnInbox ? null : selectedUser?._id;

                // Paint raw user-stats first (fast), then prepare with that employee's live module bells.
                const params = {};
                if (targetUserId) params.targetUserId = targetUserId;

                const res = targetUserId
                    ? await axiosInstance.get('/Employee/dashboard/user-stats', { params, skipToast: true })
                    : await fetchEmployeeDashboardStats(axiosInstance, { skipToast: true });

                if (cancelled) return;

                const payload = res?.data && typeof res.data === 'object' ? res.data : {};
                const rawItems = mergeExpiryNotificationDedupe(
                    Array.isArray(payload.items) ? payload.items : [],
                    [],
                );
                const paintItems = stripModuleNotificationCopies(rawItems);

                setUserStats({
                    ...payload,
                    items: paintItems,
                });
                setDerivedStats({
                    completed: paintItems.filter((i) => i.status === 'Approved' || i.status === 'Rejected').length,
                    overdue: paintItems.filter((i) => isOverdue(i.requestedDate, i.status, i.type)).length,
                });
                setLoading(false);

                // Same prepare path for own Dashboard and for a team member's Command Center.
                try {
                    const prepared = await loadPreparedCommandCenterItems(axiosInstance, {
                        targetUserId,
                        statsPayload: { ...payload, items: paintItems },
                        skipEmployees: true,
                    });
                    if (cancelled) return;

                    let merged = prepared.items;
                    setUserStats((prev) => ({
                        ...prev,
                        ...payload,
                        items: merged,
                    }));
                    setDerivedStats({
                        completed: merged.filter((i) => i.status === 'Approved' || i.status === 'Rejected').length,
                        overdue: merged.filter((i) => isOverdue(i.requestedDate, i.status, i.type)).length,
                    });

                    // Own inbox only: optional second pass with employee roster for HR live expiry.
                    if (
                        viewingOwnInbox &&
                        (prepared.feeds?.liveExpiryHrView || prepared.feeds?.mandatoryCardsHrLive)
                    ) {
                        const full = await loadPreparedCommandCenterItems(axiosInstance, {
                            targetUserId: null,
                            statsPayload: { ...payload, items: paintItems },
                            skipEmployees: false,
                            force: true,
                        });
                        if (cancelled) return;
                        merged = full.items;
                        setUserStats((prev) => ({
                            ...prev,
                            ...payload,
                            items: merged,
                        }));
                        setDerivedStats({
                            completed: merged.filter((i) => i.status === 'Approved' || i.status === 'Rejected').length,
                            overdue: merged.filter((i) => isOverdue(i.requestedDate, i.status, i.type)).length,
                        });
                    }
                } catch (inboxErr) {
                    console.error('Failed to prepare Command Center inbox', inboxErr);
                }

            } catch (error) {

                if (cancelled) return;
                console.error("Failed to fetch user activity stats", error);
                setLoading(false);

            }

        };



        const checkTeam = async () => {
            try {
                if (hasTeam || cancelled) return;

                const res = await axiosInstance.get('/Employee/dashboard/hierarchy', {
                    skipToast: true,
                });

                if (cancelled) return;

                if (res.data?.hierarchy?.length > 0) {
                    setHasTeam(true);
                }
            } catch (e) {
                // Soft capability probe for "See Teams" — never surface as a console error overlay.
                if (cancelled || e?.silent || e?.isAuthError) return;
                if (process.env.NODE_ENV === 'development') {
                    const detail =
                        e?.message ||
                        e?.response?.data?.message ||
                        e?.response?.status ||
                        'unknown';
                    console.warn('Team check skipped:', detail);
                }
            }
        };

        checkTeam();

        fetchUserStats();

        let refreshTimer = null;
        const refreshFromModuleInbox = () => {
            // Never refresh / re-merge when inspecting another employee.
            if (!viewingOwnInbox) return;
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                clearModuleNotificationFeedsCache();
                fetchUserStats();
            }, 400);
        };
        if (typeof window !== 'undefined') {
            window.addEventListener(ASSET_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            window.addEventListener(FINE_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            window.addEventListener(PAYMENT_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            window.addEventListener(REWARD_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            window.addEventListener(LOAN_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            window.addEventListener(ATTENDANCE_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
        }

        return () => {
            cancelled = true;
            if (refreshTimer) clearTimeout(refreshTimer);
            if (typeof window !== 'undefined') {
                window.removeEventListener(ASSET_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
                window.removeEventListener(FINE_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
                window.removeEventListener(PAYMENT_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
                window.removeEventListener(REWARD_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
                window.removeEventListener(LOAN_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
                window.removeEventListener(ATTENDANCE_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            }
        };

    }, [router, selectedUser]);



    // Helper: Check if an item is overdue based on 2 PM rule

    // Derived Scoped Items — when viewing another user, use THEIR id and never keep session module bells.

    const inboxViewerIds = useMemo(() => {
        if (selectedUser) {
            return {
                objectId: selectedUser._id,
                empCode: selectedUser.employeeId,
            };
        }
        return {
            objectId: currentUserId,
            empCode: currentUserEmpId,
        };
    }, [selectedUser, currentUserId, currentUserEmpId]);

    const viewingOwnInbox = useMemo(() => {
        if (!selectedUser) return true;
        return (
            (currentUserId && String(selectedUser._id) === String(currentUserId)) ||
            (currentUserEmpId &&
                selectedUser.employeeId &&
                String(selectedUser.employeeId) === String(currentUserEmpId))
        );
    }, [selectedUser, currentUserId, currentUserEmpId]);

    const scopedItems = useMemo(() => {
        if (!userStats.items) return [];
        return userStats.items.filter((item) => {
            if (viewMode === 'teams') return true;

            if (requestScope === 'outgoing') {
                // Module-bell copies are inbox-only for the logged-in user; never My Requests.
                if (
                    item?._fromModuleNotifications ||
                    item?._fromModulePageNotifications ||
                    item?._fromModulePendingInbox
                ) {
                    return false;
                }
                if (item.scope) return item.scope === 'outgoing';
                const myId = inboxViewerIds.objectId;
                if (!myId) return true;
                const requesterId = item.employeeId?._id || item.employeeId || item.requestedById || item.targetEmployeeId;
                const isRequester =
                    String(requesterId) === String(myId) ||
                    (inboxViewerIds.empCode && String(requesterId) === String(inboxViewerIds.empCode));
                return isRequester;
            }

            return isIncomingCommandCenterItem(item, inboxViewerIds, {
                // Prepared items (own live merge or remote stats-merge) both use module copies.
                allowModuleCopies: true,
            });
        });
    }, [userStats.items, viewMode, requestScope, inboxViewerIds]);

    const scopedStats = useMemo(
        () => computeIncomingCommandCenterStats(scopedItems),
        [scopedItems],
    );

    const pendingTypeStats = useMemo(
        () => computePendingActivityByType(scopedItems),
        [scopedItems],
    );

    const overduePendingItems = useMemo(
        () =>
            scopedItems.filter(
                (item) =>
                    isDashboardPendingItem(item) &&
                    isOverdue(item.requestedDate, item.status, item.type),
            ),
        [scopedItems],
    );

    const overdueTypeStats = useMemo(
        () => computePendingActivityByType(overduePendingItems),
        [overduePendingItems],
    );

    const activityPieModeData = activityPieMode === 'Overdue' ? overdueTypeStats : pendingTypeStats;

    const typeFilteredItems = useMemo(() => {
        if (!activityTypeFilter) return scopedItems;
        return scopedItems.filter((item) => resolvePendingActivityType(item) === activityTypeFilter);
    }, [scopedItems, activityTypeFilter]);

    const typeFilteredStats = useMemo(
        () => computeIncomingCommandCenterStats(typeFilteredItems),
        [typeFilteredItems],
    );

    const typeFilteredOverdueCount = useMemo(
        () =>
            typeFilteredItems.filter(
                (item) =>
                    isDashboardPendingItem(item) &&
                    isOverdue(item.requestedDate, item.status, item.type),
            ).length,
        [typeFilteredItems],
    );

    const openActivityLog = (label) => {
        setActivityTypeFilter(label || null);
        setViewMode('requests');
        setFilter(activityPieMode === 'Overdue' ? 'Overdue' : 'Pending');
        setIsExpanded(true);
    };

    const closeCommandCenter = () => {
        setIsExpanded(false);
        setActivityTypeFilter(null);
    };

    const getFilteredItems = () => {

        const source = typeFilteredItems;



        switch (filter) {

            case 'Total':

                return source;

            case 'Completed':

                return source.filter(item => item.status === 'Approved' || item.status === 'Rejected');

            case 'Overdue':

                return source.filter(
                    (item) =>
                        isDashboardPendingItem(item) &&
                        isOverdue(item.requestedDate, item.status, item.type),
                );

            case 'Pending':

                return source.filter((item) => isDashboardPendingItem(item));

            default:

                return source.filter(item => item.status === filter);

        }

    };



    const { toast } = useToast();



    // Navigation Handler

    const prefetchNotificationDestination = (item) => {
        const path = buildDashboardNotificationPath(item);
        if (!path) return;
        try {
            router.prefetch?.(path);
        } catch {
            /* ignore */
        }
        const vehicleId = vehicleIdFromNotificationHref(path);
        if (vehicleId) {
            void warmVehicleDetailLight(vehicleId, {
                serviceId: serviceIdFromNotificationHref(path),
            });
        }
    };

    const handleRowClick = (item) => {
        if (!item) return;

        if (item.status === 'Approved' || item.status === 'Rejected') {
            toast({
                title: 'Opening Request',
                description: 'This request has already been actioned.',
            });
        }

        // Bulk asset assignment → open select/accept modal here (no Asset page redirect).
        const bulkGroupId = resolveBulkAssignmentGroupId(item);
        if (bulkGroupId) {
            setBulkAssignmentGroupId(bulkGroupId);
            return;
        }

        // Bulk leave / return / EOL / L&D / transfer / creation → list modal.
        if (isBulkActionInboxRow(item)) {
            setBulkActionRow(withBulkActionAssetIds(item));
            return;
        }

        const path = buildDashboardNotificationPath(item);
        if (path) {
            prefetchNotificationDestination(item);
            void ensureAssetFlowchartRoleMeta().catch(() => null);
            router.push(path);
            return;
        }

        toast({
            title: 'Unable to open task',
            description: 'No detail page is configured for this notification type.',
            variant: 'destructive',
        });
    };











    // Fetch hierarchy data for Team View (only employees with portal User accounts)
    useEffect(() => {

        if (!isExpanded || viewMode !== 'teams') return;

        let cancelled = false;

        const loadHierarchy = async () => {

            try {

                const res = await axiosInstance.get('/Employee/dashboard/hierarchy');

                if (cancelled) return;

                const flatList = res.data.hierarchy || [];

                const manager = res.data.manager;

                if (manager) {

                    const tree = buildTree(manager, flatList);

                    setHierarchyData(tree);

                    setTeamStats({});

                    // Only warm the visible top-level row(s). Children load on expand
                    // (TeamTableRow) — avoid N× module-feed fan-out for the whole tree.
                    const roots = Array.isArray(tree) ? tree : [tree];
                    roots.forEach((person) => {
                        if (person?._id) {
                            fetchEmployeeStats(person._id, person.employeeId);
                        }
                    });

                } else {

                    setHierarchyData([]);

                }

            } catch (error) {

                console.error("Failed to load hierarchy", error);

            }

        };

        loadHierarchy();

        return () => {

            cancelled = true;

        };

    }, [isExpanded, viewMode]);

    // Keep the logged-in user's Team Performance row identical to their Inbox cards.
    // Only when Command Center is actually showing *our* items (never when drilling into someone else).
    useEffect(() => {
        if (viewMode !== 'teams' || !currentUserId) return;
        if (!viewingOwnInbox) return;
        if (!Array.isArray(userStats.items)) return;

        const stats = countCommandCenterInboxStats(
            userStats.items,
            {
                objectId: currentUserId,
                empCode: currentUserEmpId,
            },
            { allowModuleCopies: true },
        );
        setTeamStats((prev) => ({
            ...prev,
            [currentUserId]: stats,
        }));
    }, [viewMode, currentUserId, currentUserEmpId, userStats.items, viewingOwnInbox]);

    // Team overview cards = sum of each person's exact dashboard Inbox counts (same as table rows).
    const aggregatedStats = useMemo(() => {
        const people = flattenHierarchyNodes(hierarchyData);
        return sumCommandCenterInboxStats(people.map((p) => teamStats[p._id]));
    }, [hierarchyData, teamStats]);



    const buildTree = (manager, allEmployees) => {

        if (!manager) return [];

        const list = Array.isArray(allEmployees) ? allEmployees : [];
        const seenIds = new Set();

        const getChildren = (parentId, visited = new Set()) => {
            const parentKey = String(parentId);
            if (visited.has(parentKey)) return [];

            const currentVisited = new Set(visited);
            currentVisited.add(parentKey);

            return list
                .filter((e) => {
                    const id = String(e._id);
                    if (seenIds.has(id) || currentVisited.has(id)) return false;
                    return String(e.primaryReportee) === parentKey;
                })
                .map((child) => {
                    const id = String(child._id);
                    seenIds.add(id);
                    return {
                        ...child,
                        _id: child._id,
                        children: getChildren(child._id, currentVisited),
                    };
                });
        };

        return [{
            ...manager,
            children: getChildren(manager._id, new Set()),
        }];

    };



    const fetchEmployeeStats = async (userId, empCode = null, { force = false } = {}) => {

        if (!userId) return;
        if (!force && teamStats[userId]) return; // Already fetched

        try {
            // Self: reuse already-merged Command Center items (exact live dashboard Inbox).
            const isSelf =
                (currentUserId && String(userId) === String(currentUserId)) ||
                (currentUserEmpId && empCode && String(empCode) === String(currentUserEmpId));

            const stats = await fetchCommandCenterInboxStatsForUser(axiosInstance, {
                targetUserId: userId,
                empCode,
                isOwnDashboard: isSelf,
                preloadedItems: isSelf && Array.isArray(userStats.items) && viewingOwnInbox
                    ? userStats.items
                    : null,
            });

            setTeamStats((prev) => ({
                ...prev,
                [userId]: stats,
            }));

        } catch (error) {

            console.error(`Failed to fetch stats for user ${userId}`, error);

        }

    };



    const toggleRow = (userId) => {

        setExpandedRows(prev => ({ ...prev, [userId]: !prev[userId] }));

    };



    // Recursive Table Row

    const TeamTableRow = ({ node, level = 0 }) => {

        const stats = teamStats[node._id] || { total: '-', completed: '-', overdue: '-', pending: '-', approved: '-', rejected: '-' };

        const hasChildren = node.children && node.children.length > 0;

        const isExpanded = expandedRows[node._id];



        // Fetch stats for children when expanded

        useEffect(() => {

            if (isExpanded && hasChildren) {

                node.children.forEach((child) =>
                    fetchEmployeeStats(child._id, child.employeeId),
                );

            }

        }, [isExpanded, hasChildren, node.children, fetchEmployeeStats]);



        return (

            <>

                <tr className="border-b border-slate-50 hover:bg-slate-50 transition-all">

                    <td className="py-4 px-4">

                        <div

                            className="flex items-center gap-2 cursor-pointer group-hover:bg-slate-100/50 p-1 rounded-md transition-all"

                            style={{ paddingLeft: `${level * 24}px` }}

                            onClick={() => {

                                setSelectedUser(node);

                                setViewMode('requests');

                            }}

                        >

                            {hasChildren ? (

                                <button

                                    onClick={(e) => {

                                        e.stopPropagation(); // Prevent row click when triggering expand

                                        toggleRow(node._id);

                                    }}

                                    className="p-1 hover:bg-slate-200 rounded-md transition-colors"

                                >

                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}

                                </button>

                            ) : (

                                <div className="w-6" /> // Spacer

                            )}

                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 overflow-hidden relative group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-blue-400 transition-all">

                                {node.profilePicture ? (

                                    <img src={node.profilePicture} alt="" className="w-full h-full object-cover" />

                                ) : (

                                    (node.firstName || 'U').charAt(0)

                                )}

                            </div>

                            <div>

                                <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{node.firstName} {node.lastName}</p>

                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{node.designation || 'Employee'}</p>

                            </div>

                        </div>

                    </td>

                    <td className="py-4 px-4 text-center font-bold text-slate-700">{stats.total}</td>

                    <td className="py-4 px-4 text-center font-bold text-cyan-600 bg-cyan-50/50 rounded-lg">{stats.completed}</td>

                    <td className="py-4 px-4 text-center font-bold text-red-600 bg-red-50/50 rounded-lg">{stats.overdue}</td>

                    <td className="py-4 px-4 text-center font-bold text-yellow-600 bg-yellow-50/50 rounded-lg">{stats.pending}</td>

                    <td className="py-4 px-4 text-center font-bold text-emerald-600 bg-emerald-50/50 rounded-lg">{stats.approved}</td>

                    <td className="py-4 px-4 text-center font-bold text-red-600 bg-red-50/50 rounded-lg">{stats.rejected}</td>

                </tr>

                {isExpanded && node.children && node.children.map(child => (

                    <TeamTableRow key={child._id} node={child} level={level + 1} />

                ))}

            </>

        );

    };



    return (

        <>

        <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans">

            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                <Navbar />



                <div className="flex-1 overflow-y-auto w-full p-3 sm:p-4 lg:px-5 lg:py-4 scrollbar-hide">

                    <motion.div
                        className="w-full space-y-3"
                        variants={dashboardStagger}
                        initial={reduceMotion ? false : 'hidden'}
                        animate="show"
                    >



                        <DashboardRequestHub />



                        {/* Dashboard Content Grid - Interactive Mode */}

                        <motion.div
                            className="grid grid-cols-12 gap-3 sm:gap-4 lg:gap-6"
                            variants={isExpanded ? dashboardItem : dashboardGrid}
                        >



                            {isExpanded ? (

                                /* EXPANDED VIEW: Command Center */

                                <div className="col-span-12 bg-white rounded-[20px] p-6 lg:p-8 shadow-sm border border-slate-100 animate-in fade-in zoom-in duration-300 min-h-[600px]">

                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">

                                        <div>

                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">

                                                {viewMode === 'teams'

                                                    ? `${selectedUser ? selectedUser.firstName : 'Your'} Team Overview`

                                                    : `${selectedUser ? selectedUser.firstName + "'s" : 'Request'} Command Center`

                                                }

                                            </h2>

                                            <p className="text-slate-500 text-sm mt-1">

                                                {viewMode === 'teams'

                                                    ? 'Each row uses that user’s exact dashboard Inbox counts; cards above are the sum of those rows.'

                                                    : activityTypeFilter
                                                        ? `Only ${pendingActivityTypeLegendLabel(activityTypeFilter)} requests — pending, overdue, completed, rejected, and total.`
                                                        : `Manage and track ${selectedUser ? selectedUser.firstName + "'s" : 'your'} requests in one place.`

                                                }

                                            </p>
                                            {viewMode === 'requests' && activityTypeFilter ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setActivityTypeFilter(null)}
                                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
                                                >
                                                    {pendingActivityTypeLegendLabel(activityTypeFilter)}
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            ) : null}

                                        </div>

                                        <div className="flex items-center gap-3">

                                            {/* Scope Toggles */}

                                            {viewMode === 'requests' && (

                                                <div className="flex bg-slate-100 p-1 rounded-full mr-2">

                                                    <button

                                                        onClick={() => setRequestScope('incoming')}

                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${requestScope === 'incoming' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}

                                                    >

                                                        Inbox

                                                    </button>

                                                    <button

                                                        onClick={() => setRequestScope('outgoing')}

                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${requestScope === 'outgoing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}

                                                    >

                                                        My Requests

                                                    </button>

                                                </div>

                                            )}



                                            {/* See Teams Button */}

                                            <button

                                                onClick={() => {
                                                    if (viewMode === 'requests') setActivityTypeFilter(null);
                                                    setViewMode(viewMode === 'requests' ? 'teams' : 'requests');
                                                }}

                                                className={`

                                                    flex items-center gap-2 px-4 py-2 rounded-full border font-bold text-sm transition-all

                                                    ${viewMode === 'teams'

                                                        ? 'bg-slate-900 text-white border-slate-900'

                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'

                                                    }

                                                `}

                                            >

                                                <Users className="w-4 h-4" />

                                                {viewMode === 'teams' ? 'View Requests' : 'See Teams'}

                                            </button>



                                            <button

                                                onClick={closeCommandCenter}

                                                className="self-start md:self-auto p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-blue-500 rounded-full transition-colors"

                                                title="Close Command Center"

                                            >

                                                <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6" />

                                            </button>

                                        </div>

                                    </div>



                                    {/* Action Filters - Always Visible */}

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">

                                        {(() => {

                                            const activeStats = viewMode === 'teams'
                                                ? aggregatedStats
                                                : activityTypeFilter
                                                    ? typeFilteredStats
                                                    : scopedStats;

                                            const overdueCount =
                                                viewMode === 'teams'
                                                    ? activeStats.overdue || 0
                                                    : activityTypeFilter
                                                        ? typeFilteredOverdueCount
                                                        : overdueTypeStats.total || 0;

                                            return [

                                                {

                                                    label: 'Pending', count: activeStats.pending || 0,

                                                    activeClass: 'bg-yellow-400 text-white border-yellow-400 shadow-yellow-200',

                                                    inactiveClass: 'bg-white text-yellow-600 border-slate-100 hover:border-yellow-200 hover:bg-yellow-50'

                                                },

                                                {

                                                    label: 'Approved', count: activeStats.approved || 0,

                                                    activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-200',

                                                    inactiveClass: 'bg-white text-emerald-600 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50'

                                                },

                                                {

                                                    label: 'Rejected', count: activeStats.rejected || 0,

                                                    activeClass: 'bg-rose-500 text-white border-rose-500 shadow-rose-200',

                                                    inactiveClass: 'bg-white text-rose-600 border-slate-100 hover:border-rose-200 hover:bg-rose-50'

                                                },

                                                {

                                                    label: 'Completed', count: activeStats.completed || 0,

                                                    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-blue-200',

                                                    inactiveClass: 'bg-white text-blue-600 border-slate-100 hover:border-blue-200 hover:bg-blue-50'

                                                },

                                                {

                                                    label: 'Overdue', count: overdueCount,

                                                    activeClass: 'bg-orange-600 text-white border-orange-600 shadow-orange-200',

                                                    inactiveClass: 'bg-white text-orange-600 border-slate-100 hover:border-orange-200 hover:bg-orange-50'

                                                },

                                                {

                                                    label: 'Total', count: activeStats.total || 0,

                                                    activeClass: 'bg-slate-800 text-white border-slate-800 shadow-slate-200',

                                                    inactiveClass: 'bg-white text-slate-600 border-slate-100 hover:border-slate-300 hover:bg-slate-50'

                                                }

                                            ].map((f) => (

                                                <button

                                                    key={f.label}

                                                    onClick={() => setFilter(f.label)}

                                                    className={`

                                                        flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 border h-28

                                                        ${filter === f.label

                                                            ? `${f.activeClass} shadow-xl scale-105 ring-4 ring-slate-50 z-10`

                                                            : `${f.inactiveClass} hover:-translate-y-1 hover:shadow-md`

                                                        }

                                                    `}

                                                >

                                                    <span className="text-3xl font-black mb-2">

                                                        {f.count}

                                                    </span>

                                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-90">

                                                        {f.label}

                                                    </span>

                                                </button>

                                            ));

                                        })()}

                                    </div>



                                    {viewMode === 'requests' ? (

                                        /* REQUESTS VIEW */

                                        <>

                                            {/* Table Section */}

                                            {/* Grouped Table Sections */}

                                            <div>

                                                {(() => {

                                                    const items = getFilteredItems();

                                                    if (items.length === 0) {

                                                        return (

                                                            <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">

                                                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">

                                                                    <LayoutGrid className="w-6 h-6 text-slate-300" />

                                                                </div>

                                                                <p className="text-slate-500 font-medium italic">
                                                                    No {filter.toLowerCase()}
                                                                    {activityTypeFilter
                                                                        ? ` ${pendingActivityTypeLegendLabel(activityTypeFilter).toLowerCase()}`
                                                                        : ''}{' '}
                                                                    items found.
                                                                </p>

                                                            </div>

                                                        );

                                                    }



                                                    // Group by sidebar modules (Company, Employees, … Tools Asset, Utility Bills, …)
                                                    const moduleGroups = groupCommandCenterByModule(items);

                                                    return moduleGroups.map(({ category, items: groupItems }) => (

                                                        <div key={category} className="mb-8 last:mb-0">

                                                            <div className="flex items-center gap-2 mb-4">

                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>

                                                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{category} <span className="text-slate-300 ml-1">({groupItems.length})</span></h3>

                                                            </div>



                                                            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-sm">

                                                                <table className="w-full">

                                                                    <thead>

                                                                        <tr className="border-b border-slate-50 bg-slate-50/30">

                                                                            <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested By</th>

                                                                            <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</th>

                                                                            <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>

                                                                            <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actioned Date</th>

                                                                        </tr>

                                                                    </thead>

                                                                    <tbody>

                                                                        {groupItems.map((item, index) => {

                                                                            const isMe = item.requestedBy === 'Me';
                                                                            const notice = formatCommandCenterNotificationMessage(item);



                                                                            return (

                                                                                <tr

                                                                                    key={`${item.actionId || item.id}_${index}`}

                                                                                    {...navHrefProps(buildDashboardNotificationPath(item) || '')}

                                                                                    onMouseEnter={() => prefetchNotificationDestination(item)}
                                                                                    onClick={() => handleRowClick(item)}

                                                                                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-all cursor-pointer group"

                                                                                >

                                                                                    <td className="py-3 px-4">

                                                                                        <div className="flex items-center gap-2">

                                                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isMe ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>

                                                                                                {(item.employeeName || item.requestedBy || (isMe ? userName : 'U')).charAt(0)}

                                                                                            </div>

                                                                                            <div className="flex flex-col gap-0.5 min-w-0">

                                                                                                <div className="flex items-center gap-1.5 flex-wrap">

                                                                                                    <span className={`text-sm font-medium ${isMe ? 'text-blue-700' : 'text-slate-600'}`}>

                                                                                                        {item.employeeName || item.requestedBy || (isMe ? 'Me' : 'Unknown')}

                                                                                                        {isMe && <span className="ml-1 text-xs font-bold text-blue-400 uppercase tracking-wider">(You)</span>}

                                                                                                    </span>

                                                                                                    {notice.chip ? (
                                                                                                        <span className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-100">
                                                                                                            {notice.chip}
                                                                                                        </span>
                                                                                                    ) : null}

                                                                                                </div>

                                                                                                <span className="text-[11px] text-slate-700 font-semibold tracking-tight line-clamp-1">
                                                                                                    {notice.title}
                                                                                                </span>
                                                                                                {notice.detail ? (
                                                                                                    <span className="text-[10px] text-slate-400 font-bold tracking-tight line-clamp-1">
                                                                                                        {notice.detail}
                                                                                                    </span>
                                                                                                ) : null}

                                                                                            </div>

                                                                                        </div>

                                                                                    </td>



                                                                                    <td className="py-3 px-4 text-xs text-slate-500 font-medium">

                                                                                        {item.requestedDate ? new Date(item.requestedDate).toLocaleDateString('en-US', { medium: 'date' }) : '-'}

                                                                                    </td>

                                                                                    <td className="py-3 px-4">

                                                                                        <span className={`

                                                                                            inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold capitalize tracking-wide

                                                                                            ${item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :

                                                                                                item.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border border-rose-100' :

                                                                                                    item.status === 'On Hold' ? 'bg-orange-50 text-orange-700 border border-orange-100' :

                                                                                                        'bg-amber-50 text-amber-600 border border-amber-100'}

                                                                                        `}>

                                                                                            <span className={`w-1 h-1 rounded-full mr-1.5 

                                                                                                ${item.status === 'Approved' ? 'bg-emerald-500' :

                                                                                                    item.status === 'Rejected' ? 'bg-rose-500' :

                                                                                                        item.status === 'On Hold' ? 'bg-orange-500' :

                                                                                                            'bg-amber-500'}

                                                                                            `}></span>

                                                                                            {item.status || 'Pending'}

                                                                                        </span>

                                                                                    </td>

                                                                                    <td className="py-3 px-4 text-xs text-slate-400 font-mono">

                                                                                        {item.actionedDate ? new Date(item.actionedDate).toLocaleDateString() : '-'}

                                                                                    </td>

                                                                                </tr>

                                                                            );

                                                                        })}

                                                                    </tbody>

                                                                </table>

                                                            </div>

                                                        </div>

                                                    ));

                                                })()}

                                            </div>

                                        </>

                                    ) : (

                                        /* TEAMS VIEW */

                                        <div>

                                            <div className="flex items-center gap-2 mb-6">

                                                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>

                                                <h3 className="text-sm font-black text-indigo-600 uppercase tracking-wider">Team Performance</h3>

                                            </div>



                                            <div className="overflow-x-auto">

                                                <table className="w-full">

                                                    <thead>

                                                        <tr className="border-b border-slate-100 bg-slate-50/50">

                                                            <th className="text-left py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Employees Under {selectedUser ? selectedUser.firstName : 'You'}</th>

                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Total</th>

                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</th>

                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue</th>

                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</th>

                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Approved</th>

                                                            <th className="text-center py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Rejected</th>

                                                        </tr>

                                                    </thead>

                                                    <tbody>

                                                        {hierarchyData.length > 0 ? (

                                                            hierarchyData.map(node => (

                                                                <TeamTableRow key={node._id} node={node} />

                                                            ))

                                                        ) : (

                                                            <tr>

                                                                <td colSpan="7" className="py-12 text-center text-slate-400 italic">

                                                                    Loading hierarchy...

                                                                </td>

                                                            </tr>

                                                        )}

                                                    </tbody>

                                                </table>

                                            </div>

                                        </div>

                                    )}

                                </div>

                            ) : (

                                /* DEFAULT VIEW: Summary Cards */

                                <>

                                    {/* Card 1: Request Activity (Pie Chart) - Clickable to Expand */}

                                    <motion.div

                                        variants={dashboardItem}

                                        whileHover={dashboardHover}

                                        onClick={() => {
                                            setActivityTypeFilter(null);
                                            setIsExpanded(true);
                                        }}

                                        className="dash-card-lift col-span-12 sm:col-span-6 lg:col-span-3 bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-5 shadow-sm border border-slate-100 flex flex-col min-h-[220px] sm:min-h-[280px] lg:h-[380px] lg:min-h-[380px] lg:max-h-[380px] cursor-pointer hover:border-blue-100 group relative overflow-hidden"

                                    >

                                        <div className="absolute top-0 right-0 p-2 sm:p-4">

                                            <span className="flex p-2 bg-slate-50 group-hover:bg-slate-100 text-slate-400 group-hover:text-blue-500 rounded-full transition-colors">

                                                <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6" />

                                            </span>

                                        </div>



                                        <div className="w-full mb-2 sm:mb-4">

                                            <h3 className="text-[10px] sm:text-xs lg:text-sm font-black text-slate-800 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Request Activity</h3>

                                            <p className="text-slate-400 text-[10px] sm:text-xs mt-1 sm:mt-2 leading-relaxed">
                                                {activityPieMode === 'Overdue' ? 'Overdue by type' : 'Pending by type'}
                                            </p>

                                        </div>

                                        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 overflow-hidden px-1">

                                            <ActivityPieChart
                                                data={activityPieModeData}
                                                mode={activityPieMode}
                                                pendingTotal={pendingTypeStats.total || 0}
                                                overdueTotal={overdueTypeStats.total || 0}
                                                onModeChange={setActivityPieMode}
                                                onSliceClick={openActivityLog}
                                                onCenterClick={() => openActivityLog()}
                                            />

                                        </div>

                                        <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-[9px] sm:text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">

                                            Click to view requests

                                        </div>

                                    </motion.div>



                                    {/* Card 2: Check In / Out with live timer */}
                                    <DashboardCheckInOutCard />



                                    {/* Card 3: My Attendance calendar (logged-in user) */}
                                    <DashboardAttendanceCalendar />

                                </>

                            )}

                        </motion.div>

                        {!isExpanded ? (
                            <>
                                <DashboardMyLeaveCard />
                                <DashboardMyRequestsCard />
                                <DashboardEmployeeHrCards />
                                <DashboardEmployeeAssetCards />
                            </>
                        ) : null}

                    </motion.div>

                </div>

            </div>

        </div>

        <BulkAssignmentAcknowledgeModal
            isOpen={!!bulkAssignmentGroupId}
            groupId={bulkAssignmentGroupId || ''}
            onClose={() => setBulkAssignmentGroupId(null)}
            onSuccess={() => {
                setBulkAssignmentGroupId(null);
                try {
                    window.dispatchEvent(new Event(ASSET_PENDING_INBOX_CHANGED));
                } catch {
                    /* ignore */
                }
            }}
        />
        <BulkPendingResolveModal
            isOpen={!!bulkActionRow}
            row={bulkActionRow}
            onClose={() => setBulkActionRow(null)}
            onSuccess={() => {
                setBulkActionRow(null);
                try {
                    invalidateAssetPendingInbox('all');
                    window.dispatchEvent(new Event(ASSET_PENDING_INBOX_CHANGED));
                } catch {
                    /* ignore */
                }
            }}
        />

        </>

    );

}

// Main export with Suspense wrapper
export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="flex h-screen bg-[#F8FAFC] items-center justify-center">
            <div className="text-slate-500">Loading dashboard...</div>
        </div>}>
            <DashboardContent />
        </Suspense>
    );
}

