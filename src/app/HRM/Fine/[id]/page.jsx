'use client';

import { useState, useEffect, use, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useNotificationFocusScroll } from '@/hooks/useNotificationFocusScroll';
import { FINE_FOCUS_PREFIX } from '@/utils/fineNotificationRouting';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Loader2, Printer, Check, X, Edit, AlertCircle, Lock, Trash2, Send, Users, Package, History, ExternalLink, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Image from 'next/image';
import AddFineModal from '../components/AddFineModal';
import AddVehicleFineModal from '../components/AddVehicleFineModal';
import AddSafetyFineModal from '../components/AddSafetyFineModal';
import AddProjectDamageModal from '../components/AddProjectDamageModal';
import AddLossDamageModal from '../components/AddLossDamageModal';
import FineFormCards from '../components/FineFormCards';
import FineApprovedAttachmentsTab from '../components/FineApprovedAttachmentsTab';
import {
    isLossDamageFineType,
    buildLossDamageFormFields,
} from '../components/LossDamageFineDetailsSection';
import AddOtherDamageModal from '../components/AddOtherDamageModal';
import {
    canEditApprovedFineSchedule,
    isApprovedFineStatus,
    isHrUser,
} from '../utils/fineApprovedEdit';
import {
    isCompanyFineParty,
    isViewingSpecificFineParty,
    resolveActivePartyFromFine,
} from '@/utils/fineGroupClassification';
import { canUserActOnFineStage } from '@/utils/fineStageAuth';
import { notifyFinePendingInboxChanged } from '../utils/finePendingInboxCount';
import ProfileHeader from '../../../emp/[employeeId]/components/ProfileHeader';
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

import { calculateDaysUntilExpiry, calculateTenure, getExpiryColor } from '../../../emp/[employeeId]/utils/helpers';

/** Base fine portion for one row (never includes service charge). */
function getFineBaseRowAmount(fine, emp, isCo) {
    if (isCo) {
        return Math.max(0, parseFloat(emp.employeeAmount ?? fine.companyAmount ?? 0));
    }
    let base = parseFloat(fine.employeeAmount ?? emp.employeeAmount ?? 0);
    const sc = parseFloat(fine.serviceCharge || 0);
    if (base < 0 && sc > 0) {
        base = base + sc;
    }
    return Math.max(0, base);
}

/** Payable total = base employee + company portions + service charge. */
function computeFinePayableTotal(fine) {
    if (!fine) return 0;
    const sc = parseFloat(fine.serviceCharge || 0);
    let emp = parseFloat(fine.employeeAmount || 0);
    const comp = parseFloat(fine.companyAmount || 0);
    if (emp < 0 && sc > 0) {
        emp = emp + sc;
    }
    const fromComponents = emp + comp + sc;
    const stored = parseFloat(fine.totalFineAmount || fine.fineAmount || 0);
    if (fromComponents > 0 && (stored <= 0 || stored < fromComponents - 0.009)) {
        return fromComponents;
    }
    return Math.max(stored, fromComponents);
}

/** Service charge belonging to one party (modal portions already include this). */
function partyServiceShareDisplay(fine, entry, isCompanyParty = false) {
    const perRecord = parseFloat(entry?.serviceCharge ?? 0) || 0;
    if (perRecord > 0) return perRecord;

    const totalSc = parseFloat(fine?.serviceCharge || 0) || 0;
    const rf = (fine?.responsibleFor || 'Employee').trim();
    if (rf !== 'Employee & Company' || totalSc <= 0) {
        return isCompanyParty ? 0 : totalSc;
    }
    if (fine?.isGroupView || (fine?.assignedEmployees?.length || 0) > 1) {
        return totalSc / 2;
    }
    const comp = parseFloat(fine?.companyAmount || 0) || 0;
    const hasVega = fine?.assignedEmployees?.some((e) => e.employeeId === 'VEGA-HR-0000');
    if (hasVega || comp > 0) return totalSc / 2;
    return totalSc;
}

function partyPortionTotal(fine, entry, isCompanyParty = false) {
    if (!fine) return 0;
    const rowBase = parseFloat(
        entry?.employeeAmount ??
        (isCompanyParty ? fine.companyAmount : fine.employeeAmount) ??
        0
    ) || 0;
    if (rowBase > 0) {
        return rowBase + partyServiceShareDisplay(fine, entry, isCompanyParty);
    }
    if (entry?.individualAmount != null && entry.individualAmount !== '') {
        return parseFloat(entry.individualAmount) || 0;
    }
    if (entry?.fineAmount) return parseFloat(entry.fineAmount) || 0;
    return 0;
}

