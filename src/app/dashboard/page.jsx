'use client';

import { useEffect, useState, Suspense, useMemo, memo } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import Sidebar from '@/components/Sidebar';

import Navbar from '@/components/Navbar';

import axiosInstance from '@/utils/axios';

import { mergeExpiryNotificationDedupe } from '@/utils/expiryNotificationFallbacks';
import { buildDashboardNotificationPath } from '@/utils/dashboardNotificationRouting';
import { fetchEmployeeDashboardStats } from '@/utils/employeeDashboardStatsFetch';
import {
    groupCommandCenterByModule,
    formatCommandCenterNotificationMessage,
} from '@/utils/dashboardCommandCenterInbox';
import { ASSET_PENDING_INBOX_CHANGED } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { FINE_PENDING_INBOX_CHANGED } from '@/app/HRM/Fine/utils/finePendingInboxCount';
import { PAYMENT_PENDING_INBOX_CHANGED } from '@/app/Accounts/Payments/utils/paymentPendingInboxCount';
import { REWARD_PENDING_INBOX_CHANGED } from '@/app/HRM/Reward/utils/rewardPendingInboxCount';

import {
    isDashboardPendingItem,
    filterActionableDashboardItems,
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

    TrendingUp,

    Clock,

    X,

    LayoutGrid,

    ChevronDown,

    ChevronUp,

    ChevronRight,

    ArrowUpRight,

    PlayCircle,

    Users,

    Network

} from 'lucide-react';



import { useToast } from '@/hooks/use-toast';

import HierarchySelector from '@/components/HierarchySelector';

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

import { Doughnut } from 'react-chartjs-2';



ChartJS.register(ArcElement, Tooltip, Legend);

const isOverdue = isCommandCenterOverdue;

// Wrapper component to handle useSearchParams with Suspense

const ActivityPieChart = memo(function ActivityPieChart({ data, currentFilter = 'Total' }) {
    const displayValue = currentFilter === 'Total' ? (data.total || 0) : (data[currentFilter.toLowerCase()] || 0);
    const displayLabel = currentFilter;
    const isEmpty = (data.total || 0) === 0;

    const chartData = useMemo(() => ({
        labels: ['Pending', 'Approved', 'Rejected'],
        datasets: [{
            data: [data.pending || 0, data.approved || 0, data.rejected || 0],
            backgroundColor: ['#fbbf24', '#10b981', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 8,
            cutout: '75%',
        }],
    }), [data.pending, data.approved, data.rejected]);

    const emptyData = useMemo(() => ({
        labels: ['No Data'],
        datasets: [{ data: [1], backgroundColor: ['#f1f5f9'], borderWidth: 0, cutout: '75%' }],
    }), []);

    const options = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            datalabels: false,
            legend: { display: false },
            tooltip: {
                enabled: true,
                backgroundColor: '#0f172a',
                padding: 12,
                cornerRadius: 8,
                titleFont: { family: 'inherit', size: 13 },
                bodyFont: { family: 'inherit', size: 13, weight: 'bold' },
                callbacks: {
                    label(context) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        return ' ' + label + ': ' + value;
                    },
                },
            },
        },
        layout: { padding: 10 },
    }), []);

    return (
        <div className="flex flex-col items-center justify-center w-full">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 lg:w-48 lg:h-48 shrink-0">
                <Doughnut data={isEmpty ? emptyData : chartData} options={options} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 leading-none tracking-tight">{displayValue}</span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">{displayLabel}</span>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-3 sm:mt-6">
                <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-200"></div>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Approved</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-200"></div>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rejected</span>
                </div>
            </div>
        </div>
    );
});

