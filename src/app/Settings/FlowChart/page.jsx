'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import {
    Network,
    Plus,
    Search,
    ChevronDown,
    X,
    ArrowRight,
    RotateCcw,
    Building2, // Changed from Building
    Users, // Changed from User
    Check,
    Printer, Download, AlertTriangle, MapPin, ShieldCheck, DollarSign, Wallet, Briefcase, ChevronRight, Activity,
    Eye,
    Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const RESPONSIBILITY_CATEGORIES = [
    { id: 'assigneduser', label: 'Assigned User' },
    { id: 'hr', label: 'HR' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'assetcontroller', label: 'Asset Controller' },
    { id: 'management', label: 'management' },
    { id: 'admincontroller', label: 'Admin' }
];

const BUSINESS_MODULES = [
    { id: 'fine', label: 'Fine Approval', color: 'from-orange-500 to-rose-600', shadow: 'shadow-orange-100', icon: 'AlertCircle' },
    { id: 'reward', label: 'Reward Tracking', color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-100', icon: 'Award' },
    { id: 'loan', label: 'Loan Processing', color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-100', icon: 'DollarSign' },
    { id: 'advance', label: 'Advance Request', color: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-100', icon: 'Zap' }
];

const CATEGORIES_REQUIRE_COMPANY_EMAIL = ['assigneduser', 'admincontroller', 'assetcontroller', 'hr'];
const CATEGORIES_POSITION_VIEW = ['assigneduser', 'admincontroller', 'assetcontroller', 'hr'];

/** Match backend Flowchart.category (hr, assetcontroller, …) regardless of spacing/case */
const normalizeFlowchartCategory = (c) => (c || '').toString().toLowerCase().replace(/\s+/g, '');

/** Roles that see company-allocated asset previews (legacy DB may still use `hr`). */
const isCompanyAssetCoordinatorCategory = (c) => {
    const n = normalizeFlowchartCategory(c);
    return n === 'hr' || n === 'assigneduser' || n === 'admincontroller';
};

/** Responsibility approval preview: inventory + checklists + Accept/Reject. Used in a modal when `onClose` is set. */
function InlineResponsibilityReviewPanel({ resp, positionLabel, isSubmitting, onRespond, onClose, embeddedInModal }) {
    const catKey = normalizeFlowchartCategory(resp.category);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [checked, setChecked] = useState(() => new Set());

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await axiosInstance.get(`/Flowchart/position-summary/${encodeURIComponent(catKey)}`);
                if (cancelled) return;
                if (res.data?.canViewInventory === false) {
                    setErr(res.data.viewerNote || 'Not authorized to view this preview.');
                    setData(null);
                } else {
                    setData(res.data);
                }
            } catch (e) {
                if (!cancelled) {
                    setErr(e.response?.data?.viewerNote || e.response?.data?.message || 'Failed to load preview.');
                    setData(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [resp?._id, catKey]);

    const poolAssetIds = useMemo(() => {
        if (!data || catKey !== 'assetcontroller' || data.canViewInventory === false) return [];
        const ids = [
            ...(data.parkingAssets || []).map((a) => String(a._id)),
            ...(data.unassignedAssets || []).map((a) => String(a._id))
        ].filter(Boolean);
        return ids;
    }, [data, catKey]);

    useEffect(() => {
        if (catKey !== 'assetcontroller' || poolAssetIds.length === 0) return;
        setChecked(new Set(poolAssetIds));
    }, [catKey, poolAssetIds.join(',')]);

    const allPoolSelected =
        poolAssetIds.length > 0 && poolAssetIds.every((id) => checked.has(id));

    const toggleSelectAllPoolAssets = () => {
        if (allPoolSelected) {
            setChecked(new Set());
        } else {
            setChecked(new Set(poolAssetIds));
        }
    };

    const toggleChecked = (id) => {
        const k = String(id);
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    };

    const roleTitle =
        catKey === 'assetcontroller'
            ? 'Asset Controller'
            : catKey === 'assigneduser'
                ? 'Assigned User'
                : catKey === 'admincontroller'
                    ? 'Admin'
                    : catKey === 'hr'
                        ? 'HR'
                        : (resp.category || '').toString().toUpperCase();

    return (
        <div className={`${embeddedInModal ? '' : 'rounded-2xl border border-amber-200/80'} bg-gradient-to-b from-amber-50/90 to-white overflow-hidden ${embeddedInModal ? '' : 'shadow-sm'}`}>
            <div className="px-6 py-4 border-b border-amber-100 flex flex-wrap items-start justify-between gap-3 bg-white/70">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Pending your approval</p>
                    <h3 className="text-lg font-black text-slate-900 mt-1">
                        {roleTitle} — {positionLabel || resp.category}
                    </h3>
                    <p className="text-slate-500 text-xs font-bold mt-0.5">Candidate: {resp.employeeName} ({resp.employeeId})</p>
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className={`${embeddedInModal ? 'max-h-[60vh]' : 'max-h-[min(70vh,520px)]'} overflow-y-auto px-6 py-5 bg-white`}>
                {loading && (
                    <div className="flex items-center gap-2 text-slate-600 font-bold">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        Loading preview…
                    </div>
                )}
                {err && !loading && <p className="text-red-600 font-bold text-sm">{err}</p>}

                {!loading && !err && data && data.canViewInventory === false && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 font-bold text-sm">
                        {data.viewerNote || 'Not authorized.'}
                    </div>
                )}

                {!loading && !err && data && data.canViewInventory !== false && isCompanyAssetCoordinatorCategory(resp.category) && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">
                                {catKey === 'hr' ? 'HR responsibilities' : 'Company assets (Assigned User / Admin)'}
                            </h4>
                            <ul className="list-disc pl-5 space-y-1.5 text-slate-700 text-sm">
                                {(data.hrBullets || []).map((b, i) => (
                                    <li key={i}>{b}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Company assets</h4>
                            <div className="space-y-2">
                                {(data.companyAssets || []).slice(0, 20).map((a) => (
                                    <div key={a._id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                                        <div className="font-black text-slate-900 text-sm">{a.assetId} — {a.name}</div>
                                        <div className="text-xs font-bold text-slate-500 mt-0.5">Status: {a.status || '—'}</div>
                                    </div>
                                ))}
                                {(data.companyAssets || []).length > 20 && (
                                    <p className="text-slate-400 text-xs font-bold">…and more in the position view</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !err && data && data.canViewInventory !== false && catKey === 'assetcontroller' && (
                    <div className="space-y-8">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-700 leading-relaxed">
                            <p className="font-black text-slate-800 uppercase tracking-wide text-[10px] mb-1">How checkboxes work</p>
                            <p>
                                <strong>Checked</strong> — item stays open or on leave for the new Asset Controller.
                                <strong className="ml-1">Unchecked</strong> — when you <strong>Accept</strong>, the item is assigned to the{' '}
                                <strong>previous</strong> Asset Controller. Use the toggle to <strong>select all</strong> or <strong>unselect all</strong>.
                            </p>
                            <p className="mt-2 text-slate-600">
                                <strong>Reject</strong> — you decline the role. The <strong>previous</strong> person stays Asset Controller; nothing changes.
                            </p>
                        </div>
                        {poolAssetIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={toggleSelectAllPoolAssets}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${
                                        allPoolSelected
                                            ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-900 hover:text-white hover:border-slate-900'
                                    }`}
                                >
                                    {allPoolSelected ? 'Unselect all' : 'Select all'} ({poolAssetIds.length})
                                </button>
                            </div>
                        )}
                        <div>
                            <h4 className="text-sm font-black text-amber-800 uppercase tracking-widest mb-3">A. Parking / On Leave</h4>
                            <div className="space-y-3">
                                {(data.parkingAssets || []).length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">No parked assets.</p>
                                ) : (
                                    (data.parkingAssets || []).map((a) => (
                                        <div key={a._id} className="p-4 rounded-2xl border border-amber-100 bg-amber-50/60">
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={checked.has(String(a._id))}
                                                    onChange={() => toggleChecked(a._id)}
                                                    className="mt-1 rounded border-slate-300"
                                                />
                                                <span className="flex-1 min-w-0">
                                                    <span className="font-black text-slate-900 text-sm">{a.assetId} — {a.name}</span>
                                                    <span className="block text-xs font-bold text-slate-500 mt-0.5">Status: {a.status || 'On Leave'}</span>
                                                </span>
                                            </label>
                                            <div className="mt-3 pl-8 border-l-2 border-amber-200">
                                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Accessories</div>
                                                {(a.accessories || []).length === 0 ? (
                                                    <div className="text-xs text-slate-400 italic">No accessories</div>
                                                ) : (
                                                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                                                        {(a.accessories || []).map((acc, i) => (
                                                            <li key={i}>
                                                                <span className="font-bold">{acc.name || 'Accessory'}</span>
                                                                {acc.status ? <span className="text-xs text-slate-500"> · {acc.status}</span> : null}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-emerald-800 uppercase tracking-widest mb-3">B. Unassigned / pool</h4>
                            <div className="space-y-3">
                                {(data.unassignedAssets || []).length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">No unassigned assets.</p>
                                ) : (
                                    (data.unassignedAssets || []).map((a) => (
                                        <div key={a._id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={checked.has(String(a._id))}
                                                    onChange={() => toggleChecked(a._id)}
                                                    className="mt-1 rounded border-slate-300"
                                                />
                                                <span className="flex-1 min-w-0">
                                                    <span className="font-black text-slate-900 text-sm">{a.assetId} — {a.name}</span>
                                                    <span className="block text-xs font-bold text-slate-500 mt-0.5">Status: {a.status || '—'}</span>
                                                </span>
                                            </label>
                                            <div className="mt-3 pl-8 border-l-2 border-emerald-100">
                                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Accessories</div>
                                                {(a.accessories || []).length === 0 ? (
                                                    <div className="text-xs text-slate-400 italic">No accessories</div>
                                                ) : (
                                                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                                                        {(a.accessories || []).map((acc, i) => (
                                                            <li key={i}>
                                                                <span className="font-bold">{acc.name || 'Accessory'}</span>
                                                                {acc.status ? <span className="text-xs text-slate-500"> · {acc.status}</span> : null}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !err && data && data.canViewInventory !== false &&
                    !isCompanyAssetCoordinatorCategory(resp.category) &&
                    catKey !== 'assetcontroller' && (
                    <p className="text-slate-500 text-sm font-bold">
                        No detailed inventory preview for this role. You can still accept the assignment below, or cancel to close.
                    </p>
                )}
            </div>

            <div className="px-6 py-4 border-t border-amber-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
                {onClose ? (
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onClose}
                        className="px-5 py-3 rounded-2xl font-black text-sm bg-white border-2 border-slate-200 text-slate-800 hover:bg-slate-100 shadow-sm transition-all disabled:opacity-60"
                    >
                        Cancel
                    </button>
                ) : (
                    <span />
                )}
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onRespond('Reject', resp._id, resp.category)}
                        className="px-5 py-3 rounded-2xl font-black text-sm bg-white border-2 border-rose-200 text-rose-700 hover:bg-rose-50 shadow-sm transition-all disabled:opacity-60"
                    >
                        Reject
                    </button>
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() =>
                            catKey === 'assetcontroller'
                                ? onRespond('Approve', resp._id, resp.category, { keepAssetIds: Array.from(checked) })
                                : onRespond('Approve', resp._id, resp.category)
                        }
                        className="px-5 py-3 rounded-2xl font-black text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-all disabled:opacity-60"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}

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
                // Set both User ID and Employee ID for matching
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

            // ERP MAIN FLOWCHART: Always force selection of the primary company (EST-001)
            const mainComp = comps.find(c => c.companyId === 'EST-001') || comps[0];
            if (mainComp) {
                setCompanies([mainComp]);
                setSelectedCompanyId(mainComp.companyId);
            }
        } catch (err) {
            console.error('Error fetching companies:', err);
            const errMsg = err.response?.data?.message || "Failed to fetch companies";
            toast({ title: "System Error", description: errMsg, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchCompanyData = useCallback(async (compId) => {
        try {
            // Fetch company details
            const response = await axiosInstance.get(`/Company/${compId}`);
            setCompany(response.data.company);

            // Fetch flowchart responsibilities instead of company responsibilities
            const flowchartResponse = await axiosInstance.get('/Flowchart');
            setResponsibilities(flowchartResponse.data || []);
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

            // Update Flowchart instead of Company
            await axiosInstance.post('/Flowchart', newResp);

            toast({ title: "Assignment Sent", description: "Employee will be notified for approval." });

            // Refresh data
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

    const handleRespondToResponsibility = async (action, actionId, category, extras = {}) => {
        setIsSubmitting(true);
        try {
            const catN = (category || '').toLowerCase().replace(/\s+/g, '');
            const payload = {
                action,
                actionId,
                category
            };
            if (action === 'Approve' && catN === 'assetcontroller' && Array.isArray(extras.keepAssetIds)) {
                payload.assetControllerHandover = { keepAssetIds: extras.keepAssetIds };
            }
            await axiosInstance.put('/Flowchart/respond-responsibility', payload);
            toast({ title: "Success", description: `Responsibility ${action}ed successfully.` });
            fetchCompanyData(selectedCompanyId);
            fetchPendingActions();
            return true;
        } catch (err) {
            console.error("Response error:", err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to process response",
                variant: "destructive"
            });
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const [responsibilityReviewModal, setResponsibilityReviewModal] = useState(null);

    const respondFromReviewModal = async (action, actionId, category, extras = {}) => {
        const ok = await handleRespondToResponsibility(action, actionId, category, extras);
        if (ok) setResponsibilityReviewModal(null);
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
                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Main ERP Flowchart</h1>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-blue-600">Universal Management Matrix (EST-001)</p>
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
                                                                            handleModalOpen('assignEmployee', {
                                                                                requireCompanyEmail: CATEGORIES_REQUIRE_COMPANY_EMAIL.includes(cat.id)
                                                                            });
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
                                                        // Both the target employee (by ObjectID or employeeId) AND Admin can respond
                                                        const isTargetEmp = (resp.empObjectId?.toString() === currentUserEmpId?.toString()) ||
                                                            (resp.employeeId?.replace(/\s+/g, '').toLowerCase() === currentUserEmpCustomId?.replace(/\s+/g, '').toLowerCase()) ||
                                                            (resp.employeeId === currentUserEmpCustomId); // Direct employeeId match - works even without empObjectId
                                                        const canIRespond = isPending && (isTargetEmp || currentUserIsAdmin); // Remove actionForThis requirement for now

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
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setResponsibilityReviewModal({ resp, positionLabel: cat.label })}
                                                                                disabled={isSubmitting}
                                                                                className="px-4 py-2 bg-amber-50 border-2 border-amber-200 text-amber-900 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-100 transition-all flex items-center gap-1.5 ml-auto disabled:opacity-50"
                                                                            >
                                                                                <Eye size={14} /> Review
                                                                            </button>
                                                                        ) : (
                                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectedCategory(cat.id);
                                                                                        handleModalOpen('assignEmployee', {
                                                                                            requireCompanyEmail: CATEGORIES_REQUIRE_COMPANY_EMAIL.includes(cat.id)
                                                                                        });
                                                                                    }}
                                                                                    className="px-4 py-2 bg-white border-2 border-slate-100 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
                                                                                >
                                                                                    Reassign
                                                                                </button>
                                                                                {CATEGORIES_POSITION_VIEW.includes(cat.id) && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => router.push(`/Settings/FlowChart/position/${encodeURIComponent(cat.id)}`)}
                                                                                        className="px-4 py-2 bg-blue-50 border-2 border-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center gap-1.5"
                                                                                    >
                                                                                        <Eye size={14} /> View
                                                                                    </button>
                                                                                )}
                                                                            </div>
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

                                                    // Same identity checks as standard rows (ObjectId + employeeId) so pending assignees match
                                                    const isTargetEmp = (resp.empObjectId?.toString() === currentUserEmpId?.toString()) ||
                                                        (resp.employeeId?.replace(/\s+/g, '').toLowerCase() === currentUserEmpCustomId?.replace(/\s+/g, '').toLowerCase()) ||
                                                        (resp.employeeId === currentUserEmpCustomId);
                                                    const canIRespond = isPending && (isTargetEmp || currentUserIsAdmin);

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
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setResponsibilityReviewModal({
                                                                                    resp,
                                                                                    positionLabel: resp.category?.toUpperCase()
                                                                                })
                                                                            }
                                                                            disabled={isSubmitting}
                                                                            className="px-4 py-2 bg-amber-50 border-2 border-amber-200 text-amber-900 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-100 transition-all flex items-center gap-1.5 ml-auto disabled:opacity-50"
                                                                        >
                                                                            <Eye size={14} /> Review
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedCategory(resp.category);
                                                                                handleModalOpen('assignEmployee', { requireCompanyEmail: false });
                                                                            }}
                                                                            className="px-4 py-2 bg-white border-2 border-slate-100 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                                                        >
                                                                            Reassign
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
                                                {['assigneduser', 'hr', 'accounts', 'assetcontroller', 'admincontroller'].map((catId) => {
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
                                        {modalData.requireCompanyEmail && (
                                            <p className="mt-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
                                                Only employees with a <strong>company email</strong> can be selected for this role.
                                            </p>
                                        )}
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
                                        setModalData((prev) => ({ ...prev, filteredUsers: filtered }));
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
                                        const companyEmailOk = !!(matchingEmp && (matchingEmp.companyEmail || '').trim());
                                        const blockedByCompanyEmail = modalData.requireCompanyEmail && matchingEmp && !companyEmailOk;

                                        return (
                                            <button
                                                key={user._id || user.id || `user-${idx}`}
                                                type="button"
                                                disabled={isAlreadyAssigned || isSubmitting || !matchingEmp || blockedByCompanyEmail}
                                                onClick={() => handleAssignEmployee(matchingEmp, user)}
                                                className={`w-full flex items-center justify-between p-5 rounded-[2rem] transition-all group border-2 ${isAlreadyAssigned || !matchingEmp || blockedByCompanyEmail
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
                                                {blockedByCompanyEmail ? (
                                                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-4 py-1.5 rounded-xl border border-slate-200 uppercase tracking-wider">No company email</span>
                                                ) : isAlreadyAssigned ? (
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

            {responsibilityReviewModal && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="responsibility-review-modal-title"
                    onClick={() => setResponsibilityReviewModal(null)}
                >
                    <div
                        className="bg-white w-full max-w-5xl max-h-[92vh] rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="responsibility-review-modal-title" className="sr-only">
                            Review responsibility assignment
                        </h2>
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <InlineResponsibilityReviewPanel
                                resp={responsibilityReviewModal.resp}
                                positionLabel={responsibilityReviewModal.positionLabel}
                                isSubmitting={isSubmitting}
                                onRespond={respondFromReviewModal}
                                onClose={() => setResponsibilityReviewModal(null)}
                                embeddedInModal
                            />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