function FineDetailsPageContent({ params }) {
    // Handle params whether it's a Promise (Next.js 15+) or Object
    const resolvedParams = (params instanceof Promise) ? use(params) : params;
    let { id } = resolvedParams || {};

    // Sanitize ID (remove artifacts like ":1", decode, and remove spaces)
    if (id && typeof id === 'string') {
        try {
            id = decodeURIComponent(id);
        } catch (e) {
            console.warn("Could not decode URI component", e);
        }
        if (id.includes(':')) {
            id = id.split(':')[0];
        }
        id = id.trim();
    }

    const router = useRouter();
    const searchParams = useSearchParams();
    const partyParam = searchParams.get('party');
    const partyEmployeeId = searchParams.get('employeeId');
    const viewingSpecificParty = isViewingSpecificFineParty(searchParams, id);
    const handleListReturnBack = useListReturnBack();
    const { toast } = useToast();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const [fine, setFine] = useState(null);
    const [employeeDetails, setEmployeeDetails] = useState(null);
    const [hodDetails, setHodDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [isHr, setIsHr] = useState(false);
    const [isAssetController, setIsAssetController] = useState(false);
    const [checkingPermissions, setCheckingPermissions] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isResubmittingModal, setIsResubmittingModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [activeTab, setActiveTab] = useState('fineForm'); // 'fineForm', 'historyDetails', 'approvedAttachments'
    const [assetDetails, setAssetDetails] = useState(null);
    const [loadingAsset, setLoadingAsset] = useState(false);

    // Confirmation State
    const [summaryViewMode, setSummaryViewMode] = useState('count'); // 'count', 'amount', 'remaining'
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [confirmConfig, setConfirmConfig] = useState({
        action: null, // 'approve' | 'reject' | 'updateStatus'
        status: null, // for updateStatus
        title: '',
        description: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'default' // 'default' | 'destructive'
    });

    const openConfirmation = (config) => {
        setConfirmConfig(prev => ({ ...prev, ...config }));
        setRejectionReason(''); // Reset reason when opening
        setConfirmOpen(true);
    };

    const handleConfirmAction = async () => {
        setConfirmOpen(false);
        const { action, status } = confirmConfig;

        try {
            setActionLoading(true);
            const targetId = fine?._id || id;
            let res;

            let finePdf = null;
            if ((action === 'approve' && (fine.fineStatus === 'Pending Authorization')) || (action === 'updateStatus' && status === 'Approved')) {
                toast({ title: "Generating PDF...", description: "Capturing form for email attachment." });
                const pdfResult = await generateFinePDF();
                if (pdfResult?.type === 'jspdf' && pdfResult.pdf) {
                    finePdf = pdfResult.pdf.output('datauristring').split(',')[1];
                } else if (pdfResult?.type === 'buffer' && pdfResult.base64) {
                    finePdf = pdfResult.base64;
                }
            }

            if (action === 'approve') {
                res = await axiosInstance.put(`/Fine/${targetId}/approve`, { finePdf });
                toast({
                    title: "Success",
                    description: res.data.message || "Fine approved successfully.",
                    variant: "success",
                    className: "bg-green-50 border-green-200 text-green-800"
                });
            } else if (action === 'reject') {
                if (!rejectionReason || rejectionReason.trim().length === 0) {
                    toast({ title: "Error", description: "Rejection reason is mandatory.", variant: "destructive" });
                    return;
                }
                res = await axiosInstance.put(`/Fine/${targetId}`, {
                    fineStatus: 'Rejected',
                    rejectionReason: rejectionReason
                });
                toast({
                    title: "Success",
                    description: "Fine rejected successfully.",
                    variant: "success",
                    className: "bg-green-50 border-green-200 text-green-800"
                });
            } else if (action === 'updateStatus') {
                // Prepare Payload with Dynamic Approvers
                const payload = { fineStatus: status, finePdf };
                const approverId = currentUser.id || currentUser._id;

                if (approverId) {
                    if (status === 'Pending Accounts') {
                        payload.hrApprovedBy = approverId;
                    } else if (status === 'Pending Authorization') {
                        payload.accountsApprovedBy = approverId;
                    } else if (status === 'Approved') {
                        payload.approvedBy = approverId;
                    }
                }

                res = await axiosInstance.put(`/Fine/${targetId}`, payload);
                toast({
                    title: "Success",
                    description: `Fine status updated to ${status}.`,
                    variant: "success",
                    className: "bg-green-50 border-green-200 text-green-800"
                });
            }

            refreshData();
            notifyFinePendingInboxChanged();
        } catch (err) {
            console.error("Action error:", err);
            toast({
                title: "Error",
                description: err.response?.data?.message || "Failed to perform action.",
                variant: "destructive"
            });
        } finally {
            setActionLoading(false);
        }
    };

    const validateWorkflowAssignments = () => {
        if (!fine) return true;
        const workflow = fine.workflow || [];
        
        // HR Check
        const hrStep = workflow.find(w => w.role === 'HR');
        const hrName = (hrStep?.assignedTo?.firstName) 
            ? `${hrStep.assignedTo.firstName} ${hrStep.assignedTo.lastName || ''}`.trim() 
            : (fine.hrHODName && fine.hrHODName !== 'Unknown' ? fine.hrHODName : null);
            
        if (!hrName) {
            toast({
                title: "Incomplete Flowchart",
                description: "No HR designation user assigned in the flowchart. Please assign an HR user before proceeding.",
                variant: "destructive"
            });
            return false;
        }

        // Accounts Check
        const accStep = workflow.find(w => w.role === 'Accounts');
        const accName = (accStep?.assignedTo?.firstName)
            ? `${accStep.assignedTo.firstName} ${accStep.assignedTo.lastName || ''}`.trim()
            : (fine.accountsHODName && fine.accountsHODName !== 'Unknown' ? fine.accountsHODName : null);
            
        if (!accName) {
            toast({
                title: "Incomplete Flowchart",
                description: "No Accounts designation user assigned in the flowchart. Please assign an Accounts user before proceeding.",
                variant: "destructive"
            });
            return false;
        }

        // Management Check
        const mgtStep = workflow.find(w => w.role === 'Management' || w.role === 'CEO');
        const mgtName = (mgtStep?.assignedTo?.firstName)
            ? `${mgtStep.assignedTo.firstName} ${mgtStep.assignedTo.lastName || ''}`.trim()
            : (fine.approvedBy ? (fine.approvedBy.name || `${fine.approvedBy.firstName || ''} ${fine.approvedBy.lastName || ''}`.trim()) : (fine.ceoName && fine.ceoName !== 'Unknown' ? fine.ceoName : null));

        if (!mgtName) {
            toast({
                title: "Incomplete Flowchart",
                description: "No Management designation user assigned in the flowchart. Please assign a Management user before proceeding.",
                variant: "destructive"
            });
            return false;
        }

        return true;
    };

    const handleUpdateStatus = (status) => {
        if (status === 'Pending' || status === 'Pending HR' || status === 'Pending Accounts' || status === 'Pending Authorization') {
            if (!validateWorkflowAssignments()) return;
        }

        const isCancel = status === 'Cancelled' || status === 'Withdrawn';
        openConfirmation({
            action: 'updateStatus',
            status: status,
            title: isCancel ? 'Cancel Request' : 'Update Status',
            description: isCancel ? 'Are you sure you want to cancel this request?' : `Are you sure you want to change status to ${status}?`,
            confirmText: isCancel ? 'Yes, Cancel' : 'Confirm',
            variant: isCancel ? 'destructive' : 'default'
        });
    };

    const handleApprove = () => {
        if (!validateWorkflowAssignments()) return;
        
        openConfirmation({
            action: 'approve',
            title: 'Approve Fine',
            description: 'Are you sure you want to approve this fine?',
            confirmText: 'Approve',
            variant: 'default' // Green in CSS if possible, but default blue is fine
        });
    }

    const handleReject = () => {
        openConfirmation({
            action: 'reject',
            title: 'Reject Fine',
            description: 'Are you sure you want to reject this fine? This action cannot be undone.',
            confirmText: 'Reject',
            variant: 'destructive'
        });
    };

    const refreshData = () => {
        window.location.reload();
    };

    // Fetch Current User
    // Fetch Current User
    useEffect(() => {
        const initUser = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setCurrentUser(parsedUser); // Initial load

                    // Fetch full employee details to ensure we have department/designation
                    // Use employeeId if available (preferred), otherwise user ID
                    let userId = parsedUser.employeeId || parsedUser.id || parsedUser._id;

                    // Sanitize userId (remove anything that isn't a hex char if it looks like a hex ID, or keep as string)
                    if (userId && typeof userId === 'string') {
                        // Only split if it contains ':' (log format artifact)
                        if (userId.includes(':')) userId = userId.split(':')[0].trim();
                        else userId = userId.trim();
                    }

                    // Accept both ObjectIds (24 hex) and custom Employee IDs (non-empty strings)
                    if (userId) {
                        try {
                            const res = await axiosInstance.get(`/Employee/${userId}`, {
                                validateStatus: (status) => status === 200 || status === 404
                            });

                            if (res.status === 200) {
                                const fullData = res.data.employee || res.data;
                                if (fullData) {
                                    setCurrentUser(prev => ({
                                        ...prev,
                                        department: fullData.department,
                                        designation: fullData.designation,
                                        employeeId: fullData.employeeId,
                                        employeeObjectId: fullData._id, // Store Employee ObjectId for reportee checks
                                        companyId: fullData.companyId || (fullData.company && fullData.company._id) || fullData.company,
                                        // Preserve auth flags
                                        isAdmin: prev.isAdmin,
                                        role: prev.role
                                    }));
                                }
                            }
                        } catch (err) {
                            console.warn("Background fetch warning:", err.message);
                        }
                    } else {
                        console.warn("Skipping background fetch: Invalid User ID format", userId);
                    }
                } catch (e) {
                    console.error("Error parsing user data:", e);
                }
            }
        };
        initUser();
    }, [router, toast]);

    useEffect(() => {
        const checkRoles = async () => {
            if (!currentUser || !fine) return;
            setCheckingPermissions(true);
            
            // Check HR
            let hr = isHrUser(currentUser, fine);

            // Check Asset Controller
            let ac = false;
            const dept = (currentUser.department || '').toLowerCase();
            const des = (currentUser.designation || '').toLowerCase();
            const role = (currentUser.role || '').toLowerCase();
            if (
                dept.includes('asset controller') ||
                des.includes('asset controller') ||
                role.includes('asset controller')
            ) {
                ac = true;
            }

            try {
                const flowRes = await axiosInstance.get('/Flowchart');
                const flowchartRows = flowRes?.data || [];
                const actualId = currentUser._id || currentUser.id || currentUser.employeeObjectId;
                
                if (!ac) {
                    ac = flowchartRows.some(row => 
                        row.category === 'assetcontroller' && 
                        row.status === 'Active' && 
                        (String(row.empObjectId?._id) === String(actualId) || 
                         String(row.empObjectId) === String(actualId) || 
                         String(row.employeeId) === String(currentUser.employeeId) ||
                         String(row.employeeId) === String(currentUser.employeeObjectId))
                    );
                }

                if (!hr) {
                    hr = flowchartRows.some(row => 
                        row.category === 'hr' && 
                        row.status === 'Active' && 
                        (String(row.empObjectId?._id) === String(actualId) || 
                         String(row.empObjectId) === String(actualId) || 
                         String(row.employeeId) === String(currentUser.employeeId) ||
                         String(row.employeeId) === String(currentUser.employeeObjectId))
                    );
                }
            } catch (e) {
                console.error("Error fetching flowchart for role checks:", e);
            }

            setIsHr(hr);
            setIsAssetController(ac);
            setCheckingPermissions(false);
        };
        checkRoles();
    }, [currentUser, fine]);

    const canResubmit = useMemo(() => {
        if (!currentUser || !fine || fine.fineStatus !== 'Rejected') return false;

        const workflow = fine.workflow || [];
        const currentUserId = String(currentUser._id || currentUser.id);
        const currentEmpObjectId = currentUser.employeeObjectId ? String(currentUser.employeeObjectId) : null;

        const approvedSteps = workflow.filter(w => w.status === 'Approved');
        if (approvedSteps.length > 0) {
            const lastApprovedStep = approvedSteps[approvedSteps.length - 1];
            const lastApproverId = String(lastApprovedStep.assignedTo?._id || lastApprovedStep.assignedTo);
            return lastApproverId === currentUserId || (currentEmpObjectId && lastApproverId === currentEmpObjectId);
        } else {
            const creatorId = String(fine.createdBy?._id || fine.createdBy);
            return currentUserId === creatorId;
        }
    }, [currentUser, fine]);

    const [allEmployees, setAllEmployees] = useState([]);
    const [allEmployeeFines, setAllEmployeeFines] = useState([]);
    const [fineSummaries, setFineSummaries] = useState({
        totalFineCount: 0,
        totalAmount: 0,
        paidFineCount: 0,
        paidFineAmount: 0,
        outstandingBalance: 0,
        distinctTypesCount: 0,
        startMonthYear: '-',
        endMonthYear: '-',
        personalLoan: { amount: 0, duration: 0, paid: 0, count: 0 },
        salaryAdvance: { amount: 0, duration: 0, paid: 0, count: 0 }
    });

    // Helpers (getYearMonth, addMonthsToYM, getEmpShare) remain the same...
    const getYearMonth = (val) => {
        if (!val) return 0;
        if (typeof val === 'string') {
            const parts = val.split(/[-/T ]/);
            if (parts.length >= 2) {
                const y = parseInt(parts[0]);
                const m = parseInt(parts[1]);
                if (y > 1000 && m >= 1 && m <= 12) return y * 100 + m;
            }
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) return 0;
        return d.getFullYear() * 100 + (d.getMonth() + 1);
    };

    const addMonthsToYM = (ym, months) => {
        if (ym <= 0) return 0;
        let y = Math.floor(ym / 100);
        let m = ym % 100;
        m += months;
        while (m > 12) { m -= 12; y += 1; }
        while (m < 1) { m += 12; y -= 1; }
        return y * 100 + m;
    };

    const getTargetIndexFromId = (recordId) => {
        if (!recordId) return 0;
        const match = recordId.match(/-([A-Z])$/);
        if (match) {
            return match[1].charCodeAt(0) - 65;
        }
        return 0;
    };

    const getEmpShare = (f, targetEmpId) => {
        if (!f) return 0;
        const isCompany = (f.responsibleFor || '').toLowerCase() === 'company';
        if (isCompany) return 0;

        const contextEmpId = targetEmpId || (fine?.assignedEmployees?.find(ae => ae.fineId === id)?.employeeId);
        const rf = (f.responsibleFor || 'Employee').trim();

        if (f.assignedEmployees && f.assignedEmployees.length > 0) {
            let entry = contextEmpId
                ? f.assignedEmployees.find(ae => ae.employeeId === contextEmpId)
                : null;
            if (!entry || entry.employeeId === 'VEGA-HR-0000') {
                entry = f.assignedEmployees.find(
                    (ae) => ae.employeeId !== 'VEGA-HR-0000' && ae.employeeId !== 'VEGA_INTERNAL'
                );
            }
            if (!entry && f.assignedEmployees.length === 1) {
                entry = f.assignedEmployees[0];
            }

            if (entry && entry.employeeId !== 'VEGA-HR-0000') {
                const portion = partyPortionTotal(f, entry, false);
                if (portion > 0) return portion;
            }
        }

        const companyAmount = parseFloat(f.companyAmount || 0) || 0;
        const fineAmount = parseFloat(f.fineAmount || 0) || 0;
        const employeeAmount = parseFloat(f.employeeAmount || 0) || 0;
        const serviceShare = partyServiceShareDisplay(f, null, false);

        if (!(f.assignedEmployees?.length > 1) && companyAmount === 0) {
            return fineAmount;
        }

        if (rf === 'Employee & Company' && employeeAmount > 0) {
            return employeeAmount + serviceShare;
        }

        const totalEmpPortion = employeeAmount > 0
            ? employeeAmount + serviceShare
            : Math.max(0, fineAmount - companyAmount);
        const count = (f.assignedEmployees?.filter(
            (ae) => ae.employeeId !== 'VEGA-HR-0000' && ae.employeeId !== 'VEGA_INTERNAL'
        ).length) || 1;
        return totalEmpPortion / count;
    };

    const getCompShare = (f) => {
        if (!f) return 0;
        const rf = (f.responsibleFor || 'Employee').trim();
        if (rf === 'Employee') return 0;

        const sCharge = parseFloat(f.serviceCharge || 0) || 0;
        const vegaEntry = f.assignedEmployees?.find((ae) => ae.employeeId === 'VEGA-HR-0000');
        if (vegaEntry) {
            const portion = partyPortionTotal(f, vegaEntry, true);
            if (portion > 0) return portion;
        }

        const compBase = parseFloat(f.companyAmount || 0) || 0;
        if (rf === 'Company') {
            const empBase = parseFloat(f.employeeAmount || 0) || 0;
            return parseFloat(f.fineAmount || f.totalFineAmount || 0) || empBase + sCharge;
        }
        if (rf === 'Employee & Company' && compBase > 0) {
            return compBase + partyServiceShareDisplay(f, vegaEntry, true);
        }
        return compBase;
    };

    // Fetch Employees for Modal
    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await axiosInstance.get('/Employee');
                setAllEmployees(res.data.employees || res.data);
            } catch (e) {
                console.error("Failed to fetch employees list", e);
            }
        };
        fetchEmployees();
    }, []);

    // Fetch Fine and Employee Details
    useEffect(() => {
        const fetchAllDetails = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const fineRes = await axiosInstance.get(`/Fine/${id}`);
                const fineData = fineRes.data;
                setFine(fineData);

                if (fineData.formSummary) {
                    const { signatures, ...summaryData } = fineData.formSummary;
                    setFineSummaries((prev) => ({ ...prev, ...summaryData }));
                }

                const targetEmp = resolveActivePartyFromFine(fineData, {
                    recordId: id,
                    party: partyParam,
                    employeeId: partyEmployeeId,
                });

                if (targetEmp) {
                    let empId = String(targetEmp.employeeId || '').trim();
                    const isCompanyFineView =
                        isCompanyFineParty(targetEmp) ||
                        partyParam === 'company' ||
                        fineData.responsibleFor === 'Company';

                    if (empId && empId.includes(':')) {
                        empId = empId.split(':')[0].trim();
                    }

                    if (!isCompanyFineView && empId && empId !== 'PENDING') {
                        try {
                            const empRes = await axiosInstance.get(`/Employee/${empId}`);
                            const empDetails = empRes.data.employee || empRes.data;
                            setEmployeeDetails(empDetails);
                        } catch (err) {
                            console.warn('Failed to fetch employee details:', err);
                            setEmployeeDetails({
                                firstName: targetEmp.employeeName?.split(' ')[0] || targetEmp.employeeName || 'Employee',
                                lastName: targetEmp.employeeName?.split(' ').slice(1).join(' ') || '',
                                employeeId: empId,
                                designation: '-',
                                department: fineData.assignedEmployees?.[0]?.department || '-',
                            });
                        }
                    } else {
                        const companyName = fineData.company?.name || targetEmp.employeeName || 'Company';
                        const companyId = fineData.company?.companyId || fineData.company?._id || 'VEGA-HR-0000';
                        setEmployeeDetails({
                            employeeId: companyId,
                            employeeName: companyName,
                            firstName: companyName.split(' ')[0] || 'Company',
                            lastName: companyName.split(' ').slice(1).join(' ') || '',
                            designation: 'Company',
                            department: 'Company',
                            profilePic: null,
                            companyId,
                            company: fineData.company,
                        });
                    }

                    if (!isCompanyFineView && !fineData.formSummary) {
                        try {

                            // 3. Fetch all fines for this employee to calculate summaries
                            const allFinesRes = await axiosInstance.get(`/Fine?employeeId=${empId}&limit=1000`);
                            let allFines = [];
                            if (allFinesRes.data && Array.isArray(allFinesRes.data.fines)) {
                                allFines = allFinesRes.data.fines;
                            } else if (allFinesRes.data && Array.isArray(allFinesRes.data.data)) {
                                allFines = allFinesRes.data.data;
                            } else if (Array.isArray(allFinesRes.data)) {
                                allFines = allFinesRes.data;
                            }

                            setAllEmployeeFines(allFines);

                            if (allFines.length > 0 || fineData) {
                                // Ensure the current fine is in our processing list if it's not already there
                                const processedFines = [...allFines];
                                if (fineData && !processedFines.some(f => (f._id === fineData._id || f.fineId === fineData.fineId))) {
                                    processedFines.push(fineData);
                                }

                                // Filter: Only show Approved/Active/Paid fines. Exclude Pending/Draft/Rejected.
                                const activeFines = processedFines.filter(f =>
                                    ['Approved', 'Active', 'Paid', 'Completed'].includes(f.fineStatus)
                                );
                                const totalAmount = activeFines.reduce((sum, f) => sum + getEmpShare(f, empId), 0);
                                const paidAmount = activeFines.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
                                const paidFines = activeFines.filter(f => f.fineStatus === 'Paid' || (getEmpShare(f) > 0 && f.paidAmount >= getEmpShare(f)));

                                // Group by category for the breakdown table
                                const aggregates = {
                                    'Vehicle': { amount: 0, paid: 0, count: 0, duration: 0 },
                                    'Safety': { amount: 0, paid: 0, count: 0, duration: 0 },
                                    'Project': { amount: 0, paid: 0, count: 0, duration: 0 },
                                    'Loss': { amount: 0, paid: 0, count: 0, duration: 0 },
                                    'Other': { amount: 0, paid: 0, count: 0, duration: 0 },
                                };

                                activeFines.forEach(f => {
                                    const fType = (f.fineType || f.category || f.subCategory || '').toLowerCase();
                                    let cat = 'Other';
                                    if (fType.includes('vehicle')) cat = 'Vehicle';
                                    else if (fType.includes('safety')) cat = 'Safety';
                                    else if (fType.includes('project')) cat = 'Project';
                                    else if (fType.includes('loss and damage')) cat = 'Loss';
                                    else if (fType.includes('loss') || (fType.includes('damage') && !fType.includes('other'))) cat = 'Loss';
                                    else if (fType.includes('property')) cat = 'Loss';

                                    aggregates[cat].amount += getEmpShare(f, empId);
                                    aggregates[cat].paid += (f.paidAmount || 0);
                                    aggregates[cat].count += 1;
                                    aggregates[cat].duration += (parseInt(f.payableDuration) || 1);
                                });

                                // --- LOAN AND ADVANCE INTEGRATION ---
                                let loanSummary = {
                                    personalLoan: { amount: 0, duration: 0, paid: 0, count: 0 },
                                    salaryAdvance: { amount: 0, duration: 0, paid: 0, count: 0 }
                                };
                                let loanInstallments = 0;

                                try {
                                    const loansRes = await axiosInstance.get(`/Employee/loans?employeeId=${empId}`);
                                    const allLoans = Array.isArray(loansRes.data.loans) ? loansRes.data.loans :
                                        (Array.isArray(loansRes.data.data) ? loansRes.data.data : []);

                                    const approvedLoans = allLoans.filter(l => (l.applicationStatus || '').toLowerCase() === 'approved');

                                    const pLoans = approvedLoans.filter(l => (l.type || '').toLowerCase() === 'loan');
                                    const sAdvances = approvedLoans.filter(l => (l.type || '').toLowerCase() === 'advance');

                                    loanSummary.personalLoan = {
                                        amount: pLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
                                        duration: pLoans.reduce((sum, l) => sum + (Number(l.duration) || 0), 0),
                                        paid: pLoans.reduce((sum, l) => sum + (Number(l.paidAmount) || 0), 0),
                                        count: pLoans.length
                                    };
                                    loanSummary.salaryAdvance = {
                                        amount: sAdvances.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
                                        duration: sAdvances.reduce((sum, l) => sum + (Number(l.duration) || 0), 0),
                                        paid: sAdvances.reduce((sum, l) => sum + (Number(l.paidAmount) || 0), 0),
                                        count: sAdvances.length
                                    };

                                    // Calculate Loan installments for Next Deduction inside same scope
                                    loanInstallments = approvedLoans.reduce((sum, l) => {
                                        const amt = Number(l.amount) || 0;
                                        const dur = Number(l.duration) || 1;
                                        const pd = Number(l.paidAmount) || 0;
                                        if (amt - pd > 0.5) return sum + (amt / dur);
                                        return sum;
                                    }, 0);
                                } catch (err) {
                                    console.error("Failed to fetch loans:", err);
                                }

                                // Next Deduction logic: Sum of (Share / Duration) for fines active in the upcoming payroll month
                                const now = new Date();
                                // "Next" deduction usually targets the immediate upcoming payroll (current + 1)
                                const targetYM = addMonthsToYM(now.getFullYear() * 100 + (now.getMonth() + 1), 1);
                                const targetMonthName = monthNames[(now.getMonth() + 1) % 12];

                                const nextSalaryDeduction = activeFines.reduce((sum, f) => {
                                    // Use live data for the current fine we are viewing
                                    const isCurrent = (fineData && (f._id === fineData._id || f.fineId === fineData.fineId));
                                    const record = isCurrent ? fineData : f;

                                    const share = getEmpShare(record, empId);
                                    if (share <= 0) return sum;

                                    const outstanding = share - (record.paidAmount || 0);
                                    if (outstanding <= 0) return sum;

                                    const startYM = getYearMonth(record.monthStart || record.awardedDate);
                                    const duration = parseInt(record.payableDuration) || 1;
                                    const endYM = addMonthsToYM(startYM, duration - 1);

                                    // STRICT DATE CHECK: Target month must be within [Start, End]
                                    if (startYM > 0 && targetYM >= startYM && targetYM <= endYM) {
                                        return sum + (share / duration);
                                    }
                                    return sum;
                                }, 0);


                                const totalNextDeduction = nextSalaryDeduction + loanInstallments;

                                // Mapped from fineData installment dates
                                let startMonthStr = '-';
                                let endMonthStr = '-';

                                // Fallback to awardedDate if monthStart is missing (common for simple fines)
                                const baseMonthStr = fineData.monthStart || fineData.awardedDate;

                                if (baseMonthStr) {
                                    try {
                                        let date;
                                        if (typeof baseMonthStr === 'string' && baseMonthStr.includes('-')) {
                                            const p = baseMonthStr.split('-');
                                            date = new Date(parseInt(p[0]), (parseInt(p[1]) || 1) - 1, 1);
                                        } else {
                                            date = new Date(baseMonthStr);
                                        }

                                        if (!isNaN(date.getTime())) {
                                            const formatMY = (d) => `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                                            startMonthStr = formatMY(date);

                                            const duration = parseInt(fineData.payableDuration) || 1;
                                            const startYM = getYearMonth(baseMonthStr);
                                            const endYM = addMonthsToYM(startYM, duration - 1);

                                            // Reuse helpers for end date string
                                            const ey = Math.floor(endYM / 100);
                                            const em = endYM % 100;
                                            endMonthStr = `${em.toString().padStart(2, '0')}/${ey}`;
                                        }
                                    } catch (e) {
                                        console.error("Date parsing error:", e);
                                        startMonthStr = baseMonthStr;
                                    }
                                }
                                setFineSummaries({
                                    startMonthYear: startMonthStr,
                                    endMonthYear: endMonthStr,
                                    nextSalaryDeduction: Math.round(totalNextDeduction),
                                    targetMonthName: targetMonthName,
                                    aggregates,
                                    totalFineCount: activeFines.length,
                                    totalAmount: totalAmount,
                                    paidFineCount: paidFines.length,
                                    paidFineAmount: paidAmount,
                                    distinctTypesCount: Object.values(aggregates).filter(a => a.count > 0).length,
                                    ...loanSummary,
                                    outstandingBalance: (totalAmount - paidAmount) +
                                        (loanSummary.personalLoan.amount - loanSummary.personalLoan.paid) +
                                        (loanSummary.salaryAdvance.amount - loanSummary.salaryAdvance.paid)
                                });
                            }
                        } catch (err) {
                            console.error("Failed to fetch all employee fines:", err);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching details:', err);
                toast({
                    title: "Error",
                    description: "Failed to load fine details.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        fetchAllDetails();
    }, [id, toast, partyParam, partyEmployeeId]);

    // Fetch Asset Details if it's a Loss & Damage fine
    useEffect(() => {
        const fetchAssetInfo = async () => {
            const targetAssetObjectId = fine?.assetObjectId || fine?.mainAssetObjectId;
            if (!targetAssetObjectId) return;
            try {
                setLoadingAsset(true);
                const res = await axiosInstance.get(`/AssetItem/detail/${targetAssetObjectId}`);
                setAssetDetails(res.data);
            } catch (err) {
                console.error("Failed to fetch asset details:", err);
            } finally {
                setLoadingAsset(false);
            }
        };

        if (fine && (fine.fineType === 'Loss & Damage' || fine.assetId || fine.assetObjectId)) {
            fetchAssetInfo();
        }
    }, [fine]);

    useNotificationFocusScroll({
        loading,
        focusCardPrefix: FINE_FOCUS_PREFIX,
        deps: [fine?._id, fine?.fineStatus],
    });

    const arrayBufferToBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    };

    const generateFinePDF = async () => {
        const element = document.getElementById('fine-form-container');
        if (element) {
            try {
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    scrollY: -window.scrollY
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                return { type: 'jspdf', pdf };
            } catch (err) {
                console.error('PDF generation error:', err);
            }
        }

        try {
            const targetId = fine?._id || id;
            const response = await axiosInstance.get(`/Fine/${targetId}/pdf`, {
                responseType: 'arraybuffer',
            });
            if (response.data?.byteLength > 500) {
                return { type: 'buffer', base64: arrayBufferToBase64(response.data) };
            }
        } catch (err) {
            console.error('Server PDF generation fallback failed:', err);
        }

        return null;
    };

    const toggleSummaryMode = () => {
        setSummaryViewMode(prev => {
            if (prev === 'count') return 'amount';
            if (prev === 'amount') return 'remaining';
            return 'count';
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const calculateServiceYears = (joinDate) => {
        if (!joinDate) return '-';
        const start = new Date(joinDate);
        const now = new Date();

        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        let days = now.getDate() - start.getDate();

        if (days < 0) {
            months--;
            const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            days += lastMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        let result = [];
        if (years > 0) result.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
        if (months > 0) result.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
        if (days > 0 || result.length === 0) result.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);

        return result.join(' ');
    };

    // Helper to format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString();
    };

    // Derived Data moved up to satisfy Rules of Hooks
    const mainEmployee = employeeDetails || (() => {
        const targetIdx = getTargetIndexFromId(id);
        const target = fine?.assignedEmployees?.find(ae => ae.fineId === id) || (fine?.assignedEmployees?.[targetIdx] || fine?.assignedEmployees?.[0]);
        if (!target) return {};
        return {
            firstName: target.employeeName?.split(' ')[0] || target.employeeName,
            lastName: target.employeeName?.split(' ').slice(1).join(' ') || '',
            employeeId: target.employeeId
        };
    })();

    // Logic to find active visa expiry (similar to VisaCard component)
    const activeVisaExpiry = useMemo(() => {
        if (!mainEmployee || !mainEmployee.visaDetails) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isValid = (dateStr) => dateStr && new Date(dateStr) >= today;

        const details = mainEmployee.visaDetails;
        // Prioritize Valid: Employment > Spouse > Visit
        if (isValid(details.employment?.expiryDate)) return details.employment.expiryDate;
        if (isValid(details.spouse?.expiryDate)) return details.spouse.expiryDate;
        if (isValid(details.visit?.expiryDate)) return details.visit.expiryDate;

        // Fallback to any existing one if all are expired
        return details.employment?.expiryDate || details.spouse?.expiryDate || details.visit?.expiryDate || null;
    }, [mainEmployee]);

    // Labour Card Expiry
    const labourCardExpiry = mainEmployee.labourCardDetails?.expiryDate || mainEmployee.labourCardExpiryDate || null;

    const waitingForName = useMemo(() => {
        if (!fine) return null;
        if (['Approved', 'Rejected', 'Completed', 'Draft', 'Cancelled', 'Withdrawn', 'Active'].includes(fine.fineStatus)) return null;

        // 1. Identify which role we are waiting for based on status
        const s = fine.fineStatus;
        let roleToMatch = null;
        if (s === 'Pending HR') roleToMatch = 'HR';
        else if (s === 'Pending Accounts') roleToMatch = 'Accounts';
        else if (s === 'Pending Authorization') roleToMatch = 'Management';
        else if (s === 'Pending' || s === 'Pending Review') {
            const activeWf = (fine.workflow || []).find(w => w.status === 'Pending');
            if (activeWf) roleToMatch = activeWf.role;
        }

        // 2. Try to find the person assigned in workflow for this specific role
        if (roleToMatch) {
            const step = (fine.workflow || []).find(w => w.role === roleToMatch && w.status === 'Pending');
            if (step?.assignedTo && typeof step.assignedTo === 'object') {
                const name = (step.assignedTo.firstName || step.assignedTo.name) 
                    ? `${step.assignedTo.firstName || ''} ${step.assignedTo.lastName || ''}`.trim() || step.assignedTo.name 
                    : null;
                if (name && name !== 'Unknown') return name;
            }
        }

        // 3. Fallback to submittedTo snapshot (newly populated in backend for groups too)
        if (fine.submittedTo && typeof fine.submittedTo === 'object') {
            const name = (fine.submittedTo.firstName || fine.submittedTo.name)
                ? `${fine.submittedTo.firstName || ''} ${fine.submittedTo.lastName || ''}`.trim() || fine.submittedTo.name
                : null;
            if (name && name !== 'Unknown') return name;
        }

        // 4. Fallback to HOD names from the backend calculation
        if ((s === 'Pending HR' || roleToMatch === 'HR') && fine.hrHODName && fine.hrHODName !== 'Unknown') return fine.hrHODName;
        if ((s === 'Pending Accounts' || roleToMatch === 'Accounts') && fine.accountsHODName && fine.accountsHODName !== 'Unknown') return fine.accountsHODName;
        if ((s === 'Pending Authorization' || roleToMatch === 'Management') && fine.ceoName && fine.ceoName !== 'Unknown') return fine.ceoName;

        // If we found a specific role but no name yet, return null so we don't show "HR: HR"
        return null; 
    }, [fine]);

    const activePartyEntry = useMemo(
        () => resolveActivePartyFromFine(fine, {
            recordId: id,
            party: partyParam,
            employeeId: partyEmployeeId,
        }),
        [fine, id, partyParam, partyEmployeeId],
    );

    const isApproved = ['Approved', 'Active', 'Completed', 'Paid'].includes(fine?.fineStatus);
    const isGroup = fine?.isGroupView || (fine?.assignedEmployees?.length > 1 && !fine?.fineId?.match(/-[A-Z]$/));
    const showGroupPlaceholder = isGroup && !isApproved && !viewingSpecificParty;

    // --- Profile Cards Logic ---
    const employeeForCard = useMemo(() => {
        if (showGroupPlaceholder) {
            return {
                firstName: 'GROUP',
                lastName: 'REQUEST',
                employeeId: 'GROUP',
                designation: 'Group Fine Request',
                department: 'Pending Approval',
                profilePic: null,
                visaDetails: null,
                passportDetails: null,
                emiratesIdDetails: null,
                labourCardDetails: null,
                medicalInsuranceDetails: null,
                drivingLicenseDetails: null
            };
        }
        return employeeDetails || (fine?.assignedEmployees?.[0] ? {
            ...fine.assignedEmployees[0],
            firstName: fine.assignedEmployees[0].employeeName?.split(' ')[0] || '',
            lastName: fine.assignedEmployees[0].employeeName?.split(' ').slice(1).join(' ') || '',
            designation: mainEmployee.designation,
            department: mainEmployee.department,
            ...mainEmployee
        } : null);
    }, [showGroupPlaceholder, employeeDetails, fine, mainEmployee]);

    // Permission Logic — only the assignee on the current workflow step may act (+ Admin)
    const canPerformAction = () => {
        if (!currentUser || !fine) return false;

        const isAdmin = currentUser.role === 'Admin' || currentUser.isAdmin;
        const status = fine.fineStatus;

        if (status === 'Draft') {
            const creatorId = fine.createdBy?._id || fine.createdBy;
            const currentUserId = currentUser.id || currentUser._id;
            if (String(creatorId) === String(currentUserId)) return true;
            return isAdmin;
        }

        return canUserActOnFineStage({
            user: currentUser,
            fine,
            isAdmin,
        });
    };

    const approvedScheduleOnlyEdit = useMemo(
        () => isHr && isApprovedFineStatus(fine?.fineStatus),
        [isHr, fine],
    );

    const approvedAssetControllerOnlyEdit = useMemo(
        () => isAssetController && isApprovedFineStatus(fine?.fineStatus),
        [isAssetController, fine],
    );

    const canShowEditFine = useMemo(() => {
        if (!currentUser || !fine) return false;
        if (isApprovedFineStatus(fine.fineStatus)) {
            return approvedScheduleOnlyEdit || approvedAssetControllerOnlyEdit;
        }
        if (fine.fineStatus === 'Rejected' && canResubmit) return true;
        const isAdmin = currentUser.role === 'Admin' || currentUser.isAdmin;
        return canPerformAction() || isAdmin;
    }, [currentUser, fine, canResubmit, approvedScheduleOnlyEdit, approvedAssetControllerOnlyEdit]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F2F6F9]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!fine) return null;

    // Derived Data
    const toTitleCase = (str) => {
        if (!str || typeof str !== 'string') return str || '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const getUserName = (user, fallback) => {
        let name = fallback || 'Unknown';
        if (user) {
            if (user.name) name = user.name;
            else if (user.firstName) name = `${user.firstName} ${user.lastName || ''}`.trim();
        }
        return toTitleCase(name);
    };

    const getUserId = (user, fallbackId) => {
        if (user && user.employeeId) return user.employeeId;
        return fallbackId || '';
    };

    const rawName = showGroupPlaceholder
        ? 'GROUP REQUEST'
        : (`${mainEmployee.firstName || ''} ${mainEmployee.lastName || ''}`.trim() || fine?.assignedEmployees?.[0]?.employeeName);

    const employeeName = toTitleCase(rawName);
    const designation = mainEmployee.designation || '-';
    const department = mainEmployee.department || '-';
    const hodName = mainEmployee.reportsTo?.name || 'Manager'; // Fallback logic
    
    // Check if this is a company fine (single party or company slice of a group)
    const isCompanyFine =
        partyParam === 'company' ||
        isCompanyFineParty(activePartyEntry) ||
        (!viewingSpecificParty && (
            mainEmployee?.employeeId === 'VEGA-HR-0000' ||
            mainEmployee?.employeeName === 'Vega Digital IT Solutions' ||
            fine?.responsibleFor === 'Company'
        ));
    
    // Get company share for company fines
    const getCompanyShare = (f) => {
        if (!f) return 0;
        if (!isCompanyFine) return 0;
        return parseFloat(f.companyAmount || f.fineAmount || 0);
    };
    
    // Get company name for display - prioritize populated company object
    const displayName = isCompanyFine 
        ? (fine?.company?.name || employeeDetails?.employeeName || fine?.assignedEmployees?.find(emp => emp.employeeId === 'VEGA-HR-0000')?.employeeName || 'Company')
        : employeeName;
    
    // Get company ID for display - prefer companyId string over _id
    const displayCompanyId = isCompanyFine 
        ? (fine?.company?.companyId || employeeDetails?.companyId || fine?.company?._id || '-')
        : null;

    // Get HR name for company fines (use hrHODName)
    const displayHODName = isCompanyFine 
        ? (fine?.hrHODName || 'HR')
        : hodName;

    const lossDamageFormFields = fine && isLossDamageFineType(fine)
        ? buildLossDamageFormFields(fine, {
            isCompanyFine,
            employeeName: displayName || employeeName,
            department,
            hodName: displayHODName,
            getEmpShare,
            getCompShare,
            fineSummaries,
        })
        : null;




    const handleEdit = () => {
        // Redirect to edit page or open modal
        // Assuming there is an edit page or using the AddFineModal in edit mode?
        // Usually it's /HRM/Fine/edit/[id] or a modal. 
        // Current task doesn't specify creating an edit page, just the button.
        // I'll assume standard edit route /HRM/Fine/[id]/edit for now or just log it if route not exist.
        // Actually, let's look for an edit route. 
        // But for now, I'll just add the button with a placeholder alert or router push if I'm confident.
        // Let's assume a modal or separate page. 
        // Given existing patterns, it's likely a modal or same page edit.
        // I will just add the button visual for now as requested.
        toast({ title: 'Not available', description: 'Edit functionality to be implemented or route to be defined.' });
    };

    // tenure and status items moved below returns as they don't use hooks themselves,
    // but depend on employeeForCard which is defined above.

    const tenure = calculateTenure(employeeForCard?.dateOfJoining || employeeForCard?.contractJoiningDate);

    // Calculate expiry days for status items
    const visaDays = calculateDaysUntilExpiry(employeeForCard?.visaDetails?.employment?.expiryDate || employeeForCard?.visaDetails?.spouse?.expiryDate || employeeForCard?.visaDetails?.visit?.expiryDate);
    const passportDays = calculateDaysUntilExpiry(employeeForCard?.passportDetails?.expiryDate);
    const eidDays = calculateDaysUntilExpiry(employeeForCard?.emiratesIdDetails?.expiryDate);
    const labourCardDays = calculateDaysUntilExpiry(employeeForCard?.labourCardDetails?.expiryDate);
    const medDays = calculateDaysUntilExpiry(employeeForCard?.medicalInsuranceDetails?.expiryDate);
    const drivingLicenseDays = calculateDaysUntilExpiry(employeeForCard?.drivingLicenseDetails?.expiryDate);

    const statusItems = [
        { label: 'Visa', days: visaDays, color: getExpiryColor(visaDays) },
        { label: 'Passport', days: passportDays, color: getExpiryColor(passportDays) },
        { label: 'Emirates ID', days: eidDays, color: getExpiryColor(eidDays) },
        { label: 'Labour Card', days: labourCardDays, color: getExpiryColor(labourCardDays) },
        { label: 'Medical Ins.', days: medDays, color: getExpiryColor(medDays) },
        { label: 'Dr. License', days: drivingLicenseDays, color: getExpiryColor(drivingLicenseDays) },
    ];

    // --- Timeline Logic ---
    const getDuration = (start, end) => {
        if (!start || !end) return '';
        const diff = new Date(end) - new Date(start);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        if (minutes > 0) return `${minutes}m`;
        return '< 1m';
    };


    const workflow = fine.workflow || [];
    const type = (fine.fineType || '').toLowerCase();

    // Define the dynamic steps for Fine — no Reportee step (removed)
    const steps = [
        { id: 1, label: 'Created', role: 'System' },
        { id: 2, label: 'Requester', role: 'Requester' },
        { id: 3, label: 'HR', role: 'HR' },
        { id: 4, label: 'Accounts', role: 'Accounts' },
        { id: 5, label: 'Management', role: 'Management' },
    ];

    // Map internal fineStatus to step IDs
    // Draft -> 2 (Requester)
    // Pending HR -> 3 (HR) — first approval stage
    // Pending Accounts -> 4 (Accounts)
    // Pending Authorization -> 5 (Management)
    // Approved -> 6
    const internalStatus = fine.fineStatus;
    const statusMap = {
        'Draft': 2,
        'Pending HR': 3,
        'Pending Accounts': 4,
        'Pending Authorization': 5,
        'Approved': 6,
        'Active': 6,
        'Completed': 6,
        'Paid': 6
    };

    const currentActive = statusMap[internalStatus] || 2;
    const isRejected = internalStatus === 'Rejected';
    const isCancelled = internalStatus === 'Cancelled';


    return (
        <>
            <div className="flex min-h-screen w-full bg-[#F2F6F9] print:bg-white">
                <div className="print:hidden"><Sidebar /></div>
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="print:hidden"><Navbar /></div>
                    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {confirmConfig.description}
                                </AlertDialogDescription>
                                {(confirmConfig.action === 'reject' || (confirmConfig.action === 'updateStatus' && confirmConfig.status === 'Rejected')) && (
                                    <div className="mt-4 space-y-2">
                                        <label className="text-sm font-semibold text-gray-700">Rejection Reason <span className="text-red-500">*</span></label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Please provide a reason for rejection..."
                                            className="w-full min-h-[100px] p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                            required
                                        />
                                    </div>
                                )}
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-gray-200 hover:bg-gray-50 text-gray-600 font-bold">
                                    {confirmConfig.cancelText || 'Cancel'}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if ((confirmConfig.action === 'reject' || (confirmConfig.action === 'updateStatus' && confirmConfig.status === 'Rejected')) && (!rejectionReason || rejectionReason.trim().length === 0)) {
                                            toast({ title: "Reason Required", description: "Please enter a reason for rejection.", variant: "destructive" });
                                            return;
                                        }
                                        handleConfirmAction();
                                    }}
                                    disabled={actionLoading}
                                    className={confirmConfig.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {confirmConfig.confirmText}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <div className="flex-1 flex flex-col items-center justify-start py-8 print:py-0 relative overflow-y-auto w-full px-6 md:px-8">
                        {/* Back Button Header */}
                        <div className="w-full flex items-center justify-between mb-2 print:hidden">
                            <ListReturnBackButton onNavigate={handleListReturnBack} />
                        </div>

                        {/* Top Grid: Profile + Action Card — equal width columns */}
                        <div className="flex flex-row gap-4 w-full mb-6 print:hidden items-stretch">

                            {/* Left Column: Profile & Stats */}
                            <div className="flex-1 min-w-0 flex flex-col">
                                {employeeForCard && (
                                    <div className="w-full h-full flex-1">
                                    <ProfileHeader
                                        employee={employeeForCard}
                                        hideProgressBar={true}
                                        hideStatusToggle={true}
                                        hideRole={true}
                                        hideContactNumber={true}
                                        hideEmail={true}
                                        enlargeProfilePic={false}
                                        showNameUnderProfilePic={true}
                                        hideEmployeeStatus={true}
                                        imageError={imageError}
                                        setImageError={setImageError}
                                        subtitle={fine.fineId}
                                        statusLabel={null}
                                        extraContent={(
                                            <div className="mt-3 space-y-3 w-full">
                                                <div className="grid grid-cols-2 gap-3 w-full cursor-pointer" onClick={toggleSummaryMode} title="Click to toggle between Count, Amount, and Remaining">
                                                    {/* Total - Blue */}
                                                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 text-center flex items-center justify-between px-4 transition-all hover:bg-blue-100">
                                                        <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wide truncate">
                                                            {summaryViewMode === 'count' ? 'Total Count' : summaryViewMode === 'amount' ? 'Total Amount' : 'Balance'}
                                                        </span>
                                                        <span className="text-lg font-bold text-blue-800">
                                                            {summaryViewMode === 'count' 
                                                                ? (fineSummaries.totalFineCount || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (fineSummaries.totalAmount || 0).toLocaleString()
                                                                    : (fineSummaries.outstandingBalance || 0).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Vehicle - Green */}
                                                    <div className="bg-green-50 p-2 rounded-lg border border-green-100 text-center flex items-center justify-between px-4 transition-all hover:bg-green-100">
                                                        <span className="text-[10px] text-green-600 font-medium uppercase tracking-wide truncate">Vehicle</span>
                                                        <span className="text-lg font-bold text-green-800">
                                                            {summaryViewMode === 'count' 
                                                                ? (fineSummaries.aggregates?.['Vehicle']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (fineSummaries.aggregates?.['Vehicle']?.amount || 0).toLocaleString()
                                                                    : ((fineSummaries.aggregates?.['Vehicle']?.amount || 0) - (fineSummaries.aggregates?.['Vehicle']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Safety - Purple */}
                                                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-100 text-center flex items-center justify-between px-4 transition-all hover:bg-purple-100">
                                                        <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wide truncate">Safety</span>
                                                        <span className="text-lg font-bold text-purple-800">
                                                            {summaryViewMode === 'count' 
                                                                ? (fineSummaries.aggregates?.['Safety']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (fineSummaries.aggregates?.['Safety']?.amount || 0).toLocaleString()
                                                                    : ((fineSummaries.aggregates?.['Safety']?.amount || 0) - (fineSummaries.aggregates?.['Safety']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Project Damage - Amber */}
                                                    <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 text-center flex items-center justify-between px-4 transition-all hover:bg-amber-100">
                                                        <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wide truncate">Project Damage</span>
                                                        <span className="text-lg font-bold text-amber-800">
                                                            {summaryViewMode === 'count' 
                                                                ? (fineSummaries.aggregates?.['Project']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (fineSummaries.aggregates?.['Project']?.amount || 0).toLocaleString()
                                                                    : ((fineSummaries.aggregates?.['Project']?.amount || 0) - (fineSummaries.aggregates?.['Project']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Loss and Damage - Red */}
                                                    <div className="bg-red-50 p-2 rounded-lg border border-red-100 text-center flex items-center justify-between px-4 transition-all hover:bg-red-100">
                                                        <span className="text-[10px] text-red-600 font-medium uppercase tracking-wide truncate">Loss & Damage</span>
                                                        <span className="text-lg font-bold text-red-800">
                                                            {summaryViewMode === 'count' 
                                                                ? (fineSummaries.aggregates?.['Loss']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (fineSummaries.aggregates?.['Loss']?.amount || 0).toLocaleString()
                                                                    : ((fineSummaries.aggregates?.['Loss']?.amount || 0) - (fineSummaries.aggregates?.['Loss']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Other Damage - Gray */}
                                                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-center flex items-center justify-between px-4 transition-all hover:bg-gray-100">
                                                        <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide truncate">Other Damage</span>
                                                        <span className="text-lg font-bold text-gray-800">
                                                            {summaryViewMode === 'count' 
                                                                ? (fineSummaries.aggregates?.['Other']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (fineSummaries.aggregates?.['Other']?.amount || 0).toLocaleString()
                                                                    : ((fineSummaries.aggregates?.['Other']?.amount || 0) - (fineSummaries.aggregates?.['Other']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Status Badge - hidden when fine is already approved */}
                                                {(() => {
                                                    const s = fine?.fineStatus;
                                                    const isApprovedFine = ['Approved', 'Active', 'Completed', 'Paid'].includes(s);
                                                    if (isApprovedFine) return null;

                                                    let role = '';
                                                    if (s === 'Pending HR') role = 'HR';
                                                    else if (s === 'Pending Accounts') role = 'Accounts';
                                                    else if (s === 'Pending Authorization') role = 'Management';
                                                    else if (s === 'Pending' || s === 'Pending Review') {
                                                        const activeWf = (fine.workflow || []).find(w => w.status === 'Pending');
                                                        if (activeWf) role = activeWf.role;
                                                    }

                                                    let label = '';
                                                    if (s === 'Draft') label = 'Waiting for Requester';
                                                    else if (s === 'Approved') label = 'Approved';
                                                    else if (waitingForName) label = `Waiting for ${role || 'HR'}: ${waitingForName}`;
                                                    else if (role) label = `Waiting for ${role}`;
                                                    else label = s;

                                                    if (!label) return null;

                                                    const isApproved = label.includes('Approved');

                                                    return (
                                                        <div className="w-full">
                                                            <span className={`text-[11px] font-black uppercase tracking-wider px-4 py-2.5 rounded-lg border shadow-sm w-full block text-center
                                                                ${isApproved
                                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                                    : 'bg-amber-50 text-amber-700 border-amber-200'}
                                                            `}>
                                                                {label}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    />
                                    </div>
                                )}
                                {/* EmploymentSummary removed */}
                            </div>

                            {/* Right Column: Action Card — 6-box grid + workflow track inside */}
                            <div className="flex-1 min-w-0 flex flex-col">
                                <div
                                    id="fine-focus-pendingApproval"
                                    className="bg-white rounded-lg shadow-sm p-4 w-full h-full flex flex-col overflow-visible"
                                >
                                    {(() => {
                                        const status = fine?.fineStatus;
                                        const isDraft = status === 'Draft';
                                        const isApprovedState = ['Approved', 'Active', 'Completed', 'Paid'].includes(status);
                                        const isFinalized = status === 'Approved' || status === 'Rejected' || isApprovedState;
                                        const totalFineAmount = Number(fine?.totalFineAmount || fine?.fineAmount || 0);
                                        const paidAmount = Number(fine?.paidAmount || 0);
                                        const remainingAmount = Math.max(0, totalFineAmount - paidAmount);
                                        const compactBox = 'p-2 rounded-lg border flex items-center justify-between px-4 min-h-[44px] transition-all';

                                        const statusBoxClass =
                                            status === 'Approved' || isApprovedState ? 'bg-green-50 border-green-100 text-green-700' :
                                            status === 'Rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                            'bg-yellow-50 border-yellow-100 text-yellow-700';

                                        const cells = [];

                                        // 1 — Current Status (hidden once approved)
                                        if (!isApprovedState) {
                                            cells.push(
                                                <div key="status" className={`${compactBox} ${statusBoxClass}`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate opacity-80">Current Status</span>
                                                    <span className="text-lg font-bold truncate ml-2">{status || 'Unknown'}</span>
                                                </div>
                                            );
                                        }

                                        // 2–6 — payment summary, actions, or completed
                                        if (isApprovedState) {
                                            cells.push(
                                                <div key="total" className={`${compactBox} bg-red-50 border-red-100`}>
                                                    <span className="text-[10px] text-red-600 font-medium uppercase tracking-wide truncate">Total Fine</span>
                                                    <span className="text-lg font-bold text-red-800 tabular-nums ml-2">{totalFineAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>,
                                                <div key="paid" className={`${compactBox} bg-green-50 border-green-100`}>
                                                    <span className="text-[10px] text-green-600 font-medium uppercase tracking-wide truncate">Paid</span>
                                                    <span className="text-lg font-bold text-green-800 tabular-nums ml-2">{paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>,
                                                <div key="remaining" className={`${compactBox} bg-amber-50 border-amber-100`}>
                                                    <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wide truncate">Remaining</span>
                                                    <span className="text-lg font-bold text-amber-800 tabular-nums ml-2">{remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>,
                                                <div key="done" className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-70`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide truncate">Workflow</span>
                                                    <span className="text-lg font-bold flex items-center gap-1 ml-2"><Check className="w-4 h-4" /> Completed</span>
                                                </div>
                                            );
                                        } else if (status === 'Rejected' && canResubmit) {
                                            cells.push(
                                                <button key="resubmit" type="button" onClick={() => setIsResubmittingModal(true)} className={`${compactBox} border-orange-100 bg-orange-50 text-orange-600 hover:bg-orange-100`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide">Edit & Resubmit</span>
                                                    <Edit className="w-5 h-5 shrink-0" />
                                                </button>
                                            );
                                            while (cells.length < 6) {
                                                cells.push(<div key={`pad-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-300 opacity-40`}><span className="text-[10px]">—</span><span>—</span></div>);
                                            }
                                        } else if (canPerformAction()) {
                                            if (isDraft) {
                                                cells.push(
                                                    <button key="submit" type="button" onClick={() => handleUpdateStatus('Pending')} className={`${compactBox} border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100`}>
                                                        <span className="text-[10px] font-medium uppercase tracking-wide truncate">Submit</span>
                                                        <Send className="w-5 h-5 shrink-0" />
                                                    </button>,
                                                    <button key="cancel" type="button" onClick={() => handleUpdateStatus('Cancelled')} className={`${compactBox} border-red-100 bg-red-50 text-red-600 hover:bg-red-100`}>
                                                        <span className="text-[10px] font-medium uppercase tracking-wide truncate">Cancel</span>
                                                        <Trash2 className="w-5 h-5 shrink-0" />
                                                    </button>
                                                );
                                            } else {
                                                cells.push(
                                                    <button key="approve" type="button" onClick={handleApprove} className={`${compactBox} border-green-100 bg-green-50 text-green-600 hover:bg-green-100`}>
                                                        <span className="text-[10px] font-medium uppercase tracking-wide truncate">Approve</span>
                                                        <Check className="w-5 h-5 shrink-0" />
                                                    </button>,
                                                    <button key="reject" type="button" onClick={handleReject} className={`${compactBox} border-red-100 bg-red-50 text-red-600 hover:bg-red-100`}>
                                                        <span className="text-[10px] font-medium uppercase tracking-wide truncate">Reject</span>
                                                        <X className="w-5 h-5 shrink-0" />
                                                    </button>
                                                );
                                            }
                                            while (cells.length < 6) {
                                                cells.push(
                                                    <div key={`lock-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-50`}>
                                                        <span className="text-[10px] font-medium uppercase tracking-wide truncate">Pending</span>
                                                        <Lock className="w-4 h-4 shrink-0" />
                                                    </div>
                                                );
                                            }
                                        } else if (isFinalized) {
                                            cells.push(
                                                <div key="done-a" className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-70`}>
                                                    <span className="text-[10px] font-medium uppercase tracking-wide">Workflow</span>
                                                    <span className="text-lg font-bold flex items-center gap-1"><Check className="w-4 h-4" /> Completed</span>
                                                </div>
                                            );
                                            while (cells.length < 6) {
                                                cells.push(<div key={`pad-f-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 opacity-30`}><span className="text-[10px]">—</span></div>);
                                            }
                                        } else {
                                            while (cells.length < 6) {
                                                cells.push(
                                                    <div key={`lock-all-${cells.length}`} className={`${compactBox} bg-gray-50 border-gray-100 text-gray-400 opacity-50`}>
                                                        <span className="text-[10px] font-medium uppercase tracking-wide truncate">Locked</span>
                                                        <Lock className="w-4 h-4 shrink-0" />
                                                    </div>
                                                );
                                            }
                                        }

                                        return (
                                            <div className="grid grid-cols-2 gap-3 w-full shrink-0">
                                                {cells.slice(0, 6)}
                                            </div>
                                        );
                                    })()}

                                    {/* Approval workflow track — hidden for approved fines */}
                                    {fine && !['Approved', 'Active', 'Completed', 'Paid'].includes(fine.fineStatus) && (
                                        <div className="mt-auto pt-3 border-t border-gray-100 shrink-0 overflow-visible">
                                            <div className="flex items-start w-full px-1 pt-2 pb-14 min-h-[92px]">
                                                {steps.map((step, idx) => {
                                                    const isLast = idx === steps.length - 1;
                                                    const isStepCurrent = currentActive === step.id && !isRejected && !isCancelled;

                                                    // CIRCLE COLOR: Green only if the specific role has actually approved
                                                    const isStepApproved = (() => {
                                                        if (fine.fineStatus === 'Approved') return true;
                                                        if (step.id === 1) return true; // Created always green
                                                        if (step.id === 2) return (fine.fineStatus || '').toLowerCase() !== 'draft'; // Requester green after sending
                                                        // HR step (id=3)
                                                        if (step.id === 3) return workflow.some(w => w.role === 'HR' && w.status === 'Approved');
                                                        // Accounts step (id=4)
                                                        if (step.id === 4) return workflow.some(w => w.role === 'Accounts' && w.status === 'Approved');
                                                        // Management step (id=5)
                                                        if (step.id === 5) {
                                                            return workflow.some(w => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved') || fine.fineStatus === 'Approved';
                                                        }
                                                        return false;
                                                    })();

                                                    const isGreen = isStepApproved;

                                                    // LINE COLOR: Green only if the destination step has already been approved
                                                    const isNextStepGreen = (() => {
                                                        if (fine.fineStatus === 'Approved') return true;
                                                        const nextId = step.id + 1;
                                                        if (nextId === 2) return fine.fineStatus !== 'Draft';
                                                        if (nextId === 3) return workflow.some(w => w.role === 'HR' && w.status === 'Approved');
                                                        if (nextId === 4) return workflow.some(w => w.role === 'Accounts' && w.status === 'Approved');
                                                        if (nextId === 5) return workflow.some(w => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved') || fine.fineStatus === 'Approved';
                                                        return false;
                                                    })();

                                                    // Helper to get name for subtext
                                                    const getStepName = () => {
                                                        if (step.id === 1) return 'System';
                                                        if (step.id === 2) {
                                                            const creator = fine.createdBy;
                                                            if (!creator) return 'Unknown';
                                                            return creator.name || (creator.firstName ? `${creator.firstName} ${creator.lastName || ''}`.trim() : 'Requester');
                                                        }
                                                        // HR step (id=3)
                                                        if (step.id === 3) {
                                                            const hrStep = workflow.find(w => w.role === 'HR');
                                                            if (hrStep?.assignedTo?.firstName) return `${hrStep.assignedTo.firstName} ${hrStep.assignedTo.lastName || ''}`.trim();
                                                            if (fine.hrHODName && fine.hrHODName !== 'Unknown') return fine.hrHODName;
                                                            return 'HR';
                                                        }
                                                        // Accounts step (id=4)
                                                        if (step.id === 4) {
                                                            const accStep = workflow.find(w => w.role === 'Accounts');
                                                            if (accStep?.assignedTo?.firstName) return `${accStep.assignedTo.firstName} ${accStep.assignedTo.lastName || ''}`.trim();
                                                            if (fine.accountsHODName && fine.accountsHODName !== 'Unknown') return fine.accountsHODName;
                                                            return 'Accounts';
                                                        }
                                                        // Management step (id=5)
                                                        if (step.id === 5) {
                                                            const mgtStep = workflow.find(w => w.role === 'Management' || w.role === 'CEO');
                                                            if (mgtStep?.assignedTo?.firstName) return `${mgtStep.assignedTo.firstName} ${mgtStep.assignedTo.lastName || ''}`.trim();
                                                            if (fine.approvedBy) return fine.approvedBy.name || (fine.approvedBy.firstName ? `${fine.approvedBy.firstName} ${fine.approvedBy.lastName || ''}`.trim() : '');
                                                            if (fine.ceoName && fine.ceoName !== 'Unknown') return fine.ceoName;
                                                            return 'Management';
                                                        }
                                                        return '';
                                                    };

                                                    const getStepDate = () => {
                                                        let dateValue = null;
                                                        if (step.id <= 2) {
                                                            dateValue = fine.createdAt;
                                                        } else {
                                                            const wfStep = workflow.find(w => w.role === step.role && w.status === 'Approved');
                                                            dateValue = wfStep?.actionedAt;
                                                        }

                                                        if (dateValue) {
                                                            try {
                                                                return format(new Date(dateValue), 'MMM d, yyyy');
                                                            } catch (e) {
                                                                return null;
                                                            }
                                                        }
                                                        return null;
                                                    };

                                                    const stepDate = getStepDate();

                                                    const getStepDisplay = () => {
                                                        const isStepRejected = isRejected && currentActive === step.id;
                                                        if (isStepRejected) return <X size={14} strokeWidth={3} />;
                                                        if (isGreen) return <Check size={14} strokeWidth={3} />;
                                                        return step.id;
                                                    };

                                                    const stepName = toTitleCase(getStepName());

                                                    return (
                                                        <div key={step.id} className={`flex items-center ${isLast ? 'flex-none' : 'flex-1'}`}>
                                                            {/* Circle Component */}
                                                            <div className="relative flex flex-col items-center">
                                                                <div
                                                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 shadow-sm z-10
                                                                        ${isGreen
                                                                            ? 'bg-green-500 text-white shadow-md shadow-green-200'
                                                                            : 'bg-red-50 text-red-300 border-2 border-red-100'
                                                                        }
                                                                        ${isStepCurrent ? '!bg-white !text-green-600 !border-2 !border-green-500 shadow-none scale-110 ring-4 ring-green-50' : ''}
                                                                        ${isRejected && currentActive === step.id ? '!bg-white !text-red-600 !border-red-500 !ring-red-50' : ''}
                                                                    `}
                                                                >
                                                                    {getStepDisplay()}
                                                                </div>

                                                                {/* Subtext labels — room below circles stays inside card */}
                                                                <div className="absolute top-[32px] flex flex-col items-center min-w-[52px] max-w-[72px] text-center">
                                                                    <span className={`text-[8px] font-black uppercase tracking-[0.04em] mb-0.5 whitespace-nowrap leading-tight ${isGreen ? 'text-green-600' : 'text-gray-400'}`}>
                                                                        {step.label}
                                                                    </span>
                                                                    {stepName && (
                                                                        <span className="text-[8px] text-gray-500 font-bold max-w-[68px] line-clamp-2 leading-tight opacity-80">
                                                                            {stepName}
                                                                        </span>
                                                                    )}
                                                                    {stepDate && (
                                                                        <span className="text-[8px] text-gray-400 font-medium max-w-[68px] truncate leading-tight mt-0.5">
                                                                            {stepDate}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Connecting Line Segment */}
                                                            {!isLast && (
                                                                <div className="flex-1 relative flex items-center">
                                                                    <div className={`h-[2px] w-full transition-all duration-500 z-0 shadow-sm ${isNextStepGreen ? 'bg-green-500' : 'bg-red-50'}`} />

                                                                    {/* Duration Badge */}
                                                                    {(() => {
                                                                        let start = null;
                                                                        let end = null;
                                                                        let isLive = false;

                                                                        if (step.id === 1) {
                                                                            // Created → Requester
                                                                            start = fine.createdAt;
                                                                            if (fine.fineStatus !== 'Draft') end = fine.updatedAt;
                                                                            if (fine.fineStatus === 'Draft') isLive = true;
                                                                        } else if (step.id === 2) {
                                                                            // Requester → HR
                                                                            start = (fine.fineStatus !== 'Draft') ? fine.updatedAt : fine.createdAt;
                                                                            const hrStep = workflow.find(w => w.role === 'HR');
                                                                            end = hrStep?.actionedAt;
                                                                            if (start && !end && currentActive === 3) isLive = true;
                                                                        } else if (step.id === 3) {
                                                                            // HR → Accounts
                                                                            const hrStep = workflow.find(w => w.role === 'HR');
                                                                            start = hrStep?.actionedAt;
                                                                            const accStep = workflow.find(w => w.role === 'Accounts');
                                                                            end = accStep?.actionedAt;
                                                                            if (start && !end && currentActive === 4) isLive = true;
                                                                        } else if (step.id === 4) {
                                                                            // Accounts → Management
                                                                            const accStep = workflow.find(w => w.role === 'Accounts');
                                                                            start = accStep?.actionedAt;
                                                                            const mgtStep = workflow.find(w => w.role === 'Management' || w.role === 'CEO');
                                                                            end = mgtStep?.actionedAt;
                                                                            if (start && !end && currentActive === 5) isLive = true;
                                                                        }

                                                                        const effectiveEnd = end || (isLive ? new Date() : null);

                                                                        if (start && effectiveEnd) {
                                                                            const diff = Math.max(0, new Date(effectiveEnd) - new Date(start));
                                                                            const durationText = getDuration(new Date(start), new Date(effectiveEnd));

                                                                            return (
                                                                                <div className={`absolute left-1/2 -translate-x-1/2 bottom-3 z-20 flex items-center gap-1 ${isLive ? 'animate-pulse' : ''}`}>
                                                                                    {isLive && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                                                                    <span className={`text-[9px] md:text-[10px] font-black whitespace-nowrap uppercase tracking-tight ${isLive ? 'text-green-600' : 'text-gray-500'}`}>
                                                                                        {durationText}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="w-full flex items-center border-b border-gray-200 mb-6 print:hidden">
                            <button
                                onClick={() => setActiveTab('fineForm')}
                                className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${
                                    activeTab === 'fineForm'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Fine Form
                            </button>
                            <button
                                onClick={() => setActiveTab('historyDetails')}
                                className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${
                                    activeTab === 'historyDetails'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Fine History & Details
                            </button>
                            {canShowEditFine && (
                                <button
                                    onClick={() => setShowEditModal(true)}
                                    className="py-3 px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 flex items-center gap-1.5"
                                >
                                    <Edit className="w-4 h-4" />
                                    {approvedScheduleOnlyEdit ? 'Edit Schedule' : 'Edit Fine'}
                                </button>
                            )}
                            {isApprovedFineStatus(fine.fineStatus) && (
                                <button
                                    onClick={() => setActiveTab('approvedAttachments')}
                                    className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${
                                        activeTab === 'approvedAttachments'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    Attachment
                                </button>
                            )}
                        </div>

                        {/* 
                            NEW: Group Details Table for Non-Approved/Pending state.
                            Shows only when formal A4 form is hidden.
                        */}
                        {!['Approved', 'Active', 'Completed', 'Paid'].includes(fine.fineStatus) && (
                            <div className={`w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8 print:hidden ${activeTab === 'fineForm' ? 'block' : 'hidden'}`}>
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                                            <Users size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-800">Group Request Details</h4>
                                            <p className="text-sm text-gray-500">Breakdown of fine participants and amounts</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        {fine.serviceCharge > 0 && (
                                            <div className="text-right">
                                                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Service Charge</div>
                                                <div className="text-sm font-semibold text-gray-600">{Number(fine.serviceCharge || 0).toLocaleString()} AED</div>
                                            </div>
                                        )}
                                        <div className="text-right">
                                            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Fine</div>
                                            <div className="text-sm font-bold text-gray-900">{Number(computeFinePayableTotal(fine)).toLocaleString()} AED</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-400 font-semibold uppercase tracking-tighter text-[11px]">
                                                <th className="px-4 py-3 border-b">ID</th>
                                                <th className="px-4 py-3 border-b">Employee Name</th>
                                                <th className="px-4 py-3 border-b">Category</th>
                                                <th className="px-4 py-3 border-b text-center">Amount (AED)</th>
                                                <th className="px-4 py-3 border-b text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {fine.assignedEmployees?.map((emp, idx) => {
                                                const isCo = emp.employeeId === 'VEGA-HR-0000' || emp.employeeName === 'Vega Digital IT Solutions';
                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-4 py-4 font-bold text-gray-700">
                                                            {isCo ? <span className="text-gray-400 italic">Internal</span> : emp.employeeId}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="font-semibold text-gray-900">{emp.employeeName}</div>
                                                            {isCo && <div className="text-[10px] text-blue-600 font-bold uppercase tracking-tight">Company Contribution</div>}
                                                        </td>
                                                        <td className="px-4 py-4 text-gray-600">
                                                            {fine.fineType}
                                                            {fine.accessoryName ? (
                                                                <div className="text-[10px] text-gray-400 mt-0.5"><span className="font-semibold text-gray-500">Accessory:</span> {fine.accessoryName}</div>
                                                            ) : fine.assetName ? (
                                                                <div className="text-[10px] text-gray-400 mt-0.5"><span className="font-semibold text-gray-500">Asset:</span> {fine.assetName}</div>
                                                            ) : null}
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className="font-bold text-red-600">
                                                                {(() => {
                                                                    const base = getFineBaseRowAmount(fine, emp, isCo);
                                                                    const employeeCount = fine.assignedEmployees?.filter(e => e.employeeId !== 'VEGA-HR-0000').length || 1;
                                                                    if (!isCo && employeeCount > 1 && !fine.isGroupView) {
                                                                        return Number(base / employeeCount).toLocaleString();
                                                                    }
                                                                    return Number(base).toLocaleString();
                                                                })()}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded-lg text-[10px] font-bold uppercase tracking-tight border border-yellow-100">
                                                                {fine.fineStatus || 'Pending Approval'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            {fine.serviceCharge > 0 && (
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan="3" className="px-4 py-3 text-right font-semibold text-gray-600 uppercase text-xs">Service Charge:</td>
                                                    <td className="px-4 py-3 text-center font-bold text-gray-700 text-sm">
                                                        {Number(fine.serviceCharge || 0).toLocaleString()} AED
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            )}
                                            <tr className="bg-blue-50/30">
                                                <td colSpan="3" className="px-4 py-4 text-right font-bold text-gray-600 uppercase text-xs">Total Amount:</td>
                                                <td className="px-4 py-4 text-center font-black text-blue-700 text-base">
                                                    {Number(computeFinePayableTotal(fine)).toLocaleString()} AED
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Description / Remarks</h5>
                                    <p className="text-sm text-gray-700 leading-relaxed italic">
                                        {fine.description || "No specific description provided."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Fine Form — card layout (approved fines) */}
                        {['Approved', 'Active', 'Completed', 'Paid'].includes(fine.fineStatus) && (
                            <div
                                id="fine-form-container"
                                className={`w-full ${activeTab === 'fineForm' ? 'block' : 'hidden'}`}
                            >
                                <FineFormCards
                                    fine={fine}
                                    isCompanyFine={isCompanyFine}
                                    isLossDamage={isLossDamageFineType(fine)}
                                    lossDamageFields={lossDamageFormFields}
                                    showGroupPlaceholder={showGroupPlaceholder}
                                    employeeName={employeeName}
                                    displayName={displayName}
                                    department={department}
                                    hodName={displayHODName}
                                    designation={designation}
                                    mainEmployee={mainEmployee}
                                    fineSummaries={fineSummaries}
                                    getEmpShare={getEmpShare}
                                    getCompShare={getCompShare}
                                    formatDate={formatDate}
                                    assetDetails={assetDetails}
                                    allEmployeeFines={allEmployeeFines}
                                />
                            </div>
                        )}

                        {activeTab === 'approvedAttachments' && isApprovedFineStatus(fine.fineStatus) && (
                            <FineApprovedAttachmentsTab
                                fine={fine}
                                fineRouteId={id}
                                employeeId={activePartyEntry?.employeeId}
                            />
                        )}

                        {/* Fine History & Details Tab Content */}
                        {activeTab === 'historyDetails' && (
                            <div className="w-full flex flex-col lg:flex-row gap-6 mb-8 print:hidden items-stretch">
                                {/* Left Column: Details Cards */}
                                <div className="flex-1 flex flex-col gap-6">
                                    {/* Fine Overview Details */}
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
                                            <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                                                <FileText size={24} />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-800">Fine Details</h4>
                                                <p className="text-xs text-gray-500">Overview of the logged fine record</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Fine ID</span>
                                                <span className="font-semibold text-gray-800">{fine.fineId}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Fine Type</span>
                                                <span className="font-semibold text-gray-800">{fine.fineType}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Category / Reason</span>
                                                <span className="font-semibold text-gray-800">{fine.category || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Awarded Date</span>
                                                <span className="font-semibold text-gray-800">{formatDate(fine.awardedDate || fine.createdAt)}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Employee Portion</span>
                                                <span className="font-semibold text-red-600">
                                                    {Number(fine.employeeAmount || 0).toLocaleString()} AED
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Company Portion</span>
                                                <span className="font-semibold text-gray-800">
                                                    {Number(fine.companyAmount || 0).toLocaleString()} AED
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Service Charge</span>
                                                <span className="font-semibold text-gray-800">
                                                    {Number(fine.serviceCharge || 0).toLocaleString()} AED
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Total Amount</span>
                                                <span className="font-bold text-blue-600">
                                                    {Number(fine.totalFineAmount || fine.fineAmount || 0).toLocaleString()} AED
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Payable Duration</span>
                                                <span className="font-semibold text-gray-800">
                                                    {fine.payableDuration || 1} Month(s)
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Deduction Range</span>
                                                <span className="font-semibold text-gray-800">
                                                    {fineSummaries.startMonthYear || '-'} to {fineSummaries.endMonthYear || '-'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <span className="text-xs text-gray-400 block font-medium mb-1">Description / Remarks</span>
                                            <p className="text-sm text-gray-600 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                {fine.description || 'No description provided.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Asset Details (For Loss & Damage Fines) */}
                                    {(fine.fineType === 'Loss & Damage' || fine.assetId || fine.assetObjectId) && (
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                                            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                                                        <Package size={24} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-gray-800">Asset Details</h4>
                                                        <p className="text-xs text-gray-500">Details of the damaged or lost asset</p>
                                                    </div>
                                                </div>
                                                
                                                {/* Redirect Link */}
                                                {(fine.assetObjectId || assetDetails?._id) && (
                                                    <Link
                                                        href={(() => {
                                                            const assetObjId = fine.assetObjectId || assetDetails?._id;
                                                            const typeLower = String(assetDetails?.type || assetDetails?.typeId?.name || '').toLowerCase();
                                                            const catLower = String(assetDetails?.category || assetDetails?.categoryId?.name || '').toLowerCase();
                                                            const isVehicle = typeLower.includes('vehicle') || catLower.includes('vehicle') || !!assetDetails?.plateNumber;
                                                            return isVehicle
                                                                ? `/HRM/Asset/Vehicle/details/${assetObjId}`
                                                                : `/HRM/Asset/details/${assetObjId}`;
                                                        })()}
                                                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                                                    >
                                                        View Asset Page
                                                        <ExternalLink size={12} />
                                                    </Link>
                                                )}
                                            </div>
                                            
                                            {loadingAsset ? (
                                                <div className="flex justify-center py-6">
                                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                                                    <div>
                                                        <span className="text-xs text-gray-400 block font-medium">Asset ID</span>
                                                        <span className="font-semibold text-mono text-gray-800">{fine.assetId || assetDetails?.assetId || '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 block font-medium">Asset Name</span>
                                                        <span className="font-semibold text-gray-800">{fine.assetName || assetDetails?.name || '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 block font-medium">Category</span>
                                                        <span className="font-semibold text-gray-800">
                                                            {assetDetails?.categoryId?.name || assetDetails?.category || '-'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 block font-medium">Type</span>
                                                        <span className="font-semibold text-gray-800">
                                                            {assetDetails?.typeId?.name || assetDetails?.type || '-'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 block font-medium">Status</span>
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block border ${
                                                            String(assetDetails?.status || '').toLowerCase() === 'lost' 
                                                                ? 'bg-red-50 text-red-700 border-red-200' 
                                                                : String(assetDetails?.status || '').toLowerCase() === 'damaged' 
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                                        }`}>
                                                            {assetDetails?.status || 'Lost'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 block font-medium">Asset Value</span>
                                                        <span className="font-semibold text-gray-800">
                                                            {assetDetails?.assetValue ? `${Number(assetDetails.assetValue).toLocaleString()} AED` : '-'}
                                                        </span>
                                                    </div>
                                                    
                                                    {(fine.accessoryId || fine.accessoryName) && (
                                                        <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
                                                            <h5 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2">Affected Accessory</h5>
                                                            <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                                                                <div>
                                                                    <span className="text-xs text-gray-400 block font-medium">Accessory ID</span>
                                                                    <span className="font-semibold text-mono text-gray-800">{fine.accessoryId || '-'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs text-gray-400 block font-medium">Accessory Name</span>
                                                                    <span className="font-semibold text-gray-800">{fine.accessoryName || '-'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Workflow History Timeline */}
                                <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                                    <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
                                        <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                                            <History size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-800">Fine Workflow History</h4>
                                            <p className="text-xs text-gray-500">Timeline of creation and approvals</p>
                                        </div>
                                    </div>
                                    
                                    {/* Timeline Steps */}
                                    <div className="relative pl-6 border-l-2 border-gray-100 ml-4 flex-1 flex flex-col gap-8 py-2">
                                        {steps.map((step) => {
                                            const isStepApproved = (() => {
                                                if (fine.fineStatus === 'Approved') return true;
                                                if (step.id === 1) return true; // Created always green
                                                if (step.id === 2) return (fine.fineStatus || '').toLowerCase() !== 'draft'; // Requester green after sending
                                                if (step.id === 3) return workflow.some(w => w.role === 'HR' && w.status === 'Approved');
                                                if (step.id === 4) return workflow.some(w => w.role === 'Accounts' && w.status === 'Approved');
                                                if (step.id === 5) return workflow.some(w => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved') || fine.fineStatus === 'Approved';
                                                return false;
                                            })();

                                            const isStepRejected = isRejected && currentActive === step.id;
                                            const isStepPending = currentActive === step.id && !isRejected && !isCancelled;

                                            const getStepActor = () => {
                                                if (step.id === 1) return 'System';
                                                if (step.id === 2) {
                                                    const creator = fine.createdBy;
                                                    if (!creator) return 'Requester';
                                                    return creator.name || (creator.firstName ? `${creator.firstName} ${creator.lastName || ''}`.trim() : 'Requester');
                                                }
                                                if (step.id === 3) {
                                                    const hrStep = workflow.find(w => w.role === 'HR');
                                                    if (hrStep?.assignedTo?.firstName) return `${hrStep.assignedTo.firstName} ${hrStep.assignedTo.lastName || ''}`.trim();
                                                    if (fine.hrHODName && fine.hrHODName !== 'Unknown') return fine.hrHODName;
                                                    return 'HR Manager';
                                                }
                                                if (step.id === 4) {
                                                    const accStep = workflow.find(w => w.role === 'Accounts');
                                                    if (accStep?.assignedTo?.firstName) return `${accStep.assignedTo.firstName} ${accStep.assignedTo.lastName || ''}`.trim();
                                                    if (fine.accountsHODName && fine.accountsHODName !== 'Unknown') return fine.accountsHODName;
                                                    return 'Accounts Officer';
                                                }
                                                if (step.id === 5) {
                                                    const mgtStep = workflow.find(w => w.role === 'Management' || w.role === 'CEO');
                                                    if (mgtStep?.assignedTo?.firstName) return `${mgtStep.assignedTo.firstName} ${mgtStep.assignedTo.lastName || ''}`.trim();
                                                    if (fine.approvedBy) return fine.approvedBy.name || (fine.approvedBy.firstName ? `${fine.approvedBy.firstName} ${fine.approvedBy.lastName || ''}`.trim() : '');
                                                    if (fine.ceoName && fine.ceoName !== 'Unknown') return fine.ceoName;
                                                    return 'CEO / Management';
                                                }
                                                return '';
                                            };

                                            const getStepDateStr = () => {
                                                let dateValue = null;
                                                if (step.id <= 2) {
                                                    dateValue = fine.createdAt;
                                                } else {
                                                    const wfStep = workflow.find(w => w.role === step.role && w.status === 'Approved');
                                                    dateValue = wfStep?.actionedAt;
                                                }
                                                if (dateValue) {
                                                    try {
                                                        return format(new Date(dateValue), 'MMM d, yyyy - hh:mm a');
                                                    } catch (e) {
                                                        return null;
                                                    }
                                                }
                                                return null;
                                            };

                                            const actorName = getStepActor();
                                            const actionDate = getStepDateStr();

                                            return (
                                                <div key={step.id} className="relative text-gray-700">
                                                    {/* Circle Indicator */}
                                                    <div className={`absolute -left-[35px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 z-10 ${
                                                        isStepApproved 
                                                            ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-200' 
                                                            : isStepRejected 
                                                                ? 'bg-red-500 border-red-500 text-white shadow-sm shadow-red-200' 
                                                                : isStepPending 
                                                                    ? 'bg-white border-blue-500 text-blue-500 ring-4 ring-blue-50' 
                                                                    : 'bg-white border-gray-200 text-gray-400'
                                                    }`}>
                                                        {isStepApproved ? <Check size={12} strokeWidth={3} /> : isStepRejected ? <X size={12} strokeWidth={3} /> : step.id}
                                                    </div>
                                                    
                                                    {/* Step Details */}
                                                    <div className="flex flex-col text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-gray-800 text-sm">{step.label} Stage</span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                isStepApproved 
                                                                    ? 'bg-green-50 text-green-700 border border-green-200' 
                                                                    : isStepRejected 
                                                                        ? 'bg-red-50 text-red-700 border border-red-200' 
                                                                        : isStepPending 
                                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                                                            : 'bg-gray-50 text-gray-400 border border-gray-200'
                                                            }`}>
                                                                {isStepApproved ? 'Approved' : isStepRejected ? 'Rejected' : isStepPending ? 'Pending' : 'Scheduled'}
                                                            </span>
                                                        </div>
                                                        
                                                        <span className="text-xs text-gray-500 mt-1 font-medium">
                                                            Assigned / Action by: <span className="font-semibold text-gray-700">{toTitleCase(actorName)}</span>
                                                        </span>
                                                        
                                                        {actionDate && (
                                                            <span className="text-[11px] text-gray-400 mt-0.5">
                                                                Date: {actionDate}
                                                            </span>
                                                        )}

                                                        {isStepRejected && fine.rejectionReason && (
                                                            <div className="mt-2 text-xs text-red-600 bg-red-50/50 border border-red-100 p-2.5 rounded-lg font-medium italic">
                                                                Reason: {fine.rejectionReason}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Edit Fine Modal */}
                    {(showEditModal || isResubmittingModal) && (
                    <>
                        {fine.fineType === 'Vehicle Fine' && (
                            <AddVehicleFineModal
                                isOpen={showEditModal || isResubmittingModal}
                                onClose={() => { setShowEditModal(false); setIsResubmittingModal(false); }}
                                onSuccess={refreshData}
                                employees={allEmployees}
                                initialData={fine}
                                isResubmitting={isResubmittingModal}
                                scheduleOnlyEdit={approvedScheduleOnlyEdit}
                            />
                        )}
                        {fine.fineType === 'Safety Fine' && (
                            <AddSafetyFineModal
                                isOpen={showEditModal || isResubmittingModal}
                                onClose={() => { setShowEditModal(false); setIsResubmittingModal(false); }}
                                onSuccess={refreshData}
                                employees={allEmployees}
                                initialData={fine}
                                isResubmitting={isResubmittingModal}
                                scheduleOnlyEdit={approvedScheduleOnlyEdit}
                            />
                        )}
                        {fine.fineType === 'Project Damage' && (
                            <AddProjectDamageModal
                                isOpen={showEditModal || isResubmittingModal}
                                onClose={() => { setShowEditModal(false); setIsResubmittingModal(false); }}
                                onSuccess={refreshData}
                                employees={allEmployees}
                                initialData={fine}
                                isResubmitting={isResubmittingModal}
                                scheduleOnlyEdit={approvedScheduleOnlyEdit}
                            />
                        )}
                        {fine.fineType === 'Loss & Damage' && (
                            <AddLossDamageModal
                                isOpen={showEditModal || isResubmittingModal}
                                onClose={() => { setShowEditModal(false); setIsResubmittingModal(false); }}
                                onSuccess={refreshData}
                                employees={allEmployees}
                                initialData={{
                                    ...fine,
                                    ...(assetDetails
                                        ? {
                                            accessories: assetDetails.accessories || fine.accessories,
                                            assetValue: assetDetails.assetValue ?? fine.assetValue,
                                            purchaseDate: assetDetails.purchaseDate ?? fine.purchaseDate,
                                            assetPurchaseDate: assetDetails.purchaseDate ?? fine.assetPurchaseDate,
                                        }
                                        : {}),
                                }}
                                isResubmitting={isResubmittingModal}
                                scheduleOnlyEdit={approvedScheduleOnlyEdit}
                                assetControllerOnlyEdit={approvedAssetControllerOnlyEdit}
                            />
                        )}
                        {(fine.fineType === 'Other Damage' || fine.subCategory === 'Other Damage') && (
                            <AddOtherDamageModal
                                isOpen={showEditModal || isResubmittingModal}
                                onClose={() => { setShowEditModal(false); setIsResubmittingModal(false); }}
                                onSuccess={refreshData}
                                employees={allEmployees}
                                initialData={fine}
                                isResubmitting={isResubmittingModal}
                                scheduleOnlyEdit={approvedScheduleOnlyEdit}
                            />
                        )}
                        {/* Fallback for general fines or unmatched types */}
                        {!['Vehicle Fine', 'Safety Fine', 'Project Damage', 'Loss & Damage', 'Other Damage'].includes(fine.fineType) && fine.subCategory !== 'Other Damage' && (
                            <AddFineModal
                                isOpen={showEditModal || isResubmittingModal}
                                onClose={() => { setShowEditModal(false); setIsResubmittingModal(false); }}
                                onSuccess={refreshData}
                                employees={allEmployees}
                                initialData={fine}
                                currentUser={currentUser}
                                isResubmitting={isResubmittingModal}
                                scheduleOnlyEdit={approvedScheduleOnlyEdit}
                            />
                        )}
                    </>
                    )}
                </div>
            </div>
        </>
    );
}

export default function FineDetailsPage({ params }) {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <FineDetailsPageContent params={params} />
        </Suspense>
    );
}