function DashboardContent() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);

    const [userName, setUserName] = useState('User');

    const [currentUserId, setCurrentUserId] = useState(null);

    const [currentUserEmpId, setCurrentUserEmpId] = useState(null); // String ID (VEGA-xxx)

    const [requestScope, setRequestScope] = useState('incoming'); // 'incoming' (To Action) or 'outgoing' (My Requests)

    const [userStats, setUserStats] = useState({ pending: 0, approved: 0, rejected: 0, accepted: 0, total: 0, items: [] });

    const [derivedStats, setDerivedStats] = useState({ completed: 0, overdue: 0 });

    const [isExpanded, setIsExpanded] = useState(false);



    const [filter, setFilter] = useState('Pending');



    const [viewMode, setViewMode] = useState('requests'); // 'requests' or 'teams'

    const [hierarchyData, setHierarchyData] = useState([]);

    const [teamStats, setTeamStats] = useState({}); // Cache for employee stats: { empId: { pending: 0... } }

    const [expandedRows, setExpandedRows] = useState({}); // { empId: true/false }



    // Hierarchy State

    const [showHierarchyModal, setShowHierarchyModal] = useState(false);

    const [selectedUser, setSelectedUser] = useState(null); // null = self

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

                if (!hasTeam) {

                    const res = await axiosInstance.get('/Employee/dashboard/hierarchy');

                    if (res.data.hierarchy && res.data.hierarchy.length > 0) {

                        setHasTeam(true);

                    }

                }

            } catch (e) { console.error("Team check failed", e); }

        };



        checkTeam();

        fetchUserStats();

        let refreshTimer = null;
        const refreshFromModuleInbox = () => {
            // Never refresh / re-merge when inspecting another employee.
            if (!viewingOwnInbox) return;
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                fetchUserStats();
            }, 400);
        };
        if (typeof window !== 'undefined') {
            window.addEventListener(ASSET_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            window.addEventListener(FINE_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            window.addEventListener(PAYMENT_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
            window.addEventListener(REWARD_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
        }

        return () => {
            cancelled = true;
            if (refreshTimer) clearTimeout(refreshTimer);
            if (typeof window !== 'undefined') {
                window.removeEventListener(ASSET_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
                window.removeEventListener(FINE_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
                window.removeEventListener(PAYMENT_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
                window.removeEventListener(REWARD_PENDING_INBOX_CHANGED, refreshFromModuleInbox);
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



    const homeAttentionItems = useMemo(
        () => filterActionableDashboardItems(userStats.items || []),
        [userStats.items],
    );

    const scopedStats = useMemo(
        () => computeIncomingCommandCenterStats(scopedItems),
        [scopedItems],
    );



    const getFilteredItems = () => {

        const source = scopedItems;



        switch (filter) {

            case 'Total':

                return source;

            case 'Completed':

                return source.filter(item => item.status === 'Approved' || item.status === 'Rejected');

            case 'Overdue':

                return source.filter(item => isOverdue(item.requestedDate, item.status, item.type));

            case 'Pending':

                return source.filter((item) => isDashboardPendingItem(item));

            default:

                return source.filter(item => item.status === filter);

        }

    };



    const { toast } = useToast();



    // Navigation Handler

    const handleRowClick = (item) => {
        if (!item) return;

        if (item.status === 'Approved' || item.status === 'Rejected') {
            toast({
                title: 'Opening Request',
                description: 'This request has already been actioned.',
            });
        }

        const path = buildDashboardNotificationPath(item);
        if (path) {
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

                    // Exact dashboard Inbox counts for every person in the tree (no team-stats mix-in).
                    flattenHierarchyNodes(tree).forEach((person) => {
                        fetchEmployeeStats(person._id, person.employeeId, { force: true });
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

        <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans">

            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                <Navbar />



                <div className="flex-1 overflow-y-auto w-full p-3 sm:p-5 lg:p-10 scrollbar-hide">

                    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-10">



                        {/* New Header Section */}

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">

                            <div className="min-w-0">

                                <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">Hi, welcome back!</h1>

                                <p className="text-slate-500 font-medium mt-0.5 sm:mt-1 text-xs sm:text-sm leading-snug">Your HR performance and monitoring dashboard template.</p>

                            </div>

                            <div className="hidden md:block">

                                {/* Date or other actions can go here */}

                                <span className="text-slate-400 font-bold text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>

                            </div>

                        </div>



                        {/* Dashboard Content Grid - Interactive Mode */}

                        <div className="grid grid-cols-12 gap-3 sm:gap-4 lg:gap-6">



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

                                                    : `Manage and track ${selectedUser ? selectedUser.firstName + "'s" : 'your'} requests in one place.`

                                                }

                                            </p>

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

                                                onClick={() => setViewMode(viewMode === 'requests' ? 'teams' : 'requests')}

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

                                                onClick={() => setIsExpanded(false)}

                                                className="self-start md:self-auto p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"

                                                title="Close Command Center"

                                            >

                                                <ChevronUp className="w-6 h-6" />

                                            </button>

                                        </div>

                                    </div>



                                    {/* Action Filters - Always Visible */}

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">

                                        {(() => {

                                            const activeStats = viewMode === 'teams' ? aggregatedStats : scopedStats;



                                            return [

                                                {

                                                    label: 'Pending', count: activeStats.pending || 0,

                                                    activeClass: 'bg-yellow-400 text-white border-yellow-400 shadow-yellow-200',

                                                    inactiveClass: 'bg-white text-yellow-600 border-slate-100 hover:border-yellow-200 hover:bg-yellow-50'

                                                },

                                                {

                                                    label: 'Total', count: activeStats.total || 0,

                                                    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-blue-200',

                                                    inactiveClass: 'bg-white text-blue-600 border-slate-100 hover:border-blue-200 hover:bg-blue-50'

                                                },

                                                {

                                                    label: 'Completed', count: activeStats.completed || 0,

                                                    activeClass: 'bg-cyan-400 text-white border-cyan-400 shadow-cyan-200',

                                                    inactiveClass: 'bg-white text-cyan-600 border-slate-100 hover:border-cyan-200 hover:bg-cyan-50'

                                                },

                                                {

                                                    label: 'Approved', count: activeStats.approved || 0,

                                                    activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-200',

                                                    inactiveClass: 'bg-white text-emerald-600 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50'

                                                },

                                                 {
                                                     label: 'Rejected', count: activeStats.rejected || 0,
                                                     activeClass: 'bg-red-600 text-white border-red-600 shadow-red-200',
                                                     inactiveClass: 'bg-white text-red-600 border-slate-100 hover:border-red-200 hover:bg-red-50'
                                                 },
                                                 {
                                                     label: 'Overdue', count: activeStats.overdue || 0,
                                                     activeClass: 'bg-orange-600 text-white border-orange-600 shadow-orange-200',
                                                     inactiveClass: 'bg-white text-orange-600 border-slate-100 hover:border-orange-200 hover:bg-orange-50'
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

                                                                <p className="text-slate-500 font-medium italic">No {filter.toLowerCase()} items found.</p>

                                                            </div>

                                                        );

                                                    }



                                                    // Group by sidebar modules (Company, Employees, Fine, Reward, Vehicle Asset, Tools Asset, …)
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

                                    <div

                                        onClick={() => setIsExpanded(true)}

                                        className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[240px] lg:min-h-[300px] cursor-pointer hover:shadow-md hover:border-blue-100 transition-all group relative overflow-hidden"

                                    >

                                        <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-0 group-hover:opacity-100 transition-opacity">

                                            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />

                                        </div>



                                        <div className="w-full mb-2 sm:mb-4">

                                            <h3 className="text-[10px] sm:text-xs lg:text-sm font-black text-slate-800 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Request Activity</h3>

                                            <p className="text-slate-400 text-[10px] sm:text-xs mt-1 sm:mt-2 leading-relaxed">Status Overview</p>

                                        </div>

                                        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">

                                            <ActivityPieChart data={scopedStats} currentFilter={filter} size={45} />

                                        </div>

                                        <div className="mt-2 sm:mt-4 text-[9px] sm:text-xs font-bold text-center text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">

                                            Click to view details

                                        </div>

                                    </div>



                                    {/* Card 2: Net Profit Margin (Dummy) */}

                                    <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[200px] sm:min-h-[240px] lg:min-h-[300px]">

                                        <div>

                                            <h3 className="text-[10px] sm:text-xs lg:text-sm font-black text-slate-800 uppercase tracking-wider">Net Profit Margin</h3>

                                            <p className="text-slate-400 text-[10px] sm:text-xs mt-1 sm:mt-2 leading-relaxed">Measures your business at generating prof... <span className="text-blue-500 cursor-pointer hover:underline">Learn more</span></p>

                                        </div>

                                        <div className="flex items-center justify-center py-2 sm:py-4">

                                            <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full flex items-center justify-center">

                                                {/* Background Circle */}

                                                <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 160 160">

                                                    <circle cx="80" cy="80" r="70" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />

                                                    <circle cx="80" cy="80" r="70" stroke="#3b82f6" strokeWidth="12" fill="transparent" strokeDasharray="440" strokeDashoffset="140" strokeLinecap="round" />

                                                </svg>

                                                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-blue-600">68%</span>

                                            </div>

                                        </div>

                                    </div>



                                    {/* Card 3: Your Balance (Dummy) */}

                                    <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-5 lg:p-8 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[180px] sm:min-h-[240px] lg:min-h-[300px] relative overflow-hidden">

                                        <div className="flex justify-between items-start z-10 gap-2">

                                            <div className="min-w-0">

                                                <p className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1">Your Balance</p>

                                                <h3 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight break-words">$780,560<span className="text-base sm:text-xl lg:text-2xl text-slate-400">.00</span></h3>

                                            </div>

                                            <div className="bg-blue-600 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded font-black italic tracking-tighter text-xs sm:text-lg shrink-0">VISA</div>

                                        </div>



                                        <div className="z-10 mt-3 sm:mt-0">

                                            <p className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 sm:mb-2">Your Account Number</p>

                                            <div className="flex items-center gap-2 sm:gap-4 text-slate-900 text-sm sm:text-lg lg:text-xl font-black tracking-widest flex-wrap">

                                                <span>••••</span>

                                                <span>••••</span>

                                                <span>••••</span>

                                                <span>5637</span>

                                            </div>

                                        </div>



                                        <div className="flex justify-between items-end z-10 border-t border-slate-100 pt-6 mt-4">

                                            <div>

                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Holder</p>

                                                <p className="text-sm font-bold text-slate-700">Alicia Christensen</p>

                                            </div>

                                            <div>

                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Type</p>

                                                <p className="text-sm font-bold text-slate-700">Savings</p>

                                            </div>

                                        </div>



                                        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/4 opacity-5 pointer-events-none">

                                            <TrendingUp className="w-64 h-64 text-slate-900" />

                                        </div>

                                    </div>



                                    {/* NEW: Pending Approvals Quick List (Always visible in Default View) */}

                                    <div className="col-span-12 bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-5 lg:p-8 shadow-sm border border-slate-100 min-h-0 sm:min-h-[280px] lg:min-h-[400px]">

                                        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6 lg:mb-8">

                                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">

                                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">

                                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />

                                                </div>

                                                <div className="min-w-0">

                                                    <h3 className="text-sm sm:text-base lg:text-lg font-black text-slate-900 tracking-tight">Pending Approvals</h3>

                                                    <p className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase tracking-widest mt-0.5">Needs Your Attention</p>

                                                </div>

                                            </div>

                                            <button

                                                onClick={() => { setFilter('Pending'); setIsExpanded(true); }}

                                                className="text-blue-600 text-[9px] sm:text-xs font-black uppercase tracking-widest hover:text-blue-700 transition-colors bg-blue-50 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full shrink-0"

                                            >

                                                View All

                                            </button>

                                        </div>



                                        <div className="space-y-2 sm:space-y-4">

                                            {homeAttentionItems.length > 0 ? (

                                                homeAttentionItems.slice(0, 5).map((item, idx) => {
                                                    const notice = formatCommandCenterNotificationMessage(item);

                                                    return (

                                                    <div

                                                        key={`${item.id}-${item.actionId || ''}-${idx}`}

                                                        {...navHrefProps(buildDashboardNotificationPath(item) || '')}

                                                        onClick={() => handleRowClick(item)}

                                                        className="group flex items-center justify-between gap-2 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all cursor-pointer"

                                                    >

                                                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">

                                                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">

                                                                <span className="text-slate-900 font-black text-[10px] sm:text-xs">{(item.requestedBy || 'E').charAt(0)}</span>

                                                            </div>

                                                            <div className="min-w-0">

                                                                <p className="text-xs sm:text-sm font-black text-slate-800 tracking-tight truncate">
                                                                    {notice.title}
                                                                </p>
                                                                {notice.detail ? (
                                                                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold tracking-tight line-clamp-1 mt-0.5">
                                                                        {notice.detail}
                                                                    </p>
                                                                ) : null}

                                                            </div>

                                                        </div>

                                                        <div className="text-right shrink-0">

                                                            <p className="text-[10px] sm:text-xs font-bold text-slate-900">{new Date(item.requestedDate).toLocaleDateString()}</p>

                                                        </div>

                                                    </div>

                                                    );
                                                })
                                            ) : (

                                                <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">

                                                    <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">

                                                        <Clock className="w-6 h-6 text-slate-200" />

                                                    </div>

                                                    <p className="text-slate-400 font-bold text-sm tracking-tight italic">No pending requests at the moment.</p>

                                                </div>

                                            )}

                                        </div>

                                    </div>

                                </>

                            )}

                        </div>



                        {/* Row 2: Financial Ratios & Details (Dummy) - Only show if NOT expanded */}

                        {!isExpanded && (

                            <div className="grid grid-cols-12 gap-3 sm:gap-4 lg:gap-6 mt-3 sm:mt-4 lg:mt-6">



                                {/* Col 1: Ratios Card - Span 6 */}

                                <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-0 sm:min-h-[240px] lg:min-h-[300px]">

                                    <div className="space-y-4 sm:space-y-6 lg:space-y-8">

                                        {/* Quick Ratio */}

                                        <div>

                                            <div className="flex justify-between items-baseline gap-2 mb-1.5 sm:mb-2">

                                                <h3 className="text-[10px] sm:text-xs lg:text-sm font-black text-slate-800 uppercase tracking-wider">Quick Ratio</h3>

                                                <span className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">0.9:8</span>

                                            </div>

                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">

                                                <div className="h-full w-[45%] bg-amber-400 rounded-full"></div>

                                            </div>

                                            <p className="text-[10px] text-slate-400 mt-2">Quick Ratio Goal: 1.0 or higher</p>

                                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">

                                                Measures your Current Assets + Accounts Receivable / Current Liabilities <span className="text-blue-500 cursor-pointer hover:underline">Learn more</span>

                                            </p>

                                        </div>



                                        {/* Current Ratio */}

                                        <div>

                                            <div className="flex justify-between items-baseline gap-2 mb-1.5 sm:mb-2">

                                                <h3 className="text-[10px] sm:text-xs lg:text-sm font-black text-slate-800 uppercase tracking-wider">Current Ratio</h3>

                                                <span className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">2.8</span>

                                            </div>

                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">

                                                <div className="h-full w-[70%] bg-emerald-500 rounded-full"></div>

                                            </div>

                                            <p className="text-[10px] text-slate-400 mt-2">Quick Ratio Goal: 2.0 or higher</p>

                                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">

                                                Measures your Current Assets / Current Liabilities. <span className="text-blue-500 cursor-pointer hover:underline">Learn more</span>

                                            </p>

                                        </div>

                                    </div>



                                </div>



                                {/* Col 2 & 3: 4-Card Grid Stats - Span 6 */}

                                <div className="col-span-12 lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">

                                    {/* Total Income */}

                                    <div className="bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col justify-between">

                                        <div>

                                            <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-4">Total Income</h3>

                                            {/* Dummy Mini Bar Chart */}

                                            <div className="flex items-end gap-1 h-6 sm:h-8 mb-2 sm:mb-4">

                                                <div className="w-1.5 sm:w-2 bg-blue-600 rounded-t-sm h-[40%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-blue-600 rounded-t-sm h-[70%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-blue-600 rounded-t-sm h-[50%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-purple-600 rounded-t-sm h-[100%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-purple-600 rounded-t-sm h-[60%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-purple-600 rounded-t-sm h-[80%]"></div>

                                            </div>

                                            <h4 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 mb-1">$ 83,320<span className="text-sm sm:text-base lg:text-lg text-slate-400">.50</span></h4>

                                            <p className="text-[10px] sm:text-xs font-bold text-emerald-500">18.2% <span className="text-slate-400 font-medium">higher vs previous month</span></p>

                                        </div>

                                    </div>



                                    {/* Total Expenses */}

                                    <div className="bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col justify-between">

                                        <div>

                                            <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-4">Total Expenses</h3>

                                            {/* Dummy Mini Bar Chart */}

                                            <div className="flex items-end gap-1 h-6 sm:h-8 mb-2 sm:mb-4">

                                                <div className="w-1.5 sm:w-2 bg-blue-400 rounded-t-sm h-[60%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-blue-400 rounded-t-sm h-[30%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-blue-400 rounded-t-sm h-[50%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-blue-400 rounded-t-sm h-[40%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-blue-400 rounded-t-sm h-[80%]"></div>

                                            </div>

                                            <h4 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 mb-1">$ 32,370<span className="text-sm sm:text-base lg:text-lg text-slate-400">.00</span></h4>

                                            <p className="text-[10px] sm:text-xs font-bold text-red-500">0.7% <span className="text-slate-400 font-medium">higher vs previous month</span></p>

                                        </div>

                                    </div>



                                    {/* Accounts Receivable */}

                                    <div className="bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col justify-between">

                                        <div>

                                            <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-4">Accounts Receivable</h3>

                                            {/* Dummy Mini Bar Chart */}

                                            <div className="flex items-end gap-1 h-6 sm:h-8 mb-2 sm:mb-4">

                                                <div className="w-1.5 sm:w-2 bg-emerald-400 rounded-t-sm h-[50%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-emerald-400 rounded-t-sm h-[70%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-emerald-400 rounded-t-sm h-[40%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-emerald-400 rounded-t-sm h-[80%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-emerald-400 rounded-t-sm h-[60%]"></div>

                                            </div>

                                            <h4 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 mb-1">$ 9,112<span className="text-sm sm:text-base lg:text-lg text-slate-400">.00</span></h4>

                                            <p className="text-[10px] sm:text-xs font-bold text-emerald-500">0.7% <span className="text-slate-400 font-medium">higher vs previous month</span></p>

                                        </div>

                                    </div>



                                    {/* Accounts Payable */}

                                    <div className="bg-white rounded-2xl sm:rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col justify-between">

                                        <div>

                                            <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-4">Accounts Payable</h3>

                                            {/* Dummy Mini Bar Chart */}

                                            <div className="flex items-end gap-1 h-6 sm:h-8 mb-2 sm:mb-4">

                                                <div className="w-1.5 sm:w-2 bg-pink-500 rounded-t-sm h-[40%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-pink-500 rounded-t-sm h-[60%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-pink-500 rounded-t-sm h-[30%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-pink-500 rounded-t-sm h-[90%]"></div>

                                                <div className="w-1.5 sm:w-2 bg-pink-500 rounded-t-sm h-[50%]"></div>

                                            </div>

                                            <h4 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 mb-1">$ 8,216<span className="text-sm sm:text-base lg:text-lg text-slate-400">.00</span></h4>

                                            <p className="text-[10px] sm:text-xs font-bold text-emerald-500">0.7% <span className="text-slate-400 font-medium">higher vs previous month</span></p>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        )}





                    </div>

                </div>

            </div>

        </div>

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

