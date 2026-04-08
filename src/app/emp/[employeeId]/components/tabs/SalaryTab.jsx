'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import Select from 'react-select';
// Import cards directly to test if DynamicCards re-exports are causing issues
import SalaryDetailsCard from '../cards/SalaryDetailsCard';
import BankAccountCard from '../cards/BankAccountCard';

import {
    Download, Award, X, Undo2, ArrowRightLeft, User, Clock, CheckCircle2, UserPlus,
    Monitor, MoreHorizontal, History, XCircle, ChevronDown, ChevronRight, FileText, ClipboardList, PenTool, Lock,
    PackageX
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import AddLossDamageModal from '@/app/HRM/Fine/components/AddLossDamageModal';
import AssignAssetModal from '@/app/HRM/Asset/components/AssignAssetModal';
import AssetCheckboxAssignModal from '../modals/AssetCheckboxAssignModal';
import HandoverFormModal from '@/app/HRM/Asset/components/HandoverFormModal';
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
import PaymentReceipt from '@/app/Accounts/Payments/components/PaymentReceipt';

export default function SalaryTab({
    searchParams,
    employee,
    isAdmin,
    hasPermission,
    hasSalaryDetails,
    hasBankDetailsSection,
    formatDate,
    selectedSalaryAction,
    setSelectedSalaryAction,
    salaryHistoryPage,
    setSalaryHistoryPage,
    salaryHistoryItemsPerPage,
    setSalaryHistoryItemsPerPage,
    calculateTotalSalary,
    onOpenSalaryModal,
    onOpenBankModal,
    onViewDocument,
    onEditSalary,
    onDeleteSalary,
    editingSalaryIndex,
    setEditingSalaryIndex,
    setSalaryForm,
    setSalaryFormErrors,
    setShowSalaryModal,
    employeeId,
    fetchEmployee,
    fines = [],
    rewards = [],
    loans = [],
    assets = [],
    employeeOptions = [],
    onIncrementSalary,
    currentUser
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();
    const [showCertificate, setShowCertificate] = useState(false);
    const [selectedCertificate, setSelectedCertificate] = useState(null);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedReturnAsset, setSelectedReturnAsset] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [assignmentData, setAssignmentData] = useState({
        reassignTo: '',
        assignmentType: 'Permanent',
        assignedDays: ''
    });
    const [isReturning, setIsReturning] = useState(false);
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [selectedDamageAsset, setSelectedDamageAsset] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAssignAsset, setSelectedAssignAsset] = useState(null);

    // New states for Asset Management
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedHistoryAsset, setSelectedHistoryAsset] = useState(null);
    const [assetHistory, setAssetHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [respondingToAsset, setRespondingToAsset] = useState(null);
    const [responseComments, setResponseComments] = useState('');
    const [unassignedAssets, setUnassignedAssets] = useState([]);
    const [onLeaveAssets, setOnLeaveAssets] = useState([]);
    const [isAssetController, setIsAssetController] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [selectedHandoverAsset, setSelectedHandoverAsset] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, asset: null, action: null });
    const [assetSubTab, setAssetSubTab] = useState('Your Assets');
    const [selectedCompanyTab, setSelectedCompanyTab] = useState(null); // For company sub-tabs
    const [companies, setCompanies] = useState([]);
    const [isHR, setIsHR] = useState(false);
    // Viewer permissions (for action buttons only). Tabs visibility is based on the *viewed* profile role.
    const [viewerIsAssetController, setViewerIsAssetController] = useState(false);
    const [viewerIsHR, setViewerIsHR] = useState(false);
    const [companyAssets, setCompanyAssets] = useState([]);
    const [loadingCompanyAssets, setLoadingCompanyAssets] = useState(false);
    /** Ignore stale responses when switching between employee profiles */
    const hrCompanyAssetsFetchIdRef = useRef(0);
    const [processingOnLeaveAction, setProcessingOnLeaveAction] = useState(null);
    const [onLeaveActionDialog, setOnLeaveActionDialog] = useState({ isOpen: false, asset: null, action: null });
    const [selectedParkingEmployee, setSelectedParkingEmployee] = useState(null);
    const [selectedOnLeaveAssets, setSelectedOnLeaveAssets] = useState([]);
    /** Your Assets tab — same pattern as Parking; bulk return/transfer use selected IDs in BulkHolderActionModal. */
    const [selectedYourAssets, setSelectedYourAssets] = useState([]);
    const [extensionDays, setExtensionDays] = useState(1);
    /** Parking tab: bulk transfer uses same Leave + duration API as TransferAssetModal (1–30 days). */
    const [bulkParkingTransferDuration, setBulkParkingTransferDuration] = useState('7');
    /** Your Assets: parking-style dialogs + direct API (no picker modal). */
    const [yourAssetsBulkDialog, setYourAssetsBulkDialog] = useState({ isOpen: false, kind: null });
    const [yourAssetsBulkLeaveDuration, setYourAssetsBulkLeaveDuration] = useState('7');
    const [processingYourAssetsBulk, setProcessingYourAssetsBulk] = useState(false);
    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
    const [selectedUnassignedAssets, setSelectedUnassignedAssets] = useState([]);

    const assetControllerTrulyUnassigned = useMemo(() => {
        return (unassignedAssets || []).filter((asset) => {
            const status = asset.status?.toString().trim();
            return (
                status === 'Unassigned' ||
                status === 'Returned' ||
                status === 'Draft' ||
                !status ||
                status === ''
            );
        });
    }, [unassignedAssets]);

    const assetControllerHasBulkAssignable = useMemo(
        () =>
            assetControllerTrulyUnassigned.some((a) => String(a?.status ?? '').trim() === 'Unassigned'),
        [assetControllerTrulyUnassigned]
    );

    const isYourAssetBulkSelectable = useCallback(
        (a) => a && String(a.status || '').trim() === 'Assigned' && !a.pendingAction,
        []
    );

    const yourAssetsBulkEligibleRows = useMemo(() => {
        const initial = assets?.length ? assets : employee?.assets || [];
        return initial.filter((row) => {
            if (!row) return false;
            const st = String(row.status || '').trim();
            if (st === 'Unassigned' || st === 'Draft') return false;
            return isYourAssetBulkSelectable(row);
        });
    }, [assets, employee?.assets, isYourAssetBulkSelectable]);

    useEffect(() => {
        if (assetSubTab !== 'Your Assets') setSelectedYourAssets([]);
    }, [assetSubTab]);

    useEffect(() => {
        if (assetSubTab !== 'Unassigned Assets') {
            setSelectedUnassignedAssets([]);
        }
    }, [assetSubTab]);

    useEffect(() => {
        const validIds = new Set((assetControllerTrulyUnassigned || []).map((a) => String(a?._id || a?.id)).filter(Boolean));
        setSelectedUnassignedAssets((prev) => prev.filter((id) => validIds.has(String(id))));
    }, [assetControllerTrulyUnassigned]);

    const refetchAssetControllerUnassigned = useCallback(async () => {
        if (!employee?.employeeId) return;
        try {
            const res = await axiosInstance
                .get(`/AssetItem/unassigned/controller/${employee.employeeId}`, { skipToast: true })
                .catch(() => null);
            if (res?.status === 200) {
                setUnassignedAssets(res.data.items || []);
            }
            if (fetchEmployee) fetchEmployee();
        } catch {
            /* ignore */
        }
    }, [employee?.employeeId, fetchEmployee]);

    const filteredOnLeaveAssets = useMemo(() => {
        return selectedParkingEmployee
            ? onLeaveAssets.filter(asset => {
                if (!asset.assignedTo) return false;
                const empId = asset.assignedTo._id || asset.assignedTo.id || asset.assignedTo.employeeId || asset.assignedTo;
                return empId.toString() === selectedParkingEmployee.toString();
            })
            : onLeaveAssets;
    }, [onLeaveAssets, selectedParkingEmployee]);

    const fetchHRCompanyAssetsForProfile = async (profileOwnerId) => {
        if (!profileOwnerId) return;
        const fetchId = ++hrCompanyAssetsFetchIdRef.current;
        setLoadingCompanyAssets(true);
        try {
            const res = await axiosInstance.get(`/AssetItem/company-assets/hr/${encodeURIComponent(profileOwnerId)}`);
            if (fetchId !== hrCompanyAssetsFetchIdRef.current) return;
            if (res.status === 200 && res.data?.isHR) {
                setIsHR(true);
                const items = res.data.items || [];
                setCompanyAssets(items);

                if (res.data.designatedCompanies && res.data.designatedCompanies.length > 0) {
                    setCompanies(res.data.designatedCompanies);
                } else {
                    const companyMap = new Map();
                    items.forEach(asset => {
                        if (asset.assignedCompany) {
                            const company = asset.assignedCompany;
                            const companyId = company._id || company.id || company;
                            if (companyId && !companyMap.has(companyId)) {
                                companyMap.set(companyId, {
                                    _id: companyId,
                                    id: companyId,
                                    name: company.name || 'Unknown Company',
                                    nickName: company.nickName || company.shortName || null
                                });
                            }
                        }
                    });
                    setCompanies(Array.from(companyMap.values()));
                }
            } else {
                setIsHR(false);
                setCompanyAssets([]);
                setCompanies([]);
            }
        } catch {
            if (fetchId === hrCompanyAssetsFetchIdRef.current) {
                setIsHR(false);
                setCompanyAssets([]);
                setCompanies([]);
            }
        } finally {
            if (fetchId === hrCompanyAssetsFetchIdRef.current) {
                setLoadingCompanyAssets(false);
            }
        }
    };

    const [expandedFineId, setExpandedFineId] = useState(null);
    const [finePayments, setFinePayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [allEmployeePayments, setAllEmployeePayments] = useState([]);


    const certificateRef = useRef(null);

    const executeRespondToAsset = async () => {
        const { asset, action } = confirmDialog;
        if (!asset || !action) return;

        try {
            setRespondingToAsset(asset._id);
            await axiosInstance.put(`/AssetItem/${asset._id}/respond`, {
                action: action,
                comments: ''
            });
            toast({
                title: "Success",
                description: `Asset assignment ${action === 'Accept' ? 'accepted' : 'rejected'} successfully.`
            });
            if (fetchEmployee) fetchEmployee();
        } catch (error) {
            console.error('Error responding to asset:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to respond to assignment"
            });
        } finally {
            setRespondingToAsset(null);
            setConfirmDialog({ isOpen: false, asset: null, action: null });
        }
    };

    // Check for Handover User (e.g. Manager who received notice request)
    const handoverTarget = employee?.noticeRequest?.submittedTo;
    const handoverUserId = typeof handoverTarget === 'object' ? handoverTarget?._id : handoverTarget;

    // Helpers for Asset Management permissions
    const loggedInEmployeeId = currentUser?.employeeObjectId; // EmployeeBasic ObjectId - used for actionRequiredBy comparison
    const isLoggedInAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT';
    const isProfileOwner = loggedInEmployeeId === employee?._id;
    const isManager = employee?.primaryReportee === loggedInEmployeeId || employee?.primaryReportee?._id === loggedInEmployeeId;
    const assigneeHasNoAccess = !employee?.companyEmail || !employee?.enablePortalAccess;
    // Only show Unassigned/Parking tabs on the logged-in Asset Controller's OWN profile page.
    // Show Unassigned/Parking tabs when the *viewed* profile is an Asset Controller.
    // This is independent of who is logged in (visibility is based on the profile being opened).
    const canManageParkingTab = !!isAssetController;

    /** Same bulk actions as HRM → Asset; profile context fixes the holder (no employee dropdown). Requires asset module access; self-service on own profile without hrm_asset isEdit. */
    const canBulkAssetFromProfile =
        !!employee?._id &&
        hasPermission('hrm_asset', 'isView') &&
        (
            isAdmin() ||
            hasPermission('hrm_asset', 'isEdit') ||
            (loggedInEmployeeId &&
                employee?._id &&
                String(loggedInEmployeeId) === String(employee._id))
        );

    const calculateEmployeeFineShare = (fine) => {
        if (!fine) return 0;
        const targetEmpId = employeeId; // Profile employee ID
        
        const sCharge = parseFloat(fine.serviceCharge || 0);

        // 1. Specific Employee ID Priority
        if (targetEmpId && fine.assignedEmployees?.length > 0) {
            const record = fine.assignedEmployees.find(e => 
                e.employeeId === targetEmpId || 
                (e.empObjectId && (e.empObjectId._id === targetEmpId || e.empObjectId === targetEmpId)) ||
                e._id === targetEmpId
            );
            if (record && record.individualAmount > 0) {
                const count = (fine.assignedEmployees?.length) || 1;
                return parseFloat(record.individualAmount) + (sCharge / count);
            }
        }

        const isCo = (fine.responsibleFor || '').toLowerCase() === 'company';
        if (isCo) return 0;
        const realEmps = (fine.assignedEmployees || []).filter(e => !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(e.employeeId));

        const coAmt = parseFloat(fine.companyAmount || 0);
        const fAmt = parseFloat(fine.fineAmount || 0);
        const eAmt = parseFloat(fine.employeeAmount || 0);
        
        if (realEmps.length === 1 && coAmt === 0) return fAmt + sCharge;
        if (eAmt > 0 && eAmt <= fAmt && realEmps.length > 1) return (eAmt + sCharge) / realEmps.length;
        if (realEmps.length === 1 && eAmt > 0 && eAmt <= fAmt) return eAmt + sCharge;
        return (fAmt + sCharge - coAmt) / (realEmps.length || 1);
    };

    const toggleFineExpansion = async (fineId, referenceId) => {
        if (expandedFineId === fineId) {
            setExpandedFineId(null);
            setFinePayments([]);
            return;
        }

        setExpandedFineId(fineId);
        setLoadingPayments(true);
        try {
            const res = await axiosInstance.get('/Payment', {
                params: {
                    relatedEntityType: 'Fine',
                    referenceId: referenceId,
                    // We want to show all payments for this fine, but the user asked for "only that users fine show dropdownly"
                    // So we filter by paidBy (employee profile)
                    paidBy: employeeId 
                }
            });
            // Payment records are typically marked as Completed (and may later appear as Paid/Approved in some flows).
            // Keep all successful statuses so the fine row dropdown always shows payment history.
            const successfulStatuses = ['Approved', 'Completed', 'Paid'];
            const fetched = res.data.payments || res.data || [];
            setFinePayments(
                fetched.filter((p) => successfulStatuses.includes(String(p?.status || '').trim()))
            );
        } catch (error) {
            console.error('Error fetching fine payments:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to fetch payment history'
            });
        } finally {
            setLoadingPayments(false);
        }
    };

    const normalizePaymentAttachmentForViewer = (attachment, fallbackName = 'Payment Attachment') => {
        if (!attachment) return null;

        if (typeof attachment === 'string' && attachment.trim()) {
            return {
                data: attachment,
                name: fallbackName,
                mimeType: 'application/pdf'
            };
        }

        const data = attachment.data || attachment.url || attachment.publicId || '';
        if (!data) return null;

        return {
            data,
            name: attachment.name || fallbackName,
            mimeType: attachment.mimeType || attachment.type || 'application/pdf'
        };
    };

    useEffect(() => {
        if (showReturnModal) {
            fetchEmployees();
            // Auto-select Handover User if exists
            if (handoverUserId) {
                setAssignmentData(prev => ({ ...prev, reassignTo: handoverUserId }));
            }
        }
    }, [showReturnModal, handoverUserId]);

    // Track if we've already handled the deep link to avoid re-opening
    const [deepLinkHandled, setDeepLinkHandled] = useState(false);

    useEffect(() => {
        if (!deepLinkHandled && searchParams && employee?.assets?.length > 0) {
            const assetIdParam = searchParams.get('assetId');
            if (assetIdParam) {
                // Find the asset in the employee's asset list to act on it
                // The dashboard 'requestId' matches the AssetItem._id
                const targetAsset = employee.assets.find(a =>
                    (a._id || a.id)?.toString() === assetIdParam
                );

                if (targetAsset && targetAsset.status === 'Pending') {
                    // Check if the current user can act on this asset
                    const canAct = (isProfileOwner || (isManager && (assigneeHasNoAccess || targetAsset.actionRequiredBy === loggedInEmployeeId)));

                    if (canAct) {
                        setRespondingToAsset(targetAsset._id || targetAsset.id);
                        setResponseComments('');
                        setDeepLinkHandled(true);
                    }
                }
            }

        }
    }, [searchParams, employee?.assets, deepLinkHandled, isProfileOwner, isManager, assigneeHasNoAccess, loggedInEmployeeId]);

    const [respStatus, setRespStatus] = useState('Active');

    useEffect(() => {
                    if (employee && employee.employeeId) {
            hrCompanyAssetsFetchIdRef.current += 1;
            setIsHR(false);
            setCompanyAssets([]);
            setSelectedCompanyTab(null);
            setAssetSubTab('Your Assets');
            // Check Asset Controller - silently check if user is asset controller
            // This is just a permission check, so 403 is expected for non-controllers
            // Wrap in try-catch and completely suppress errors
            (async () => {
                try {
                    const res = await axiosInstance.get(`/AssetItem/unassigned/controller/${employee.employeeId}`, {
                        skipToast: true // Flag to skip toast and console errors in axios interceptor
                    }).catch(() => null); // Catch and ignore all errors
                    
                    if (res && res.status === 200) {
                        setIsAssetController(true);
                        setUnassignedAssets(res.data.items || []);
                        setRespStatus(res.data.controllerStatus || 'Active');
                        
                        // Also fetch On Leave assets for Asset Controllers
                        try {
                            const onLeaveRes = await axiosInstance.get(`/AssetItem/on-leave/controller/${employee.employeeId}`, {
                                skipToast: true
                            }).catch(() => null);
                            
                            if (onLeaveRes && onLeaveRes.status === 200) {
                                setOnLeaveAssets(onLeaveRes.data.items || []);
                            } else {
                                setOnLeaveAssets([]);
                            }
                        } catch {
                            setOnLeaveAssets([]);
                        }
                    } else {
                        // 403 or other error - user is not an asset controller (expected)
                        setIsAssetController(false);
                        setUnassignedAssets([]);
                        setOnLeaveAssets([]);
                        setRespStatus('Active');
                    }
                } catch {
                    // Silently ignore - this is expected for non-controllers
                    setIsAssetController(false);
                    setUnassignedAssets([]);
                    setOnLeaveAssets([]);
                    setRespStatus('Active');
                }
            })();

            // Fetch companies list for dynamic tabs
            axiosInstance.get('/Company')
                .then(res => {
                    const companiesList = res.data.companies || [];
                    setCompanies(companiesList);
                })
                .catch(err => {
                    console.error('Error fetching companies:', err);
                });

            // Check HR and fetch company assets ONLY for the profile being viewed.
            fetchHRCompanyAssetsForProfile(employee.employeeId);
            // Fetch all payments for this employee to show statuses in tables
            axiosInstance.get('/Payment', { params: { paidBy: employeeId } })
                .then(res => {
                    const pays = res.data.payments || (Array.isArray(res.data) ? res.data : []);
                    setAllEmployeePayments(pays);
                })
                .catch(err => console.error('Error fetching employee payments:', err));
        }
    }, [employee, currentUser]);

    // When HR approves/rejects a company asset in the asset details page,
    // returning back to this HR profile page may keep component state stale.
    // Refetch when the browser tab becomes visible again.
    useEffect(() => {
        if (!isHR) return;
        if (selectedSalaryAction !== 'Assets' || assetSubTab !== 'Company Assets') return;
        if (!employee?.employeeId) return;

        // Refetch on client-side navigation changes (e.g., returning from Asset details).
        fetchHRCompanyAssetsForProfile(employee.employeeId);

        // Also refetch when tab becomes visible again.
        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            fetchHRCompanyAssetsForProfile(employee.employeeId);
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, isHR, selectedSalaryAction, assetSubTab, employee?.employeeId]);

    // Removal of auto-selection to allow "All" options to persist

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/Employee', { params: { limit: 1000 } });
            const empList = response.data.employees || response.data || [];
            setEmployees(Array.isArray(empList) ? empList : []);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load employees" });
        }
    };


    const handleReportDamage = (asset) => {
        setSelectedDamageAsset(asset);
        setShowDamageModal(true);
    };

    const handleReturnAsset = (asset) => {
        if (!asset) return;
        setSelectedReturnAsset(asset);
        setAssignmentData({
            reassignTo: '',
            assignmentType: 'Permanent',
            assignedDays: ''
        });
        setShowReturnModal(true);
    };

    const submitReturnAsset = async () => {
        if (!selectedReturnAsset) return;

        const returnMongoId = selectedReturnAsset._id || selectedReturnAsset.id;
        if (!returnMongoId) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Invalid asset reference. Open the asset from the list and try again.'
            });
            return;
        }

        setIsReturning(true);
        try {
            const payload = {};
            if (assignmentData.reassignTo) {
                payload.reassignTo = assignmentData.reassignTo;
                payload.assignmentType = assignmentData.assignmentType;
                if (assignmentData.assignmentType === 'Temporary') {
                    payload.assignedDays = assignmentData.assignedDays;
                }
            }

            await axiosInstance.put(`/AssetItem/${returnMongoId}/return`, payload);
            toast({
                title: "Success",
                description: "Asset returned/reassigned successfully."
            });
            if (fetchEmployee) fetchEmployee();
            setShowReturnModal(false);
            setSelectedReturnAsset(null);
        } catch (error) {
            console.error("Error returning asset:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to return asset."
            });
        } finally {
            setIsReturning(false);
        }
    };

    // Helper function for consistent Title Case
    const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const handleDownloadCertificate = async () => {
        if (!certificateRef.current) return;

        try {
            // Collect all stylesheets for html2canvas to ensure fonts/styles are captured
            const styleSheets = Array.from(document.styleSheets);
            let safeCss = '';

            styleSheets.forEach(sheet => {
                try {
                    const rules = sheet.cssRules || [];
                    for (let rule of rules) {
                        let cssText = rule.cssText;
                        // Replace unsupported lab() or oklch() colors
                        cssText = cssText.replace(/lab\([^)]+\)/gi, '#000');
                        cssText = cssText.replace(/oklch\([^)]+\)/gi, '#000000ff');
                        safeCss += cssText + '\n';
                    }
                } catch (e) {
                    // Ignore cross-origin stylesheets
                }
            });

            const canvas = await html2canvas(certificateRef.current, {
                scale: 2, // Higher quality
                logging: false,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollY: -window.scrollY, // Fix for scrolling issues
                onclone: (clonedDoc) => {
                    // Inject sanitized CSS
                    const styleTag = clonedDoc.createElement('style');
                    styleTag.innerHTML = safeCss;
                    clonedDoc.head.appendChild(styleTag);
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape, A4
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${selectedCertificate?.title || 'Certificate'}.pdf`);

            toast({
                title: "Success",
                description: "Certificate downloaded successfully"
            });
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to download certificate"
            });
        }
    };

    // Helper to get Signer 1 Name with fallback to Primary Reportee
    const getSigner1Name = () => {
        if (selectedCertificate?.certSigner1Name && selectedCertificate.certSigner1Name !== 'Nivil Ali') {
            return selectedCertificate.certSigner1Name;
        }
        if (employee?.primaryReportee) {
            const rep = employee.primaryReportee;
            // Handle if populated object
            if (typeof rep === 'object' && rep.firstName) {
                return toTitleCase(`${rep.firstName} ${rep.lastName || ''}`);
            }
        }
        return 'Nivil Ali';
    };

    const getSigner1Title = () => {
        if (selectedCertificate?.certSigner1Title && selectedCertificate.certSigner1Title !== 'Managing Director') {
            return selectedCertificate.certSigner1Title;
        }
        if (employee?.primaryReportee) {
            const rep = employee.primaryReportee;
            if (typeof rep === 'object' && rep.designation) {
                return rep.designation;
            }
        }
        return 'Managing Director';
    };

    // Prepare salary history data
    let salaryHistoryData = employee?.salaryHistory || [];

    // Deduplicate salary history based on fromDate (keep the first occurrence)
    // This handles potential data inconsistencies where duplicate entries might exist
    if (Array.isArray(salaryHistoryData) && salaryHistoryData.length > 0) {
        const seenMonths = new Set();
        salaryHistoryData = salaryHistoryData.filter(entry => {
            let dateObj = null;

            // Try to get date from fromDate first
            if (entry.fromDate) {
                dateObj = new Date(entry.fromDate);
            }
            // Fallback to month string parsing if needed
            else if (entry.month) {
                try {
                    dateObj = new Date(entry.month);
                } catch (e) { dateObj = null; }
            }

            // Keep entries where date can't be determined or is invalid
            if (!dateObj || isNaN(dateObj.getTime())) return true;

            // Create key based on Year-Month (e.g. "2026-2" for March 2026)
            const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;

            if (seenMonths.has(key)) {
                return false; // Duplicate month found
            }

            seenMonths.add(key);
            return true;
        });
    }

    // Logic for injecting initial salary if missing has been removed to prevent duplicates.
    // The backend now guarantees creation of initial salary history.


    // Display salary history in insertion order (latest first, no sorting)

    // Helper to generate month sequence for fine duration boxes
    const getMonthSequence = (startMonth, duration, fineDate) => {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        let startIndex = -1;

        // 1. Determine Start Index
        if (startMonth) {
            // Check if YYYY-MM format (e.g., "2026-07")
            if (startMonth.match(/^\d{4}-\d{2}$/)) {
                startIndex = parseInt(startMonth.split('-')[1], 10) - 1; // 0-indexed
            } else {
                // Assume Month Name (e.g., "March")
                startIndex = months.findIndex(m => m.toLowerCase() === startMonth.toLowerCase());
            }
        }

        // 2. LOGIC: If explicit start set -> Use Duration. Else -> Next Month (1 box).
        if (startIndex !== -1) {
            // Valid explicit schedule found
            const count = duration && duration > 0 ? duration : 1;
            const sequence = [];
            for (let i = 0; i < count; i++) {
                const monthIndex = (startIndex + i) % 12;
                sequence.push(months[monthIndex]);
            }
            return sequence;
        }

        // Default Fallback: Next Month relative to fine date
        const date = fineDate ? new Date(fineDate) : new Date();
        const calculatedStartIndex = (date.getMonth() + 1) % 12;

        const count = duration && duration > 0 ? duration : 1;
        const sequence = [];
        for (let i = 0; i < count; i++) {
            const monthIndex = (calculatedStartIndex + i) % 12;
            sequence.push(months[monthIndex]);
        }
        return sequence;
    };

    const sortedHistory = selectedSalaryAction === 'Salary History'
        ? [...salaryHistoryData]
        : [];
    const totalItems = sortedHistory.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / salaryHistoryItemsPerPage));
    const startIndex = (salaryHistoryPage - 1) * salaryHistoryItemsPerPage;
    const endIndex = startIndex + salaryHistoryItemsPerPage;
    const currentPageData = sortedHistory.slice(startIndex, endIndex);

    // Generate page numbers
    const getPageNumbers = () => {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
        if (pages.length === 0) {
            pages.push(1);
        }
        return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <SalaryDetailsCard
                    employee={employee}
                    isAdmin={isAdmin}
                    hasPermission={hasPermission}
                    hasSalaryDetails={hasSalaryDetails}
                    onEdit={onOpenSalaryModal}
                    onIncrement={onIncrementSalary}
                    onViewOfferLetter={async () => {
                        // Quick check first
                        let offerLetter = null;
                        let offerLetterSource = null;

                        // Check salary history first
                        if (employee?.salaryHistory && Array.isArray(employee.salaryHistory) && employee.salaryHistory.length > 0) {
                            const sortedHistory = [...employee.salaryHistory];
                            for (const entry of sortedHistory) {
                                if (entry.offerLetter) {
                                    offerLetter = entry.offerLetter;
                                    offerLetterSource = { type: 'salaryOfferLetter', docId: entry._id };
                                    break;
                                }
                            }
                        }

                        // Check main employee offer letter
                        if (!offerLetter && employee?.offerLetter) {
                            offerLetter = employee.offerLetter;
                            offerLetterSource = { type: 'offerLetter' };
                        }

                        if (!offerLetter) {
                            toast({
                                variant: "default",
                                title: "No salary letter found",
                                description: "No salary letter is available for this salary record."
                            });
                            return;
                        }

                        // Check if it's a Cloudinary URL or base64 data
                        const isCloudinaryUrl = offerLetter.url || (offerLetter.data && (offerLetter.data.startsWith('http://') || offerLetter.data.startsWith('https://')));
                        const documentData = offerLetter.url || offerLetter.data;

                        // If document is directly available (Cloudinary URL or base64), open immediately
                        if (documentData) {
                            if (isCloudinaryUrl) {
                                // Cloudinary URL - use directly (much faster!)
                                onViewDocument({
                                    data: documentData,
                                    name: offerLetter.name || 'Salary Letter.pdf',
                                    mimeType: offerLetter.mimeType || 'application/pdf',
                                    moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                });
                            } else {
                                // Base64 data - clean and use
                                let cleanData = documentData;
                                if (cleanData.includes(',')) {
                                    cleanData = cleanData.split(',')[1];
                                }

                                onViewDocument({
                                    data: cleanData,
                                    name: offerLetter.name || 'Salary Letter.pdf',
                                    mimeType: offerLetter.mimeType || 'application/pdf',
                                    moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                });
                            }
                        } else if (offerLetterSource && employeeId) {
                            // Open modal with loading state immediately
                            onViewDocument({
                                data: null, // Signal loading
                                name: offerLetter.name || 'Salary Letter.pdf',
                                mimeType: offerLetter.mimeType || 'application/pdf',
                                loading: true,
                                moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                            });

                            // Fetch in background
                            try {
                                const axiosInstance = (await import('@/utils/axios')).default;
                                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                    params: offerLetterSource.docId
                                        ? { type: offerLetterSource.type, docId: offerLetterSource.docId }
                                        : { type: offerLetterSource.type }
                                });

                                if (response.data && response.data.data) {
                                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                    if (isCloudinaryUrl) {
                                        // Cloudinary URL - use directly
                                        onViewDocument({
                                            data: response.data.data,
                                            name: response.data.name || offerLetter.name || 'Salary Letter.pdf',
                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                            moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                        });
                                    } else {
                                        // Base64 data - clean and use
                                        let cleanData = response.data.data;
                                        if (cleanData.includes(',')) {
                                            cleanData = cleanData.split(',')[1];
                                        }

                                        onViewDocument({
                                            data: cleanData,
                                            name: response.data.name || offerLetter.name || 'Salary Letter.pdf',
                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                            moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                        });
                                    }
                                } else {
                                    onViewDocument(null); // Close modal
                                    toast({
                                        variant: "destructive",
                                        title: "Failed to load salary letter",
                                        description: "Unable to load the salary letter. Please try again."
                                    });
                                }
                            } catch (err) {
                                console.error('Error fetching salary letter:', err);
                                onViewDocument(null); // Close modal
                                toast({
                                    variant: "destructive",
                                    title: "Error fetching salary letter",
                                    description: "Please try again."
                                });
                            }
                        } else {
                            toast({
                                title: "Salary letter data not available",
                                description: "The salary letter data is not available."
                            });
                        }
                    }}
                />

                <BankAccountCard
                    employee={employee}
                    isAdmin={isAdmin}
                    hasPermission={hasPermission}
                    hasBankDetailsSection={hasBankDetailsSection}
                    onEdit={onOpenBankModal}
                    onViewDocument={async () => {
                        if (!employee.bankAttachment) {
                            toast({
                                title: "No bank attachment found",
                                description: "No bank attachment is available."
                            });
                            return;
                        }

                        // Check if it's a Cloudinary URL or base64 data
                        const isCloudinaryUrl = employee.bankAttachment.url ||
                            (employee.bankAttachment.data && (employee.bankAttachment.data.startsWith('http://') || employee.bankAttachment.data.startsWith('https://')));
                        const documentData = employee.bankAttachment.url || employee.bankAttachment.data;

                        // If document is directly available (Cloudinary URL or base64), open immediately
                        if (documentData) {
                            if (isCloudinaryUrl) {
                                // Cloudinary URL - use directly (much faster!)
                                onViewDocument({
                                    data: documentData,
                                    name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                    mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                    moduleId: 'hrm_employees_view_bank'
                                });
                            } else {
                                // Base64 data - clean and use
                                let cleanData = documentData;
                                if (cleanData.includes(',')) {
                                    cleanData = cleanData.split(',')[1];
                                }

                                onViewDocument({
                                    data: cleanData,
                                    name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                    mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                    moduleId: 'hrm_employees_view_bank'
                                });
                            }
                        } else if (employeeId) {
                            // Open modal with loading state immediately
                            onViewDocument({
                                data: null, // Signal loading
                                name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                loading: true,
                                moduleId: 'hrm_employees_view_bank'
                            });

                            // Fetch in background
                            try {
                                const axiosInstance = (await import('@/utils/axios')).default;
                                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                    params: { type: 'bankAttachment' }
                                });

                                if (response.data && response.data.data) {
                                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                    if (isCloudinaryUrl) {
                                        // Cloudinary URL - use directly
                                        onViewDocument({
                                            data: response.data.data,
                                            name: response.data.name || employee.bankAttachment.name || 'Bank Attachment.pdf',
                                            mimeType: response.data.mimeType || employee.bankAttachment.mimeType || 'application/pdf',
                                            moduleId: 'hrm_employees_view_bank'
                                        });
                                    } else {
                                        // Base64 data - clean and use
                                        let cleanData = response.data.data;
                                        if (cleanData.includes(',')) {
                                            cleanData = cleanData.split(',')[1];
                                        }

                                        onViewDocument({
                                            data: cleanData,
                                            name: response.data.name || employee.bankAttachment.name || 'Bank Attachment.pdf',
                                            mimeType: response.data.mimeType || employee.bankAttachment.mimeType || 'application/pdf',
                                            moduleId: 'hrm_employees_view_bank'
                                        });
                                    }
                                } else {
                                    onViewDocument(null); // Close modal
                                    toast({
                                        variant: "destructive",
                                        title: "Failed to load bank attachment",
                                        description: "Unable to load the bank attachment. Please try again."
                                    });
                                }
                            } catch (err) {
                                console.error('Error fetching bank attachment:', err);
                                onViewDocument(null); // Close modal
                                toast({
                                    variant: "destructive",
                                    title: "Error fetching bank attachment",
                                    description: "Please try again."
                                });
                            }
                        }
                    }}
                />
            </div>

            {/* Action Buttons - Tab Style */}
            <div className="flex flex-wrap gap-3 mt-6">
                {['Salary History', 'Fine', 'Rewards', 'NCR', 'Loans', 'Advance', 'Assets', 'CTC'].map((action) => {
                    if (action === 'Salary History' && !isAdmin() && !hasPermission('hrm_employees_view_salary_history', 'isView') && !hasPermission('hrm_employees_view_salary', 'isView')) {
                        return null;
                    }
                    return (
                        <button
                            key={action}
                            onClick={() => {
                                setSelectedSalaryAction(action);
                                setSalaryHistoryPage(1);
                            }}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors border-2 ${selectedSalaryAction === action
                                ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                }`}
                        >
                            {action}
                        </button>
                    );
                })}
            </div>

            {/* Salary Action Card */}
            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-semibold text-gray-800">{selectedSalaryAction}</h3>
                        {selectedSalaryAction === 'Assets' && (
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {/* Asset Controllers see: Your Assets + Unassigned Assets + Parking */}
                                {canManageParkingTab && (
                                    <>
                                        <button
                                            onClick={() => setAssetSubTab('Your Assets')}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${assetSubTab === 'Your Assets' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Your Assets
                                        </button>
                                        <button
                                            onClick={() => setAssetSubTab('Unassigned Assets')}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${assetSubTab === 'Unassigned Assets' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Unassigned Assets
                                        </button>
                                        <button
                                            onClick={() => setAssetSubTab('On Leave')}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${assetSubTab === 'On Leave' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                           Parking
                                        </button>
                                    </>
                                )}
                                {/* Dynamic Employee Sub-tabs for Parking (On Leave) */}
                                {canManageParkingTab && assetSubTab === 'On Leave' && (
                                    <div className="flex items-center gap-2 ml-4 border-l border-gray-200 pl-4">
                                        {(() => {
                                            const employeeMap = new Map();
                                            onLeaveAssets.forEach(asset => {
                                                if (asset.assignedTo) {
                                                    const emp = asset.assignedTo;
                                                    const empId = emp._id || emp.id || emp.employeeId || emp;
                                                    if (empId && !employeeMap.has(empId)) {
                                                        employeeMap.set(empId, {
                                                            id: empId,
                                                            name: emp.firstName ? `${emp.firstName} ${emp.lastName}` : (emp.name || 'Unknown Employee'),
                                                            employeeId: emp.employeeId || '—'
                                                        });
                                                    }
                                                }
                                            });

                                            const employeeList = Array.from(employeeMap.values());
                                            if (employeeList.length === 0) return null;

                                            return (
                                                <>
                                                    <button
                                                        onClick={() => setSelectedParkingEmployee(null)}
                                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                                            !selectedParkingEmployee 
                                                                ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm' 
                                                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                                        }`}
                                                    >
                                                        All Employees
                                                    </button>
                                                    {employeeList.map(emp => {
                                                        const isSelected = selectedParkingEmployee === emp.id;
                                                        return (
                                                            <button
                                                                key={emp.id}
                                                                onClick={() => setSelectedParkingEmployee(emp.id)}
                                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                                                    isSelected 
                                                                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm' 
                                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                                                }`}
                                                                title={emp.name}
                                                            >
                                                                {emp.name}
                                                            </button>
                                                        );
                                                    })}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                                {/* HR users: if not AC, show Your Assets; all HR users also get Company Assets */}
                                {!canManageParkingTab && isHR && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setAssetSubTab('Your Assets');
                                                setSelectedCompanyTab(null);
                                            }}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${assetSubTab === 'Your Assets' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Your Assets
                                        </button>
                                    </>
                                )}
                                {isHR && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setAssetSubTab('Company Assets');
                                                if (!selectedCompanyTab && companies.length > 0) {
                                                    setSelectedCompanyTab(companies[0]._id || companies[0].id);
                                                } else if (!selectedCompanyTab && companyAssets.length > 0) {
                                                    const firstAssetWithCompany = companyAssets.find(a => a.assignedCompany);
                                                    if (firstAssetWithCompany?.assignedCompany) {
                                                        const company = firstAssetWithCompany.assignedCompany;
                                                        setSelectedCompanyTab(company._id || company.id || company);
                                                    }
                                                }
                                            }}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${assetSubTab === 'Company Assets' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Company Assets
                                        </button>
                                    </>
                                )}
                                {/* Dynamic Company Sub-tabs - shown when Company Assets is selected */}
                                {isHR && assetSubTab === 'Company Assets' && (
                                    <div className="flex items-center gap-2 ml-4 border-l border-gray-200 pl-4">
                                        {(() => {
                                            // Get unique companies from assets
                                            const uniqueCompanies = [];
                                            const companyMap = new Map();
                                            
                                            companyAssets.forEach(asset => {
                                                if (asset.assignedCompany) {
                                                    const company = asset.assignedCompany;
                                                    const companyId = company._id || company.id || company;
                                                    if (companyId && !companyMap.has(companyId)) {
                                                        companyMap.set(companyId, {
                                                            id: companyId,
                                                            name: company.name || 'Unknown Company',
                                                            nickName: company.nickName || company.shortName || null
                                                        });
                                                    }
                                                }
                                            });
                                            
                                            // Also add companies from the companies list
                                            companies.forEach(company => {
                                                const companyId = company._id || company.id;
                                                if (companyId && !companyMap.has(companyId)) {
                                                    companyMap.set(companyId, {
                                                        id: companyId,
                                                        name: company.name || 'Unknown Company',
                                                        nickName: company.nickName || company.shortName || null
                                                    });
                                                }
                                            });
                                            
                                            const companyList = Array.from(companyMap.values());
                                            
                                            if (companyList.length === 0) return null;
                                            
                                            // Auto-select first company if none selected
                                            if (!selectedCompanyTab && companyList.length > 0) {
                                                setTimeout(() => setSelectedCompanyTab(companyList[0].id), 0);
                                            }
                                            
                                            return companyList.map(company => {
                                                const displayName = company.nickName || company.name;
                                                const isSelected = selectedCompanyTab === company.id;
                                                
                                                return (
                                                    <button
                                                        key={company.id}
                                                        onClick={() => setSelectedCompanyTab(company.id)}
                                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                                            isSelected 
                                                                ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm' 
                                                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                                        }`}
                                                        title={company.name !== displayName ? company.name : ''}
                                                    >
                                                        {displayName}
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {selectedSalaryAction === 'Assets' && isAssetController && assetSubTab === 'On Leave' && selectedOnLeaveAssets.length > 0 && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                    {selectedOnLeaveAssets.length} Selected
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBulkParkingTransferDuration('7');
                                        setOnLeaveActionDialog({
                                            isOpen: true,
                                            asset: {
                                                _id: 'bulk',
                                                assetId: `${selectedOnLeaveAssets.length} Assets`
                                            },
                                            action: 'TransferBulk'
                                        });
                                    }}
                                    className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black hover:bg-amber-600 transition-all shadow-md flex items-center gap-2 active:scale-95"
                                >
                                    <ArrowRightLeft size={14} />
                                    BULK TRANSFER
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setOnLeaveActionDialog({
                                            isOpen: true,
                                            asset: {
                                                _id: 'bulk',
                                                assetId: `${selectedOnLeaveAssets.length} Assets`
                                            },
                                            action: 'OnDutyBulk'
                                        })
                                    }
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2 active:scale-95"
                                >
                                    <CheckCircle2 size={14} />
                                    BULK ON DUTY
                                </button>
                            </div>
                        )}
                        {selectedSalaryAction === 'Assets' &&
                            isAssetController &&
                            assetSubTab === 'Unassigned Assets' &&
                            assetControllerHasBulkAssignable &&
                            selectedUnassignedAssets.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setIsBulkAssignModalOpen(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 shadow-md flex items-center gap-2 active:scale-95 transition-all"
                                >
                                    <UserPlus size={16} />
                                    Assign Asset ({selectedUnassignedAssets.length})
                                </button>
                            )}
                        {selectedSalaryAction === 'Assets' &&
                            assetSubTab === 'Your Assets' &&
                            canBulkAssetFromProfile &&
                            selectedYourAssets.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                    <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                        {selectedYourAssets.length} Selected
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setYourAssetsBulkDialog({ isOpen: true, kind: 'return' })
                                        }
                                        className="px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black hover:bg-rose-600 transition-all shadow-md flex items-center gap-2 active:scale-95"
                                    >
                                        <Undo2 size={14} />
                                        BULK RETURN
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setYourAssetsBulkLeaveDuration('7');
                                            setYourAssetsBulkDialog({ isOpen: true, kind: 'leave' });
                                        }}
                                        className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black hover:bg-amber-600 transition-all shadow-md flex items-center gap-2 active:scale-95"
                                    >
                                        <ArrowRightLeft size={14} />
                                        BULK TRANSFER
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setYourAssetsBulkDialog({ isOpen: true, kind: 'endOfServices' })
                                        }
                                        className="px-4 py-2 bg-slate-700 text-white rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all shadow-md flex items-center gap-2 active:scale-95"
                                    >
                                        <PackageX size={14} />
                                        BULK END OF SERVICES
                                    </button>
                                </div>
                            )}
                        {selectedSalaryAction === 'Salary History' && (isAdmin() || hasPermission('hrm_employees_view_salary', 'isView') || hasPermission('hrm_employees_view_salary_history', 'isView')) && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Items per page</span>
                                    <select
                                        value={salaryHistoryItemsPerPage}
                                        onChange={(e) => {
                                            setSalaryHistoryItemsPerPage(Number(e.target.value));
                                            setSalaryHistoryPage(1);
                                        }}
                                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSalaryHistoryPage(prev => Math.max(1, prev - 1))}
                                        disabled={salaryHistoryPage === 1 || totalItems === 0}
                                        className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${salaryHistoryPage === 1 || totalItems === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                                            }`}
                                    >
                                        &lt;
                                    </button>
                                    {pageNumbers.map((pageNum) => (
                                        <button
                                            key={pageNum}
                                            onClick={() => setSalaryHistoryPage(pageNum)}
                                            disabled={totalItems === 0}
                                            className={`px-3 py-1 rounded-lg text-sm bg-white border border-gray-300 text-gray-700 ${totalItems === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setSalaryHistoryPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={salaryHistoryPage === totalPages || totalItems === 0 || totalItems <= salaryHistoryItemsPerPage}
                                        className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${salaryHistoryPage === totalPages || totalItems === 0 || totalItems <= salaryHistoryItemsPerPage
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-gray-300'
                                            }`}
                                    >
                                        &gt;
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto w-full max-w-full">
                    <table className="w-full min-w-0 table-auto">
                        <thead>
                            <tr className="border-b border-gray-200">
                                {selectedSalaryAction === 'Salary History' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">From Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">To Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Basic Salary</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Other Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Home Rent Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vehicle Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fuel Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Salary</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Salary Letter</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Rewards' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Attachment</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Fine' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fine ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Individual Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Paid Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Balance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment Schedule</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Document</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'NCR' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                    </>
                                )}
                                {['Loans', 'Advance'].includes(selectedSalaryAction) && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Deduction</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment Schedule</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Document</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'CTC' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Year</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Basic</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Allowances</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total CTC</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Assets' && assetSubTab === 'Your Assets' && (
                                    <>
                                        {canBulkAssetFromProfile && (
                                            <th className="py-3 px-4 text-left w-10">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                    title="Select all eligible (assigned, no pending action)"
                                                    checked={
                                                        yourAssetsBulkEligibleRows.length > 0 &&
                                                        yourAssetsBulkEligibleRows.every((a) =>
                                                            selectedYourAssets.some(
                                                                (sid) => String(sid) === String(a._id)
                                                            )
                                                        )
                                                    }
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedYourAssets(
                                                                yourAssetsBulkEligibleRows.map((a) => a._id)
                                                            );
                                                        } else {
                                                            setSelectedYourAssets([]);
                                                        }
                                                    }}
                                                />
                                            </th>
                                        )}
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset Name</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Value (AED)</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Assigned Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Attachment</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Assets' && isAssetController && assetSubTab === 'Unassigned Assets' && (
                                    <>
                                        <th className="py-3 px-4 text-left w-10">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                title="Select all unassigned assets"
                                                checked={
                                                    assetControllerTrulyUnassigned.length > 0 &&
                                                    selectedUnassignedAssets.length === assetControllerTrulyUnassigned.length
                                                }
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedUnassignedAssets(
                                                            assetControllerTrulyUnassigned
                                                                .map((a) => a?._id || a?.id)
                                                                .filter(Boolean)
                                                        );
                                                    } else {
                                                        setSelectedUnassignedAssets([]);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset Name</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type / Category</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Value (AED)</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700"></th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Assets' && canManageParkingTab && assetSubTab === 'On Leave' && (
                                    <>
                                        <th className="py-3 px-4 text-left w-10">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                checked={filteredOnLeaveAssets.length > 0 && selectedOnLeaveAssets.length === filteredOnLeaveAssets.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedOnLeaveAssets(filteredOnLeaveAssets.map(a => a._id));
                                                    } else {
                                                        setSelectedOnLeaveAssets([]);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset Name</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type / Category</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Value (AED)</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Assigned To</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Remaining Days</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Assets' && isHR && assetSubTab === 'Company Assets' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset Name</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Asset ID</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type / Category</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Value (AED)</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Purchase Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Attachment</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {selectedSalaryAction === 'Salary History' && (
                                currentPageData.length > 0 ? (
                                    currentPageData.map((entry, index) => {
                                        const actualIndex = startIndex + index;
                                        return (
                                            <tr key={actualIndex} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {entry.fromDate ? new Date(entry.fromDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {entry.toDate ? new Date(entry.toDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Present'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {entry.basic?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {entry.otherAllowance?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {entry.houseRentAllowance?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {entry.vehicleAllowance?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">AED {(() => {
                                                    if (entry.fuelAllowance !== undefined && entry.fuelAllowance !== null) {
                                                        return entry.fuelAllowance.toFixed(2);
                                                    }
                                                    const fuelFromAdditional = entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;
                                                    return fuelFromAdditional.toFixed(2);
                                                })()}</td>
                                                <td className="py-3 px-4 text-sm font-semibold text-gray-500">AED {(() => {
                                                    const basic = entry.basic || 0;
                                                    const hra = entry.houseRentAllowance || 0;
                                                    const vehicle = entry.vehicleAllowance || 0;
                                                    const other = entry.otherAllowance || 0;
                                                    const fuel = entry.fuelAllowance !== undefined && entry.fuelAllowance !== null
                                                        ? entry.fuelAllowance
                                                        : (entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0);
                                                    const recalculatedTotal = basic + hra + vehicle + fuel + other;
                                                    return recalculatedTotal.toFixed(2);
                                                })()}</td>
                                                <td className="py-3 px-4 text-sm">
                                                    {(() => {
                                                        const hasOfferLetter = !!(entry.offerLetter &&
                                                            (entry.offerLetter.url || entry.offerLetter.data));

                                                        if (!hasOfferLetter) {
                                                            return <span className="text-gray-400">—</span>;
                                                        }

                                                        const offerLetterName = entry.offerLetter?.name || 'Salary Letter.pdf';

                                                        return (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();

                                                                    const offerLetter = entry.offerLetter;

                                                                    if (!offerLetter) {
                                                                        toast({
                                                                            title: "No salary letter found",
                                                                            description: "No salary letter is available for this salary record."
                                                                        });
                                                                        return;
                                                                    }

                                                                    const documentData = offerLetter.url || offerLetter.data;

                                                                    if (documentData) {
                                                                        const isCloudinaryUrl = offerLetter.url ||
                                                                            (offerLetter.data && (offerLetter.data.startsWith('http://') || offerLetter.data.startsWith('https://')));

                                                                        if (isCloudinaryUrl) {
                                                                            onViewDocument({
                                                                                data: documentData,
                                                                                name: offerLetterName,
                                                                                mimeType: offerLetter.mimeType || 'application/pdf',
                                                                                moduleId: 'hrm_employees_view_salary_history'
                                                                            });
                                                                        } else {
                                                                            let cleanData = documentData;
                                                                            if (cleanData.includes(',')) {
                                                                                cleanData = cleanData.split(',')[1];
                                                                            }
                                                                            onViewDocument({
                                                                                data: cleanData,
                                                                                name: offerLetterName,
                                                                                mimeType: offerLetter.mimeType || 'application/pdf',
                                                                                moduleId: 'hrm_employees_view_salary_history'
                                                                            });
                                                                        }
                                                                    } else {
                                                                        if (entry._id && employeeId) {
                                                                            try {
                                                                                const axiosInstance = (await import('@/utils/axios')).default;
                                                                                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                                                                    params: { type: 'salaryOfferLetter', docId: entry._id }
                                                                                });

                                                                                if (response.data && response.data.data) {
                                                                                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                                                                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                                                                    if (isCloudinaryUrl) {
                                                                                        onViewDocument({
                                                                                            data: response.data.data,
                                                                                            name: response.data.name || offerLetterName,
                                                                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                                                                            moduleId: 'hrm_employees_view_salary_history'
                                                                                        });
                                                                                    } else {
                                                                                        let cleanData = response.data.data;
                                                                                        if (cleanData.includes(',')) {
                                                                                            cleanData = cleanData.split(',')[1];
                                                                                        }
                                                                                        onViewDocument({
                                                                                            data: cleanData,
                                                                                            name: response.data.name || offerLetterName,
                                                                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                                                                            moduleId: 'hrm_employees_view_salary_history'
                                                                                        });
                                                                                    }
                                                                                } else {
                                                                                    toast({
                                                                                        variant: "destructive",
                                                                                        title: "Failed to load salary letter",
                                                                                        description: "Unable to load the salary letter."
                                                                                    });
                                                                                }
                                                                            } catch (err) {
                                                                                if (err.response?.status === 404) {
                                                                                    toast({
                                                                                        variant: "destructive",
                                                                                        title: "Salary letter not found",
                                                                                        description: "No salary letter is available for this salary record."
                                                                                    });
                                                                                } else {
                                                                                    toast({
                                                                                        variant: "destructive",
                                                                                        title: "Error loading salary letter",
                                                                                        description: "Please try again."
                                                                                    });
                                                                                }
                                                                            }
                                                                        } else {
                                                                            toast({
                                                                                variant: "destructive",
                                                                                title: "Salary letter data not available",
                                                                                description: "The salary letter data is not available."
                                                                            });
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5 font-medium"
                                                                title="View Salary Letter"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                                    <polyline points="14 2 14 8 20 8"></polyline>
                                                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                                                    <polyline points="10 9 9 9 8 9"></polyline>
                                                                </svg>
                                                                <span className="truncate max-w-[150px]" title={offerLetterName}>
                                                                    {offerLetterName}
                                                                </span>
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {(isAdmin() || hasPermission('hrm_employees_view_salary', 'isEdit')) && (
                                                            <button
                                                                onClick={() => {
                                                                    const entryToEdit = sortedHistory[actualIndex];
                                                                    if (onEditSalary) {
                                                                        onEditSalary(entryToEdit, actualIndex);
                                                                    }
                                                                }}
                                                                className="text-blue-600 hover:text-blue-700"
                                                                title="Edit"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                        )}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_salary', 'isDelete')) && (
                                                            <button
                                                                onClick={() => onDeleteSalary(actualIndex, sortedHistory)}
                                                                className="text-red-600 hover:text-red-700"
                                                                title="Delete"
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="py-16 text-center text-gray-400 text-sm">
                                            No Salary History
                                        </td>
                                    </tr>
                                )
                            )}

                            {selectedSalaryAction === 'Fine' && (
                                fines && fines.filter(f => ['Approved', 'Paid'].includes(f.fineStatus)).length > 0 ? (
                                    fines.filter(f => ['Approved', 'Paid'].includes(f.fineStatus)).map((fine, index) => {
                                        const individualShare = calculateEmployeeFineShare(fine);
                                        const isExpanded = expandedFineId === (fine._id || index);
                                        
                                        // Filter payments for this specific fine by this employee
                                        const relatedPayments = allEmployeePayments.filter(p => 
                                            (p.referenceId === fine.fineId || p.relatedEntityId === fine._id) &&
                                            ['Completed', 'Paid', 'Success', 'Approved', 'Active'].includes(p.status)
                                        );

                                        const paidAmount = relatedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                                        const balance = Math.max(0, individualShare - paidAmount);
                                        const isGroup = (fine.assignedEmployees?.length || 1) > 1;

                                        return (
                                            <React.Fragment key={fine._id || index}>
                                                <tr 
                                                    onClick={() => toggleFineExpansion(fine._id || index, fine.fineId)}
                                                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}
                                                >
                                                    <td className="py-3 px-4 text-sm font-bold text-gray-700">
                                                        <div className="flex items-center gap-2">
                                                            {isExpanded ? <ChevronDown size={14} className="text-blue-500" /> : <ChevronRight size={14} className="text-gray-400" />}
                                                            {fine.fineId || '—'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight ${isGroup ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                            {isGroup ? 'Group' : 'Individual'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm font-black text-gray-700">
                                                        AED {individualShare.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm font-black text-emerald-600">
                                                        AED {paidAmount.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm font-black text-rose-600">
                                                        AED {balance.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(() => {
                                                                const monthLabels = getMonthSequence(fine.monthStart, fine.payableDuration, fine.createdAt || fine.fineDate);
                                                                const monthlyAmount = fine.payableDuration > 0 ? (individualShare / fine.payableDuration) : individualShare;
                                                                
                                                                // Simple month-matching logic consistent with PaymentReceipt
                                                                let remainingPays = [...relatedPayments].sort((a,b) => new Date(a.paymentDate || a.createdAt) - new Date(b.paymentDate || b.createdAt));
                                                                
                                                                return monthLabels.map((m, idx) => {
                                                                    let currentPaid = 0;
                                                                    while(remainingPays.length > 0 && currentPaid < (monthlyAmount - 0.01)) {
                                                                        const p = remainingPays[0];
                                                                        const pAmt = parseFloat(p.amount || 0);
                                                                        const needed = monthlyAmount - currentPaid;
                                                                        if (pAmt <= (needed + 0.01)) {
                                                                            currentPaid += pAmt;
                                                                            remainingPays.shift();
                                                                        } else {
                                                                            currentPaid = monthlyAmount;
                                                                            remainingPays[0] = { ...p, amount: pAmt - needed };
                                                                            break;
                                                                        }
                                                                    }
                                                                    const isPaid = currentPaid >= (monthlyAmount - 0.5);

                                                                    return (
                                                                        <span
                                                                            key={idx}
                                                                            className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tighter rounded border ${
                                                                                isPaid 
                                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                                                            }`}
                                                                            title={isPaid ? 'Paid' : `AED ${currentPaid.toFixed(0)} / ${monthlyAmount.toFixed(0)}`}
                                                                        >
                                                                            {m.substring(0, 3)}
                                                                        </span>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500">
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            {fine.attachment && (
                                                                <button
                                                                    onClick={() => onViewDocument(fine.attachment)}
                                                                    className="text-blue-600 hover:text-blue-700 transition-colors p-1 hover:bg-blue-50 rounded"
                                                                    title="View Document"
                                                                >
                                                                    <FileText size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={7} className="bg-gray-50/50 p-4">
                                                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                                                    <div className="flex items-center gap-2">
                                                                        <History size={14} className="text-blue-500" />
                                                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Receipts</h4>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 italic">
                                                                        Individual History
                                                                    </span>
                                                                </div>
                                                                <div className="p-0">
                                                                    {loadingPayments ? (
                                                                        <div className="p-8 text-center">
                                                                            <div className="w-6 h-6 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                                                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-tight">Loading receipts...</p>
                                                                        </div>
                                                                    ) : finePayments.length === 0 ? (
                                                                        <div className="p-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                                                                            No payment receipts found for this fine.
                                                                        </div>
                                                                    ) : (
                                                                        <table className="w-full text-left text-sm">
                                                                            <thead>
                                                                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                                                    <th className="px-4 py-2">Receipt No</th>
                                                                                    <th className="px-4 py-2">Date</th>
                                                                                    <th className="px-4 py-2">Amount</th>
                                                                                    <th className="px-4 py-2">Status</th>
                                                                                    <th className="px-4 py-2">Attachment</th>
                                                                                    <th className="px-4 py-2 text-right">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {finePayments.map((pay) => (
                                                                                    <tr key={pay._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                                                                                        <td className="px-4 py-3 font-bold text-slate-700">{pay.paymentId}</td>
                                                                                        <td className="px-4 py-3 text-slate-500">{new Date(pay.paymentDate || pay.createdAt).toLocaleDateString()}</td>
                                                                                        <td className="px-4 py-3 font-black text-blue-600">AED {pay.amount?.toFixed(2)}</td>
                                                                                        <td className="px-4 py-3">
                                                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight ${
                                                                                                ['Completed', 'Success', 'Paid'].includes(pay.status) 
                                                                                                    ? 'bg-emerald-100 text-emerald-700' 
                                                                                                    : 'bg-amber-100 text-amber-700'
                                                                                            }`}>
                                                                                                {pay.status}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="px-4 py-3">
                                                                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                                                {(() => {
                                                                                                    const viewerDoc = normalizePaymentAttachmentForViewer(
                                                                                                        pay.attachment,
                                                                                                        `${pay.paymentId || 'Payment'}-attachment`
                                                                                                    );
                                                                                                    if (!viewerDoc) {
                                                                                                        return <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">No File</span>;
                                                                                                    }
                                                                                                    return (
                                                                                                    <button
                                                                                                        onClick={() => onViewDocument(viewerDoc)}
                                                                                                        className="text-blue-600 hover:text-blue-700 transition-colors p-1 hover:bg-blue-50 rounded"
                                                                                                        title="View Attachment"
                                                                                                    >
                                                                                                        <FileText size={16} />
                                                                                                    </button>
                                                                                                    );
                                                                                                })()}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-right">
                                                                                            <button 
                                                                                                onClick={() => setSelectedInvoice(pay)}
                                                                                                className="text-blue-600 hover:text-blue-700 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1 ml-auto group"
                                                                                            >
                                                                                                View Invoice
                                                                                                <ArrowRightLeft size={12} className="group-hover:translate-x-1 transition-transform" />
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-16 text-center text-gray-400 text-sm">
                                            No Fines to display
                                        </td>
                                    </tr>
                                )
                            )}

                            {selectedSalaryAction === 'Rewards' && (
                                rewards && rewards.filter(r => r.rewardStatus === 'Approved').length > 0 ? (
                                    rewards.filter(r => r.rewardStatus === 'Approved').map((reward, index) => (
                                        <tr key={reward._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {reward.awardedDate ? formatDate(reward.awardedDate) : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {reward.awardedDate ? new Date(reward.awardedDate).toLocaleString('default', { month: 'long' }) : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                {reward.title || reward.description || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                AED {reward.amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                <button
                                                    onClick={() => {
                                                        setSelectedCertificate(reward);
                                                        setShowCertificate(true);
                                                    }}
                                                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors p-1.5 hover:bg-blue-50 rounded-lg"
                                                >
                                                    <Download size={16} />
                                                    <span className="text-xs">Download</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                                            No Rewards to display
                                        </td>
                                    </tr>
                                )
                            )}

                            {/* Handling other tabs that are not yet implemented with data */}
                            {selectedSalaryAction === 'Loans' && (
                                (() => {
                                    const actualLoans = loans.filter(l => (l.type || 'Loan') === 'Loan' && l.status === 'Approved');
                                    return actualLoans.length > 0 ? (
                                        actualLoans.map((loan, index) => (
                                            <tr key={loan._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {loan.loanId || 'Loan'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {loan.createdAt ? formatDate(loan.createdAt) : (loan.appliedDate ? formatDate(loan.appliedDate) : '—')}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {loan.amount?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {loan.duration ? (loan.amount / loan.duration).toFixed(2) : '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    <div className="flex flex-wrap gap-2">
                                                        {(() => {
                                                            const boxes = getMonthSequence(loan.monthStart, loan.duration, loan.createdAt || loan.appliedDate);
                                                            return boxes.map((month, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md border border-blue-200"
                                                                >
                                                                    {month}
                                                                </span>
                                                            ));
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {loan.attachment ? (
                                                        <button
                                                            onClick={() => onViewDocument(loan.attachment)}
                                                            className="text-green-600 hover:text-green-700 transition-colors p-1 hover:bg-green-50 rounded"
                                                            title="View Document"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                                            </svg>
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-16 text-center text-gray-400 text-sm">
                                                No Loans to display
                                            </td>
                                        </tr>
                                    );
                                })()
                            )}

                            {selectedSalaryAction === 'Advance' && (
                                (() => {
                                    const advances = loans.filter(l => l.type === 'Advance' && l.status === 'Approved');
                                    return advances.length > 0 ? (
                                        advances.map((advance, index) => (
                                            <tr key={advance._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {advance.loanId || 'Advance'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {advance.createdAt ? formatDate(advance.createdAt) : (advance.appliedDate ? formatDate(advance.appliedDate) : '—')}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {advance.amount?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {advance.duration ? (advance.amount / advance.duration).toFixed(2) : '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    <div className="flex flex-wrap gap-2">
                                                        {(() => {
                                                            const boxes = getMonthSequence(advance.monthStart, advance.duration, advance.createdAt || advance.appliedDate);
                                                            return boxes.map((month, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md border border-blue-200"
                                                                >
                                                                    {month}
                                                                </span>
                                                            ));
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {advance.attachment ? (
                                                        <button
                                                            onClick={() => onViewDocument(advance.attachment)}
                                                            className="text-green-600 hover:text-green-700 transition-colors p-1 hover:bg-green-50 rounded"
                                                            title="View Document"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                                            </svg>
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-16 text-center text-gray-400 text-sm">
                                                No Advances to display
                                            </td>
                                        </tr>
                                    );
                                })()
                            )}

                            {selectedSalaryAction === 'NCR' && (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                                        No NCR Records Found
                                    </td>
                                </tr>
                            )}

                            {selectedSalaryAction === 'CTC' && (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                                        No CTC History Found
                                    </td>
                                </tr>
                            )}

                            {selectedSalaryAction === 'Assets' && assetSubTab === 'Your Assets' && (
                                (() => {
                                    const initialAssetsList = assets && assets.length > 0 ? assets : (employee?.assets || []);
                                    const assetsListFiltered = initialAssetsList.filter((a) => {
                                        if (!a) return false;
                                        const st = String(a.status || '').trim();
                                        if (st === 'Unassigned' || st === 'Draft') return false;
                                        return true;
                                    });

                                    const assetsList = assetsListFiltered;

                                    const handleRespondToAsset = async (asset, action) => {
                                        setConfirmDialog({ isOpen: true, asset, action });
                                    };

                                    const viewAssetHistory = async (asset) => {
                                        try {
                                            setSelectedHistoryAsset(asset);
                                            setShowHistoryModal(true);
                                            setLoadingHistory(true);
                                            const response = await axiosInstance.get(`/AssetItem/${asset._id}/history`);
                                            setAssetHistory(response.data);
                                        } catch (error) {
                                            console.error('Error fetching asset history:', error);
                                            toast({
                                                variant: "destructive",
                                                title: "Error",
                                                description: "Failed to fetch asset history"
                                            });
                                        } finally {
                                            setLoadingHistory(false);
                                        }
                                    };

                                    if (assetsList.length === 0) {
                                        return (
                                            <tr>
                                                <td
                                                    colSpan={canBulkAssetFromProfile ? 9 : 8}
                                                    className="py-16 text-center text-gray-400 text-sm"
                                                >
                                                    No Assets assigned
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return assetsList.map((asset, index) => {
                                                    const rowAssigneeId = (() => {
                                                        const t = asset?.assignedTo;
                                                        if (!t) return null;
                                                        if (typeof t === 'object' && t._id) return t._id.toString();
                                                        return t.toString();
                                                    })();
                                                    const profileEmpId = employee?._id?.toString();
                                                    const assetAssignedToProfileEmployee = !!(rowAssigneeId && profileEmpId && rowAssigneeId === profileEmpId);
                                                    const canReturnAssetFromProfile =
                                                        isLoggedInAdmin || isAssetController || (isProfileOwner && assetAssignedToProfileEmployee);
                                                    const rowSelected = selectedYourAssets.some(
                                                        (sid) => String(sid) === String(asset._id)
                                                    );
                                                    const bulkRowSelectable = isYourAssetBulkSelectable(asset);

                                                    return (
                                                    <tr 
                                                        key={asset._id || index} 
                                                        className={`border-b border-gray-100 hover:bg-gray-50 group cursor-pointer transition-colors ${
                                                            canBulkAssetFromProfile && rowSelected ? 'bg-blue-50/50' : ''
                                                        }`}
                                                        onClick={() => router.push(`/HRM/Asset/details/${asset._id || asset.id}`)}
                                                    >
                                                        {canBulkAssetFromProfile && (
                                                            <td className="py-3 px-4 w-10" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                                                                    title={
                                                                        bulkRowSelectable
                                                                            ? 'Include in bulk return / transfer'
                                                                            : 'Only assigned assets with no pending request can be selected'
                                                                    }
                                                                    checked={rowSelected}
                                                                    disabled={!bulkRowSelectable}
                                                                    onChange={(e) => {
                                                                        const id = asset._id;
                                                                        if (e.target.checked) {
                                                                            setSelectedYourAssets((prev) =>
                                                                                prev.some((p) => String(p) === String(id))
                                                                                    ? prev
                                                                                    : [...prev, id]
                                                                            );
                                                                        } else {
                                                                            setSelectedYourAssets((prev) =>
                                                                                prev.filter((p) => String(p) !== String(id))
                                                                            );
                                                                        }
                                                                    }}
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="py-3 px-4 text-sm text-gray-500 font-medium">
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-900 font-bold">{asset.name || '—'}</span>
                                                                {/* Assignment meta labels intentionally removed from asset-name cell */}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {asset.assetId || '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            <span>{asset.typeId?.name || asset.typeId || '—'}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            AED {asset.assetValue ? Number(asset.assetValue).toFixed(2) : '0.00'}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {asset.status === 'Returned' ? formatDate(asset.updatedAt) :
                                                                (asset.assignedDate ? formatDate(asset.assignedDate) :
                                                                    (asset.updatedAt ? formatDate(asset.updatedAt) : '—'))}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${asset.status === 'Assigned' ? 'bg-indigo-100 text-indigo-700' :
                                                                asset.status === 'Unassigned' ? 'bg-emerald-100 text-emerald-700' :
                                                                    asset.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                                        asset.status === 'Service' ? 'bg-rose-100 text-rose-700' :
                                                                            asset.status === 'Returned' ? 'bg-blue-100 text-blue-700' :
                                                                                'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                {asset.status || 'Assigned'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedHandoverAsset(asset);
                                                                        setShowHandoverModal(true);
                                                                    }}
                                                                    className="text-indigo-600 hover:text-indigo-700 transition-colors p-1 hover:bg-indigo-50 rounded"
                                                                    title="View Handover Form"
                                                                >
                                                                    <ClipboardList size={18} />
                                                                </button>
                                                                {(asset.file || asset.handoverForm) && (
                                                                    <button
                                                                        onClick={() => onViewDocument({
                                                                            data: asset.file || asset.handoverForm,
                                                                            name: `HandoverForm_${asset.assetId}.pdf`,
                                                                            mimeType: 'application/pdf',
                                                                            moduleId: 'hrm_employees_view_asset_form'
                                                                        })}
                                                                        className="text-blue-600 hover:text-blue-700 transition-colors p-1 hover:bg-blue-50 rounded"
                                                                        title="View Signed Document"
                                                                    >
                                                                        <FileText size={18} />
                                                                    </button>
                                                                )}
                                                                {asset.invoiceFile && (
                                                                    <button
                                                                        onClick={() => onViewDocument({
                                                                            data: asset.invoiceFile,
                                                                            name: `Invoice_${asset.assetId}.pdf`,
                                                                            mimeType: 'application/pdf',
                                                                            moduleId: 'hrm_employees_view_asset_invoice'
                                                                        })}
                                                                        className="text-green-600 hover:text-green-700 transition-colors p-1 hover:bg-green-50 rounded"
                                                                        title="View Invoice"
                                                                    >
                                                                        <Download size={18} />
                                                                    </button>
                                                                )}
                                                                {!asset.handoverForm && !asset.file && !asset.invoiceFile && !asset && '—'}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center gap-1">
                                                                {/* Accept/Reject buttons ONLY show for the employee who needs to accept the assignment */}
                                                                {/* Condition: status is Pending AND actionRequiredBy matches the logged-in employee's ID */}
                                                                {(() => {
                                                                    // Helper function to extract ID from actionRequiredBy (handles ObjectId, string, or populated object)
                                                                    const getActionRequiredById = (actionRequiredBy) => {
                                                                        if (!actionRequiredBy) return null;
                                                                        if (typeof actionRequiredBy === 'object' && actionRequiredBy._id) {
                                                                            return actionRequiredBy._id.toString();
                                                                        }
                                                                        return actionRequiredBy.toString();
                                                                    };
                                                                    
                                                                    const actionRequiredById = getActionRequiredById(asset.actionRequiredBy);
                                                                    const loggedInId = loggedInEmployeeId?.toString();
                                                                    
                                                                    // Show buttons ONLY if status is Pending AND actionRequiredBy matches logged-in employee
                                                                    const shouldShowButtons = asset.status === 'Pending' && 
                                                                                              actionRequiredById && 
                                                                                              loggedInId && 
                                                                                              actionRequiredById === loggedInId;
                                                                    
                                                                    return shouldShowButtons ? (
                                                                        <div className="flex items-center gap-1 mr-2 bg-amber-50 p-1 rounded-lg border border-amber-100">
                                                                            <button
                                                                                onClick={() => handleRespondToAsset(asset, 'Accept')}
                                                                                disabled={respondingToAsset === asset._id}
                                                                                className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-all"
                                                                                title="Accept Assignment"
                                                                            >
                                                                                <CheckCircle2 size={18} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleRespondToAsset(asset, 'Reject')}
                                                                                disabled={respondingToAsset === asset._id}
                                                                                className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-all"
                                                                                title="Reject Assignment"
                                                                            >
                                                                                <XCircle size={18} />
                                                                            </button>
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                                <button
                                                                    onClick={() => viewAssetHistory(asset)}
                                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                    title="View Detailed History"
                                                                >
                                                                    <History size={18} />
                                                                </button>
                                                                {asset.status !== 'Returned' ? (
                                                                    canReturnAssetFromProfile ? (
                                                                        <button
                                                                            onClick={() => handleReturnAsset(asset)}
                                                                            className="text-amber-500 hover:text-amber-700 transition-colors p-1.5 hover:bg-amber-50 rounded-lg"
                                                                            title="Return Asset"
                                                                        >
                                                                            <ArrowRightLeft size={18} />
                                                                        </button>
                                                                    ) : null
                                                                ) : (
                                                                    (isLoggedInAdmin || isAssetController) ? (
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedAssignAsset(asset);
                                                                                setShowAssignModal(true);
                                                                            }}
                                                                            className="text-blue-500 hover:text-blue-700 transition-colors p-1.5 hover:bg-blue-50 rounded-lg"
                                                                            title="Reassign Asset"
                                                                        >
                                                                            <UserPlus size={18} />
                                                                            {(() => {
                                                                                if (asset.assignmentType !== 'Temporary') return 'Reassign';
                                                                                const end = asset.temporaryEndDate ? new Date(asset.temporaryEndDate) : null;
                                                                                if (!end) return 'Reassign';
                                                                                const today = new Date();
                                                                                today.setHours(0, 0, 0, 0);
                                                                                const target = new Date(end);
                                                                                target.setHours(0, 0, 0, 0);
                                                                                const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                                                                                const safeDays = Number.isFinite(diffDays) ? diffDays : null;
                                                                                if (safeDays == null) return 'Reassign';
                                                                                const display = safeDays >= 0 ? safeDays : 0;
                                                                                return `Reassign (${display}d)`;
                                                                            })()}
                                                                        </button>
                                                                    ) : null
                                                                )}
                                                                <button
                                                                    onClick={() => handleReportDamage(asset)}
                                                                    className="text-red-500 hover:text-red-700 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                                                                    title="Report Loss/Damage"
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                    });
                                })())}

                            {/* Unassigned Assets Section - for Asset Controllers */}
                            {selectedSalaryAction === 'Assets' && isAssetController && assetSubTab === 'Unassigned Assets' && (
                                <React.Fragment>
                                    {(() => {
                                        const trulyUnassigned = assetControllerTrulyUnassigned;

                                        if (!trulyUnassigned || trulyUnassigned.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={8} className="py-8 text-center text-gray-400 text-sm">
                                                        No Unassigned Assets Found
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        return trulyUnassigned.map((asset, index) => (
                                            <tr 
                                                key={asset._id || index} 
                                                className={`border-b border-gray-100 hover:bg-gray-50 group cursor-pointer transition-colors ${selectedUnassignedAssets.includes(asset._id || asset.id) ? 'bg-blue-50/40' : ''}`}
                                                onClick={() => router.push(`/HRM/Asset/details/${asset._id || asset.id}`)}
                                            >
                                                <td className="py-3 px-4 w-10" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                        checked={selectedUnassignedAssets.includes(asset._id || asset.id)}
                                                        onChange={(e) => {
                                                            const rowId = asset._id || asset.id;
                                                            if (!rowId) return;
                                                            if (e.target.checked) {
                                                                setSelectedUnassignedAssets((prev) => [...new Set([...prev, rowId])]);
                                                            } else {
                                                                setSelectedUnassignedAssets((prev) => prev.filter((id) => String(id) !== String(rowId)));
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-900 font-bold">
                                                    {asset.name || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {asset.assetId || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    <div className="flex flex-col">
                                                        <span>{asset.typeId?.name || asset.typeId?.type || '—'}</span>
                                                        <span className="text-xs text-gray-400">{asset.categoryId?.name || asset.categoryId?.category || ''}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {asset.assetValue ? Number(asset.assetValue).toFixed(2) : '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${asset.status === 'Returned' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {asset.status || 'Unassigned'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedAssignAsset(asset);
                                                                setShowAssignModal(true);
                                                            }}
                                                            className="text-blue-500 hover:text-blue-700 transition-colors p-1.5 hover:bg-blue-50 rounded-lg"
                                                            title="Assign Asset"
                                                        >
                                                            <UserPlus size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">—</td>
                                            </tr>
                                        ));
                                    })()}
                                </React.Fragment>
                            )}

                            {/* On Leave Assets Section - for Asset Controllers */}
                            {selectedSalaryAction === 'Assets' && isAssetController && assetSubTab === 'On Leave' && (
                                <React.Fragment>
                                    {(() => {
                                        const filteredOnLeaveAssets = selectedParkingEmployee
                                            ? onLeaveAssets.filter(asset => {
                                                if (!asset.assignedTo) return false;
                                                const empId = asset.assignedTo._id || asset.assignedTo.id || asset.assignedTo.employeeId || asset.assignedTo;
                                                return empId.toString() === selectedParkingEmployee.toString();
                                            })
                                            : onLeaveAssets;

                                        if (!filteredOnLeaveAssets || filteredOnLeaveAssets.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={7} className="py-8 text-center text-gray-400 text-sm italic">
                                                        {selectedParkingEmployee ? 'No assets found for selected employee' : 'No On Leave Assets Found'}
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return filteredOnLeaveAssets.map((asset, index) => {
                                            const assignedObj = asset.assignedTo;
                                            const assignedEmpId = assignedObj?._id || assignedObj?.id || assignedObj;
                                            const canManageThisParkingAsset =
                                                isLoggedInAdmin ||
                                                isAssetController ||
                                                (isProfileOwner && assignedEmpId && String(assignedEmpId) === String(loggedInEmployeeId));

                                            return (
                                            <tr
                                                key={asset._id || index}
                                                className={`border-b border-gray-100 hover:bg-gray-50 group cursor-pointer transition-colors ${selectedOnLeaveAssets.includes(asset._id) ? 'bg-blue-50/50' : ''}`}
                                                onClick={() => router.push(`/HRM/Asset/details/${asset._id || asset.id}`)}
                                            >
                                                <td className="py-3 px-4 w-10" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                        checked={selectedOnLeaveAssets.includes(asset._id)}
                                                        disabled={!(isAssetController || isLoggedInAdmin)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedOnLeaveAssets(prev => [...prev, asset._id]);
                                                            } else {
                                                                setSelectedOnLeaveAssets(prev => prev.filter(id => id !== asset._id));
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-900 font-bold">
                                                    {asset.name || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {asset.assetId || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    <div className="flex flex-col">
                                                        <span>{asset.typeId?.name || asset.typeId?.type || '—'}</span>
                                                        <span className="text-xs text-gray-400">{asset.categoryId?.name || asset.categoryId?.category || ''}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    AED {asset.assetValue ? Number(asset.assetValue).toFixed(2) : '0.00'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">
                                                    {(() => {
                                                        // Handle both populated object and ObjectId string
                                                        const assignedToObj = asset.assignedTo;
                                                        if (assignedToObj && typeof assignedToObj === 'object' && assignedToObj.firstName) {
                                                            return (
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{assignedToObj.firstName} {assignedToObj.lastName}</span>
                                                                    <span className="text-xs text-gray-400">{assignedToObj.employeeId}</span>
                                                                </div>
                                                            );
                                                        } else if (assignedToObj) {
                                                            // If it's an ObjectId, we might need to fetch it, but for now show the ID
                                                            return <span className="text-xs text-gray-400">Employee ID: {assignedToObj.toString().substring(0, 8)}...</span>;
                                                        }
                                                        return '—';
                                                    })()}
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    {(() => {
                                                        let end = asset.onLeaveEndDate;
                                                        if (!end && asset.onLeaveStartDate && asset.onLeaveDuration) {
                                                            const start = new Date(asset.onLeaveStartDate);
                                                            end = new Date(start);
                                                            end.setDate(start.getDate() + parseInt(asset.onLeaveDuration));
                                                        }
                                                        
                                                        if (!end) return <span className="text-gray-400">—</span>;
                                                        
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        const target = new Date(end);
                                                        target.setHours(0, 0, 0, 0);
                                                        
                                                        const diffTime = target - today;
                                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                        
                                                        if (diffDays > 0) {
                                                            return (
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-emerald-600 font-black text-xs uppercase tracking-tight">{diffDays} Days Left</span>
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                    </div>
                                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-0.5">End: {formatDate(end)}</span>
                                                                </div>
                                                            );
                                                        }
                                                        if (diffDays === 0) {
                                                            return (
                                                                <div className="flex flex-col">
                                                                    <span className="text-amber-600 font-black uppercase tracking-tight text-xs flex items-center gap-1.5">
                                                                        Expires Today
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-0.5">{formatDate(end)}</span>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-rose-600 font-black text-xs uppercase tracking-tight">{Math.abs(diffDays)} Days Overdue</span>
                                                                    <AlertTriangle size={10} className="text-rose-500" />
                                                                </div>
                                                                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-tight mt-0.5">Expired: {formatDate(end)}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <button
                                                            onClick={() => {
                                                                setOnLeaveActionDialog({ isOpen: true, asset, action: 'Return' });
                                                            }}
                                                            disabled={!canManageThisParkingAsset || processingOnLeaveAction === asset._id}
                                                            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] font-black hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                            title="Return Asset (Status: Unassigned)"
                                                        >
                                                            <Undo2 size={12} />
                                                            Return
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setOnLeaveActionDialog({ isOpen: true, asset, action: 'OnDuty' });
                                                            }}
                                                            disabled={!canManageThisParkingAsset || processingOnLeaveAction === asset._id}
                                                            className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-black hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                            title="Set to On Duty (Status: Assigned)"
                                                        >
                                                            <CheckCircle2 size={12} />
                                                            On Duty
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedAssignAsset(asset);
                                                                setShowAssignModal(true);
                                                            }}
                                                            disabled={!canManageThisParkingAsset || processingOnLeaveAction === asset._id}
                                                            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                            title="Reassign Asset"
                                                        >
                                                            <ArrowRightLeft size={12} />
                                                            {(() => {
                                                                const end = asset.onLeaveEndDate ? new Date(asset.onLeaveEndDate) : null;
                                                                if (!end) return 'Reassign';
                                                                const today = new Date();
                                                                today.setHours(0, 0, 0, 0);
                                                                const target = new Date(end);
                                                                target.setHours(0, 0, 0, 0);
                                                                const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                                                                const safeDays = Number.isFinite(diffDays) ? diffDays : null;
                                                                if (safeDays == null) return 'Reassign';
                                                                const display = safeDays >= 0 ? safeDays : 0;
                                                                return `Reassign (${display}d)`;
                                                            })()}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setExtensionDays(1);
                                                                setOnLeaveActionDialog({ isOpen: true, asset, action: 'Extend' });
                                                            }}
                                                            disabled={!canManageThisParkingAsset || processingOnLeaveAction === asset._id}
                                                            className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-[10px] font-black hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                            title="Extend Parking Duration"
                                                        >
                                                            <Clock size={12} />
                                                            Extend
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )});
                                    })()}
                                </React.Fragment>
                            )}

                            {selectedSalaryAction === 'Assets' && isHR && assetSubTab === 'Company Assets' && (
                                <React.Fragment>
                                    {loadingCompanyAssets ? (
                                        <tr>
                                            <td colSpan={8} className="py-16 text-center text-gray-400 text-sm">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
                                                    <span>Loading company assets...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : !companyAssets || companyAssets.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-16 text-center text-gray-400 text-sm italic">
                                                No Company Assets Found
                                            </td>
                                        </tr>
                                    ) : (
                                        (() => {
                                            // Filter assets by selected company tab
                                            const filteredAssets = selectedCompanyTab 
                                                ? companyAssets.filter(asset => {
                                                    if (!asset.assignedCompany) return false;
                                                    const companyId = asset.assignedCompany._id || asset.assignedCompany.id || asset.assignedCompany;
                                                    return (companyId?.toString() === selectedCompanyTab?.toString());
                                                })
                                                : companyAssets;
                                            
                                            if (filteredAssets.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={8} className="py-16 text-center text-gray-400 text-sm italic">
                                                            {selectedCompanyTab ? 'No assets found for selected company' : 'No Company Assets Found'}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            
                                            return filteredAssets.map((asset, index) => (
                                                <tr 
                                                    key={asset._id || index} 
                                                    className="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer transition-colors"
                                                    onClick={() => router.push(`/HRM/Asset/details/${asset._id || asset.id}`)}
                                                >
                                                    <td className="py-3 px-4 text-sm text-gray-500 font-medium">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-slate-900 font-bold">{asset.name || '—'}</span>
                                                            {asset.assignedCompany && (
                                                                <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tight mt-0.5">
                                                                    {asset.assignedCompany.name || asset.assignedCompany}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500">
                                                        {asset.assetId || '—'}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500">
                                                        <div className="flex flex-col">
                                                            <span>{asset.typeId?.name || asset.typeId || '—'}</span>
                                                            <span className="text-xs text-gray-400">{asset.categoryId?.name || asset.categoryId || ''}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500">
                                                        AED {asset.assetValue ? Number(asset.assetValue).toFixed(2) : '0.00'}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500">
                                                        {asset.purchaseDate ? formatDate(asset.purchaseDate) : '—'}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${asset.status === 'Assigned' ? 'bg-indigo-100 text-indigo-700' :
                                                            asset.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                            {asset.status || 'Assigned'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => router.push(`/HRM/Asset/details/${asset._id || asset.id}`)}
                                                                className="text-blue-500 hover:text-blue-700 transition-colors p-1.5 hover:bg-blue-50 rounded-lg"
                                                                title="View Details"
                                                            >
                                                                <Monitor size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center gap-2">
                                                            {(() => {
                                                                // Helper function to extract ID from actionRequiredBy (handles ObjectId, string, or populated object)
                                                                const getActionRequiredById = (actionRequiredBy) => {
                                                                    if (!actionRequiredBy) return null;
                                                                    if (typeof actionRequiredBy === 'object' && actionRequiredBy._id) {
                                                                        return actionRequiredBy._id.toString();
                                                                    }
                                                                    return actionRequiredBy.toString();
                                                                };
                                                                
                                                                const actionRequiredById = getActionRequiredById(asset.actionRequiredBy);
                                                                const loggedInId = loggedInEmployeeId?.toString();
                                                                
                                                                // Show button ONLY if status is Pending AND actionRequiredBy matches logged-in EmployeeBasic ObjectId
                                                                // Also check if user is HR from flowchart
                                                                const shouldShowButton = asset.status === 'Pending' && 
                                                                                          actionRequiredById && 
                                                                                          loggedInId && 
                                                                                          actionRequiredById === loggedInId &&
                                                                                          isHR; // Only show if user is HR
                                                                
                                                                return shouldShowButton ? (
                                                                    <button
                                                                        onClick={() => window.location.href = `/HRM/Asset/details/${asset._id}?authAction=true`}
                                                                        className="px-3 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-black hover:bg-amber-600 transition-all shadow-sm flex items-center gap-1"
                                                                    >
                                                                        <CheckCircle2 size={12} />
                                                                        REVIEW APPROVAL
                                                                    </button>
                                                                ) : '—';
                                                            })()}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ));
                                        })()
                                    )}
                                </React.Fragment>
                            )}

                        </tbody>
                    </table>
                </div>
            </div>

            {/* Certificate Modal */}
            {
                showCertificate && selectedCertificate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        {/* Font Import for Certificate */}
                        <style jsx global>{`
                        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:wght@300;400;500;600&display=swap');
                    `}</style>

                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Award className="text-amber-500" size={20} />
                                    Reward Certificate
                                </h3>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleDownloadCertificate}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Download size={16} />
                                        Download PDF
                                    </button>
                                    <button
                                        onClick={() => setShowCertificate(false)}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body - Scrollable */}
                            <div className="flex-1 overflow-auto p-8 bg-gray-100 flex items-center justify-center">
                                {/* Certificate Reference Div for PDF Generation - Exact Replica of Reward Details Page */}
                                <div
                                    ref={certificateRef}
                                    id="certificate-container"
                                    className="bg-white relative w-[900px] h-[636px] shadow-2xl overflow-hidden flex flex-col justify-between shrink-0"
                                >
                                    <div className="absolute inset-0 z-0">
                                        <img
                                            src="/assets/certificate-bg-new.png"
                                            alt="Certificate Background"
                                            className="w-full h-full object-fill"
                                            crossOrigin="anonymous"
                                        />
                                    </div>

                                    <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-24 pt-20 pb-0 text-center">
                                        <h1 className="text-5xl font-semibold text-[#1a2e35] tracking-[0.1em] mb-2 uppercase font-sans" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {selectedCertificate.certHeader || 'Certificate'}
                                        </h1>
                                        <h2 className="text-2xl text-[#1a2e35] font-normal mb-4 tracking-wide" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {selectedCertificate.certSubHeader || 'Of Appreciation'}
                                        </h2>
                                        <p className="text-xs text-black uppercase tracking-widest mb-4" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                            {selectedCertificate.certPresentationText || 'This certificate is presented to'}
                                        </p>
                                        <div className="mb-6 w-full">
                                            <h3 className="text-5xl text-[#1a2e35] font-normal" style={{ fontFamily: '"Great Vibes", cursive' }}>
                                                {toTitleCase(selectedCertificate.employeeName || (employee ? `${employee.firstName} ${employee.lastName}` : ''))}
                                            </h3>
                                        </div>
                                        <div className="max-w-xl mx-auto space-y-3">
                                            <p className="text-base text-gray-600 leading-relaxed px-4" style={{ fontFamily: '"Montserrat", sans-serif' }}>
                                                {selectedCertificate.title || ''}
                                            </p>
                                            <div className="mt-2 space-y-1">
                                                {selectedCertificate.rewardType === 'Gift' && selectedCertificate.giftName && (
                                                    <p className="text-lg font-medium text-[#1a2e35]" style={{ fontFamily: '"Montserrat", sans-serif' }}>Gift: {selectedCertificate.giftName}</p>
                                                )}
                                                {/* Logic for amount if needed, though usually hidden on generic certs unless specific */}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-20 flex items-end justify-between px-36 pb-28 w-full">
                                        <div className="text-center">
                                            <p className="text-lg font-semibold text-[#1a2e35] mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>
                                                {getSigner1Name()}
                                            </p>
                                            <p className="text-lg font-medium uppercase tracking-wider text-[#1a2e35]" style={{ fontFamily: '"Playfair Display", serif' }}>
                                                {getSigner1Title()}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-center -mb-4">
                                            <img src="/assets/certificate-logo-v2.png" alt="Company Seal" className="w-60 h-32 object-contain" crossOrigin="anonymous" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-semibold text-[#1a2e35] mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>
                                                {selectedCertificate.certSigner2Name || 'Raseel Muhammad'}
                                            </p>
                                            <p className="text-lg uppercase tracking-wider text-[#1a2e35]" style={{ fontFamily: '"Playfair Display", serif' }}>
                                                {selectedCertificate.certSigner2Title || 'CEO'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Return Asset Modal */}
            {
                showReturnModal && selectedReturnAsset && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col justify-between">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-100">
                                        <Undo2 size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Return Asset</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Asset: {selectedReturnAsset.assetId} - {selectedReturnAsset.name}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowReturnModal(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                                {/* Asset Info Summary */}
                                <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-[24px] border border-slate-100">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Asset Type</label>
                                        <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                            {selectedReturnAsset.typeId?.name || selectedReturnAsset.typeId || '-'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Category</label>
                                        <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                            {selectedReturnAsset.categoryId?.name || selectedReturnAsset.categoryId || '-'}
                                        </div>
                                    </div>
                                </div>

                                {/* Return Action Info */}
                                <div className="bg-blue-50 border border-blue-100 rounded-[24px] p-6 space-y-2">
                                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block pl-1">
                                        Returning To
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-200 text-blue-700 flex items-center justify-center shadow-sm">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">
                                                {handoverTarget
                                                    ? `${handoverTarget.firstName} ${handoverTarget.lastName} (Handover User)`
                                                    : (selectedReturnAsset.assignedBy?.firstName
                                                        ? `${selectedReturnAsset.assignedBy.firstName} ${selectedReturnAsset.assignedBy.lastName} (Original Issuer)`
                                                        : "Asset Store / Admin")}
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                {handoverTarget
                                                    ? "Asset will be handed over to the designated successor."
                                                    : "Asset will be returned to the store or original issuer."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                                <button
                                    onClick={() => setShowReturnModal(false)}
                                    className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:border-slate-300 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitReturnAsset}
                                    disabled={isReturning}
                                    className="flex-[2] px-6 py-4 bg-amber-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-200 hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {isReturning ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <ArrowRightLeft size={18} strokeWidth={2.5} />
                                            Confirm
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Loss & Damage Modal */}
            <AddLossDamageModal
                isOpen={showDamageModal}
                onClose={() => {
                    setShowDamageModal(false);
                    setSelectedDamageAsset(null);
                }}
                onSuccess={() => {
                    // Refresh data - fetchEmployee will refresh all tabs including Assets and Fines
                    if (fetchEmployee) fetchEmployee();
                    setShowDamageModal(false);
                    setSelectedDamageAsset(null);
                }}
                employees={[employee]} // Pass current employee as the only option
                initialData={selectedDamageAsset ? {
                    assetId: selectedDamageAsset.assetId,
                    employeeId: employee.employeeId,
                    assignedEmployees: [{ employeeId: employee.employeeId }],
                    fineAmount: selectedDamageAsset.assetValue
                } : null}
            />

            {
                showAssignModal && selectedAssignAsset && (
                    <AssignAssetModal
                        isOpen={showAssignModal}
                        onClose={() => {
                            setShowAssignModal(false);
                            setSelectedAssignAsset(null);
                        }}
                        asset={selectedAssignAsset}
                        onUpdate={fetchEmployee}
                    />
                )
            }

            <AssetCheckboxAssignModal
                isOpen={isBulkAssignModalOpen}
                onClose={() => setIsBulkAssignModalOpen(false)}
                selectedAssets={assetControllerTrulyUnassigned.filter((a) =>
                    selectedUnassignedAssets.some((id) => String(id) === String(a._id || a.id))
                )}
                onUpdate={() => {
                    setSelectedUnassignedAssets([]);
                    refetchAssetControllerUnassigned();
                }}
            />

            {/* Asset History Modal */}
            {
                showHistoryModal && selectedHistoryAsset && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                                        <History size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Asset History</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            ID: {selectedHistoryAsset.assetId} - {selectedHistoryAsset.name}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowHistoryModal(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-8 overflow-y-auto flex-1 bg-slate-50/30">
                                {loadingHistory ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading history...</p>
                                    </div>
                                ) : assetHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                            <History size={32} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-400">No history records found for this asset.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {assetHistory.map((entry, idx) => (
                                            <div key={idx} className="relative pl-10">
                                                {/* Timeline Line */}
                                                {idx !== assetHistory.length - 1 && (
                                                    <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-slate-200"></div>
                                                )}

                                                {/* Timeline Node */}
                                                <div className={`absolute left-0 top-1 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm z-10 ${entry.action?.toLowerCase().includes('assign') ? 'bg-indigo-600 text-white' :
                                                    entry.action?.toLowerCase().includes('accept') ? 'bg-emerald-500 text-white' :
                                                        entry.action?.toLowerCase().includes('return') ? 'bg-amber-500 text-white' :
                                                            entry.action?.toLowerCase().includes('reject') ? 'bg-rose-500 text-white' :
                                                                'bg-slate-600 text-white'
                                                    }`}>
                                                    {entry.action?.toLowerCase().includes('assign') ? <UserPlus size={20} /> :
                                                        entry.action?.toLowerCase().includes('accept') ? <CheckCircle2 size={20} /> :
                                                            entry.action?.toLowerCase().includes('return') ? <ArrowRightLeft size={20} /> :
                                                                entry.action?.toLowerCase().includes('reject') ? <XCircle size={20} /> :
                                                                    <Clock size={20} />}
                                                </div>

                                                {/* Content Card */}
                                                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-blue-200 transition-all">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            {formatDate(entry.createdAt)}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${entry.action?.toLowerCase().includes('assign') ? 'bg-indigo-50 text-indigo-600' :
                                                            entry.action?.toLowerCase().includes('accept') ? 'bg-emerald-50 text-emerald-600' :
                                                                entry.action?.toLowerCase().includes('return') ? 'bg-amber-50 text-amber-600' :
                                                                    entry.action?.toLowerCase().includes('reject') ? 'bg-rose-50 text-rose-600' :
                                                                        'bg-slate-50 text-slate-600'
                                                            }`}>
                                                            {entry.action}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-800 mb-1">
                                                        {entry.message}
                                                    </h4>
                                                    {entry.performedBy && (
                                                        <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                                                            <User size={12} className="text-slate-400" />
                                                            By: <span className="text-slate-700 font-bold">{entry.performedBy.firstName} {entry.performedBy.lastName}</span>
                                                        </p>
                                                    )}
                                                    {entry.comments && (
                                                        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 italic text-xs text-slate-600">
                                                            "{entry.comments}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="px-8 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Handover Form Modal */}
            <HandoverFormModal
                isOpen={showHandoverModal}
                onClose={() => {
                    setShowHandoverModal(false);
                    setSelectedHandoverAsset(null);
                }}
                asset={selectedHandoverAsset}
                employee={employee}
            />

            {/* Confirmation Dialog */}
            <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, isOpen: false })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to {confirmDialog.action === 'Accept' ? 'accept' : 'reject'} this asset assignment?
                            {confirmDialog.action === 'Accept' && " By accepting, you acknowledge receipt and responsibility for this asset."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                executeRespondToAsset();
                            }}
                            className={confirmDialog.action === 'Accept' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}
                        >
                            {confirmDialog.action === 'Accept' ? 'Accept' : 'Reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            {/* On Leave Action Confirmation Dialog */}
            <AlertDialog open={onLeaveActionDialog.isOpen} onOpenChange={(open) => !open && setOnLeaveActionDialog({ isOpen: false, asset: null, action: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {onLeaveActionDialog.action === 'TransferBulk'
                                ? 'Bulk parking transfer'
                                : onLeaveActionDialog.action === 'OnDutyBulk'
                                  ? 'Bulk set to On Duty'
                                  : onLeaveActionDialog.action === 'Extend'
                                    ? 'Extend Parking Duration'
                                    : onLeaveActionDialog.action === 'Return' || onLeaveActionDialog.action === 'ReturnBulk'
                                      ? 'Return Asset'
                                      : 'Set Asset to On Duty'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {onLeaveActionDialog.action === 'TransferBulk' ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-600">
                                        Apply a <strong>Leave / parking</strong> transfer for{' '}
                                        <strong>{selectedOnLeaveAssets.length}</strong> selected asset(s). This sends the same{' '}
                                        <strong>Leave</strong> request as the asset transfer flow (with duration in days), in one
                                        bulk call.
                                    </p>
                                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">
                                                Parking duration (days, 1–30)
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={30}
                                                value={bulkParkingTransferDuration}
                                                onChange={(e) => {
                                                    const raw = e.target.value;
                                                    if (raw === '') {
                                                        setBulkParkingTransferDuration('');
                                                        return;
                                                    }
                                                    const v = parseInt(raw, 10);
                                                    if (Number.isNaN(v)) return;
                                                    setBulkParkingTransferDuration(String(Math.min(30, Math.max(1, v))));
                                                }}
                                                className="w-full px-4 py-2 border border-amber-200 rounded-xl text-sm font-bold text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                            />
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-amber-700 font-black shadow-sm mt-5 text-xs">
                                            {bulkParkingTransferDuration ? `${bulkParkingTransferDuration}d` : '—'}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 italic">
                                        Asset Controller requests are processed like a normal transfer; duration must be between 1 and 30
                                        days.
                                    </p>
                                </div>
                            ) : onLeaveActionDialog.action === 'Extend' ? (
                                <div className="space-y-4">
                                    <p>
                                        How many DAYS would you like to EXTEND the parking for asset <strong>{onLeaveActionDialog.asset?.assetId}</strong>?
                                    </p>
                                    <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Extension Days (Max 10)</label>
                                            <input 
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={extensionDays}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (!isNaN(val)) setExtensionDays(Math.min(10, Math.max(1, val)));
                                                }}
                                                className="w-full px-4 py-2 border border-indigo-200 rounded-xl text-sm font-bold text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 font-black shadow-sm mt-5">
                                            +{extensionDays}d
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 italic">
                                        The asset's end date will be extended by {extensionDays} days from its current end date.
                                    </p>
                                </div>
                            ) : (onLeaveActionDialog.action === 'Return' || onLeaveActionDialog.action === 'ReturnBulk') ? (
                                <>
                                    Are you sure you want to RETURN <strong>{onLeaveActionDialog.asset?.assetId}</strong>?
                                    <br /><br />
                                    This will mark the selected asset(s) as <strong>Unassigned</strong> and they will appear in the Unassigned Assets section.
                                </>
                            ) : (
                                <>
                                    Are you sure you want to set <strong>{onLeaveActionDialog.asset?.assetId}</strong> to <strong>ON DUTY</strong>?
                                    <br /><br />
                                    {onLeaveActionDialog.action === 'OnDutyBulk' ? (
                                        <>
                                            This will mark the selected assets as <strong>Assigned</strong> back to their previous assigned employees.
                                        </>
                                    ) : (
                                        <>
                                            {onLeaveActionDialog.asset?.assignedTo ? (
                                                <>
                                                    This will mark the asset as <strong>Assigned</strong> to{' '}
                                                    <strong>
                                                        {onLeaveActionDialog.asset.assignedTo.firstName} {onLeaveActionDialog.asset.assignedTo.lastName}
                                                    </strong> (the previous assigned employee).
                                                </>
                                            ) : (
                                                <>
                                                    This will mark the asset as <strong>Assigned</strong> to the previous assigned employee.
                                                    <br />
                                                    <span className="text-amber-600 font-semibold">Note: If no previous employee is found, the operation will fail.</span>
                                                </>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async (e) => {
                                e.preventDefault();
                                const { asset, action } = onLeaveActionDialog;
                                if (!asset) return;

                                if (action === 'TransferBulk') {
                                    const d = parseInt(String(bulkParkingTransferDuration || '').trim(), 10);
                                    if (!Number.isInteger(d) || d < 1 || d > 30) {
                                        toast({
                                            variant: 'destructive',
                                            title: 'Invalid duration',
                                            description: 'Enter a parking duration between 1 and 30 days.'
                                        });
                                        return;
                                    }
                                    if (!selectedOnLeaveAssets.length) return;
                                    try {
                                        setProcessingOnLeaveAction(asset._id);
                                        const reasonText = `Leave duration: ${d} days`;
                                        await axiosInstance.put('/AssetItem/bulk/request-action', {
                                            assetIds: selectedOnLeaveAssets.map((id) => String(id)),
                                            actionType: 'Leave',
                                            reason: reasonText,
                                            duration: d,
                                            leaveDuration: d
                                        });
                                        toast({
                                            title: 'Success',
                                            description: `Leave / parking transfer submitted for ${selectedOnLeaveAssets.length} asset(s).`
                                        });
                                        setSelectedOnLeaveAssets([]);
                                        if (fetchEmployee) fetchEmployee();
                                        const onLeaveRes = await axiosInstance
                                            .get(`/AssetItem/on-leave/controller/${employee.employeeId}`, { skipToast: true })
                                            .catch(() => null);
                                        if (onLeaveRes?.status === 200) {
                                            setOnLeaveAssets(onLeaveRes.data.items || []);
                                        }
                                        setOnLeaveActionDialog({ isOpen: false, asset: null, action: null });
                                    } catch (error) {
                                        console.error('Bulk parking transfer failed:', error);
                                        toast({
                                            variant: 'destructive',
                                            title: 'Error',
                                            description: error.response?.data?.message || 'Bulk transfer failed.'
                                        });
                                    } finally {
                                        setProcessingOnLeaveAction(null);
                                    }
                                    return;
                                }

                                const isBulk = action === 'ReturnBulk' || action === 'OnDutyBulk';
                                const assetIdsToProcess = isBulk ? selectedOnLeaveAssets : [asset._id];

                                try {
                                    setProcessingOnLeaveAction(asset._id);
                                    
                                    if (isBulk) {
                                        await axiosInstance.put(`/AssetItem/bulk/on-leave-action`, {
                                            assetIds: assetIdsToProcess,
                                            action: action === 'ReturnBulk' ? 'Return' : 'OnDuty'
                                        });
                                    } else {
                                        await axiosInstance.put(`/AssetItem/${asset._id}/on-leave-action`, {
                                            action: action === 'Return' ? 'Return' : (action === 'Extend' ? 'Extend' : 'OnDuty'),
                                            extensionDays: action === 'Extend' ? extensionDays : undefined
                                        });
                                    }

                                    toast({
                                        title: "Success",
                                        description: action.includes('Return') 
                                            ? `${isBulk ? `${assetIdsToProcess.length} assets have` : `Asset ${asset.assetId} has`} been returned and marked as Unassigned.`
                                            : action === 'Extend'
                                            ? `Asset ${asset.assetId} parking duration has been extended by ${extensionDays} days.`
                                            : `${isBulk ? `${assetIdsToProcess.length} assets have` : `Asset ${asset.assetId} has`} been set to On Duty.`
                                    });
                                    
                                    // Reset selection if bulk was successful
                                    if (isBulk) setSelectedOnLeaveAssets([]);

                                    // Refresh data
                                    if (fetchEmployee) fetchEmployee();
                                    // Refresh on-leave assets
                                    const onLeaveRes = await axiosInstance.get(`/AssetItem/on-leave/controller/${employee.employeeId}`, {
                                        skipToast: true
                                    }).catch(() => null);
                                    if (onLeaveRes && onLeaveRes.status === 200) {
                                        setOnLeaveAssets(onLeaveRes.data.items || []);
                                    }
                                    setOnLeaveActionDialog({ isOpen: false, asset: null, action: null });
                                } catch (error) {
                                    console.error(`Error ${action === 'Return' ? 'returning' : (action === 'Extend' ? 'extending' : 'setting on duty')} on-leave asset:`, error);
                                    toast({
                                        variant: "destructive",
                                        title: "Error",
                                        description: error.response?.data?.message || `Failed to process action`
                                    });
                                } finally {
                                    setProcessingOnLeaveAction(null);
                                }
                            }}
                            disabled={processingOnLeaveAction === onLeaveActionDialog.asset?._id}
                            className={
                                onLeaveActionDialog.action === 'TransferBulk'
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                    : (onLeaveActionDialog.action || '').includes('Return')
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                      : onLeaveActionDialog.action === 'Extend'
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }
                        >
                            {processingOnLeaveAction === onLeaveActionDialog.asset?._id
                                ? 'Processing...'
                                : onLeaveActionDialog.action === 'TransferBulk'
                                  ? 'Submit transfer'
                                  : (onLeaveActionDialog.action || '').includes('Return')
                                    ? 'Return'
                                    : onLeaveActionDialog.action === 'Extend'
                                      ? 'Extend'
                                      : 'Set to On Duty'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Your Assets — bulk actions (same pattern as Parking: show only when selected; confirm then direct API) */}
            <AlertDialog
                open={yourAssetsBulkDialog.isOpen}
                onOpenChange={(open) => !open && setYourAssetsBulkDialog({ isOpen: false, kind: null })}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {yourAssetsBulkDialog.kind === 'return' && 'Bulk return'}
                            {yourAssetsBulkDialog.kind === 'leave' && 'Bulk transfer (leave / parking)'}
                            {yourAssetsBulkDialog.kind === 'endOfServices' && 'Bulk end of services'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {yourAssetsBulkDialog.kind === 'return' && (
                                <>
                                    Return <strong>{selectedYourAssets.length}</strong> selected asset(s)? If you are the assignee,
                                    this may send one return request to the Asset Controller; otherwise each asset is processed
                                    separately.
                                </>
                            )}
                            {yourAssetsBulkDialog.kind === 'leave' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-600">
                                        Send a <strong>Leave</strong> (parking) request for{' '}
                                        <strong>{selectedYourAssets.length}</strong> asset(s), same API as the asset transfer flow.
                                    </p>
                                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">
                                                Duration (days, 1–30)
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={30}
                                                value={yourAssetsBulkLeaveDuration}
                                                onChange={(e) => {
                                                    const raw = e.target.value;
                                                    if (raw === '') {
                                                        setYourAssetsBulkLeaveDuration('');
                                                        return;
                                                    }
                                                    const v = parseInt(raw, 10);
                                                    if (Number.isNaN(v)) return;
                                                    setYourAssetsBulkLeaveDuration(
                                                        String(Math.min(30, Math.max(1, v)))
                                                    );
                                                }}
                                                className="w-full px-4 py-2 border border-amber-200 rounded-xl text-sm font-bold text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                            />
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-amber-700 font-black shadow-sm mt-5 text-xs">
                                            {yourAssetsBulkLeaveDuration ? `${yourAssetsBulkLeaveDuration}d` : '—'}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {yourAssetsBulkDialog.kind === 'endOfServices' && (
                                <>
                                    Submit <strong>End of Services</strong> for <strong>{selectedYourAssets.length}</strong>{' '}
                                    selected asset(s)? This uses the same bulk request as the asset module (return to store flow).
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processingYourAssetsBulk}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={processingYourAssetsBulk}
                            onClick={async (e) => {
                                e.preventDefault();
                                const kind = yourAssetsBulkDialog.kind;
                                const ids = selectedYourAssets.map(String);
                                if (!kind || ids.length === 0) return;

                                if (kind === 'leave') {
                                    const d = parseInt(String(yourAssetsBulkLeaveDuration || '').trim(), 10);
                                    if (!Number.isInteger(d) || d < 1 || d > 30) {
                                        toast({
                                            variant: 'destructive',
                                            title: 'Invalid duration',
                                            description: 'Enter a duration between 1 and 30 days.'
                                        });
                                        return;
                                    }
                                }

                                setProcessingYourAssetsBulk(true);
                                try {
                                    if (kind === 'return') {
                                        const assigneeSelf =
                                            loggedInEmployeeId &&
                                            employee?._id &&
                                            String(loggedInEmployeeId) === String(employee._id);
                                        const primary = ids[0];
                                        if (assigneeSelf) {
                                            if (ids.length > 1) {
                                                await axiosInstance.put(`/AssetItem/${primary}/return`, {
                                                    bulkAssetIds: ids
                                                });
                                            } else {
                                                await axiosInstance.put(`/AssetItem/${primary}/return`, {});
                                            }
                                        } else {
                                            for (const id of ids) {
                                                await axiosInstance.put(`/AssetItem/${id}/return`, {});
                                            }
                                        }
                                        toast({
                                            title: 'Success',
                                            description: assigneeSelf
                                                ? ids.length > 1
                                                    ? 'Return request sent to the Asset Controller for the selected assets.'
                                                    : 'Return request sent to the Asset Controller.'
                                                : `Return processed for ${ids.length} asset(s).`
                                        });
                                    } else if (kind === 'leave') {
                                        const d = parseInt(String(yourAssetsBulkLeaveDuration || '').trim(), 10);
                                        await axiosInstance.put('/AssetItem/bulk/request-action', {
                                            assetIds: ids,
                                            actionType: 'Leave',
                                            reason: `Leave duration: ${d} days`,
                                            duration: d,
                                            leaveDuration: d
                                        });
                                        toast({
                                            title: 'Success',
                                            description: `Leave request sent for ${ids.length} asset(s).`
                                        });
                                    } else if (kind === 'endOfServices') {
                                        await axiosInstance.put('/AssetItem/bulk/request-action', {
                                            assetIds: ids,
                                            actionType: 'End of Services',
                                            reason: 'End of Services return requested'
                                        });
                                        toast({
                                            title: 'Success',
                                            description: `End of Services request sent for ${ids.length} asset(s).`
                                        });
                                    }
                                    setSelectedYourAssets([]);
                                    setYourAssetsBulkDialog({ isOpen: false, kind: null });
                                    if (fetchEmployee) fetchEmployee();
                                } catch (err) {
                                    toast({
                                        variant: 'destructive',
                                        title: 'Error',
                                        description:
                                            err.response?.data?.message || 'Bulk action failed. Try again or pick fewer items.'
                                    });
                                } finally {
                                    setProcessingYourAssetsBulk(false);
                                }
                            }}
                            className={
                                yourAssetsBulkDialog.kind === 'return'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : yourAssetsBulkDialog.kind === 'leave'
                                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }
                        >
                            {processingYourAssetsBulk
                                ? 'Processing…'
                                : yourAssetsBulkDialog.kind === 'return'
                                  ? 'Confirm return'
                                  : yourAssetsBulkDialog.kind === 'leave'
                                    ? 'Submit transfer'
                                    : 'Submit'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Invoice Viewer Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="text-blue-600" size={20} />
                                Payment Invoice
                            </h3>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-100/50">
                            <PaymentReceipt payment={selectedInvoice} />
                        </div>
                        <div className="p-6 bg-white border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}



