'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import {
    Network,
    Plus,
    Search,
    ChevronDown,
    Trash2,
    X,
    ArrowRight,
    RotateCcw,
    Building2, // Changed from Building
    Users, // Changed from User
    Check,
    Printer, Download, AlertTriangle, MapPin, ShieldCheck, DollarSign, Wallet, Briefcase, ChevronRight, Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

const RESPONSIBILITY_CATEGORIES = [
    { id: 'hr', label: 'HR Admin' },
    { id: 'accounts', label: 'Financial Controller' },
    { id: 'assetcontroller', label: 'Asset Controller' },
    { id: 'management', label: 'General Management' },
    { id: 'admincontroller', label: 'System Admin' }
];

const BUSINESS_MODULES = [
    { id: 'fine', label: 'Fine Approval', color: 'from-orange-500 to-rose-600', shadow: 'shadow-orange-100', icon: 'AlertCircle' },
    { id: 'reward', label: 'Reward Tracking', color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-100', icon: 'Award' },
    { id: 'loan', label: 'Loan Processing', color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-100', icon: 'DollarSign' },
    { id: 'advance', label: 'Advance Request', color: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-100', icon: 'Zap' }
];

export default function GlobalFlowChartPage() {
    const router = useRouter();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState('responsibilities');
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allEmployees, setAllEmployees] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [responsibilities, setResponsibilities] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Modal State
    const [modalType, setModalType] = useState(null); // 'addCustomResponsibility' | 'assignEmployee'
    const [modalData, setModalData] = useState({});
    const [modalErrors, setModalErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUserEmpId, setCurrentUserEmpId] = useState(null);
    const [currentUserEmpCustomId, setCurrentUserEmpCustomId] = useState(null);
    const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
    const [pendingActions, setPendingActions] = useState([]);

    useEffect(() => {
        const userData = localStorage.getItem('employeeUser') || localStorage.getItem('user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                setCurrentUserEmpId(user.employeeObjectId || user._id);
                setCurrentUserEmpCustomId(user.employeeId);
                setCurrentUserIsAdmin(['Admin', 'CEO', 'Director', 'General Manager'].includes(user.role) || user.isAdmin);
            } catch (e) {
                console.error("Error parsing user data:", e);
            }
        }
    }, []);

    const fetchPendingActions = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/Employee/dashboard/user-stats');
            setPendingActions(res.data.items?.filter(i => i.type === 'Responsibility Approval' && i.status === 'Pending') || []);
        } catch (err) {
            console.error("Error fetching actions:", err);
        }
    }, []);

    useEffect(() => {
        if (currentUserEmpId) fetchPendingActions();
    }, [currentUserEmpId, fetchPendingActions]);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [respDropdownOpen, setRespDropdownOpen] = useState(false);
    const respDropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (respDropdownRef.current && !respDropdownRef.current.contains(event.target)) {
                setRespDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/Company');
            const comps = response.data.companies || [];
            setCompanies(comps);
            if (comps.length > 0) {
                // If we don't have a selection, default to the first one
                if (!selectedCompanyId) {
                    setSelectedCompanyId(comps[0].companyId);
                }
            }
        } catch (err) {
            console.error('Error fetching companies:', err);
            const errMsg = err.response?.data?.message || "Failed to fetch companies";
            toast({ title: "System Error", description: errMsg, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [selectedCompanyId, toast]);

    const fetchCompanyData = useCallback(async (compId) => {
        if (!compId) return;
        try {
            const response = await axiosInstance.get(`/Company/${compId}`);
            setCompany(response.data.company);
            setResponsibilities(response.data.company.responsibilities || []);
        } catch (err) {
            console.error('Error fetching company details:', err);
        }
    }, []);

    const fetchAllData = useCallback(async () => {
        try {
            // Fetch ALL employees across all companies
            const empRes = await axiosInstance.get('/Employee', { params: { limit: 1000 } });
            setAllEmployees(empRes.data.employees || empRes.data || []);

            const userRes = await axiosInstance.get('/User', { params: { limit: 1000 } });
            setAllUsers(userRes.data.users || userRes.data || []);
        } catch (err) {
            console.error('Error fetching employees/users:', err);
        }
    }, []);

    useEffect(() => {
        fetchCompanies();
        fetchAllData();
    }, [fetchCompanies, fetchAllData]);

    useEffect(() => {
        if (selectedCompanyId) {
            fetchCompanyData(selectedCompanyId);
        }
    }, [selectedCompanyId, fetchCompanyData]);

    const handleModalOpen = (type, data = {}) => {
        setModalType(type);
        setModalData(data);
        setModalErrors({});
        setRespDropdownOpen(false);
    };

    const handleModalClose = () => {
        setModalType(null);
        setModalData({});
        setModalErrors({});
    };

    // Helper to check if an existing assignment is valid
    const getAssignmentError = (resp) => {
        const emp = allEmployees.find(e => e.employeeId === resp.employeeId || e._id === resp.empObjectId);
        if (!emp) return "Profile not found";
        return null;
    };

    const handleRemoveConfirm = async () => {
        if (itemToDelete === null) return;
        const updated = responsibilities.filter((_, i) => i !== itemToDelete);

        setResponsibilities(updated);
        try {
            // Update ONLY the selected company
            await axiosInstance.patch(`/Company/${selectedCompanyId}`, { responsibilities: updated });

            toast({ title: "Updated", description: "Role removed successfully." });
        } catch (err) {
            console.error('Error removing responsibility:', err);
            toast({ title: "Sync Error", description: "Failed to sync update across all companies", variant: "destructive" });
        } finally {
            setItemToDelete(null);
        }
    };

    const handleAssignEmployee = async (emp, user) => {
        if (!selectedCategory) return;
        setIsSubmitting(true);
        try {
            const newResp = {
                employeeId: emp.employeeId,
                empObjectId: user._id,
                employeeName: `${emp.firstName} ${emp.lastName}`,
                designation: emp.designation,
                email: emp.companyEmail || emp.workEmail || emp.email || user.email,
                category: selectedCategory,
                status: 'Pending'
            };

            // Update local state first for responsiveness
            // setResponsibilities(prev => [...prev.filter(r => r.category !== modalData.category), newResp]);

            // Update ONLY the selected company
            await axiosInstance.patch(`/Company/${selectedCompanyId}`, {
                responsibilities: [...(responsibilities || []), newResp],
                isGlobalFlowUpdate: false
            });

            toast({ title: "Assignment Sent", description: "Employee will be notified for approval." });

            // Refresh ALL data to keep everything in sync
            await Promise.all([
                fetchCompanies(),
                fetchCompanyData(selectedCompanyId),
                fetchPendingActions()
            ]);

            setModalType(null);
        } catch (err) {
            console.error("Sync error:", err);
            toast({ title: "Error", description: err.response?.data?.message || "Failed to sync responsibilities", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRespondToResponsibility = async (action, actionId, category) => {
        setIsSubmitting(true);
        try {
            await axiosInstance.put(`/Company/${selectedCompanyId}/respond-responsibility`, {
                action: action,
                actionId: actionId,
                category: category
            });
            toast({ title: "Success", description: `Responsibility ${action}ed successfully.` });
            fetchCompanyData(selectedCompanyId);
            fetchPendingActions();
        } catch (err) {
            console.error("Response error:", err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to process response",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC]">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-y-auto bg-slate-50/50">
                    <div className="p-8 max-w-[1600px] mx-auto w-full">
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-white rounded-3xl shadow-sm border border-slate-100">
                                    <Network className="w-8 h-8 text-blue-600" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Organization Flow</h1>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Organization-Specific Responsibilities</p>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex items-center gap-4 mb-8 bg-white p-1.5 rounded-[1.5rem] shadow-sm border border-slate-100 w-fit">
                            <button
                                onClick={() => setActiveTab('responsibilities')}
                                className={`px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300 ${activeTab === 'responsibilities'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-y-[-2px]'
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
                                    }`}
                            >
                                Responsibilities
                            </button>
                            <button
                                onClick={() => setActiveTab('flowchart')}
                                className={`px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300 ${activeTab === 'flowchart'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-y-[-2px]'
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
                                    }`}
                            >
                                Flow Chart
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'responsibilities' ? (
                                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-10 min-h-[600px]">
                                    <div className="flex items-center justify-between mb-10">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900">Responsibility Matrix</h3>
                                            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mt-1 italic">Source of Truth for Fine, Loan, Reward & Advance Approvals</p>
                                        </div>

                                        <div className="relative" ref={respDropdownRef}>
                                            {/* <button
                                                onClick={() => setRespDropdownOpen(!respDropdownOpen)}
                                                className="bg-slate-900 hover:bg-blue-600 text-white px-8 py-4 rounded-2xl text-sm font-black transition-all shadow-xl shadow-slate-200 flex items-center gap-3 transform hover:scale-105 active:scale-95"
                                            >
                                                Add New Role <ChevronDown size={18} />
                                            </button> */}
                                            {respDropdownOpen && (
                                                <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-3 z-50 animate-in fade-in zoom-in duration-200">
                                                    <button
                                                        onClick={() => handleModalOpen('addCustomResponsibility')}
                                                        className="w-full text-left px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center gap-3"
                                                    >
                                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                                            <Plus size={16} />
                                                        </div>
                                                        Custom Responsibility
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-[2rem] border border-slate-50">
                                        <table className="w-full border-separate border-spacing-y-4 px-2">
                                            <thead>
                                                <tr className="text-left">
                                                    <th className="px-8 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Position / Category</th>
                                                    <th className="px-8 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Assignment</th>
                                                    <th className="px-8 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Designation</th>
                                                    <th className="px-8 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right pr-12">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Default Categories */}
                                                {RESPONSIBILITY_CATEGORIES.map((cat) => {
                                                    const catResps = responsibilities.filter(r => r.category === cat.id);
                                                    const pendingResp = catResps.find(r => r.status === 'Pending');
                                                    const activeResp = catResps.find(r => r.status === 'Active');

                                                    // If pending exists, show ONLY pending. Otherwise show active.
                                                    const displayResps = pendingResp ? [pendingResp] : (activeResp ? [activeResp] : []);

                                                    if (displayResps.length === 0) {
                                                        return (
                                                            <tr key={cat.id} className="bg-slate-50/50 hover:bg-blue-50/20 transition-all group rounded-[2rem]">
                                                                <td className="px-8 py-6 first:rounded-l-[2rem] last:rounded-r-[2rem]">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors"></div>
                                                                        <span className="text-sm font-black text-slate-500 group-hover:text-blue-600 transition-colors">{cat.label}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    <span className="text-xs font-black text-amber-400/80 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-100 uppercase tracking-tighter italic">Unassigned</span>
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    <span className="text-xs font-bold text-slate-300">---</span>
                                                                </td>
                                                                <td className="px-8 py-6 text-right pr-12">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedCategory(cat.id);
                                                                            handleModalOpen('assignEmployee');
                                                                        }}
                                                                        className="px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-900 rounded-xl text-xs font-black hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        Assign
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return displayResps.map((resp, idx) => {
                                                        const isPending = resp.status === 'Pending';
                                                        const actionForThis = pendingActions.find(a =>
                                                            a.extra1 === resp.category
                                                        );
                                                        // Both the target employee (by ObjectID or Custom ID) AND Admin can respond
                                                        const isTargetEmp = (resp.empObjectId?.toString() === currentUserEmpId?.toString()) ||
                                                            (resp.employeeId?.replace(/\s+/g, '').toLowerCase() === currentUserEmpCustomId?.replace(/\s+/g, '').toLowerCase());
                                                        const canIRespond = isPending && actionForThis && (isTargetEmp || currentUserIsAdmin);

                                                        return (
                                                            <tr key={`${cat.id}-${idx}`} className={`bg-white hover:bg-blue-50/10 transition-all group shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] ${isPending ? 'border-l-4 border-amber-400' : ''}`}>
                                                                <td className="px-8 py-6 first:rounded-l-[2rem] last:rounded-r-[2rem]">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-2 h-2 rounded-full ${isPending ? 'bg-amber-400 animate-pulse' : 'bg-blue-500'}`}></div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-black text-slate-900">{cat.label}</span>
                                                                            {isPending && <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tighter">Pending Approval</span>}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${isPending ? 'from-amber-400 to-orange-500' : 'from-blue-500 to-indigo-600'} flex items-center justify-center text-white text-xs font-black shadow-lg ${isPending ? 'shadow-amber-100' : 'shadow-blue-100'}`}>
                                                                            {resp.employeeName?.charAt(0)}
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-black text-slate-800">{resp.employeeName}</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{resp.employeeId}</span>
                                                                                {resp.financials && (
                                                                                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                                                                                        <span className="text-[10px] text-slate-500 font-bold">Asset: {resp.financials.assetValue?.toLocaleString()} AED</span>
                                                                                        <span className="text-slate-300">|</span>
                                                                                        <span className="text-[10px] text-slate-500 font-bold">Acc: {resp.financials.accValue?.toLocaleString()} AED</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-slate-500 italic">{resp.designation}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6 text-right pr-12">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {canIRespond ? (
                                                                            <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                                                                                <button
                                                                                    onClick={() => handleRespondToResponsibility('Approve', actionForThis.actionId || actionForThis.id, resp.category)}
                                                                                    disabled={isSubmitting}
                                                                                    className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                                                                                    title="Approve Assignment"
                                                                                >
                                                                                    <Check size={18} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleRespondToResponsibility('Reject', actionForThis.actionId || actionForThis.id, resp.category)}
                                                                                    disabled={isSubmitting}
                                                                                    className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm"
                                                                                    title="Reject Assignment"
                                                                                >
                                                                                    <X size={18} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const realIndex = responsibilities.findIndex(r => r.category === cat.id && r.employeeId === resp.employeeId);
                                                                                    setItemToDelete(realIndex);
                                                                                }}
                                                                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                                                                            >
                                                                                <Trash2 size={18} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })}

                                                {/* Custom Categories */}
                                                {responsibilities.filter(r => !RESPONSIBILITY_CATEGORIES.find(c => c.id === r.category)).reduce((acc, current) => {
                                                    // Group by category and pick pending if available
                                                    const existing = acc.find(a => a.category === current.category);
                                                    if (!existing) {
                                                        acc.push(current);
                                                    } else if (current.status === 'Pending' && existing.status === 'Active') {
                                                        // Replace active with pending for same category
                                                        acc[acc.indexOf(existing)] = current;
                                                    }
                                                    return acc;
                                                }, []).map((resp, idx) => {
                                                    const isPending = resp.status === 'Pending';
                                                    const actionForThis = pendingActions.find(a =>
                                                        a.extra1 === resp.category
                                                    );

                                                    // Both the target employee (by ObjectID or Custom ID) AND Admin can respond
                                                    const isTargetEmp = (resp.empObjectId?.toString() === currentUserEmpId?.toString()) ||
                                                        (resp.employeeId?.replace(/\s+/g, '').toLowerCase() === currentUserEmpCustomId?.replace(/\s+/g, '').toLowerCase());

                                                    const canIRespond = isPending && actionForThis && (isTargetEmp || currentUserIsAdmin);

                                                    return (
                                                        <tr key={`custom-${idx}`} className={`bg-white hover:bg-purple-50/10 transition-all group shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] ${isPending ? 'border-l-4 border-amber-400' : ''}`}>
                                                            <td className="px-8 py-6 first:rounded-l-[2rem] last:rounded-r-[2rem]">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-2 h-2 rounded-full ${isPending ? 'bg-amber-400 animate-pulse' : 'bg-purple-500'}`}></div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-black text-slate-900">{resp.category?.toUpperCase()}</span>
                                                                        {isPending && <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tighter">Pending Approval</span>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${isPending ? 'from-amber-400 to-orange-500' : 'from-purple-500 to-indigo-600'} flex items-center justify-center text-white text-xs font-black shadow-lg ${isPending ? 'shadow-amber-100' : 'shadow-purple-100'}`}>
                                                                        {resp.employeeName?.charAt(0)}
                                                                    </div>
                                                                    <div className="flex flex-col text-left">
                                                                        <span className="text-sm font-black text-slate-800">{resp.employeeName}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{resp.employeeId}</span>
                                                                            {resp.financials && (
                                                                                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                                                                                    <span className="text-[10px] text-slate-500 font-bold">Asset: {resp.financials.assetValue?.toLocaleString()} AED</span>
                                                                                    <span className="text-slate-300">|</span>
                                                                                    <span className="text-[10px] text-slate-500 font-bold">Acc: {resp.financials.accValue?.toLocaleString()} AED</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <span className="text-xs font-bold text-slate-500 italic">{resp.designation}</span>
                                                            </td>
                                                            <td className="px-8 py-6 text-right pr-12">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {canIRespond ? (
                                                                        <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                                                                            <button
                                                                                onClick={() => handleRespondToResponsibility('Approve', actionForThis.actionId || actionForThis.id, resp.category)}
                                                                                disabled={isSubmitting}
                                                                                className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                                                                                title="Approve Assignment"
                                                                            >
                                                                                <Check size={18} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleRespondToResponsibility('Reject', actionForThis.actionId || actionForThis.id, resp.category)}
                                                                                disabled={isSubmitting}
                                                                                className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm"
                                                                                title="Reject Assignment"
                                                                            >
                                                                                <X size={18} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                const realIndex = responsibilities.findIndex(r => r.category === resp.category && r.employeeId === resp.employeeId);
                                                                                setItemToDelete(realIndex);
                                                                            }}
                                                                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-10 min-h-[700px] flex flex-col items-center">
                                    <div className="w-full flex items-center justify-between mb-12 pb-6 border-b border-slate-50">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900">Operational Hierarchy</h3>
                                            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mt-1">Mapping Approvals for Fine, Reward, Loan & Advance</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                fetchCompanyData(selectedCompanyId);
                                                toast({ title: "Refreshed", description: "Operational data updated" });
                                            }}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl text-sm font-black transition-all shadow-xl shadow-emerald-100 flex items-center gap-3 transform hover:scale-105"
                                        >
                                            <RotateCcw size={18} /> Refresh Logic
                                        </button>
                                    </div>

                                    {/* Simplified Flow Visualization */}
                                    <div className="w-full h-full flex flex-col items-center gap-16 py-12">
                                        {/* Top Level: Management */}
                                        <div className="flex flex-col items-center gap-16 w-full">
                                            <div className="flex flex-wrap justify-center gap-10">
                                                {responsibilities.filter(r => r.category === 'management').map((r, i) => (
                                                    <div key={i} className="flex flex-col items-center gap-4 group">
                                                        <div className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-1.5 shadow-2xl shadow-blue-200 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                                            <div className="w-full h-full rounded-[2.2rem] bg-white flex items-center justify-center text-blue-600 font-black text-3xl">
                                                                {r.employeeName?.[0]}
                                                            </div>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-lg font-black text-slate-800">{r.employeeName}</p>
                                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 inline-block">Chief Executive</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Connector */}
                                            {responsibilities.some(r => r.category === 'management') && (
                                                <div className="h-16 w-1 bg-gradient-to-b from-blue-400/30 via-slate-200 to-transparent rounded-full" />
                                            )}

                                            {/* Second Level: Controllers */}
                                            <div className="flex flex-wrap justify-center gap-20 w-full max-w-6xl relative">
                                                {['hr', 'accounts', 'assetcontroller', 'admincontroller'].map((catId) => {
                                                    const group = responsibilities.filter(r => r.category === catId);
                                                    const catLabel = RESPONSIBILITY_CATEGORIES.find(c => c.id === catId)?.label;

                                                    if (group.length === 0) return null;

                                                    return (
                                                        <div key={catId} className="flex flex-col items-center gap-8 animate-in slide-in-from-top-4 duration-700">
                                                            <div className="flex flex-wrap justify-center gap-6">
                                                                {group.map((r, i) => (
                                                                    <div key={i} className="flex flex-col items-center gap-3 group">
                                                                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 p-1 shadow-xl shadow-emerald-50 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
                                                                            <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center text-emerald-600 font-bold text-2xl">
                                                                                {r.employeeName?.[0]}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-center">
                                                                            <p className="text-sm font-black text-slate-700 group-hover:text-emerald-700 transition-colors">{r.employeeName}</p>
                                                                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">{catLabel}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Connector to Modules */}
                                            {responsibilities.length > 0 && (
                                                <div className="flex flex-col items-center">
                                                    <div className="h-20 w-1 bg-gradient-to-b from-slate-200 to-slate-100 rounded-full" />
                                                    <div className="px-6 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] -mt-4 shadow-xl shadow-slate-200">
                                                        Operational Decision Hub
                                                    </div>
                                                </div>
                                            )}

                                            {/* Bottom Level: Business Modules */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-5xl mt-8">
                                                {BUSINESS_MODULES.map((module) => (
                                                    <div key={module.id} className="flex flex-col items-center gap-4 group p-6 rounded-[2rem] bg-slate-50 border border-slate-100/50 hover:bg-white hover:shadow-2xl hover:shadow-slate-200 transition-all duration-500 transform hover:-translate-y-2">
                                                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${module.color} flex items-center justify-center text-white shadow-xl ${module.shadow}`}>
                                                            {module.id === 'fine' && <Network size={28} />}
                                                            {module.id === 'reward' && <Check size={28} />}
                                                            {module.id === 'loan' && <Building2 size={28} />}
                                                            {module.id === 'advance' && <RotateCcw size={28} />}
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs font-black text-slate-800 uppercase tracking-wider">{module.label}</p>
                                                            <div className="mt-3 flex flex-col gap-1.5">
                                                                <span className="text-[9px] font-bold text-slate-400 leading-tight">Flows to {module.id === 'fine' || module.id === 'reward' ? 'HR Admin' : 'Financial Controller'}</span>
                                                                <div className="h-1 w-8 bg-slate-200 mx-auto rounded-full group-hover:w-full group-hover:bg-blue-400 transition-all duration-500" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Empty State */}
                                        {responsibilities.length === 0 && (
                                            <div className="flex flex-col items-center gap-6 text-slate-300 py-32 opacity-40">
                                                <Network size={120} strokeWidth={0.5} className="animate-pulse" />
                                                <div className="text-center">
                                                    <p className="text-xl font-black uppercase tracking-widest">No Structure Detected</p>
                                                    <p className="text-sm font-bold mt-2 italic">Assign responsibilities to generate the organization flow</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Modals */}
            {modalType === 'addCustomResponsibility' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 flex flex-col gap-8 transform animate-in slide-in-from-bottom-8 duration-500">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-purple-50 text-purple-600 rounded-[1.5rem]">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900">Add New Role</h3>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Custom Position</p>
                                </div>
                            </div>
                            <button onClick={handleModalClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Category Name</label>
                                <input
                                    type="text"
                                    required
                                    value={modalData.category || ''}
                                    onChange={(e) => setModalData({ ...modalData, category: e.target.value })}
                                    placeholder="e.g. Safety Officer, IT Lead..."
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-300"
                                />
                                {modalErrors.category && <p className="text-[11px] text-red-500 font-black mt-1 ml-2 uppercase tracking-tighter">{modalErrors.category}</p>}
                            </div>

                            <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                                <p className="text-xs text-blue-700 font-bold leading-relaxed flex items-center gap-3">
                                    <Check className="w-4 h-4 shrink-0" />
                                    Next step: Select an employee to fill this new global position.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (!modalData.category) {
                                    setModalErrors({ category: "Position name is required" });
                                    return;
                                }
                                setModalErrors({});
                                setSelectedCategory(modalData.category);
                                setModalType('assignEmployee');
                                setModalData({});
                            }}
                            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-100 flex items-center justify-center gap-3 hover:bg-blue-700 transition-all transform hover:scale-105"
                        >
                            Select Employee <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {modalType === 'assignEmployee' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in slide-in-from-bottom-8 duration-500">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-blue-600 text-white rounded-[1.8rem] shadow-lg shadow-blue-100">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900">Assign Member</h3>
                                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Position: <span className="text-blue-600">{selectedCategory}</span></p>
                                    </div>
                                </div>
                                <button onClick={handleModalClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-red-500">
                                    <X className="w-8 h-8" />
                                </button>
                            </div>

                            {/* Search Box */}
                            <div className="relative group">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search by User Name, Username or Role..."
                                    className="w-full pl-16 pr-8 py-5 bg-white border border-slate-100 rounded-3xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                                    onChange={(e) => {
                                        const query = e.target.value.toLowerCase();

                                        // ONLY FILTER EMPLOYEES
                                        const linkedUsers = allUsers.filter(user =>
                                            allEmployees.some(emp =>
                                                (user.employeeId && emp.employeeId === user.employeeId) ||
                                                (user.username && emp.employeeId === user.username)
                                            )
                                        );

                                        const filtered = linkedUsers.filter(user =>
                                            (user.name || '').toLowerCase().includes(query) ||
                                            (user.username || '').toLowerCase().includes(query) ||
                                            (user.role || '').toLowerCase().includes(query)
                                        );
                                        setModalData({ ...modalData, filteredUsers: filtered });
                                    }}
                                />
                            </div>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
                            <div className="space-y-3">
                                {(() => {
                                    const displayedUsers = (modalData.filteredUsers || allUsers).filter(user =>
                                        allEmployees.some(emp =>
                                            (user.employeeId && emp.employeeId === user.employeeId) ||
                                            (user.username && emp.employeeId === user.username)
                                        )
                                    );

                                    if (displayedUsers.length === 0) {
                                        return (
                                            <div className="py-24 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 opacity-60">
                                                <Search size={48} className="mx-auto text-slate-200 mb-6" />
                                                <p className="text-lg font-black text-slate-400 uppercase tracking-widest">No Linked Employees Found</p>
                                            </div>
                                        );
                                    }

                                    return displayedUsers.map((user, idx) => {
                                        // Simple employee matching
                                        const matchingEmp = allEmployees.find(emp =>
                                            (user.employeeId && emp.employeeId === user.employeeId) ||
                                            (user.username && emp.employeeId === user.username)
                                        );

                                        const isAlreadyAssigned = responsibilities.some(r =>
                                            (r.empObjectId === user._id || r.employeeId === user.employeeId || (user.username && r.employeeId === user.username)) &&
                                            r.category === selectedCategory
                                        );

                                        const notLinked = !matchingEmp;

                                        return (
                                            <button
                                                key={user._id || user.id || `user-${idx}`}
                                                type="button"
                                                disabled={isAlreadyAssigned || isSubmitting || !matchingEmp}
                                                onClick={() => handleAssignEmployee(matchingEmp, user)}
                                                className={`w-full flex items-center justify-between p-5 rounded-[2rem] transition-all group border-2 ${isAlreadyAssigned || !matchingEmp
                                                    ? 'bg-slate-50 border-slate-50 opacity-50 cursor-not-allowed'
                                                    : 'bg-white border-slate-100 hover:border-blue-500 hover:bg-blue-50/20 hover:scale-[1.01]'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-slate-200/50 text-xl transition-all ${isAlreadyAssigned ? 'bg-slate-200 text-slate-400' : 'bg-white text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                                        {user.name?.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col text-left">
                                                        <span className={`text-lg font-black transition-colors ${isAlreadyAssigned ? 'text-slate-400' : 'text-slate-900 group-hover:text-blue-700'}`}>{user.name}</span>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                                                                {matchingEmp?.employeeId || user.username}
                                                            </span>
                                                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                                            <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-wide truncate max-w-[150px]">{user.role || 'ERP USER'}</span>
                                                        </div>
                                                        {notLinked && (
                                                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-tighter mt-1 flex items-center gap-1.5 border border-amber-100 bg-amber-50 px-2 py-0.5 rounded-md w-fit">
                                                                Sync Warning: No direct employee link found
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {isAlreadyAssigned ? (
                                                    <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-4 py-1.5 rounded-xl border border-amber-100 uppercase tracking-wider">Already Active</span>
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-300 group-hover:border-blue-500 group-hover:text-blue-500 group-hover:bg-white transition-all">
                                                        <Plus size={24} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={itemToDelete !== null} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent className="rounded-[2.5rem] p-10 bg-white border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-300">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-4 mb-2">
                            <div className="p-4 bg-red-50 text-red-500 rounded-3xl">
                                <Trash2 size={24} />
                            </div>
                            Confirm Removal
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 text-lg font-bold leading-relaxed">
                            Are you absolutely sure you want to remove this assignment from the organizational matrix?
                            <br /><span className="text-slate-400 text-sm italic font-medium">This will update the organizational flow visualization immediately.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-4">
                        <AlertDialogCancel className="rounded-2xl px-8 py-4 font-black text-slate-500 border-2 border-slate-100 hover:bg-slate-50 hover:text-slate-900 transition-all">Cancel Execution</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveConfirm}
                            className="rounded-2xl px-8 py-4 font-black bg-red-500 text-white hover:bg-red-600 shadow-xl shadow-red-100 transition-all border-none"
                        >
                            Yes, Remove Role
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
