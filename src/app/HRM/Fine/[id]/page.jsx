'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { useNotificationFocusScroll } from '@/hooks/useNotificationFocusScroll';
import { FINE_FOCUS_PREFIX } from '@/utils/fineNotificationRouting';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import html2canvas from 'html2canvas';
import { buildHtml2CanvasOptions } from '@/utils/html2canvasSafeCapture';
import { jsPDF } from 'jspdf';
import { Loader2, Printer, Check, X, Edit, AlertCircle, Lock, Trash2, Send, Package, History, ExternalLink, FileText, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import { format } from 'date-fns';
import Image from 'next/image';
import AddFineModal from '../components/AddFineModal';
import AddVehicleFineModal from '../components/AddVehicleFineModal';
import AddSafetyFineModal from '../components/AddSafetyFineModal';
import AddProjectDamageModal from '../components/AddProjectDamageModal';
import AddLossDamageModal from '../components/AddLossDamageModal';
import FineFormCards from '../components/FineFormCards';
import FineApprovedAttachmentsTab from '../components/FineApprovedAttachmentsTab';
import FineWorkflowHistoryPanel from '../components/FineWorkflowHistoryPanel';
import {
    buildFineVendorPaymentPrefill,
    canAccountsPayFineVendorBill,
} from '../utils/fineVendorPaymentPrefill';
import { mapZohoVendors } from '@/utils/zohoVendors';
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
    buildGroupMembersForFine,
    buildGroupMemberDetailHref,
    buildGroupOverviewHref,
    canViewGroupFinePartiesIndividually,
    getFineBaseId,
    isCompanyFineParty,
    isViewingSpecificFineParty,
    resolveActivePartyFromFine,
} from '@/utils/fineGroupClassification';
import {
    resolveCompanyFinePayableAmount,
    resolveEmployeeFinePayableAmount,
} from '@/utils/finePayableAmount';
import { canUserActOnFineStage } from '@/utils/fineStageAuth';
import { notifyFinePendingInboxChanged } from '../utils/finePendingInboxCount';
import { APPROVED_FINE_STATUSES, deriveFineScheduleMonthYears } from '../utils/fineScheduleUtils';
import { buildEmployeeFinancials } from '../utils/employeeFineFinancials';
import { isApprovedLoanRecord } from '../../LoanAndAdvance/utils/loanScheduleUtils';
import { HEADER_PAIR_CARD_FIXED, HEADER_PAIR_GRID, DETAIL_PAIR_COLUMN, DETAIL_PAIR_GRID } from '@/utils/headerPairLayout';
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

const EMPTY_FINE_SUMMARIES = {
    totalFineCount: 0,
    totalAmount: 0,
    paidFineCount: 0,
    paidFineAmount: 0,
    outstandingBalance: 0,
    distinctTypesCount: 0,
    startMonthYear: '-',
    endMonthYear: '-',
    personalLoan: { amount: 0, duration: 0, paid: 0, count: 0 },
    salaryAdvance: { amount: 0, duration: 0, paid: 0, count: 0 },
};

const FINE_WORKFLOW_STEPS = [
    { id: 1, label: 'Created', role: 'System' },
    { id: 2, label: 'Requester', role: 'Requester' },
    { id: 3, label: 'HR', role: 'HR' },
    { id: 4, label: 'Accounts', role: 'Accounts' },
    { id: 5, label: 'Management', role: 'Management' },
];

