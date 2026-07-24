'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { navigateFromList, rememberListFilterStep, syncBrowserUrl } from '@/utils/listReturnNavigation';
import ListTableRowLink from '@/components/ListTableRowLink';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { navHrefProps } from '@/utils/linkContextMenu';
import axiosInstance from '@/utils/axios';
import FineFlowManager from './components/FineFlowManager';
import PendingFineRequestsModal from './components/PendingFineRequestsModal';
import {
    countVisibleFinePendingInbox,
    notifyFinePendingInboxChanged,
} from './utils/finePendingInboxCount';
import { fetchFinePendingInbox } from '@/utils/pendingInboxFetch';
import { clearModuleNotificationFeedsCache } from '@/utils/moduleNotifications';
import { Trash2, X, Pencil, ChevronDown, ChevronRight, Bell } from 'lucide-react';
import { buildFineFocusElementId, runFineListFocusScroll } from '@/utils/fineNotificationRouting';
import {
    buildGroupMembersForFine,
    buildGroupRowFromMembers,
    buildGroupMemberDetailHref,
    canViewGroupFinePartiesIndividually,
    getFineBaseId,
    isCompanyFineParty,
    isMultiPartyFine,
} from '@/utils/fineGroupClassification';
import {
    resolveCompanyFinePayableAmount,
    resolveEmployeeFinePayableAmount,
} from '@/utils/finePayableAmount';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import { useToast } from '@/hooks/use-toast';
import ErpErrorBanner from '@/components/ErpErrorBanner';
import { isAdmin } from '@/utils/permissions';
import { canAccessAddFine } from '@/app/HRM/Fine/utils/finePermissionAccess';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell, LabelList
} from 'recharts';
import RechartsBox from '@/components/charts/RechartsBox';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Pie } from 'react-chartjs-2';

// Register ChartJS
ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 600 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime;
        let animationFrame;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;

            if (progress < duration) {
                const percentage = progress / duration;
                const easeOut = 1 - Math.pow(1 - percentage, 4);
                setCount(Math.floor(easeOut * value));
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <>{count}</>;
};

function FinePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [fines, setFines] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddFlow, setShowAddFlow] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [fineToDelete, setFineToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [selectedEmployeeFines, setSelectedEmployeeFines] = useState(null);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [selectedTypeFines, setSelectedTypeFines] = useState(null);

    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
    const [selectedFineType, setSelectedFineType] = useState(() => searchParams.get('fineType') || '');
    const [expandedGroups, setExpandedGroups] = useState({});
    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'group');
    const [selectedStatus, setSelectedStatus] = useState(() => searchParams.get('status') || 'Pending');
    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);
    const [pendingInboxCount, setPendingInboxCount] = useState(0);
    const fetchingRef = useRef(false);
    const searchParamsRef = useRef(searchParams);
    searchParamsRef.current = searchParams;

    const listReturnParams = useMemo(() => ({
        search: searchQuery,
        fineType: selectedFineType,
        status: selectedStatus,
        tab: activeTab,
    }), [searchQuery, selectedFineType, selectedStatus, activeTab]);

    usePersistListReturnState(listReturnParams);

    useLayoutEffect(() => {
        const status = searchParams.get('status');
        if (status) setSelectedStatus((prev) => (prev === status ? prev : status));
        const tab = searchParams.get('tab');
        if (tab) setActiveTab((prev) => (prev === tab ? prev : tab));
        const fineType = searchParams.get('fineType');
        if (fineType !== null) setSelectedFineType((prev) => (prev === fineType ? prev : fineType));
        const search = searchParams.get('search');
        if (search !== null) setSearchQuery((prev) => (prev === search ? prev : search));
    }, [searchParams]);

    useEffect(() => {
        const params = new URLSearchParams(searchParamsRef.current.toString());
        if (searchQuery) params.set('search', searchQuery);
        else params.delete('search');
        if (selectedFineType) params.set('fineType', selectedFineType);
        else params.delete('fineType');
        if (selectedStatus && selectedStatus !== 'Pending') params.set('status', selectedStatus);
        else if (selectedStatus === 'Pending') params.set('status', 'Pending');
        else params.delete('status');
        if (activeTab && activeTab !== 'group') params.set('tab', activeTab);
        else params.delete('tab');
        const queryString = params.toString();
        const newUrl = queryString ? `/HRM/Fine?${queryString}` : '/HRM/Fine';
        const currentFull = `${window.location.pathname}${window.location.search}`;
        if (newUrl !== currentFull) {
            rememberListFilterStep(newUrl);
            syncBrowserUrl(newUrl);
        }
    }, [searchQuery, selectedFineType, selectedStatus, activeTab]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch employees for dropdown in modal
    const fetchEmployees = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Employee');
            setEmployees(response.data.employees || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    }, []);

    // Fetch fines from backend
    const fetchFines = useCallback(async () => {
        if (fetchingRef.current) {
            return;
        }

        try {
            fetchingRef.current = true;
            setLoading(true);
            setError('');

            // Fetch with high limit to support client-side filtering
            // ideally this should be moved to server-side filtering in the future
            const response = await axiosInstance.get('/Fine?limit=1000');
            const finesData = response.data.fines || response.data || [];

            // 1. Group by base fine ID (split rows like VEGA-FINE-0001-A / -B)
            const groups = {};
            finesData.forEach((fine) => {
                if (!fine || typeof fine !== 'object') return;
                const baseId = getFineBaseId(fine);
                if (!groups[baseId]) groups[baseId] = [];
                groups[baseId].push(fine);
            });

            // 2. Transform groups into display rows
            const processed = Object.entries(groups).map(([groupKey, members]) => {
                const first = members[0];
                const isSplitGroup = members.length > 1;

                const allAssigned = [];
                let totalGroupAmount = 0;

                members.forEach((m) => {
                    const mAssigned = m.assignedEmployees || [];
                    const memberCompanyId = m.company?.companyId || m.company?._id || m.company ||
                        first.company?.companyId || first.company?._id || first.company;
                    mAssigned.forEach((emp) => {
                        const isCompany = isCompanyFineParty(emp);
                        const payable = isCompany
                            ? resolveCompanyFinePayableAmount(m, emp)
                            : resolveEmployeeFinePayableAmount(m, emp.employeeId);
                        allAssigned.push({
                            ...emp,
                            isCompany,
                            individualAmount: payable || emp.individualAmount,
                            fineAmount: payable || emp.fineAmount,
                            _id: m._id,
                            recordFineId: m.fineId,
                            fineStatus: m.fineStatus || 'Pending',
                            companyId: memberCompanyId,
                        });
                    });
                    const empAmt = parseFloat(m.employeeAmount || 0) || 0;
                    const compAmt = parseFloat(m.companyAmount || 0) || 0;
                    const sc = parseFloat(m.serviceCharge || 0) || 0;
                    const fromParts = empAmt + compAmt + sc;
                    const stored = parseFloat(m.totalFineAmount || m.fineAmount || 0) || 0;
                    totalGroupAmount += fromParts > 0 ? fromParts : stored;
                });

                if (isSplitGroup) {
                    return buildGroupRowFromMembers(first, groupKey, members, allAssigned, totalGroupAmount);
                }

                if (isMultiPartyFine(first)) {
                    const groupMembers = buildGroupMembersForFine(first);
                    if (groupMembers.length > 1) {
                        const syntheticAssigned = groupMembers.map((member) => ({
                            employeeId: member.isCompany ? 'VEGA-HR-0000' : member.employeeId,
                            employeeName: member.employeeName,
                            individualAmount: member.fineAmount,
                            isCompany: member.isCompany,
                            _id: member.fineRecordId,
                            recordFineId: member.fineId,
                            fineStatus: member.fineStatus,
                            companyId: member.companyId,
                        }));
                        const totalAmount = groupMembers.reduce(
                            (sum, m) => sum + (parseFloat(m.fineAmount) || 0),
                            0,
                        );
                        return buildGroupRowFromMembers(
                            first,
                            groupKey,
                            members,
                            syntheticAssigned,
                            totalAmount || parseFloat(first.fineAmount) || 0,
                        );
                    }
                }

                const emp = allAssigned[0] || first.assignedEmployees?.[0] || {};
                const isCompanyRec = isCompanyFineParty(emp);

                const displayAmount = isCompanyRec
                    ? resolveCompanyFinePayableAmount(first, emp)
                    : resolveEmployeeFinePayableAmount(first, emp.employeeId || first.employeeId);

                return {
                    ...first,
                    fineId: first.fineId,
                    isGroup: false,
                    employeeId: isCompanyRec ? null : (emp.employeeId || first.employeeId || 'N/A'),
                    employeeName: emp.employeeName || first.employeeName || 'N/A',
                    fineStatus: first.fineStatus || 'Pending',
                    displayAmount,
                    _uiKey: first._id,
                    isCompanyOnly: isCompanyRec,
                };
            });

            setFines(processed);
        } catch (err) {
            console.error('Error fetching fines:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch fines');
            setFines([]);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);

    const fetchPendingInboxCount = useCallback(async ({ force = false } = {}) => {
        try {
            const items = await fetchFinePendingInbox(axiosInstance, { skipToast: true, force });
            setPendingInboxCount(countVisibleFinePendingInbox(items));
            notifyFinePendingInboxChanged();
        } catch {
            setPendingInboxCount(0);
            notifyFinePendingInboxChanged();
        }
    }, []);

    useEffect(() => {
        if (mounted) {
            fetchFines();
            fetchEmployees();
            fetchPendingInboxCount();
        }
    }, [mounted, fetchFines, fetchEmployees, fetchPendingInboxCount]);

    const handleAddFine = () => {
        setShowAddFlow(true);
    };

    const handleModalSuccess = () => {
        fetchFines();
        fetchPendingInboxCount();
    };

    const handleDeleteClick = (fine) => {
        setFineToDelete(fine);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!fineToDelete) return;

        try {
            setIsDeleting(true);
            await axiosInstance.delete(`/Fine/${fineToDelete._id}`);
            toast({
                title: "Success",
                description: "Fine record deleted successfully",
                variant: "success",
            });
            notifyFinePendingInboxChanged();
            clearModuleNotificationFeedsCache();
            fetchFines();
            fetchPendingInboxCount({ force: true });
        } catch (err) {
            console.error('Error deleting fine:', err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to delete fine",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setFineToDelete(null);
        }
    };

    const filteredFines = useMemo(() => {
        if (!fines || !Array.isArray(fines)) return [];

        let result = fines;

        // Filter by Status (default: Pending)
        if (selectedStatus !== 'All') {
            if (selectedStatus === 'Pending') {
                // Show all pending statuses and draft: Pending, Pending HR, Pending Accounts, Pending Authorization, Draft, etc.
                result = result.filter(fine => {
                    const status = (fine.fineStatus || '').toLowerCase();
                    return status.includes('pending') || status === 'draft';
                });
            } else {
                // Exact match for other statuses
                result = result.filter(fine => fine.fineStatus === selectedStatus);
            }
        }

        // Filter by Fine Type or Category
        if (selectedFineType) {
            if (selectedFineType === 'Other') {
                // 'Other' in the dashboard boxes acts as a catch-all for types not specifically categorized in other boxes
                const specificTypes = ['Vehicle Fine', 'Vehicle Damage', 'Safety Fine', 'Project Damage', 'Loss & Damage'];
                result = result.filter(fine => !specificTypes.includes(fine.fineType));
            } else if (selectedFineType === 'Damage' || selectedFineType === 'Violation') {
                result = result.filter(fine => fine.category === selectedFineType || fine.fineType === selectedFineType);
            } else if (selectedFineType === 'Other Fines') {
                result = result.filter(fine =>
                    fine.fineType === 'Other Fines' || fine.subCategory === 'Other Fines' ||
                    fine.fineType === 'Other Damage' || fine.subCategory === 'Other Damage'
                );
            } else {
                result = result.filter(fine => fine.fineType === selectedFineType);
            }
        }

        // Filter by Tab
        if (activeTab === 'individual') {
            result = result.filter(fine => !fine.isGroup);
        } else if (activeTab === 'group') {
            result = result.filter(fine => fine.isGroup);
        }

        // Filter by Search Query
        const query = searchQuery.toLowerCase().trim();
        if (query) {
            result = result.filter(fine =>
                (fine.fineId && fine.fineId.toLowerCase().includes(query)) ||
                (fine.employeeId && fine.employeeId.toLowerCase().includes(query)) ||
                (fine.employeeName && fine.employeeName.toLowerCase().includes(query)) ||
                (fine.fineType && fine.fineType.toLowerCase().includes(query)) ||
                (fine.fineStatus && fine.fineStatus.toLowerCase().includes(query))
            );
        }

        return result;
    }, [fines, searchQuery, selectedFineType, activeTab, selectedStatus]);

    const focusFineParam = searchParams.get('focusFine');

    useEffect(() => {
        if (loading || !focusFineParam) return undefined;
        return runFineListFocusScroll(focusFineParam);
    }, [loading, focusFineParam, filteredFines.length, activeTab, selectedStatus, selectedFineType]);

    if (!mounted) {
        return null;
    }

    // Prepare Dashboard Stats
    // Flatten confirmed fines to count individuals/entities instead of request groups
    const confirmedFines = fines.filter(f => ['Approved', 'Active', 'Completed'].includes(f.fineStatus));
    const pendingCollectionFines = fines.filter(f => ['Approved', 'Active'].includes(f.fineStatus));

    const flattenedConfirmed = [];
    confirmedFines.forEach(f => {
        if (f.isGroup && f.groupMembers) {
            f.groupMembers.forEach(m => {
                flattenedConfirmed.push({
                    ...f,
                    employeeName: m.employeeName,
                    employeeId: m.employeeId,
                    displayAmount: m.fineAmount,
                    fineId: m.fineId,
                    isGroup: false
                });
            });
        } else {
            flattenedConfirmed.push(f);
        }
    });

    const dashboardStats = {
        count: flattenedConfirmed.length,
        value: confirmedFines.reduce((acc, f) => acc + (f.displayAmount || 0), 0),
        outstanding: pendingCollectionFines.reduce((acc, f) => acc + (f.displayAmount || 0), 0),
        vehicle: flattenedConfirmed.filter(f => f.fineType === 'Vehicle Fine').length,
        vehicleDamage: flattenedConfirmed.filter(f => f.fineType === 'Vehicle Damage').length,
        safety: flattenedConfirmed.filter(f => f.fineType === 'Safety Fine').length,
        project: flattenedConfirmed.filter(f => f.fineType === 'Project Damage').length,
        lossDamage: flattenedConfirmed.filter(f => f.fineType === 'Loss & Damage').length,
        other: flattenedConfirmed.filter(f => !['Vehicle Fine', 'Vehicle Damage', 'Safety Fine', 'Project Damage', 'Loss & Damage'].includes(f.fineType)).length,
    };

    // Prepare Chart Data
    // 1. Finer User (Top Users by Fine Count)
    const userMap = {};
    flattenedConfirmed.forEach(f => {
        const name = f.employeeName || 'N/A';
        userMap[name] = (userMap[name] || 0) + 1;
    });
    const finerUserData = Object.entries(userMap)
        .map(([name, value]) => ({ name: name.split(' ')[0], fullName: name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    // 2. Fine Type (Pie Chart)
    const typeMap = {};
    const typeListMap = {};
    flattenedConfirmed.forEach(f => {
        const type = f.fineType || 'Other';
        typeMap[type] = (typeMap[type] || 0) + 1;
        if (!typeListMap[type]) typeListMap[type] = [];
        typeListMap[type].push(f);
    });
    const fineTypeData = {
        labels: Object.keys(typeMap),
        datasets: [{
            data: Object.values(typeMap),
            backgroundColor: ['#F97316', '#15803D', '#3B82F6', '#A855F7', '#10B981', '#6366F1'],
            borderWidth: 0,
            borderColor: 'transparent',
            lists: Object.values(typeListMap)
        }]
    };

    return (
        <>
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                        {/* Header and Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">Fine Management</h1>
                                <p className="text-sm sm:text-base text-gray-600">
                                    Manage employee fines and split liability tracking
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setPendingInboxModalOpen(true)}
                                    className="relative p-1.5 sm:p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800 shrink-0"
                                    title="Fine notifications assigned to you"
                                >
                                    <Bell size={20} />
                                    {pendingInboxCount > 0 ? (
                                        <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none flex items-center justify-center border-2 border-white shadow-sm tabular-nums">
                                            {pendingInboxCount > 99 ? '99+' : pendingInboxCount}
                                        </span>
                                    ) : null}
                                </button>

                                {/* Search */}
                                <div className="relative flex-1 min-w-[140px] sm:min-w-[180px] max-w-md">
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <path d="m21 21-4.35-4.35"></path>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search Fines"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white shadow-sm transition-all"
                                    />
                                </div>

                                {/* Add Fine Button */}
                                {canAccessAddFine() ? (
                                <button
                                    onClick={handleAddFine}
                                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14"></path>
                                    </svg>
                                    Add Fine
                                </button>
                                ) : null}
                            </div>
                        </div>

                        {/* Redesigned Dashboard Header */}
                        <div className={HEADER_PAIR_GRID}>
                            {/* Left Panel: Statistics Grid */}
                            <div className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 ${HEADER_PAIR_CARD_DASHBOARD}`}>
                                <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 shrink-0">Fine Overview</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 flex-1">
                                    {[
                                        { label: 'Total Fines', value: dashboardStats.count, color: 'text-red-600', filter: '' },
                                        { label: 'Fine Value', value: dashboardStats.value, color: 'text-red-600', isCurrency: true },
                                        { label: 'Outstanding', value: dashboardStats.outstanding, color: 'text-red-600', isCurrency: true },
                                        { label: 'Other', value: dashboardStats.other, color: 'text-red-600', filter: 'Other' },
                                        { label: 'Vehicle', value: dashboardStats.vehicle, color: 'text-red-600', filter: 'Vehicle Fine' },
                                        { label: 'Veh Damage', value: dashboardStats.vehicleDamage, color: 'text-red-600', filter: 'Vehicle Damage' },
                                        { label: 'Safety', value: dashboardStats.safety, color: 'text-red-600', filter: 'Safety Fine' },
                                        { label: 'Project', value: dashboardStats.project, color: 'text-red-600', filter: 'Project Damage' },
                                        { label: 'Los/Damage', value: dashboardStats.lossDamage, color: 'text-red-600', filter: 'Loss & Damage' },
                                    ].map((item, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => item.filter !== undefined && setSelectedFineType(item.filter)}
                                            className="bg-gray-50 p-2 sm:p-3 lg:p-4 rounded-xl flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-gray-200"
                                        >
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2 break-words text-center leading-tight">{item.label}</span>
                                            <div
                                                className="flex items-baseline justify-center gap-1 font-black group-hover:scale-105 transition-transform"
                                                style={{ color: '#dc2626' }}
                                            >
                                                {item.isCurrency ? (
                                                    <>
                                                        <span className="text-sm font-bold">AED</span>
                                                        <span className="text-lg sm:text-xl lg:text-2xl"><AnimatedCounter value={item.value} /></span>
                                                    </>
                                                ) : (
                                                    <span className="text-xl sm:text-2xl lg:text-3xl"><AnimatedCounter value={item.value} /></span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Panel: Charts */}
                            <div className={`bg-white p-3 sm:p-4 lg:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 sm:gap-4 lg:gap-6 ${HEADER_PAIR_CARD_DASHBOARD}`}>
                                {/* Bar Chart: Finer User */}
                                <div className="flex-[3] flex flex-col min-h-0 min-w-0">
                                    <h3 className="text-xs sm:text-sm font-bold text-gray-400 text-center uppercase tracking-widest mb-2 sm:mb-4 shrink-0">Finer User</h3>
                                    <div className="flex-1 min-h-0 min-w-0">
                                        <RechartsBox height={220} minHeight={180} className="h-full">
                                            <BarChart data={finerUserData} margin={{ top: 15, right: 0, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="fineBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#1E3A8A" stopOpacity={1} />
                                                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.8} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis
                                                    dataKey="name"
                                                    fontSize={10}
                                                    axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                                    tickLine={false}
                                                    dy={5}
                                                />
                                                <YAxis hide={true} />
                                                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                <Bar
                                                    dataKey="value"
                                                    radius={[4, 4, 0, 0]}
                                                    barSize={24}
                                                    animationDuration={1200}
                                                    onClick={(data) => {
                                                        if (data) {
                                                            const employeeFines = flattenedConfirmed.filter(f => f.employeeName === data.fullName);
                                                            setSelectedEmployeeFines({
                                                                fullName: data.fullName,
                                                                value: data.value,
                                                                fines: employeeFines
                                                            });
                                                            setIsEmpModalOpen(true);
                                                        }
                                                    }}
                                                    cursor="pointer"
                                                >
                                                    {finerUserData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill="url(#fineBarGradient)" />
                                                    ))}
                                                    <LabelList dataKey="value" position="top" style={{ fill: '#DC2626', fontSize: '11px', fontWeight: '800' }} />
                                                </Bar>
                                            </BarChart>
                                        </RechartsBox>
                                    </div>
                                </div>

                                {/* Pie Chart: Fine Type */}
                                <div className="flex-[2] flex flex-col items-center justify-center min-h-0 min-w-0">
                                    <h3 className="text-xs sm:text-sm font-bold text-gray-400 text-center uppercase tracking-widest mb-2 sm:mb-4 shrink-0">Fine Type</h3>
                                    <div className="w-full max-w-[230px] aspect-square flex items-center justify-center relative min-h-0">
                                        <Pie
                                            data={fineTypeData}
                                            plugins={[ChartDataLabels]}
                                            options={{
                                                plugins: {
                                                    legend: { display: false },
                                                    datalabels: {
                                                        color: '#fff',
                                                        font: {
                                                            weight: 'bold',
                                                            size: 14
                                                        },
                                                        formatter: (value) => value
                                                    }
                                                },
                                                maintainAspectRatio: false,
                                                onClick: (event, elements) => {
                                                    if (elements && elements.length > 0) {
                                                        const index = elements[0].index;
                                                        const label = fineTypeData.labels[index];
                                                        const list = fineTypeData.datasets[0].lists[index] || [];

                                                        setSelectedTypeFines({
                                                            title: label,
                                                            fines: list
                                                        });
                                                        setIsTypeModalOpen(true);
                                                    }
                                                },
                                                onHover: (event, elements) => {
                                                    event.native.target.style.cursor = (elements && elements.length > 0) ? 'pointer' : 'default';
                                                },
                                                animation: {
                                                    animateRotate: true,
                                                    animateScale: true,
                                                    duration: 1200,
                                                    easing: 'easeOutQuart'
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex items-center gap-4 sm:gap-6 lg:gap-10 mb-4 sm:mb-6 lg:mb-8 border-b border-gray-200 px-1 sm:px-2 overflow-x-auto">
                            <button
                                type="button"
                                {...navHrefProps('/HRM/Fine')}
                                onClick={() => setActiveTab('individual')}
                                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'individual'
                                    ? 'text-blue-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                    Individual Fine
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'individual' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {fines.filter(f => !f.isGroup).length}
                                    </span>
                                </div>
                                {activeTab === 'individual' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.3)]" />
                                )}
                            </button>

                            <button
                                type="button"
                                {...navHrefProps('/HRM/Fine?tab=group')}
                                onClick={() => setActiveTab('group')}
                                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'group'
                                    ? 'text-blue-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="9" cy="7" r="4"></circle>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                    Group Fine
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'group' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {fines.filter(f => f.isGroup).length}
                                    </span>
                                </div>
                                {activeTab === 'group' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.3)]" />
                                )}
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Fine Directory</h2>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                {selectedFineType && (
                                    <button
                                        onClick={() => setSelectedFineType('')}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-1 cursor-pointer transition-all"
                                    >
                                        CLEAR FILTER: {selectedFineType.toUpperCase()}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                )}
                                {/* Status Filter Dropdown */}
                                <div className="relative min-w-[140px] sm:min-w-[180px] flex-1 sm:flex-none">
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        className="w-full h-[34px] sm:h-[38px] px-3 sm:px-4 border border-gray-800/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white appearance-none cursor-pointer shadow-sm transition-all font-medium"
                                    >
                                        <option value="All">All Statuses</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Pending HR">Pending HR</option>
                                        <option value="Pending Accounts">Pending Accounts</option>
                                        <option value="Pending Authorization">Pending Authorization</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Active">Active</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Paid">Paid</option>
                                        <option value="Rejected">Rejected</option>
                                        <option value="Cancelled">Cancelled</option>
                                        <option value="Draft">Draft</option>
                                    </select>
                                </div>
                                {/* Fine Type Filter Dropdown */}
                                <div className="relative min-w-[140px] sm:min-w-[200px] flex-1 sm:flex-none">
                                    <select
                                        value={selectedFineType}
                                        onChange={(e) => setSelectedFineType(e.target.value)}
                                        className="w-full h-[34px] sm:h-[38px] px-3 sm:px-4 border border-gray-800/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white appearance-none cursor-pointer shadow-sm transition-all"
                                    >
                                        <option value="">All Fine Types</option>
                                        <option value="Vehicle Fine">Vehicle Fine</option>
                                        <option value="Vehicle Damage">Vehicle Damage</option>
                                        <option value="Safety Fine">Safety Fine</option>
                                        <option value="Violation">Violation</option>
                                        <option value="Project Damage">Project Damage</option>
                                        <option value="Loss & Damage">Loss & Damage</option>
                                        <option value="Other Fines">Other Fines</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && <ErpErrorBanner className="mb-4" />}

                        {/* Fines Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-[640px] sm:min-w-[780px] lg:min-w-0 table-auto text-xs sm:text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                FINE ID
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                EMP. ID
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                NAME
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                COMPANY
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                FINE TYPE
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                AMOUNT
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                STATUS
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                ACTIONS
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="8" className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                                                    Loading fines...
                                                </td>
                                            </tr>
                                        ) : filteredFines.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="px-2 sm:px-4 lg:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                                                    No fines found. Click "Add Fine" to create one.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredFines.map((fine) => {
                                                const isCompanyRow = fine.isCompany || fine.employeeName === 'Vega Digital IT Solutions';
                                                const isGroupRow = fine.isGroup === true;
                                                const isExpanded = expandedGroups[fine._uiKey];
                                                // Individual party rows only after management approval.
                                                const isGroupSeparated = canViewGroupFinePartiesIndividually(fine.fineStatus);
                                                const canExpandGroup = isGroupRow && isGroupSeparated && (fine.groupMembers?.length > 0);

                                                const focusIds = (fine._ids || [fine._id]).filter(Boolean).map(String);
                                                const rowFocusId = focusIds[0] || fine._id;

                                                // Pending group = one common request; navigate to shared detail.
                                                // After approval = expand to individual party rows.
                                                const isNavigableFine = isGroupRow
                                                    ? !isGroupSeparated && !isCompanyRow
                                                    : !isCompanyRow;
                                                const fineHref = isNavigableFine
                                                    ? (isGroupRow
                                                        ? `/HRM/Fine/${encodeURIComponent(fine.fineId)}?view=group`
                                                        : `/HRM/Fine/${encodeURIComponent(fine.fineId)}`)
                                                    : '';

                                                return (
                                                    <React.Fragment key={fine._uiKey || fine._id || fine.fineId}>
                                                        <ListTableRowLink
                                                            href={fineHref}
                                                            router={router}
                                                            enabled={isNavigableFine}
                                                        >
                                                        <tr
                                                            id={buildFineFocusElementId(rowFocusId)}
                                                            data-fine-focus-ids={focusIds.join(',')}
                                                            onClick={
                                                                canExpandGroup
                                                                    ? () => {
                                                                          setExpandedGroups((prev) => ({
                                                                              ...prev,
                                                                              [fine._uiKey]: !prev[fine._uiKey],
                                                                          }));
                                                                      }
                                                                    : undefined
                                                            }
                                                            className={`relative transition-colors ${isGroupRow
                                                                ? 'bg-gray-100 hover:bg-gray-200 cursor-pointer'
                                                                : isCompanyRow
                                                                    ? 'cursor-default transition-none'
                                                                    : 'hover:bg-gray-50 cursor-pointer'
                                                                }`}
                                                        >
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                                                                <div className="flex items-center gap-2">
                                                                    {canExpandGroup && (
                                                                        <span className="text-gray-400">
                                                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                        </span>
                                                                    )}
                                                                    {fine.fineId}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-700">
                                                                <div className="relative z-10 pointer-events-none">
                                                                    {isGroupRow ? (
                                                                        <span className="text-gray-500 uppercase tracking-tighter">
                                                                            Group ({fine.empCount + (fine.hasCompanyShare ? 1 : 0)})
                                                                        </span>
                                                                    ) : isCompanyRow ? (
                                                                        <span className="text-gray-400 font-medium italic">Internal</span>
                                                                    ) : (fine.employeeId || '').replace(/\s+/g, '')}
                                                                </div>
                                                            </td>
                                                            <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-gray-700 ${isGroupRow && fine.hasCompanyShare ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
                                                                <div className="relative z-10 pointer-events-none">
                                                                    {isGroupRow ? (
                                                                        <span className="text-gray-500 font-bold uppercase tracking-wide italic">
                                                                            {`Group Request (${fine.empCount} Emps${fine.hasCompanyShare ? ' + Co.' : ''})`}
                                                                        </span>
                                                                    ) : fine.employeeName}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                <div className="relative z-10 pointer-events-none">
                                                                    {fine.companyName || 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                <div className="relative z-10 pointer-events-none">
                                                                    {fine.fineType}
                                                                    {fine.accessoryName ? (
                                                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                                                            <span className="font-semibold text-gray-500">Accessory:</span> {fine.accessoryName}
                                                                        </div>
                                                                    ) : fine.assetName ? (
                                                                        <div className="text-[10px] text-gray-400 mt-0.5"><span className="font-semibold text-gray-500">Asset:</span> {fine.assetName}</div>
                                                                    ) : null}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-red-600 font-bold">
                                                                <div className="relative z-10 pointer-events-none">
                                                                    {Number(fine.displayAmount || 0).toLocaleString()} AED
                                                                </div>
                                                            </td>
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap">
                                                                <div className="relative z-10 pointer-events-none">
                                                                    <span
                                                                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${fine.fineStatus === 'Active' || fine.fineStatus === 'Approved' || fine.fineStatus === 'Completed'
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                            : fine.fineStatus === 'Pending HR'
                                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                                : fine.fineStatus === 'Pending Accounts'
                                                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                                    : fine.fineStatus === 'Pending Authorization' || fine.fineStatus === 'Pending Management'
                                                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                                        : fine.fineStatus === 'Rejected' || fine.fineStatus === 'Cancelled'
                                                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                            }`}
                                                                    >
                                                                        {fine.fineStatus || 'Pending'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-right">
                                                                <div className="relative z-20 flex items-center justify-end gap-2">
                                                                    {(!isGroupRow || !isGroupSeparated) && (
                                                                        <button
                                                                            type="button"
                                                                            {...navHrefProps(
                                                                                !isCompanyRow && fine.fineId
                                                                                    ? (isGroupRow
                                                                                        ? `/HRM/Fine/${encodeURIComponent(fine.fineId)}?view=group`
                                                                                        : `/HRM/Fine/${encodeURIComponent(fine.fineId)}`)
                                                                                    : '',
                                                                            )}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isCompanyRow || !fine.fineId) return;
                                                                                navigateFromList(
                                                                                    router,
                                                                                    isGroupRow
                                                                                        ? `/HRM/Fine/${encodeURIComponent(fine.fineId)}?view=group`
                                                                                        : `/HRM/Fine/${encodeURIComponent(fine.fineId)}`,
                                                                                );
                                                                            }}
                                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                            title={isGroupRow ? 'Open Group Fine' : 'Edit Fine'}
                                                                        >
                                                                            <Pencil size={18} />
                                                                        </button>
                                                                    )}
                                                                    {(isAdmin() || canAccessAddFine()) && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteClick(fine);
                                                                            }}
                                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                            title="Delete Fine Transaction"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        </ListTableRowLink>

                                                        {/* Expanded Group Members — only after management approval */}
                                                        {isGroupRow && isGroupSeparated && isExpanded && fine.groupMembers.map((member, mIdx) => {
                                                            const memberHref = buildGroupMemberDetailHref(fine, member);
                                                            const canOpenMember = Boolean(memberHref);

                                                            return (
                                                            <ListTableRowLink
                                                                key={`${fine._uiKey}-member-${mIdx}`}
                                                                href={memberHref || ''}
                                                                router={router}
                                                                enabled={canOpenMember}
                                                            >
                                                            <tr
                                                                className={`bg-gray-50/50 hover:bg-blue-50/30 border-l-4 border-blue-400 transition-colors ${canOpenMember ? 'cursor-pointer' : 'cursor-default'}`}
                                                            >
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-xs font-mono text-gray-400 pl-8 sm:pl-12 italic">
                                                                    ↳ {member.fineId}
                                                                </td>
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-xs font-bold text-gray-600">
                                                                    {member.isCompany ? (
                                                                        <span className="text-blue-600 font-semibold italic">
                                                                            Company (Click to View)
                                                                        </span>
                                                                    ) : member.employeeId}
                                                                </td>
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-xs text-gray-600">
                                                                    {member.employeeName}
                                                                </td>
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-xs text-gray-500">
                                                                    {fine.companyName}
                                                                </td>
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-xs text-gray-500">
                                                                    {fine.fineType}
                                                                </td>
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-xs text-red-500 font-bold">
                                                                    {Number(member.fineAmount || 0).toLocaleString()} AED
                                                                </td>
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 whitespace-nowrap">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${member.fineStatus === 'Active' || member.fineStatus === 'Approved' || member.fineStatus === 'Completed'
                                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                        : 'bg-gray-100 text-gray-600 border-gray-200'
                                                                        }`}>
                                                                        {member.fineStatus}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right">
                                                                    {canOpenMember && (
                                                                        <span
                                                                            className="text-blue-600 text-xs font-semibold"
                                                                            title="View Fine Details"
                                                                        >
                                                                            View Details
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            </ListTableRowLink>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <FineFlowManager
                isOpen={showAddFlow}
                onClose={() => setShowAddFlow(false)}
                onSuccess={handleModalSuccess}
                employees={employees}
            />

            <PendingFineRequestsModal
                isOpen={pendingInboxModalOpen}
                onClose={() => setPendingInboxModalOpen(false)}
                onRefreshParent={() => {
                    fetchFines();
                    fetchPendingInboxCount({ force: true });
                }}
                onPendingInboxCount={setPendingInboxCount}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Fine Transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this fine record? If this is a split fine, all associated employee/company entries for this transaction will be removed. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {isTypeModalOpen && selectedTypeFines && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsTypeModalOpen(false)}
                    ></div>
                    <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    Category: {selectedTypeFines.title}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Total Records: {selectedTypeFines.fines.length}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsTypeModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {selectedTypeFines.fines.map((fine, idx) => (
                                <div
                                    key={fine._id || idx}
                                    {...navHrefProps(fine.fineId ? `/HRM/Fine/${fine.fineId}` : '')}
                                    onClick={() => {
                                        setIsTypeModalOpen(false);
                                        navigateFromList(router, `/HRM/Fine/${fine.fineId}`);
                                    }}
                                    className="group p-4 rounded-2xl border border-gray-100 hover:border-red-200 hover:bg-red-50/50 transition-all cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 group-hover:text-red-700 transition-colors">
                                                {fine.employeeName || 'N/A'}
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium">
                                                ID: {fine.fineId} • {fine.fineStatus}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${fine.fineStatus === 'Active' || fine.fineStatus === 'Approved' || fine.fineStatus === 'Completed'
                                            ? 'bg-green-100 text-green-700'
                                            : fine.fineStatus === 'Pending'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {fine.fineStatus}
                                        </span>
                                        <span className="text-sm font-bold text-red-600">
                                            {Number(fine.displayAmount || 0).toLocaleString()} AED
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isEmpModalOpen && selectedEmployeeFines && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsEmpModalOpen(false)}
                    ></div>
                    <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    Fines: {selectedEmployeeFines.fullName}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Total Fine Records: {selectedEmployeeFines.value}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsEmpModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {selectedEmployeeFines.fines.map((fine, idx) => (
                                <div
                                    key={fine._id || idx}
                                    {...navHrefProps(fine.fineId ? `/HRM/Fine/${fine.fineId}` : '')}
                                    onClick={() => {
                                        setIsEmpModalOpen(false);
                                        navigateFromList(router, `/HRM/Fine/${fine.fineId}`);
                                    }}
                                    className="group p-4 rounded-2xl border border-gray-100 hover:border-red-200 hover:bg-red-50/50 transition-all cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 group-hover:text-red-700 transition-colors">
                                                {fine.fineType || 'Fine'}
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium">
                                                ID: {fine.fineId} • {fine.fineStatus}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${fine.fineStatus === 'Active' || fine.fineStatus === 'Approved' || fine.fineStatus === 'Completed'
                                            ? 'bg-green-100 text-green-700'
                                            : fine.fineStatus === 'Pending'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {fine.fineStatus}
                                        </span>
                                        <span className="text-sm font-bold text-red-600">
                                            {Number(fine.displayAmount || 0).toLocaleString()} AED
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>


                    </div>
                </div>
            )}
        </>
    );
}

export default function FinePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <FinePageContent />
        </Suspense>
    );
}