function isFineWorkflowStepApproved(step, fine, workflow = []) {
    const status = fine?.fineStatus;
    if (['Approved', 'Active', 'Completed', 'Paid'].includes(status)) return true;
    if (step.id === 1) return true;
    if (step.id === 2) return String(status || '').toLowerCase() !== 'draft';
    if (step.id === 3) return workflow.some((w) => w.role === 'HR' && w.status === 'Approved');
    if (step.id === 4) return workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved');
    if (step.id === 5) {
        return workflow.some((w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved');
    }
    return false;
}

/** Green connector after a step once the next stage is reached / approved. */
function isFineWorkflowConnectorGreen(step, fine, workflow = []) {
    const nextId = step.id + 1;
    if (nextId === 2) return String(fine?.fineStatus || '').toLowerCase() !== 'draft';
    if (nextId === 3) return workflow.some((w) => w.role === 'HR' && w.status === 'Approved');
    if (nextId === 4) return workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved');
    if (nextId === 5) {
        return workflow.some((w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved')
            || fine?.fineStatus === 'Approved';
    }
    return false;
}

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

function FineDetailsPageContent() {
    let { id } = useParams();

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
    const confirmActionInFlightRef = useRef(false);
    const [imageError, setImageError] = useState(false);
    const [activeTab, setActiveTab] = useState('fineForm'); // 'fineForm', 'historyDetails', 'approvedAttachments'
    const [assetDetails, setAssetDetails] = useState(null);
    const [loadingAsset, setLoadingAsset] = useState(false);
    const [allEmployees, setAllEmployees] = useState([]);
    const [allEmployeeFines, setAllEmployeeFines] = useState([]);
    const [allEmployeeLoans, setAllEmployeeLoans] = useState([]);
    const [fineSummaries, setFineSummaries] = useState({ ...EMPTY_FINE_SUMMARIES });

    // Confirmation State
    const [summaryViewMode, setSummaryViewMode] = useState('count'); // 'count', 'amount', 'remaining'
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [managementZoho, setManagementZoho] = useState({
        zohoVendorId: '',
        zohoVendorName: '',
        expenseAccountId: '',
        expenseAccountName: '',
        zohoOrganizationId: '',
    });
    const [partyPayables, setPartyPayables] = useState([]);
    const [accountsApprovePayable, setAccountsApprovePayable] = useState({
        expenseAccountId: '',
        expenseAccountName: '',
    });
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
        if (confirmActionInFlightRef.current || actionLoading) return;
        confirmActionInFlightRef.current = true;
        setActionLoading(true);
        setConfirmOpen(false);
        const { action, status } = confirmConfig;

        try {
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
                const isAccountsStage =
                    fine.fineStatus === 'Pending Accounts' || fine.fineStatus === 'Pending Finance';
                const isManagementStage = fine.fineStatus === 'Pending Authorization';

                const groupParties = Array.isArray(partyPayables) && partyPayables.length > 0
                    ? partyPayables
                    : buildGroupMembersForFine(fine).map((p) => ({
                        fineRecordId: p.fineRecordId,
                        fineId: p.fineId,
                        employeeName: p.employeeName,
                        expenseAccountId: p.expenseAccountId || '',
                        expenseAccountName: p.expenseAccountName || '',
                        payableConfirmed: Boolean(p.payableConfirmed),
                    }));
                const isGroupFine = Boolean(fine?.isGroupView) || groupParties.length > 1;
                // Individual + group: Vendor/Payable filled on Fine Parties card
                const usePartyPayableFlow = groupParties.length >= 1;
                let resolvedVendorId =
                    String(managementZoho.zohoVendorId || fine?.zohoVendorId || '').trim();
                const resolvedVendorName = String(
                    managementZoho.zohoVendorName ||
                        fine?.zohoVendorName ||
                        fine?.fineSource ||
                        '',
                ).trim();

                // Accounts already set Vendor name (Fine Source) — resolve Zoho vendor id if missing
                if (isManagementStage && !resolvedVendorId && resolvedVendorName) {
                    try {
                        const orgId =
                            managementZoho.zohoOrganizationId ||
                            fine?.zohoOrganizationId ||
                            '';
                        const vendorRes = await axiosInstance.get('/zoho/vendors', {
                            params: {
                                ...(orgId ? { organizationId: orgId } : {}),
                                sync: 'true',
                                limit: 500,
                            },
                            skipToast: true,
                            timeout: 45000,
                        });
                        const vendors = mapZohoVendors(vendorRes?.data?.data);
                        const hint = resolvedVendorName.toLowerCase();
                        const match = vendors.find((v) => {
                            const name = String(v.label || v.name || '').trim().toLowerCase();
                            return name === hint || name.includes(hint) || hint.includes(name);
                        });
                        if (match?.id) resolvedVendorId = String(match.id).trim();
                    } catch (lookupErr) {
                        console.warn('Could not resolve Zoho vendor from Fine Source:', lookupErr);
                    }
                }

                if (isManagementStage && !resolvedVendorId && !resolvedVendorName) {
                    toast({
                        title: 'Zoho vendor required',
                        description:
                            'Set Vendor on the Fine Parties card (Accounts) before Management approval.',
                        variant: 'destructive',
                    });
                    return;
                }

                if (isManagementStage && !resolvedVendorId && resolvedVendorName) {
                    toast({
                        title: 'Zoho vendor not found',
                        description: `Vendor "${resolvedVendorName}" is set, but no matching Zoho Books vendor was found. Check the vendor name in Zoho.`,
                        variant: 'destructive',
                    });
                    return;
                }

                const allPartiesHavePayable =
                    usePartyPayableFlow &&
                    groupParties.every((p) => String(p.expenseAccountId || '').trim());
                const allPartiesCompleted = allPartiesHavePayable;

                if (
                    isManagementStage &&
                    !managementZoho.expenseAccountId &&
                    !allPartiesHavePayable &&
                    !String(fine?.expenseAccountId || '').trim()
                ) {
                    toast({
                        title: 'Expense account required',
                        description:
                            'Fill Payable on the Fine Parties card before Management approval.',
                        variant: 'destructive',
                    });
                    return;
                }

                if (isAccountsStage) {
                    if (usePartyPayableFlow) {
                        const incomplete = groupParties.filter(
                            (p) => !String(p.expenseAccountId || '').trim(),
                        );
                        if (incomplete.length > 0 || !allPartiesCompleted) {
                            toast({
                                title: 'Payable required',
                                description:
                                    `Fill Payable for every party. Incomplete: ${incomplete
                                        .map((p) => p.employeeName || p.fineId)
                                        .join(', ') || 'check party rows'}.`,
                                variant: 'destructive',
                            });
                            return;
                        }
                    } else if (
                        !String(fine?.expenseAccountId || '').trim() &&
                        !String(accountsApprovePayable.expenseAccountId || '').trim()
                    ) {
                        toast({
                            title: 'Payable required',
                            description:
                                'Select a Payable (Chart of Accounts) before Accounts can approve.',
                            variant: 'destructive',
                        });
                        return;
                    }
                }

                const approveBody = { finePdf };
                if (isManagementStage) {
                    Object.assign(approveBody, {
                        ...managementZoho,
                        zohoVendorId: resolvedVendorId,
                        zohoVendorName: resolvedVendorName,
                        zohoOrganizationId:
                            managementZoho.zohoOrganizationId || fine?.zohoOrganizationId || '',
                    });
                    if (usePartyPayableFlow && allPartiesHavePayable) {
                        approveBody.partyPayables = groupParties;
                    }
                }
                if (isAccountsStage) {
                    if (usePartyPayableFlow) {
                        approveBody.partyPayables = groupParties;
                    } else {
                        const accountId =
                            accountsApprovePayable.expenseAccountId || fine.expenseAccountId || '';
                        const accountName =
                            accountsApprovePayable.expenseAccountName || fine.expenseAccountName || '';
                        approveBody.partyPayables = [
                            {
                                fineRecordId: fine._id,
                                fineId: fine.fineId,
                                expenseAccountId: accountId,
                                expenseAccountName: accountName,
                            },
                        ];
                    }
                }
                res = await axiosInstance.put(`/Fine/${targetId}/approve`, approveBody);
                toast({
                    title: "Success",
                    description:
                        isManagementStage
                            ? (res.data.message ||
                                'Fine approved. One Zoho Bill created with all parties as Item Table lines.')
                            : isAccountsStage
                              ? (res.data.message ||
                                  'Sent to Management. Zoho Bill will be created after Management approves.')
                              : (res.data.message || 'Fine approved successfully.'),
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
            const isDedupe = err?.code === 'ACTION_DEDUPED' || /duplicate request blocked/i.test(String(err?.message || ''));
            if (!isDedupe && !err?.silent) {
                toast({
                    title: "Error",
                    description: err.response?.data?.message || err.message || "Failed to perform action.",
                    variant: "destructive"
                });
            }
        } finally {
            confirmActionInFlightRef.current = false;
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

        const isAccountsStage =
            fine?.fineStatus === 'Pending Accounts' || fine?.fineStatus === 'Pending Finance';
        const isManagementStage = fine?.fineStatus === 'Pending Authorization';

        if (isAccountsStage) {
            const groupParties = Array.isArray(partyPayables) && partyPayables.length > 0
                ? partyPayables
                : buildGroupMembersForFine(fine).map((p) => ({
                    fineRecordId: p.fineRecordId,
                    fineId: p.fineId,
                    employeeName: p.employeeName,
                    isCompany: p.isCompany,
                    expenseAccountId: p.expenseAccountId || '',
                    expenseAccountName: p.expenseAccountName || '',
                    payableConfirmed: Boolean(p.payableConfirmed),
                }));

            const usePartyPayableFlow = groupParties.length >= 1;
            if (usePartyPayableFlow) {
                const incomplete = groupParties.filter(
                    (p) => !String(p.expenseAccountId || '').trim(),
                );
                if (incomplete.length > 0) {
                    toast({
                        title: 'Payable required',
                        description:
                            `Fill Payable for every party. Incomplete: ${incomplete
                                .map((p) => p.employeeName || p.fineId)
                                .join(', ')}.`,
                        variant: 'destructive',
                    });
                    return;
                }
            } else if (
                !String(fine?.expenseAccountId || '').trim() &&
                !String(accountsApprovePayable.expenseAccountId || '').trim()
            ) {
                // Fallback when Fine Parties card has no rows
            }

            setAccountsApprovePayable({
                expenseAccountId: fine?.expenseAccountId || '',
                expenseAccountName: fine?.expenseAccountName || '',
            });

            openConfirmation({
                action: 'approve',
                title: 'Send to Management',
                description:
                    'Vendor and Payable are set on the Fine Parties card. This sends the fine to Management. No Zoho bill is created yet — Management approval will create one Zoho Bill.',
                confirmText: 'Approve & send',
                variant: 'default',
            });
            return;
        }

        if (isManagementStage) {
            openConfirmation({
                action: 'approve',
                title: 'Approve & create Zoho Bill',
                description:
                    'Confirm to create one Zoho Books Bill. Vendor = Fine Source. Each party becomes one row in the Bill Item Table (Account = Payable, Amount = fine amount).',
                confirmText: 'Approve & bill',
                variant: 'default',
            });
            return;
        }

        openConfirmation({
            action: 'approve',
            title: 'Approve Fine',
            description: 'Are you sure you want to approve this fine?',
            confirmText: 'Approve',
            variant: 'default',
        });
    };

    const handlePayVendorBill = () => {
        const prefill = buildFineVendorPaymentPrefill(fine, {
            returnTo:
                typeof window !== 'undefined'
                    ? `${window.location.pathname}${window.location.search}`
                    : '',
        });
        if (!prefill?.zohoBillIds?.length) {
            toast({
                variant: 'destructive',
                title: 'Bill not ready',
                description:
                    fine?.zohoSyncError ||
                    'No Zoho bill is linked to this fine yet. Check management approval sync.',
            });
            return;
        }
        try {
            sessionStorage.setItem('fineVendorPaymentPrefill', JSON.stringify(prefill));
        } catch (err) {
            console.error(err);
        }
        const params = new URLSearchParams();
        params.set('addFinePay', '1');
        if (prefill.organizationId) params.set('organizationId', prefill.organizationId);
        if (prefill.companyId) params.set('companyId', prefill.companyId);
        if (prefill.fineMongoId) params.set('fineMongoId', prefill.fineMongoId);
        router.push(`/Accounts/PaymentsMade/new?${params.toString()}`);
    };

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
        let empId = contextEmpId;
        if (!empId || empId === 'VEGA-HR-0000') {
            empId = f.assignedEmployees?.find(
                (ae) => ae.employeeId !== 'VEGA-HR-0000' && ae.employeeId !== 'VEGA_INTERNAL',
            )?.employeeId;
        }
        if (!empId) return 0;
        return resolveEmployeeFinePayableAmount(f, empId);
    };

    const getCompShare = (f) => {
        if (!f) return 0;
        const rf = (f.responsibleFor || 'Employee').trim();
        if (rf === 'Employee') return 0;
        return resolveCompanyFinePayableAmount(f);
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
                setAllEmployeeFines([]);
                setAllEmployeeLoans([]);
                setFineSummaries({ ...EMPTY_FINE_SUMMARIES });

                const fineRes = await axiosInstance.get(`/Fine/${id}`);
                const fineData = fineRes.data;
                setFine(fineData);
                if (APPROVED_FINE_STATUSES.includes(fineData.fineStatus)) {
                    setActiveTab('approvedAttachments');
                }

                const scheduleDates = deriveFineScheduleMonthYears(fineData);
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

                    if (!isCompanyFineView && empId && empId !== 'PENDING') {
                        try {
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

                            if (fineData.formSummary) {
                                const { signatures, employeeStats, ...employeeCommon } = fineData.formSummary;
                                setFineSummaries({
                                    ...EMPTY_FINE_SUMMARIES,
                                    ...employeeCommon,
                                    startMonthYear: scheduleDates.startMonthYear,
                                    endMonthYear: scheduleDates.endMonthYear,
                                });
                            } else if (allFines.length > 0 || fineData) {
                                // Ensure the current fine is in our processing list if it's not already there
                                const processedFines = [...allFines];
                                if (fineData && !processedFines.some(f => (f._id === fineData._id || f.fineId === fineData.fineId))) {
                                    processedFines.push(fineData);
                                }

                                // Filter: Only show Approved/Active/Paid fines. Exclude Pending/Draft/Rejected.
                                const activeFines = processedFines.filter((f) =>
                                    APPROVED_FINE_STATUSES.includes(f.fineStatus)
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

                                    setAllEmployeeLoans(allLoans);

                                    const approvedLoans = allLoans.filter(isApprovedLoanRecord);

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

                                setFineSummaries({
                                    startMonthYear: scheduleDates.startMonthYear,
                                    endMonthYear: scheduleDates.endMonthYear,
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
                    } else if (fineData.formSummary) {
                        const { signatures, employeeStats, ...employeeCommon } = fineData.formSummary;
                        setFineSummaries({
                            ...EMPTY_FINE_SUMMARIES,
                            ...employeeCommon,
                            startMonthYear: scheduleDates.startMonthYear,
                            endMonthYear: scheduleDates.endMonthYear,
                        });
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

    // Fetch Asset / Vehicle details for Loss & Damage and vehicle-linked fines
    useEffect(() => {
        const fetchAssetInfo = async () => {
            const targetAssetObjectId =
                fine?.assetObjectId ||
                fine?.mainAssetObjectId ||
                fine?.vehicleObjectId ||
                (fine?.vehicleId && /^[0-9a-fA-F]{24}$/.test(String(fine.vehicleId))
                    ? fine.vehicleId
                    : null);
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

        if (
            fine &&
            (fine.fineType === 'Loss & Damage' ||
                fine.fineType === 'Vehicle Fine' ||
                fine.fineType === 'Vehicle Damage' ||
                fine.assetId ||
                fine.assetObjectId ||
                fine.vehicleId)
        ) {
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
                const canvas = await html2canvas(element, buildHtml2CanvasOptions({
                    rootElementId: 'fine-form-container',
                }));
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
        }

        const creatorId = String(fine.createdBy?._id || fine.createdBy);
        return currentUserId === creatorId;
    }, [currentUser, fine]);

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

    const isApproved = canViewGroupFinePartiesIndividually(fine?.fineStatus);
    const isGroup = fine?.isGroupView || (fine?.assignedEmployees?.length > 1 && !fine?.fineId?.match(/-[A-Z]$/));
    // Group overview uses a shared placeholder until management approves; party tabs still work for review.
    const showGroupPlaceholder = isGroup && !isApproved && !viewingSpecificParty;

    const groupParties = useMemo(() => {
        if (!fine || !isGroup) return [];
        return buildGroupMembersForFine(fine);
    }, [fine, isGroup]);

    const isGroupOverviewActive = Boolean(isGroup && !viewingSpecificParty);

    const groupOverviewHref = useMemo(() => {
        if (!fine) return '';
        return buildGroupOverviewHref(fine);
    }, [fine]);

    const isGroupPartyTabActive = useCallback((member) => {
        if (!member || isGroupOverviewActive) return false;
        if (member.isCompany) {
            return partyParam === 'company' || isCompanyFineParty(activePartyEntry);
        }
        if (member.fineId && /-[A-Z0-9]+$/i.test(String(member.fineId)) && String(id) === String(member.fineId)) {
            return true;
        }
        if (partyParam === 'employee' && partyEmployeeId) {
            return String(partyEmployeeId) === String(member.employeeId);
        }
        return String(activePartyEntry?.employeeId || '') === String(member.employeeId || '');
    }, [activePartyEntry, id, isGroupOverviewActive, partyEmployeeId, partyParam]);

    const selectGroupOverview = useCallback((e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        if (!fine) return;
        const href = buildGroupOverviewHref(fine);
        if (!href) return;
        // Always navigate — clears ?party= / suffix ids so Group Fine tab actually switches
        router.push(href);
    }, [fine, router]);

    const selectGroupParty = useCallback((member) => {
        if (!fine || !member) return;
        const href = buildGroupMemberDetailHref(fine, member);
        if (!href) return;
        router.push(href);
    }, [fine, router]);

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

    // Permission Logic — only the assignee on the current workflow step may act (+ portal admin)
    const canPerformAction = () => {
        if (!currentUser || !fine) return false;

        const isPortalAdmin = isAdmin();
        const status = fine.fineStatus;

        if (status === 'Draft') {
            const creatorId = fine.createdBy?._id || fine.createdBy;
            const currentUserId = currentUser.id || currentUser._id;
            if (String(creatorId) === String(currentUserId)) return true;
            return isPortalAdmin;
        }

        return canUserActOnFineStage({
            user: currentUser,
            fine,
            isAdmin: isPortalAdmin,
        });
    };

    const canPayVendorFineBill = useMemo(() => {
        return canAccountsPayFineVendorBill(fine, currentUser);
    }, [fine, currentUser]);

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
        // Group fines: edit only from the Group Fine overview (not per employee/company).
        if (isGroup && !isGroupOverviewActive) return false;
        if (isApprovedFineStatus(fine.fineStatus)) {
            return approvedScheduleOnlyEdit || approvedAssetControllerOnlyEdit;
        }
        if (fine.fineStatus === 'Rejected' && canResubmit) return true;
        // Edit on in-progress fines: assignee (or portal admin), not every Add Fine user
        return canPerformAction() || isAdmin();
    }, [
        currentUser,
        fine,
        canResubmit,
        approvedScheduleOnlyEdit,
        approvedAssetControllerOnlyEdit,
        isGroup,
        isGroupOverviewActive,
    ]);

    const isCompanyFine =
        partyParam === 'company' ||
        isCompanyFineParty(activePartyEntry) ||
        (!viewingSpecificParty && (
            mainEmployee?.employeeId === 'VEGA-HR-0000' ||
            mainEmployee?.employeeName === 'Vega Digital IT Solutions' ||
            fine?.responsibleFor === 'Company'
        ));

    const employeeOwnerId = useMemo(() => {
        if (isCompanyFine || !activePartyEntry?.employeeId) return null;
        let empId = String(activePartyEntry.employeeId).trim();
        if (empId.includes(':')) empId = empId.split(':')[0].trim();
        if (!empId || empId === 'PENDING' || empId === 'VEGA-HR-0000') return null;
        return empId;
    }, [activePartyEntry, isCompanyFine]);

    const employeeFinancials = useMemo(() => {
        if (!employeeOwnerId || isCompanyFine) return null;
        return buildEmployeeFinancials({
            allEmployeeFines,
            employeeId: employeeOwnerId,
            loanSummary: {
                personalLoan: fineSummaries.personalLoan,
                salaryAdvance: fineSummaries.salaryAdvance,
            },
        });
    }, [
        allEmployeeFines,
        employeeOwnerId,
        isCompanyFine,
        fineSummaries.personalLoan,
        fineSummaries.salaryAdvance,
    ]);

    const displayFineSummaries = useMemo(() => {
        if (!employeeFinancials) return fineSummaries;
        return {
            ...fineSummaries,
            aggregates: employeeFinancials.aggregates,
            outstandingBalance: employeeFinancials.outstandingBalance,
            totalFineCount: employeeFinancials.totalFineCount,
            totalAmount: employeeFinancials.totalAmount,
            paidFineAmount: employeeFinancials.paidFineAmount,
        };
    }, [fineSummaries, employeeFinancials]);

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
            fineSummaries: displayFineSummaries,
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


    return (
        <>
            <div className="flex min-h-screen w-full bg-[#F2F6F9] print:bg-white">
                <div className="print:hidden"><Sidebar /></div>
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="print:hidden shrink-0"><Navbar /></div>
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
                                {confirmConfig.action === 'approve' &&
                                    (fine?.fineStatus === 'Pending Accounts' ||
                                        fine?.fineStatus === 'Pending Finance') && (
                                        <div className="mt-4 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-left">
                                            <p className="text-xs font-semibold text-indigo-900">
                                                Next step: Management
                                            </p>
                                            <ul className="text-[11px] text-indigo-900/90 space-y-1.5 list-disc pl-4">
                                                <li>
                                                    Accounts approval only sends this fine to{' '}
                                                    <strong>Management</strong>.
                                                </li>
                                                <li>
                                                    <strong>No Zoho Bill yet</strong> — the bill is
                                                    created after Management confirms.
                                                </li>
                                                <li>
                                                    <strong>Vendor</strong> = Fine Source (
                                                    {fine?.fineSource || 'not set'}).
                                                </li>
                                                <li>
                                                    Payable was set on the <strong>Fine Parties</strong>{' '}
                                                    card — one Zoho Bill Item Table will use those accounts.
                                                </li>
                                            </ul>
                                        </div>
                                    )}
                                {confirmConfig.action === 'approve' &&
                                    fine?.fineStatus === 'Pending Authorization' && (
                                        <div className="mt-4 space-y-3 text-left">
                                            <div className="rounded-lg border border-green-100 bg-green-50/60 p-3">
                                                <p className="text-xs font-semibold text-green-900 mb-1.5">
                                                    Zoho Bill
                                                </p>
                                                <ul className="text-[11px] text-green-900/90 space-y-1 list-disc pl-4">
                                                    <li>
                                                        Creates <strong>one</strong> Bill in Zoho Purchases
                                                        → Bills (not one bill per party).
                                                    </li>
                                                    <li>
                                                        <strong>Vendor</strong> = Fine Source (
                                                        {fine?.fineSource ||
                                                            fine?.zohoVendorName ||
                                                            'from Accounts'}
                                                        ).
                                                    </li>
                                                    <li>
                                                        <strong>Item Table</strong> = each party as a
                                                        line (Account = Payable from Fine Parties card,
                                                        Amount = fine share).
                                                    </li>
                                                    <li>
                                                        After success, Payable Status becomes{' '}
                                                        <strong>Billed</strong>.
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-gray-200 hover:bg-gray-50 text-gray-600 font-bold">
                                    {confirmConfig.cancelText || 'Cancel'}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (confirmActionInFlightRef.current || actionLoading) return;
                                        if ((confirmConfig.action === 'reject' || (confirmConfig.action === 'updateStatus' && confirmConfig.status === 'Rejected')) && (!rejectionReason || rejectionReason.trim().length === 0)) {
                                            toast({ title: "Reason Required", description: "Please enter a reason for rejection.", variant: "destructive" });
                                            return;
                                        }
                                        if (
                                            confirmConfig.action === 'approve' &&
                                            fine?.fineStatus === 'Pending Authorization' &&
                                            !managementZoho.zohoVendorId &&
                                            !fine?.zohoVendorId &&
                                            !String(fine?.fineSource || fine?.zohoVendorName || '').trim()
                                        ) {
                                            toast({
                                                title: 'Vendor missing',
                                                description:
                                                    'Set Vendor on the Fine Parties card (Accounts) before Management approval.',
                                                variant: 'destructive',
                                            });
                                            return;
                                        }
                                        if (
                                            confirmConfig.action === 'approve' &&
                                            (fine?.fineStatus === 'Pending Accounts' ||
                                                fine?.fineStatus === 'Pending Finance')
                                        ) {
                                            const parties =
                                                Array.isArray(partyPayables) && partyPayables.length > 0
                                                    ? partyPayables
                                                    : buildGroupMembersForFine(fine);
                                            const missingPayable =
                                                parties.length > 0
                                                    ? parties.some(
                                                          (p) => !String(p.expenseAccountId || '').trim(),
                                                      )
                                                    : !String(fine?.expenseAccountId || '').trim();
                                            if (missingPayable) {
                                                toast({
                                                    title: 'Payable required',
                                                    description:
                                                        'Fill Payable on the Fine Parties card before Accounts can approve.',
                                                    variant: 'destructive',
                                                });
                                                return;
                                            }
                                        }
                                        void handleConfirmAction();
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
                    <div className="flex-1 flex flex-col items-stretch justify-start py-4 sm:py-6 lg:py-8 print:py-0 relative overflow-y-auto w-full px-3 sm:px-5 lg:px-8">
                        {/* Back Button Header */}
                        <div className="w-full flex items-center justify-between mb-2 print:hidden">
                            <ListReturnBackButton onNavigate={handleListReturnBack} />
                        </div>

                        {/* Top Grid: Profile + Action Card — equal width columns (matches Loan/Advance detail) */}
                        <div className="flex flex-col xl:flex-row gap-3 sm:gap-4 lg:gap-6 w-full mb-4 sm:mb-6 lg:mb-8 print:hidden items-stretch">

                            {/* Left Column: Profile & Stats */}
                            <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                                {employeeForCard && (
                                    <div className="w-full h-full min-h-0">
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
                                                <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 cursor-pointer" onClick={toggleSummaryMode} title="Click to toggle between Count, Amount, and Remaining">
                                                    {/* Total - Blue */}
                                                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-blue-100">
                                                        <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">
                                                            {summaryViewMode === 'count' ? 'Total Count' : summaryViewMode === 'amount' ? 'Total Amount' : 'Balance'}
                                                        </span>
                                                        <span className="text-sm sm:text-lg font-bold text-blue-800 shrink-0 tabular-nums">
                                                            {summaryViewMode === 'count' 
                                                                ? (displayFineSummaries.totalFineCount || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (displayFineSummaries.totalAmount || 0).toLocaleString()
                                                                    : (displayFineSummaries.outstandingBalance || 0).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Vehicle - Green */}
                                                    <div className="bg-green-50 p-2 rounded-lg border border-green-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-green-100">
                                                        <span className="text-[10px] text-green-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Vehicle</span>
                                                        <span className="text-sm sm:text-lg font-bold text-green-800 shrink-0 tabular-nums">
                                                            {summaryViewMode === 'count' 
                                                                ? (displayFineSummaries.aggregates?.['Vehicle']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (displayFineSummaries.aggregates?.['Vehicle']?.amount || 0).toLocaleString()
                                                                    : ((displayFineSummaries.aggregates?.['Vehicle']?.amount || 0) - (displayFineSummaries.aggregates?.['Vehicle']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Safety - Purple */}
                                                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-purple-100">
                                                        <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Safety</span>
                                                        <span className="text-sm sm:text-lg font-bold text-purple-800 shrink-0 tabular-nums">
                                                            {summaryViewMode === 'count' 
                                                                ? (displayFineSummaries.aggregates?.['Safety']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (displayFineSummaries.aggregates?.['Safety']?.amount || 0).toLocaleString()
                                                                    : ((displayFineSummaries.aggregates?.['Safety']?.amount || 0) - (displayFineSummaries.aggregates?.['Safety']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Project Damage - Amber */}
                                                    <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-amber-100">
                                                        <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Project Damage</span>
                                                        <span className="text-sm sm:text-lg font-bold text-amber-800 shrink-0 tabular-nums">
                                                            {summaryViewMode === 'count' 
                                                                ? (displayFineSummaries.aggregates?.['Project']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (displayFineSummaries.aggregates?.['Project']?.amount || 0).toLocaleString()
                                                                    : ((displayFineSummaries.aggregates?.['Project']?.amount || 0) - (displayFineSummaries.aggregates?.['Project']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Loss and Damage - Red */}
                                                    <div className="bg-red-50 p-2 rounded-lg border border-red-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-red-100">
                                                        <span className="text-[10px] text-red-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Loss & Damage</span>
                                                        <span className="text-sm sm:text-lg font-bold text-red-800 shrink-0 tabular-nums">
                                                            {summaryViewMode === 'count' 
                                                                ? (displayFineSummaries.aggregates?.['Loss']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (displayFineSummaries.aggregates?.['Loss']?.amount || 0).toLocaleString()
                                                                    : ((displayFineSummaries.aggregates?.['Loss']?.amount || 0) - (displayFineSummaries.aggregates?.['Loss']?.paid || 0)).toLocaleString()
                                                            }
                                                        </span>
                                                    </div>

                                                    {/* Other Fines - Gray */}
                                                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 flex items-center justify-between gap-1 px-2 sm:px-3 min-w-0 transition-all hover:bg-gray-100">
                                                        <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide break-words leading-tight min-w-0">Other Fines</span>
                                                        <span className="text-sm sm:text-lg font-bold text-gray-800 shrink-0 tabular-nums">
                                                            {summaryViewMode === 'count' 
                                                                ? (displayFineSummaries.aggregates?.['Other']?.count || 0) 
                                                                : summaryViewMode === 'amount' 
                                                                    ? (displayFineSummaries.aggregates?.['Other']?.amount || 0).toLocaleString()
                                                                    : ((displayFineSummaries.aggregates?.['Other']?.amount || 0) - (displayFineSummaries.aggregates?.['Other']?.paid || 0)).toLocaleString()
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

                            {/* Right Column: Action Card — status & action boxes */}
                            <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                                <div
                                    id="fine-focus-pendingApproval"
                                    className="bg-white rounded-lg shadow-sm p-4 w-full h-full flex flex-col overflow-hidden"
                                >
                                    {(() => {
                                        const status = fine?.fineStatus;
                                        const isDraft = status === 'Draft';
                                        const isApprovedState = ['Approved', 'Active', 'Completed', 'Paid'].includes(status);
                                        const isFinalized = status === 'Approved' || status === 'Rejected' || isApprovedState;
                                        const totalFineAmount = Number(fine?.totalFineAmount || fine?.fineAmount || 0);
                                        const paidAmount = Number(fine?.paidAmount || 0);
                                        const remainingAmount = Math.max(0, totalFineAmount - paidAmount);
                                        const compactBox = 'p-2 rounded-lg border flex items-center justify-between px-4 min-h-[44px] transition-all break-words gap-2';

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
                                            if (canPayVendorFineBill) {
                                                cells.push(
                                                    <button
                                                        key="pay-vendor"
                                                        type="button"
                                                        onClick={handlePayVendorBill}
                                                        className={`${compactBox} border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100`}
                                                    >
                                                        <span className="text-[10px] font-medium uppercase tracking-wide truncate">
                                                            Pay vendor bill
                                                        </span>
                                                        <Wallet className="w-5 h-5 shrink-0" />
                                                    </button>,
                                                );
                                            }
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
                                            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 shrink-0">
                                                {cells.slice(0, 6)}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Main tabs — Group Fine / parties / Edit Fine (underline style) */}
                        {isGroup && groupParties.length > 0 && (
                            <div className="relative z-20 w-full flex flex-wrap items-center border-b border-gray-200 mb-1 print:hidden pointer-events-auto">
                                <Link
                                    href={groupOverviewHref || '#'}
                                    scroll={false}
                                    onClick={selectGroupOverview}
                                    className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all duration-200 cursor-pointer ${
                                        isGroupOverviewActive
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                    title="Group fine overview"
                                >
                                    Group Fine
                                </Link>
                                {groupParties.map((member, idx) => {
                                    const active = isGroupPartyTabActive(member);
                                    const href = buildGroupMemberDetailHref(fine, member) || '#';
                                    const label = member.isCompany
                                        ? (fine.companyName || member.employeeName || 'Company')
                                        : (member.employeeName || member.employeeId || `Party ${idx + 1}`);
                                    return (
                                        <Link
                                            key={`${member.isCompany ? 'company' : member.employeeId}-${idx}`}
                                            href={href}
                                            scroll={false}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                selectGroupParty(member);
                                            }}
                                            className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all duration-200 cursor-pointer ${
                                                active
                                                    ? 'border-blue-600 text-blue-600'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                            title={member.isCompany ? 'Company share' : member.employeeId || label}
                                        >
                                            {member.isCompany ? `Co. ${label}` : label}
                                        </Link>
                                    );
                                })}
                                {canShowEditFine && (
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(true)}
                                        className="py-3 px-5 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 flex items-center gap-1.5 ml-auto cursor-pointer"
                                    >
                                        <Edit className="w-4 h-4" />
                                        {approvedScheduleOnlyEdit ? 'Edit Schedule' : 'Edit Fine'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Sub-tabs — Fine Form / History (secondary chips under group main tabs) */}
                        <div
                            className={`w-full flex flex-wrap items-center mb-6 print:hidden ${
                                isGroup && groupParties.length > 0
                                    ? 'gap-2 pt-3'
                                    : 'border-b border-gray-200'
                            }`}
                        >
                            {isGroup && groupParties.length > 0 ? (
                                <>
                                    <button
                                        onClick={() => setActiveTab('fineForm')}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                            activeTab === 'fineForm'
                                                ? 'bg-slate-800 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                                        }`}
                                    >
                                        Fine Form
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('historyDetails')}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                            activeTab === 'historyDetails'
                                                ? 'bg-slate-800 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                                        }`}
                                    >
                                        Fine History & Details
                                    </button>
                                    {isApprovedFineStatus(fine.fineStatus) && (
                                        <button
                                            onClick={() => setActiveTab('approvedAttachments')}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                                activeTab === 'approvedAttachments'
                                                    ? 'bg-slate-800 text-white shadow-sm'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                                            }`}
                                        >
                                            Attachment
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>

                        {/* Fine Form — same card layout for pending and approved */}
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
                                    isGroupOverview={isGroupOverviewActive}
                                    employeeName={employeeName}
                                    displayName={displayName}
                                    department={department}
                                    hodName={displayHODName}
                                    designation={designation}
                                    mainEmployee={mainEmployee}
                                    fineSummaries={displayFineSummaries}
                                    employeeOwnerId={employeeOwnerId}
                                    getEmpShare={(f) => getEmpShare(f, employeeOwnerId)}
                                    getCompShare={getCompShare}
                                    formatDate={formatDate}
                                    assetDetails={assetDetails}
                                    allEmployeeFines={allEmployeeFines}
                                    allEmployeeLoans={allEmployeeLoans}
                                    canEditPartyPayables={
                                        (fine?.fineStatus === 'Pending Accounts' ||
                                            fine?.fineStatus === 'Pending Finance') &&
                                        canPerformAction()
                                    }
                                    onPartyPayablesChange={setPartyPayables}
                                    onPaymentSuccess={async () => {
                                        try {
                                            const fineRes = await axiosInstance.get(`/Fine/${id}`);
                                            setFine(fineRes.data);
                                        } catch (e) {
                                            console.error('Failed to refresh fine after payment', e);
                                        }
                                    }}
                                />
                        </div>

                        {isApprovedFineStatus(fine.fineStatus) && (
                            <div className={activeTab === 'approvedAttachments' ? 'w-full block' : 'w-full hidden'}>
                                <FineApprovedAttachmentsTab
                                    fine={fine}
                                    fineRouteId={id}
                                    employeeId={activePartyEntry?.employeeId}
                                />
                            </div>
                        )}

                        {/* Fine History & Details Tab Content */}
                        {activeTab === 'historyDetails' && (
                            <div className={`${DETAIL_PAIR_GRID} print:hidden`}>
                                {/* Left Column: Details Cards */}
                                <div className={`${DETAIL_PAIR_COLUMN} gap-6`}>
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
                                            {isGroup && viewingSpecificParty && (
                                                <>
                                                    <div>
                                                        <span className="text-xs text-gray-400 block font-medium">Selected Party</span>
                                                        <span className="font-semibold text-gray-800">
                                                            {isCompanyFine
                                                                ? (fine.companyName || activePartyEntry?.employeeName || 'Company')
                                                                : (activePartyEntry?.employeeName || employeeOwnerId || '-')}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 block font-medium">Party Amount</span>
                                                        <span className="font-semibold text-red-600">
                                                            {Number(
                                                                isCompanyFine
                                                                    ? getCompShare(fine)
                                                                    : getEmpShare(fine, employeeOwnerId),
                                                            ).toLocaleString()} AED
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Category / Reason</span>
                                                <span className="font-semibold text-gray-800">{fine.category || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Awarded Date</span>
                                                <span className="font-semibold text-gray-800">{formatDate(fine.awardedDate || fine.createdAt)}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400 block font-medium">Fine Source</span>
                                                <span className="font-semibold text-gray-800">{fine.fineSource || '-'}</span>
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
                                                    {displayFineSummaries.startMonthYear || '-'} to {displayFineSummaries.endMonthYear || '-'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <span className="text-xs text-gray-400 block font-medium mb-1">Description / Remarks</span>
                                            <p className="text-sm text-gray-600 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                {fine.description || 'No description provided.'}
                                            </p>
                                        </div>

                                        {(() => {
                                            const damageImages = Array.isArray(fine.attachments) && fine.attachments.length > 0
                                                ? fine.attachments
                                                : fine.attachment?.url
                                                  ? [fine.attachment]
                                                  : [];
                                            if (!damageImages.length) return null;
                                            return (
                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                    <span className="text-xs text-gray-400 block font-medium mb-2">
                                                        {fine.fineType === 'Vehicle Damage' ? 'Damage Images' : 'Attachments'}
                                                    </span>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        {damageImages.map((item, index) => (
                                                            <a
                                                                key={`${item.publicId || item.url || item.name || index}`}
                                                                href={item.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="block rounded-xl border border-gray-200 overflow-hidden bg-gray-50 hover:opacity-90 transition-opacity"
                                                            >
                                                                {item.url && String(item.mimeType || '').startsWith('image/') ? (
                                                                    <img
                                                                        src={item.url}
                                                                        alt={item.name || `Attachment ${index + 1}`}
                                                                        className="h-28 w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="h-28 flex items-center justify-center px-3 text-xs text-gray-600 text-center">
                                                                        {item.name || `Attachment ${index + 1}`}
                                                                    </div>
                                                                )}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
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
                                <FineWorkflowHistoryPanel fine={fine} />
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
                                fineCategory="Violation"
                                fineTypeName="Vehicle Fine"
                            />
                        )}
                        {fine.fineType === 'Vehicle Damage' && (
                            <AddVehicleFineModal
                                isOpen={showEditModal || isResubmittingModal}
                                onClose={() => { setShowEditModal(false); setIsResubmittingModal(false); }}
                                onSuccess={refreshData}
                                employees={allEmployees}
                                initialData={fine}
                                isResubmitting={isResubmittingModal}
                                scheduleOnlyEdit={approvedScheduleOnlyEdit}
                                fineCategory="Damage"
                                fineTypeName="Vehicle Damage"
                                allowMultipleImages
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
                        {(fine.fineType === 'Other Fines' || fine.subCategory === 'Other Fines' || fine.fineType === 'Other Damage' || fine.subCategory === 'Other Damage') && (
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
                        {!['Vehicle Fine', 'Vehicle Damage', 'Safety Fine', 'Project Damage', 'Loss & Damage', 'Other Fines', 'Other Damage'].includes(fine.fineType) && fine.subCategory !== 'Other Fines' && fine.subCategory !== 'Other Damage' && (
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

export default function FineDetailsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <FineDetailsPageContent />
        </Suspense>
    );
}
