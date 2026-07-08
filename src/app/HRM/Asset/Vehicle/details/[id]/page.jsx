'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense, startTransition } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import { navigateFromList } from '@/utils/listReturnNavigation';
import ListReturnBackButton from '@/components/ListReturnBackButton';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import {
    ArrowLeft,
    Truck,
    Car,
    ShieldCheck,
    AlertCircle,
    FileText,
    PencilLine,
    Download,
    ExternalLink,
    Smartphone,
    UserPlus,
    Printer,
    Calendar,
    Gauge,
    User,
    ArrowRight,
    Receipt,
    PenTool,
    AlertTriangle,
    Settings,
    Fuel,
    Palette,
    Tag,
    DollarSign,
    Building2,
    Shield,
    CalendarCheck,
    Eye,
    PlusCircle,
    ChevronDown,
    XCircle,
    RefreshCw,
    Plus,
    CreditCard,
    Trash2,
    Loader2,
    Undo2,
    ArrowRightLeft,
    X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotificationFocusScroll } from '@/hooks/useNotificationFocusScroll';
import { ASSET_FOCUS_PREFIX } from '@/utils/assetNotificationRouting';
import DocumentViewerModal from '@/app/emp/[employeeId]/components/modals/DocumentViewerModal';
import { resolveAttachmentForViewer } from '@/utils/attachmentPreview';
import { isAdmin as checkIsAdmin, hasPermission, parseStoredSessionUser } from '@/utils/permissions';
import {
    canAccessVehicleDetailsPage,
    vehicleCardCrud,
    vehicleDocumentInnerTabVisible,
    vehiclePermitCardCrud,
    vehicleTabCrud,
    vehicleTabVisible,
} from '../../utils/vehiclePermissionAccess';
import {
    buildAssetActionUser,
    resolveAdminInCompanyFlowchart,
} from '../../../utils/canPerformAssetAction';
import AssignAssetModal from '../../../components/AssignAssetModal';
import HandoverFormModal from '../../../components/HandoverFormModal';
import VehicleGeneralDocumentModal from '../../components/VehicleGeneralDocumentModal';
import EditVehicleBasicDetailsModal from '../../components/EditVehicleBasicDetailsModal';


import VehicleRegistrationModal from '../../components/VehicleRegistrationModal';
import VehicleInsuranceModal from '../../components/VehicleInsuranceModal';
import VehicleWarrantyModal from '../../components/VehicleWarrantyModal';
import VehiclePermitModal from '../../components/VehiclePermitModal';
import VehiclePetrolModal from '../../components/VehiclePetrolModal';
import VehicleTollModal from '../../components/VehicleTollModal';
import VehicleMortgageModal from '../../components/VehicleMortgageModal';
import VehicleMortgageCloseModal from '../../components/VehicleMortgageCloseModal';
import VehicleAssetHistoryTab from '../../components/VehicleAssetHistoryTab';
import VehicleAssetProfileHeader from '../../components/VehicleAssetProfileHeader';
import VehicleActivationSubmitModal from '../../components/VehicleActivationSubmitModal';
import VehicleProfileEditSubmitModal from '../../components/VehicleProfileEditSubmitModal';
import VehicleProfileActivationReviewModal from '../../components/VehicleProfileActivationReviewModal';
import {
    computeVehicleProfileCompletionPercent,
    getVehicleBrandLabel,
    VEHICLE_PROFILE_ACTIVATION_SECTION_IDS,
} from '../../lib/vehicleProfileCompletion';
import { saveVehicleSectionOrQueue, hasVehicleProfileEditQueue } from '../../lib/vehicleProfileEditOps';
import {
    buildNotRenewProposedRows,
    buildVehicleProfileEditSnapshots,
} from '../../lib/vehicleProfileEditSnapshots';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import VehicleDispositionRequestModal from '../../components/VehicleDispositionRequestModal';
import VehicleDispositionReviewModal from '../../components/VehicleDispositionReviewModal';
import VehicleExpirySummaryCard from '../../components/VehicleExpirySummaryCard';
import {
    evaluateVehicleHandoverCardActions,
    isVehicleProfileActiveForAssignment,
    isVehicleActivelyAssigned,
    isCurrentUserVehicleAssignee,
} from '../../utils/evaluateVehicleFleetHeaderActions';
import {
    normVehicleDocType,
    vehicleDocDateKey,
    registrationAttachmentsForDoc,
    insuranceAttachmentsForDoc,
    warrantyAttachmentsForDoc,
    permitAttachmentsForDoc,
    isInsuranceInvoiceAttachmentLabel,
    groupRegistrationDocumentRows,
    groupInsuranceDocumentRows,
    groupWarrantyDocumentRows,
    groupPermitDocumentRows,
    relatedVehicleDocumentsForCard,
    syncVehicleDocumentAttachmentBuckets,
} from '../../utils/vehicleDocumentCardRows';
import {
    resolveLiveRegistrationDoc,
    resolveLiveInsuranceDoc,
    resolveLiveWarrantyDoc,
    resolveVehicleExpirySources,
} from '../../utils/vehicleExpirySources';
import VehicleServiceModal from '../../components/VehicleServiceModal';
import VehicleCarWashRequestModal from '../../components/VehicleCarWashRequestModal';
import VehicleCarWashRequestTable from '../../components/VehicleCarWashRequestTable';
import VehicleOilServiceRequestTable from '../../components/VehicleOilServiceRequestTable';
import VehicleServiceTabRequestTable from '../../components/VehicleServiceTabRequestTable';
import VehicleHandoverHistoryTable from '../../components/VehicleHandoverHistoryTable';
import { isSameHandoverAssignee } from '../../utils/vehicleHandoverHistory';
import VehicleAccessoriesListTab from '../../components/VehicleAccessoriesListTab';
import {
    VEHICLE_SERVICE_TYPES,
    buildOilServiceDraftRequestBody,
    buildOilServiceRequestRowsFromAsset,
    buildCarWashRequestRowsFromAsset,
    findOpenOilServiceDraft,
    findOpenVehicleServiceTabDraft,
    buildVehicleServiceTabPendingRequestBody,
    buildVehicleServiceTabRequestRowsFromAsset,
    isVehicleServiceTabRequestType,
    fleetServicesForTypeSortedDesc,
    serviceCountByType,
    vehicleServiceDetailPath,
    vehicleServiceTypeKey,
    normalizeMongoId,
} from '../../components/vehicleServiceUtils';
import { canUserManageOilService } from '../../utils/vehicleOilServiceAccess';
import {
    canUserManageCarWash,
    canUserValidateCarWashAccounts,
} from '../../utils/vehicleCarWashAccess';
import { canAdminDeleteActivatedVehicleRecord } from '../../utils/vehicleAdminDeleteAccess';
import { parseServiceRemark } from '../../components/vehicleServicePayload';
import { vehicleAssetStatusBadgeClass } from '../../components/vehicleAssetStatusUi';
import AddVehicleFineModal from '@/app/HRM/Fine/components/AddVehicleFineModal';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';

function fleetServiceWorkflowLabel(srv) {
    const st = String(srv?.workflowSnapshot?.stage || '').trim();
    if (st) return st.replace(/_/g, ' ');
    const r = parseServiceRemark(srv?.remark);
    const w = String(r?.workflowStage || r?.stage || '').trim();
    return w ? w.replace(/_/g, ' ') : '';
}

/** PDF/image URLs on a service subdocument for View rows (Insurance-style footer). */
function fleetServiceAttachmentRows(srv) {
    if (!srv) return [];
    const out = [];
    const add = (url, label) => {
        const u = url && String(url).trim();
        if (u) out.push({ label, url: u });
    };
    add(srv.attachment, 'Primary attachment');
    add(srv.invoice, 'Invoice');
    add(srv.shopInvoice, 'Shop invoice');
    add(srv.serviceCompletionReport, 'Service report');
    add(srv.quotation2, 'Quotation 2');
    add(srv.quotation3, 'Quotation 3');
    return out;
}

const getInitials = (name) => {
    if (!name) return 'AS';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
};

const getAssetApproverDisplayName = (asset) => {
    if (!asset) return '';

    // If there is an active pending action (like EOL or Loss & Damage), the approver is actionRequiredBy.
    if (asset.pendingAction) {
        const ar = asset.actionRequiredBy;
        if (ar && typeof ar === 'object') {
            const n = `${ar.firstName || ''} ${ar.lastName || ''}`.trim();
            if (n) return n;
            if (ar.employeeId) return String(ar.employeeId);
        }
        const ac = asset.assetController;
        if (ac && typeof ac === 'object') {
            const n = `${ac.firstName || ''} ${ac.lastName || ''}`.trim();
            if (n) return n;
            if (ac.employeeId) return String(ac.employeeId);
        }
        return '';
    }

    // Prefer the current role holder (HR for fleet vehicles, AC for tools) so the banner stays
    // correct after a flowchart swap. Fall back to the stored approver, then to the legacy AC field.
    const ca = asset.creationApprover;
    if (ca && typeof ca === 'object') {
        const n = `${ca.firstName || ''} ${ca.lastName || ''}`.trim();
        if (n) return n;
        if (ca.employeeId) return String(ca.employeeId);
    }
    const ar = asset.actionRequiredBy;
    if (ar && typeof ar === 'object') {
        const n = `${ar.firstName || ''} ${ar.lastName || ''}`.trim();
        if (n) return n;
        if (ar.employeeId) return String(ar.employeeId);
    }
    const ac = asset.assetController;
    if (ac && typeof ac === 'object') {
        const n = `${ac.firstName || ''} ${ac.lastName || ''}`.trim();
        if (n) return n;
        if (ac.employeeId) return String(ac.employeeId);
    }
    return '';
};

const normEmpId = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');

/** Sections included when HR accepts a vehicle profile activation request. */
function computeVehicleActivationApprovedSectionsPayload(asset) {
    if (!asset) return [];
    const raw = Array.isArray(asset?.vehicleProfileActivationSections) ? asset.vehicleProfileActivationSections : [];
    const allowed = new Set(VEHICLE_PROFILE_ACTIVATION_SECTION_IDS);
    const fromRequest = [...new Set(raw.map((s) => String(s || '').trim()).filter((s) => allowed.has(s)))];
    return fromRequest.length ? fromRequest : [...VEHICLE_PROFILE_ACTIVATION_SECTION_IDS];
}

const normFlowchartCategoryKey = (c) => String(c || '').toLowerCase().trim();

/** Same priority as backend getDepartmentHOD('admincontroller'): Settings "Admin" row first. */
function pickVehicleProfileHrFlowchartRow(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const active = list.filter((r) => String(r?.status || '').trim() === 'Active');
    return active.find((r) => normFlowchartCategoryKey(r.category).replace(/\s+/g, '') === 'hr') || null;
}

/** Accounts / finance row — aligned with backend getDepartmentHOD aliases. */
function pickAccountsFlowchartRow(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const active = list.filter((r) => String(r?.status || '').trim() === 'Active');
    return (
        active.find((r) => normFlowchartCategoryKey(r.category).replace(/\s+/g, '') === 'accounts') ||
        active.find((r) => normFlowchartCategoryKey(r.category).replace(/\s+/g, '') === 'finance') ||
        null
    );
}

function pickManagementFlowchartRow(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const active = list.filter((r) => String(r?.status || '').trim() === 'Active');
    return active.find((r) => normFlowchartCategoryKey(r.category).replace(/\s+/g, '') === 'management') || null;
}

function pickVehicleProfileAdminFlowchartRow(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const active = list.filter((r) => String(r?.status || '').trim() === 'Active');
    const pick = (re) => active.find((r) => re.test(normFlowchartCategoryKey(r.category)));
    return (
        pick(/^admin$/) ||
        pick(/^administrator$/) ||
        active.find((r) => normFlowchartCategoryKey(r.category).replace(/\s+/g, '') === 'admincontroller') ||
        active.find((r) => {
            const k = normFlowchartCategoryKey(r.category).replace(/\s+/g, '');
            return k.includes('admin') && k.includes('controller');
        }) ||
        null
    );
}

function flowchartAdminRowMatchesUser(row, userData) {
    if (!row || !userData) return false;
    const empRef = row.empObjectId;
    const empMongo = typeof empRef === 'object' && empRef ? empRef._id || empRef.id : empRef;
    const myEmpObj = userData.employeeObjectId;
    const myEmployeeDocId = userData._id || userData.id;
    if (empMongo) {
        const em = String(empMongo);
        if (myEmpObj && em === String(myEmpObj)) return true;
        if (myEmployeeDocId && em === String(myEmployeeDocId)) return true;
    }
    const rowCode = normEmpId(row.employeeId || (typeof empRef === 'object' && empRef?.employeeId) || '');
    const myCode = normEmpId(userData.employeeId || '');
    if (rowCode && myCode && rowCode === myCode) return true;
    return false;
}

function displayNameFromVehicleAdminFlowchartRow(row) {
    if (!row) return '';
    const pop = row.empObjectId;
    if (pop && typeof pop === 'object') {
        const n = `${pop.firstName || ''} ${pop.lastName || ''}`.trim();
        if (n) return n;
        if (pop.employeeId) return String(pop.employeeId).trim();
    }
    const n2 = String(row.employeeName || '').trim();
    if (n2) return n2;
    return String(row.employeeId || '').trim();
}

function VehicleDetailsPageContent() {
    const router = useRouter();
    const handleListReturnBack = useListReturnBack();
    const params = useParams();
    const searchParams = useSearchParams();
    const assetId = params.id;
    const { toast } = useToast();
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [permissionsMounted, setPermissionsMounted] = useState(false);
    const isAdmin = permissionsMounted && (
        checkIsAdmin() ||
        hasPermission('hrm_asset', 'isDelete')
    );
    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const fetchAssetDetailsTicketRef = useRef(0);
    const [creationDecisionBusy, setCreationDecisionBusy] = useState(null);
    const [imageError, setImageError] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [showVehicleActivationModal, setShowVehicleActivationModal] = useState(false);
    const [showVehicleProfileEditSubmitModal, setShowVehicleProfileEditSubmitModal] = useState(false);
    const [vehicleProfileEditModalReadOnly, setVehicleProfileEditModalReadOnly] = useState(false);
    const [showVehicleActivationReviewModal, setShowVehicleActivationReviewModal] = useState(false);
    const [showVehicleGeneralDocModal, setShowVehicleGeneralDocModal] = useState(false);
    const [vehicleGeneralDoc, setVehicleGeneralDoc] = useState(null);
    const [vehicleGeneralDocRenew, setVehicleGeneralDocRenew] = useState(false);
    const [docToDelete, setDocToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [docToNotRenew, setDocToNotRenew] = useState(null);
    const [notRenewLoading, setNotRenewLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('basic'); // basic | permit | mortgage | petrolToll | service | fine | handover | history | document
    // Registration / Insurance / Warranty are shown as cards (employee profile style).
    const [assetHistory, setAssetHistory] = useState([]);
    const [loadingHandoverHistory, setLoadingHandoverHistory] = useState(false);
    const [isDownloadingHandoverHistoryPdf, setIsDownloadingHandoverHistoryPdf] = useState('');
    const [fines, setFines] = useState([]);
    const [loadingFines, setLoadingFines] = useState(false);
    const [viewingDocument, setViewingDocument] = useState(null);
    const openFilePreview = useCallback(async (attachment, label = 'Attachment') => {
        setViewingDocument({ data: '', name: label, mimeType: 'application/pdf', loading: true });
        const resolved = await resolveAttachmentForViewer(attachment, { name: label });
        if (!resolved || resolved.error) {
            setViewingDocument(null);
            if (resolved?.error) {
                toast({ variant: 'destructive', title: 'Cannot open attachment', description: resolved.error });
            }
            return;
        }
        setViewingDocument({ ...resolved, loading: false });
    }, [toast]);
    const [hasAssetController, setHasAssetController] = useState(true);
    const [isAssetController, setIsAssetController] = useState(false);
    const [companyResponsibilities, setCompanyResponsibilities] = useState([]);
    const [isFlowchartAdminController, setIsFlowchartAdminController] = useState(false);
    const [isFlowchartHr, setIsFlowchartHr] = useState(false);
    const [isFlowchartAccounts, setIsFlowchartAccounts] = useState(false);
    const [isFlowchartManagement, setIsFlowchartManagement] = useState(false);
    const [vehicleProfileActivationFlowchartAdminName, setVehicleProfileActivationFlowchartAdminName] = useState('');
    const [vehicleProfileActivationHrName, setVehicleProfileActivationHrName] = useState('');
    const [showDispositionRequestModal, setShowDispositionRequestModal] = useState(false);
    const [dispositionRequestTarget, setDispositionRequestTarget] = useState('');
    const [showDispositionReviewModal, setShowDispositionReviewModal] = useState(false);
    const [dispositionReviewMode, setDispositionReviewMode] = useState('hr');
    const [currentUserId, setCurrentUserId] = useState(null);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [isRegistrationRenew, setIsRegistrationRenew] = useState(false);
    const [showInsuranceModal, setShowInsuranceModal] = useState(false);
    const [isInsuranceRenew, setIsInsuranceRenew] = useState(false);
    const [showWarrantyModal, setShowWarrantyModal] = useState(false);
    const [isWarrantyRenew, setIsWarrantyRenew] = useState(false);
    const [showPermitModal, setShowPermitModal] = useState(false);
    const [isPermitRenew, setIsPermitRenew] = useState(false);
    const [selectedPermitDoc, setSelectedPermitDoc] = useState(null);
    const [showVehicleFineModal, setShowVehicleFineModal] = useState(false);
    const [showPetrolModal, setShowPetrolModal] = useState(false);
    const [showTollModal, setShowTollModal] = useState(false);
    const [showMortgageModal, setShowMortgageModal] = useState(false);
    const [showMortgageCloseModal, setShowMortgageCloseModal] = useState(false);
    const [isProcessingMortgageCloseApproval, setIsProcessingMortgageCloseApproval] = useState(false);
    const [vehicleServiceModalOpen, setVehicleServiceModalOpen] = useState(false);
    const [vehicleServicePresetType, setVehicleServicePresetType] = useState('');
    const [serviceInnerTab, setServiceInnerTab] = useState(VEHICLE_SERVICE_TYPES[0]);
    const [documentAttachmentsLoaded, setDocumentAttachmentsLoaded] = useState(false);
    const [creatingOilServiceRequest, setCreatingOilServiceRequest] = useState(false);
    const [creatingVehicleServiceTabRequest, setCreatingVehicleServiceTabRequest] = useState(false);
    const [vehicleServiceEditingRecord, setVehicleServiceEditingRecord] = useState(null);
    const [carWashModalOpen, setCarWashModalOpen] = useState(false);
    const [carWashModalService, setCarWashModalService] = useState(null);
    const [serviceDeleteTarget, setServiceDeleteTarget] = useState(null);
    const [deletingServiceId, setDeletingServiceId] = useState('');

    const [documentInnerTab, setDocumentInnerTab] = useState('live');
    const [docTabRegistrationOverride, setDocTabRegistrationOverride] = useState(null);
    const [docTabInsuranceDoc, setDocTabInsuranceDoc] = useState(null);
    const [docTabWarrantyDoc, setDocTabWarrantyDoc] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => { }
    });
    const [editBasicDetailsModalOpen, setEditBasicDetailsModalOpen] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [isReturning, setIsReturning] = useState(false);
    const [isProcessingFleetActionApproval, setIsProcessingFleetActionApproval] = useState(false);
    const [isCreatingInspection, setIsCreatingInspection] = useState(false);
    const [isProcessingInspectionApproval, setIsProcessingInspectionApproval] = useState(false);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'service') {
            setActiveTab('service');
            if (searchParams.get('carWashServiceId')) {
                setServiceInnerTab('Car Wash');
            }
        }
        if (tab === 'handover') {
            setActiveTab('handover');
        }
        if (tab === 'accessoriesList') {
            setActiveTab('accessoriesList');
        }
        if (tab === 'basic') setActiveTab('basic');
        if (tab === 'document') setActiveTab('document');
        if (tab === 'permit') setActiveTab('permit');
        if (tab === 'service') setActiveTab('service');
    }, [searchParams]);

    useEffect(() => {
        if (!asset || searchParams.get('dispositionReview') !== '1') return;
        const stage = String(asset.vehicleDispositionWorkflow?.stage || '').toLowerCase();
        if (stage === 'pending_hr' && isFlowchartHr) {
            setDispositionReviewMode('hr');
            setShowDispositionReviewModal(true);
        } else if (stage === 'pending_finance') {
            const dispositionRole = String(searchParams.get('dispositionRole') || '').toLowerCase();
            if (dispositionRole === 'accounts' && isFlowchartAccounts && !asset.vehicleDispositionWorkflow?.accountsCompletedAt) {
                setDispositionReviewMode('accounts');
                setShowDispositionReviewModal(true);
            } else if (
                dispositionRole === 'management' &&
                isFlowchartManagement &&
                !asset.vehicleDispositionWorkflow?.managementCompletedAt
            ) {
                setDispositionReviewMode('management');
                setShowDispositionReviewModal(true);
            }
        }
    }, [asset, searchParams, isFlowchartHr, isFlowchartAccounts, isFlowchartManagement]);

    useEffect(() => {
        setPermissionsMounted(true);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = parseStoredSessionUser();
        if (stored) {
            setCurrentUser(stored);
            setCurrentUserEmployeeId(stored.employeeObjectId || stored._id || stored.id || null);
            setCurrentUserId(stored._id || stored.id || null);
        }
    }, []);

    useEffect(() => {
        if (!asset?._id) return;

        const fetchUserDataAndCheckController = async () => {
                try {
                    const [userRes, companyRes, flowRes] = await Promise.all([
                        axiosInstance.get('/Employee/me'),
                        axiosInstance.get('/Company', { params: { scope: 'responsibilities' } }),
                        axiosInstance.get('/Flowchart').catch((e) => {
                            return { data: [] };
                        }),
                    ]);

                    if (userRes && userRes.data) {
                        const stored = parseStoredSessionUser();
                        setCurrentUser({
                            ...userRes.data,
                            isSystemSuperUser:
                                userRes.data.isSystemSuperUser ?? stored?.isSystemSuperUser ?? false,
                            isAdministrator:
                                userRes.data.isAdministrator ?? stored?.isAdministrator ?? false,
                            isAdmin: userRes.data.isAdmin ?? stored?.isAdmin ?? false,
                            name: userRes.data.name || stored?.name,
                            username: userRes.data.username || stored?.username,
                        });
                        const actualId =
                            userRes.data.employeeObjectId || userRes.data._id || userRes.data.id;
                        if (actualId) setCurrentUserEmployeeId(actualId);

                        const companies = companyRes.data.companies || [];
                        setCompanyResponsibilities(companies);

                        const respCatKey = (c) => (c || '').toLowerCase().replace(/\s+/g, '');
                        const isActiveResp = (r) =>
                            String(r?.status || '')
                                .trim()
                                .toLowerCase() === 'active';

                        const allResponsibilities = companies.flatMap((c) =>
                            Array.isArray(c?.responsibilities) ? c.responsibilities : [],
                        );

                        const controllerFound = allResponsibilities.some(
                            (r) => respCatKey(r.category) === 'assetcontroller' && isActiveResp(r),
                        );
                        setHasAssetController(!!controllerFound);

                        const isVehicleProfileFlowchartAdminRow = (r) => {
                            if (!r || !isActiveResp(r)) return false;
                            const k = respCatKey(r.category);
                            if (k === 'admincontroller' || k === 'admin' || k === 'administrator') return true;
                            if (k.includes('admin') && k.includes('controller')) return true;
                            return false;
                        };
                        const isFlowchartHrRow = (r) => respCatKey(r.category) === 'hr' && isActiveResp(r);
                        const isFlowchartAccountsRow = (r) => respCatKey(r.category) === 'accounts' && isActiveResp(r);
                        const isFlowchartManagementRow = (r) => respCatKey(r.category) === 'management' && isActiveResp(r);
                        const responsibilityAssigneeMatchesUser = (r, userData) => {
                            const empRef = r.empObjectId;
                            const empMongo = typeof empRef === 'object' && empRef ? empRef._id || empRef.id : empRef;
                            const myEmpObj = userData.employeeObjectId;
                            const myEmployeeDocId = userData._id || userData.id;
                            if (empMongo) {
                                const em = String(empMongo);
                                if (myEmpObj && em === String(myEmpObj)) return true;
                                if (myEmployeeDocId && em === String(myEmployeeDocId)) return true;
                            }
                            const rowCode = normEmpId(
                                r.employeeId || (typeof empRef === 'object' && empRef?.employeeId) || '',
                            );
                            const myCode = normEmpId(userData.employeeId || '');
                            if (rowCode && myCode && rowCode === myCode) return true;
                            return false;
                        };

                        let assetControllerFound = allResponsibilities.some(
                            (r) =>
                                respCatKey(r.category) === 'assetcontroller' &&
                                isActiveResp(r) &&
                                responsibilityAssigneeMatchesUser(r, userRes.data),
                        );
                        if (userRes.data?.employeeId) {
                            try {
                                const ctrlRes = await axiosInstance.get(
                                    `/AssetItem/unassigned/controller/${encodeURIComponent(userRes.data.employeeId)}?checkOnly=true`,
                                    { skipToast: true },
                                ).catch(() => null);
                                if (ctrlRes?.status === 200 && ctrlRes.data?.isAuthorized === true) {
                                    assetControllerFound = true;
                                }
                            } catch {
                                /* non-controller returns 403 — expected */
                            }
                        }
                        setIsAssetController(!!assetControllerFound);

                        const amFlowchartAdminFromCompany = !!allResponsibilities.some(
                            (r) =>
                                isVehicleProfileFlowchartAdminRow(r) &&
                                responsibilityAssigneeMatchesUser(r, userRes.data),
                        );

                        const flowchartRows = Array.isArray(flowRes?.data) ? flowRes.data : [];
                        const adminFlowchartRow = pickVehicleProfileAdminFlowchartRow(flowchartRows);
                        const adminLabelFromFlowchart = displayNameFromVehicleAdminFlowchartRow(adminFlowchartRow);
                        const amFlowchartAdminFromFlowchart =
                            !!adminFlowchartRow && flowchartAdminRowMatchesUser(adminFlowchartRow, userRes.data);

                        setIsFlowchartAdminController(
                            amFlowchartAdminFromFlowchart || (!adminFlowchartRow && amFlowchartAdminFromCompany),
                        );

                        const hrFlowchartRow = pickVehicleProfileHrFlowchartRow(flowchartRows);
                        const amFlowchartHrFromFlowchart =
                            !!hrFlowchartRow && flowchartAdminRowMatchesUser(hrFlowchartRow, userRes.data);
                        const amFlowchartHrFromCompany = !!allResponsibilities.some(
                            (r) => isFlowchartHrRow(r) && responsibilityAssigneeMatchesUser(r, userRes.data),
                        );
                        setIsFlowchartHr(amFlowchartHrFromFlowchart || (!hrFlowchartRow && amFlowchartHrFromCompany));
                        const accountsFcRow = pickAccountsFlowchartRow(flowchartRows);
                        const managementFcRow = pickManagementFlowchartRow(flowchartRows);
                        const amFlowchartAccountsFromFlowchart =
                            !!accountsFcRow && flowchartAdminRowMatchesUser(accountsFcRow, userRes.data);
                        const amFlowchartManagementFromFlowchart =
                            !!managementFcRow && flowchartAdminRowMatchesUser(managementFcRow, userRes.data);
                        const amFlowchartAccountsFromCompany = !!allResponsibilities.some(
                            (r) => isFlowchartAccountsRow(r) && responsibilityAssigneeMatchesUser(r, userRes.data),
                        );
                        const amFlowchartManagementFromCompany = !!allResponsibilities.some(
                            (r) => isFlowchartManagementRow(r) && responsibilityAssigneeMatchesUser(r, userRes.data),
                        );
                        setIsFlowchartAccounts(
                            amFlowchartAccountsFromFlowchart || (!accountsFcRow && amFlowchartAccountsFromCompany),
                        );
                        setIsFlowchartManagement(
                            amFlowchartManagementFromFlowchart ||
                                (!managementFcRow && amFlowchartManagementFromCompany),
                        );

                        const hrFlowRow = allResponsibilities.find((r) => isFlowchartHrRow(r));
                        const hrLabelFromCompany =
                            String(hrFlowRow?.employeeName || '').trim() ||
                            String(hrFlowRow?.employeeId || '').trim() ||
                            '';
                        const hrLabelFromFlowchart = displayNameFromVehicleAdminFlowchartRow(hrFlowchartRow);
                        setVehicleProfileActivationHrName(hrLabelFromFlowchart || hrLabelFromCompany);

                        const adminFlowRow = allResponsibilities.find((r) => isVehicleProfileFlowchartAdminRow(r));
                        const adminLabelFromCompany =
                            String(adminFlowRow?.employeeName || '').trim() ||
                            String(adminFlowRow?.employeeId || '').trim() ||
                            '';
                        setVehicleProfileActivationFlowchartAdminName(
                            adminLabelFromFlowchart || adminLabelFromCompany,
                        );
                    }
                } catch (err) {
                    setHasAssetController(false);
                    setIsFlowchartAdminController(false);
                    setVehicleProfileActivationFlowchartAdminName('');
                }
            };
        fetchUserDataAndCheckController();
    }, [asset?._id]);

    const fetchAssetDetails = async (opts = {}) => {
        const { deferServiceSigning = false, light = false, silent = false } = opts;
        const ticket = ++fetchAssetDetailsTicketRef.current;
        try {
            if (!silent && !asset) setLoading(true);
            const params = {};
            if (light) params.light = '1';
            else if (deferServiceSigning) params.deferServiceSigning = '1';
            const response = await axiosInstance.get(`/AssetItem/detail/${assetId}`, {
                params: Object.keys(params).length ? params : undefined,
                timeout: light ? 20000 : 45000,
                skipToast: silent,
            });
            if (ticket !== fetchAssetDetailsTicketRef.current) return;
            setAsset(response.data);
            return response.data;
        } catch (error) {
            if (ticket !== fetchAssetDetailsTicketRef.current) return;
            if (!silent) {
                const isTimeout = error?.code === 'TIMEOUT' || error?.message?.includes('timeout');
                const is404 = error?.response?.status === 404;
                toast({
                    variant: 'destructive',
                    title: is404 ? 'Vehicle not found' : 'Could not load vehicle',
                    description: is404
                        ? 'This vehicle may be in draft and only visible to its creator.'
                        : isTimeout
                          ? 'The server took too long. Try again or open another tab first.'
                          : 'Failed to fetch vehicle details',
                });
                setAsset(null);
            }
        } finally {
            if (ticket === fetchAssetDetailsTicketRef.current && !silent && !asset) {
                setLoading(false);
            }
        }
    };

    const handleAssetCreationResponse = async (action) => {
        if (creationDecisionBusy) return;
        setCreationDecisionBusy(action);
        fetchAssetDetailsTicketRef.current += 1;
        try {
            const { data } = await axiosInstance.put(
                `/AssetItem/${assetId}/approve-creation`,
                { action },
                { skipToast: true, timeout: 30000 },
            );
            if (action === 'Reject') {
                toast({
                    title: 'Rejected successfully',
                    description:
                        'The vehicle was returned to draft. The creator has been notified by email, dashboard, and vehicle inbox.',
                });
                router.replace('/HRM/Asset/Vehicle');
                return;
            }
            toast({
                title: 'Approved successfully',
                description:
                    'The vehicle is unassigned with an inactive profile until HR completes profile activation.',
            });
            if (data) setAsset(data);
            setCreationDecisionBusy(null);
        } catch (err) {
            const status = err?.response?.status;
            if (status === 409) {
                toast({
                    title: action === 'Reject' ? 'Already rejected' : 'Already processed',
                    description: 'This request was already actioned. Returning to the vehicle list.',
                });
                router.replace('/HRM/Asset/Vehicle');
                return;
            }
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to process request.',
            });
            setCreationDecisionBusy(null);
        }
    };

    const handleSubmitDraftForApproval = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/submit-creation`);
            toast({
                title: 'Published',
                description: 'Vehicle is on the fleet list. Complete the profile and submit for activation when ready.',
            });
            fetchAssetDetails();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to publish vehicle.',
            });
        }
    };

    const fetchAssetHistory = async ({ forHandover = false } = {}) => {
        try {
            if (forHandover) setLoadingHandoverHistory(true);
            const response = await axiosInstance.get(`/AssetItem/${assetId}/history`, {
                params: forHandover ? { forHandover: '1' } : undefined,
            });
            const payload = response.data;
            const list = Array.isArray(payload) ? payload : payload?.history || [];
            setAssetHistory(list);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to load handover history.',
            });
        } finally {
            if (forHandover) setLoadingHandoverHistory(false);
        }
    };

    const downloadHandoverHistoryPdf = async (historyId) => {
        try {
            setIsDownloadingHandoverHistoryPdf(String(historyId));
            const response = await axiosInstance.get(`/AssetItem/history-handover-pdf/${historyId}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `HandoverForm-${asset?.assetId || 'vehicle'}-History.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast({ title: 'Success', description: 'Historical handover form downloaded.' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to download handover PDF.',
            });
        } finally {
            setIsDownloadingHandoverHistoryPdf('');
        }
    };

    const fetchFines = async () => {
        try {
            setLoadingFines(true);
            const [byObjectIdResp, byAssetCodeResp] = await Promise.all([
                axiosInstance.get(`/Fine`, { params: { vehicleId: assetId } }),
                asset?.assetId
                    ? axiosInstance.get(`/Fine`, { params: { assetId: asset.assetId } })
                    : Promise.resolve({ data: { fines: [] } }),
            ]);
            const merged = [
                ...(byObjectIdResp?.data?.fines || []),
                ...(byAssetCodeResp?.data?.fines || []),
            ];
            const deduped = [];
            const seen = new Set();
            for (const fine of merged) {
                const id = String(fine?._id || '');
                if (!id || seen.has(id)) continue;
                seen.add(id);
                deduped.push(fine);
            }
            setFines(deduped);
        } catch (error) {
        } finally {
            setLoadingFines(false);
        }
    };

    const refreshData = useCallback(() => {
        if (!assetId) return;
        setDocumentAttachmentsLoaded(false);
        const includeDocuments = activeTab === 'document';
        fetchAssetDetails({
            deferServiceSigning: true,
            light: !includeDocuments,
            silent: false,
        }).then(() => {
            if (includeDocuments) setDocumentAttachmentsLoaded(true);
        });
        if (activeTab === 'history') fetchAssetHistory();
        if (activeTab === 'handover') {
            fetchAssetHistory({ forHandover: true });
        }
        if (activeTab === 'accessoriesList') {
            void fetchAssetDetails({ light: true, silent: true });
            fetchAssetHistory({ forHandover: false });
        }
        if (activeTab === 'fine') fetchFines();
    }, [assetId, activeTab]);

    const handleVehicleAssignUpdate = useCallback(() => {
        if (assetId) {
            void fetchAssetDetails({ light: true, silent: true });
            void fetchAssetHistory({ forHandover: true });
        }
    }, [assetId]);

    useEffect(() => {
        if (!assetId) return;
        setDocumentAttachmentsLoaded(false);
        fetchAssetDetails({ light: true });
    }, [assetId]);

    useEffect(() => {
        if (!assetId || activeTab !== 'document' || documentAttachmentsLoaded) return;
        let cancelled = false;
        (async () => {
            await fetchAssetDetails({ deferServiceSigning: true, silent: true });
            if (!cancelled) setDocumentAttachmentsLoaded(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [assetId, activeTab, documentAttachmentsLoaded]);

    useEffect(() => {
        if (!assetId) return;
        if (activeTab === 'history') fetchAssetHistory();
        if (activeTab === 'handover') {
            fetchAssetHistory({ forHandover: true });
        }
        if (activeTab === 'accessoriesList') {
            void fetchAssetDetails({ light: true, silent: true });
            fetchAssetHistory({ forHandover: false });
        }
        if (activeTab === 'fine') fetchFines();
    }, [assetId, activeTab]);

    useNotificationFocusScroll({
        loading,
        focusCardPrefix: ASSET_FOCUS_PREFIX,
        deps: [asset?._id, asset?.vehicleProfileActivationStatus],
    });

    const onVehicleServiceRowClick = useCallback(
        (row) => {
            const vehicleId = normalizeMongoId(row.vehicleId || assetId);
            const serviceId = normalizeMongoId(row.serviceId);
            if (!vehicleId || !serviceId) return;
            navigateFromList(
                router,
                `/HRM/Asset/Vehicle/service-requests/details/${vehicleId}/${serviceId}`,
            );
        },
        [router, assetId],
    );

    const handleDeleteVehicle = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Vehicle?',
            description: 'Are you sure you want to delete this vehicle? This action cannot be undone.',
            onConfirm: async () => {
                try {
                    await axiosInstance.delete(`/AssetItem/${assetId}`);
                    toast({ title: 'Deleted', description: 'Vehicle deleted successfully' });
                    router.push('/HRM/Asset/Vehicle');
                } catch (error) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: error.response?.data?.message || 'Failed to delete vehicle'
                    });
                }
            }
        });
    };

    const resolveAssetDocMongoId = (doc) => {
        const id = doc?._id ?? doc?.id;
        return id ? String(id) : null;
    };

    const handleDeleteDoc = async () => {
        if (!docToDelete) return;
        const docId = resolveAssetDocMongoId(docToDelete);
        if (!docId) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Cannot delete: document id is missing. Refresh the page and try again.',
            });
            return;
        }
        setDeleteLoading(true);
        try {
            const res = await axiosInstance.delete(`/AssetItem/${assetId}/document/${docId}`);
            const deletedIds = new Set(
                (Array.isArray(res.data?.deletedIds) ? res.data.deletedIds : [docId]).map(String),
            );
            setAsset((prev) => {
                if (!prev) return prev;
                const nextDocs = (prev.documents || []).filter(
                    (d) => !deletedIds.has(resolveAssetDocMongoId(d) || ''),
                );
                return { ...prev, documents: nextDocs };
            });
            const count = res.data?.deletedCount ?? deletedIds.size;
            toast({
                title: 'Deleted',
                description:
                    count > 1
                        ? `${docToDelete.type} and ${count - 1} related file(s) removed.`
                        : `${docToDelete.type} document deleted successfully`,
            });
            setDocToDelete(null);
            fetchAssetDetails({ silent: true });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to delete document',
            });
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleNotRenewDoc = async () => {
        if (!docToNotRenew || !docToNotRenew._id) return;
        setNotRenewLoading(true);
        try {
            const relatedDocs = relatedVehicleDocumentsForCard(docToNotRenew, asset?.documents || []);
            const uniqueDocs = [];
            const seen = new Set();
            for (const d of relatedDocs) {
                const id = String(d?._id || '');
                if (!id || seen.has(id)) continue;
                seen.add(id);
                uniqueDocs.push(d);
            }

            const buildMeta = (doc) => {
                let meta = {};
                const raw = doc.description;
                if (raw) {
                    try {
                        meta = JSON.parse(raw);
                    } catch {
                        meta = { text: String(raw) };
                    }
                }
                meta.isRenewed = true;
                meta.notRenewed = true;
                meta.notRenewedAt = new Date().toISOString();
                return meta;
            };

            const docType = String(docToNotRenew.type || '').toLowerCase().trim();
            let sectionId = null;
            if (docType === 'registration' || docType === 'registration attachment') {
                sectionId = 'registration';
            } else if (docType === 'insurance' || docType === 'insurance attachment') {
                sectionId = 'insurance';
            }

            const steps = uniqueDocs.map((doc) => ({
                op: 'put_document',
                docId: doc._id,
                body: { description: JSON.stringify(buildMeta(doc)) },
            }));

            if (sectionId && vehicleActPhase === 'active') {
                const { previousRows, proposedRows } = buildVehicleProfileEditSnapshots({
                    sectionId,
                    asset,
                    proposedRows: buildNotRenewProposedRows(sectionId, docToNotRenew.type),
                });
                const result = await saveVehicleSectionOrQueue({
                    asset,
                    assetId,
                    sectionId,
                    action: 'not_renew',
                    steps,
                    documentId: docToNotRenew._id,
                    hrMayApplyDirectly: canApplyVehicleDocRenewalDirectly,
                    previousRows,
                    proposedRows,
                });
                if (result.queued) {
                    toast({
                        title: 'Saved',
                        description: 'Not renew queued. Submit for HR approval when ready.',
                    });
                    setDocToNotRenew(null);
                    fetchAssetDetails();
                    return;
                }
            }

            await Promise.all(
                uniqueDocs.map((doc) =>
                    axiosInstance.put(`/AssetItem/${assetId}/document/${doc._id}`, {
                        description: JSON.stringify(buildMeta(doc)),
                    }),
                ),
            );

            toast({
                title: 'Updated',
                description: `${docToNotRenew.type} and related attachments moved to Old Documents (Not Renewed).`,
            });
            setAsset((prev) => {
                if (!prev) return prev;
                const list = Array.isArray(prev.documents) ? prev.documents : [];
                const metaById = new Map(uniqueDocs.map((d) => [String(d._id), JSON.stringify(buildMeta(d))]));
                const nextDocs = list.map((d) => {
                    const nextDescription = metaById.get(String(d?._id || ''));
                    if (!nextDescription) return d;
                    return { ...d, description: nextDescription };
                });
                return { ...prev, documents: nextDocs };
            });
            setDocToNotRenew(null);
            fetchAssetDetails();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to mark document as not renewed',
            });
        } finally {
            setNotRenewLoading(false);
        }
    };

    const assignedEmployeeForFine = useMemo(() => {
        const assignee = asset?.assignedTo;
        if (assignee && typeof assignee === 'object' && assignee.employeeId) {
            return assignee;
        }
        return null;
    }, [asset]);

    const assetActionUser = useMemo(() => {
        if (!asset) return null;
        return buildAssetActionUser({
            employeeObjectId: currentUserEmployeeId,
            isAssetController,
            isAdminInCompanyFlowchart: resolveAdminInCompanyFlowchart(
                currentUser,
                asset,
                companyResponsibilities,
            ),
        });
    }, [asset, currentUserEmployeeId, isAssetController, currentUser, companyResponsibilities]);

    const isCreatorUser = useMemo(() => {
        if (!asset || !currentUserId) return false;
        const cb = asset.createdBy?._id?.toString() || asset.createdBy?.toString();
        return cb === currentUserId;
    }, [asset, currentUserId]);

    const creatorCannotEditSubmittedAsset = useMemo(() => {
        if (!asset || !currentUserId) return false;
        if (
            checkIsAdmin() ||
            hasPermission('hrm_asset', 'isDelete')
        ) {
            return false;
        }
        if (String(asset.status || '').toLowerCase().trim() !== 'submitted for approval') return false;
        return isCreatorUser;
    }, [asset, currentUserId, currentUser, isCreatorUser]);

    const vehicleFineInitialData = useMemo(() => ({
        vehicleId: asset?._id || asset?.id || '',
        assetId: asset?.assetId || '',
        employeeId: assignedEmployeeForFine?.employeeId || '',
        assignedEmployees: assignedEmployeeForFine?.employeeId
            ? [{ employeeId: assignedEmployeeForFine.employeeId }]
            : [],
    }), [asset, assignedEmployeeForFine]);

    const fineModalVehicles = useMemo(() => (
        asset
            ? [{
                _id: asset._id || asset.id,
                assetId: asset.assetId || '',
                name: asset.assetName || asset.name || asset.assetId || 'Vehicle',
                plateNumber: asset.plateNumber || asset.vehicleNumber || '',
            }]
            : []
    ), [asset]);

    const fineModalEmployees = useMemo(() => (
        assignedEmployeeForFine
            ? [{
                employeeId: assignedEmployeeForFine.employeeId,
                firstName: assignedEmployeeForFine.firstName || '',
                lastName: assignedEmployeeForFine.lastName || '',
                company: assignedEmployeeForFine.company || null,
            }]
            : []
    ), [assignedEmployeeForFine]);

    const isVehicleDocumentOld = (doc) => {
        const status = String(doc?.status || doc?.documentStatus || '').toLowerCase();
        const hasOldStatus = ['old', 'renewed', 'archived', 'inactive'].includes(status);
        let descriptionMeta = {};
        if (doc?.description) {
            try {
                descriptionMeta = JSON.parse(doc.description);
            } catch {
                descriptionMeta = {};
            }
        }
        const explicitRenewed = !!(
            doc?.isRenewed ||
            doc?.renewedFrom ||
            doc?.renewedAt ||
            descriptionMeta?.isRenewed
        );
        return hasOldStatus || explicitRenewed;
    };

    const normDocType = normVehicleDocType;
    const docDateKey = vehicleDocDateKey;

    const vehicleDocumentLifecycleBuckets = useMemo(() => {
        const docs = asset?.documents || [];
        const normType = normVehicleDocType;

        const bucketize = (list) => {
            const basic = [];
            const registration = [];
            const insurance = [];
            const warranty = [];
            const permit = [];
            const petrol = [];
            const mortgage = [];
            for (const d of list) {
                const t = normType(d.type);
                if (t === 'registration' || t === 'registration attachment') registration.push(d);
                else if (t === 'insurance' || t === 'insurance attachment') {
                    if (!isInsuranceInvoiceAttachmentLabel(d)) insurance.push(d);
                } else if (t === 'warranty' || t === 'warranty attachment') warranty.push(d);
                else if (t === 'permit' || t === 'permit attachment') permit.push(d);
                else if (t === 'mortgage') mortgage.push(d);
                else if (t === 'petrol' || t === 'petrol attachment') petrol.push(d);
                else basic.push(d);
            }
            const regSort = (a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                if (tb !== ta) return tb - ta;
                const ma = normType(a.type) === 'registration' ? 0 : 1;
                const mb = normType(b.type) === 'registration' ? 0 : 1;
                return ma - mb;
            };
            registration.sort(regSort);
            insurance.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            warranty.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            permit.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            petrol.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            mortgage.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            basic.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            return { basic, registration, insurance, warranty, permit, petrol, mortgage };
        };

        const renewalTrackedTypes = new Set([
            'insurance',
            'registration',
            'registration attachment',
        ]);
        const renewedFromDocIds = new Set(
            (docs || [])
                .map((d) => {
                    if (!d?.description) return '';
                    try {
                        const parsed = JSON.parse(d.description);
                        return String(parsed?.renewedFrom || '');
                    } catch {
                        return '';
                    }
                })
                .filter(Boolean)
        );
        const isOldByRenewLink = (doc) => renewedFromDocIds.has(String(doc?._id || ''));
        const isDocOld = (doc) => isVehicleDocumentOld(doc) || isOldByRenewLink(doc);
        const docSortTime = (d) => {
            if (d?.issueDate) return new Date(d.issueDate).getTime();
            if (d?.expiryDate) return new Date(d.expiryDate).getTime();
            if (d?.createdAt) return new Date(d.createdAt).getTime();
            return 0;
        };
        const live = [];
        const old = [];
        const handledIds = new Set();

        for (const type of renewalTrackedTypes) {
            const docsOfType = docs
                .filter((d) => normType(d.type) === type)
                .sort((a, b) => docSortTime(b) - docSortTime(a));
            if (!docsOfType.length) continue;
            const latestActive = docsOfType.find((d) => !isDocOld(d)) || null;

            for (const d of docsOfType) {
                const id = String(d?._id || '');
                if (id) handledIds.add(id);
                if (
                    latestActive &&
                    String(d?._id || '') === String(latestActive?._id || '') &&
                    !isDocOld(d)
                ) {
                    live.push(d);
                } else {
                    old.push(d);
                }
            }
        }

        for (const d of docs) {
            const id = String(d?._id || '');
            if (id && handledIds.has(id)) continue;
            if (isDocOld(d)) old.push(d);
            else live.push(d);
        }

        const synced = syncVehicleDocumentAttachmentBuckets(live, old, docs);

        return {
            live: bucketize(synced.live),
            old: bucketize(synced.old),
        };
    }, [asset]);

    const parseWarrantyCardMeta = (doc) => {
        let meta = { currentKm: '', endKm: '', km: '', warrantyBy: '', warrantyCovered: [] };
        if (doc?.description) {
            try {
                const parsed = JSON.parse(doc.description);
                meta = {
                    currentKm: parsed?.currentKm ?? parsed?.km ?? '',
                    endKm: parsed?.endKm ?? '',
                    km: parsed?.km ?? parsed?.currentKm ?? '',
                    warrantyBy: parsed?.warrantyBy || '',
                    warrantyCovered: Array.isArray(parsed?.warrantyCovered) ? parsed.warrantyCovered : [],
                };
            } catch {
                meta = { currentKm: '', endKm: '', km: '', warrantyBy: '', warrantyCovered: [] };
            }
        }
        return meta;
    };

    const warrantyDocs = vehicleDocumentLifecycleBuckets?.live?.warranty || [];
    const warrantyCards = warrantyDocs.map((d) => ({ doc: d, meta: parseWarrantyCardMeta(d) }));

    const vehicleActivationApprovedSectionsPayload = useMemo(
        () => computeVehicleActivationApprovedSectionsPayload(asset),
        [asset],
    );

    const vehicleActStatus = String(asset?.vehicleProfileActivationStatus || 'none').toLowerCase();
    const heldSections = Array.isArray(asset?.vehicleProfileActivationHold?.unapprovedSections)
        ? asset.vehicleProfileActivationHold.unapprovedSections.map(String)
        : [];
    const vehicleActPhase =
        vehicleActStatus === 'active'
            ? 'active'
            : vehicleActStatus === 'rejected'
              ? 'rejected'
              : vehicleActStatus === 'submitted'
                ? heldSections.length > 0
                    ? 'on_hold'
                    : 'pending_review'
                : 'inactive';

    const isVehicleProfileActive = vehicleActPhase === 'active';
    const canAdminDeleteVehicleRecords = permissionsMounted && checkIsAdmin();
    const canDeleteVehicleServiceRecords = canAdminDeleteActivatedVehicleRecord({
        isAdminUser: canAdminDeleteVehicleRecords,
        profileActive: isVehicleProfileActive,
    });
    const showVehicleCardRenewActions = isVehicleProfileActive;
    const showVehicleCardDelete = !isVehicleProfileActive || canAdminDeleteVehicleRecords;

    const vehicleCardActionFlags = useCallback(
        (cardKey) => {
            const access = vehicleCardCrud(cardKey);
            return {
                showEdit: access.edit,
                showDelete:
                    ((!isVehicleProfileActive || canAdminDeleteVehicleRecords) && access.delete),
                showRenew: showVehicleCardRenewActions && access.edit,
                showNotRenew: showVehicleCardRenewActions && access.edit,
                showDownload: access.download,
            };
        },
        [isVehicleProfileActive, canAdminDeleteVehicleRecords, showVehicleCardRenewActions],
    );

    const visibleVehicleDetailTabs = useMemo(
        () =>
            [
                { id: 'basic', label: 'Basic Details' },
                { id: 'permit', label: 'Permit' },
                { id: 'fine', label: 'Fine' },
                { id: 'service', label: 'Service' },
                { id: 'accessoriesList', label: 'Accessories List' },
                { id: 'handover', label: 'Handover' },
                { id: 'history', label: 'History' },
                { id: 'document', label: 'Document' },
            ].filter((tab) => vehicleTabVisible(tab.id)),
        [permissionsMounted],
    );

    useEffect(() => {
        if (!permissionsMounted) return;
        if (!canAccessVehicleDetailsPage()) {
            router.replace('/dashboard');
        }
    }, [permissionsMounted, router]);

    useEffect(() => {
        if (!permissionsMounted || visibleVehicleDetailTabs.length === 0) return;
        if (!visibleVehicleDetailTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visibleVehicleDetailTabs[0].id);
        }
    }, [permissionsMounted, visibleVehicleDetailTabs, activeTab]);

    const permitTabAccess = useMemo(() => vehiclePermitCardCrud(), [permissionsMounted]);
    const fineTabAccess = useMemo(() => vehicleTabCrud('fine'), [permissionsMounted]);
    const accessoriesListTabAccess = useMemo(
        () => vehicleTabCrud('accessoriesList'),
        [permissionsMounted],
    );
    const oilServiceRequestRows = useMemo(
        () => buildOilServiceRequestRowsFromAsset(asset),
        [asset],
    );
    const canManageOilService = useMemo(
        () => canUserManageOilService(asset, currentUserEmployeeId, currentUser, isFlowchartAdminController),
        [asset, currentUserEmployeeId, currentUser, isFlowchartAdminController],
    );
    const carWashRequestRows = useMemo(() => buildCarWashRequestRowsFromAsset(asset), [asset]);
    const vehicleServiceTabRequestRows = useMemo(
        () =>
            isVehicleServiceTabRequestType(serviceInnerTab)
                ? buildVehicleServiceTabRequestRowsFromAsset(asset, serviceInnerTab)
                : [],
        [asset, serviceInnerTab],
    );
    const canManageCarWash = useMemo(
        () => canUserManageCarWash(asset, currentUserEmployeeId, currentUser, isFlowchartAdminController),
        [asset, currentUserEmployeeId, currentUser, isFlowchartAdminController],
    );

    const closeCarWashModal = useCallback(() => {
        setCarWashModalOpen(false);
        setCarWashModalService(null);
    }, []);

    const carWashModalCanApprove = useMemo(
        () =>
            carWashModalService
                ? canUserValidateCarWashAccounts(
                      carWashModalService,
                      asset,
                      isFlowchartAccounts,
                      currentUser,
                  )
                : false,
        [carWashModalService, asset, isFlowchartAccounts, currentUser],
    );

    const openCarWashRow = useCallback((row) => {
        if (!row) return;
        setCarWashModalService(row.serviceRecord || null);
        setCarWashModalOpen(true);
    }, []);

    const openCarWashReviewFromUrl = useCallback(
        (serviceId) => {
            const row = carWashRequestRows.find(
                (r) => normalizeMongoId(r.serviceId || r.id) === normalizeMongoId(serviceId),
            );
            if (!row) return false;
            setActiveTab('service');
            setServiceInnerTab('Car Wash');
            setCarWashModalService(row.serviceRecord || null);
            setCarWashModalOpen(true);
            return true;
        },
        [carWashRequestRows],
    );

    useEffect(() => {
        if (!asset) return;
        const serviceId = searchParams.get('carWashServiceId');
        if (!serviceId) return;
        if (!openCarWashReviewFromUrl(serviceId)) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete('carWashServiceId');
        const qs = params.toString();
        router.replace(qs ? `/HRM/Asset/Vehicle/details/${assetId}?${qs}` : `/HRM/Asset/Vehicle/details/${assetId}`, {
            scroll: false,
        });
    }, [asset, assetId, openCarWashReviewFromUrl, router, searchParams]);

    const openOilServiceDetail = useCallback(
        (row) => {
            const vehicleId = normalizeMongoId(asset?._id);
            const serviceId = normalizeMongoId(row?.serviceId || row?.id);
            if (!vehicleId || !serviceId) return;
            router.push(`/HRM/Asset/Vehicle/details/${vehicleId}/oil-service/${serviceId}`);
        },
        [asset?._id, router],
    );

    const openVehicleServiceTabRow = useCallback(
        (row) => {
            const vehicleId = normalizeMongoId(asset?._id);
            const serviceId = normalizeMongoId(row?.serviceId || row?.id);
            if (!vehicleId || !serviceId) return;
            const detailPath = vehicleServiceDetailPath(vehicleId, serviceId, serviceInnerTab);
            if (detailPath) {
                router.push(detailPath);
                return;
            }
            setVehicleServicePresetType(serviceInnerTab);
            setVehicleServiceEditingRecord(row.serviceRecord || null);
            setVehicleServiceModalOpen(true);
        },
        [asset?._id, router, serviceInnerTab],
    );

    const requestDeleteVehicleService = useCallback((row) => {
        const serviceId = normalizeMongoId(row?.serviceId || row?.id);
        if (!serviceId) return;
        setServiceDeleteTarget({
            serviceId,
            label: row?.carWashType || row?.status || 'service request',
        });
    }, []);

    const executeDeleteVehicleService = useCallback(async () => {
        const vehicleId = normalizeMongoId(asset?._id);
        const serviceId = normalizeMongoId(serviceDeleteTarget?.serviceId);
        if (!vehicleId || !serviceId) return;
        setDeletingServiceId(serviceId);
        try {
            await axiosInstance.delete(`/AssetItem/${vehicleId}/service/${serviceId}`, {
                timeout: 20000,
            });
            setAsset((prev) => {
                if (!prev) return prev;
                const services = Array.isArray(prev.services) ? prev.services : [];
                return {
                    ...prev,
                    services: services.filter(
                        (s) => normalizeMongoId(s?._id) !== serviceId,
                    ),
                };
            });
            setServiceDeleteTarget(null);
            toast({ title: 'Deleted', description: 'Service request removed successfully.' });
            invalidateAssetPendingInbox('vehicle');
            void fetchAssetDetails({ silent: true, light: true });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: error.response?.data?.message || 'Could not delete this service request.',
            });
        } finally {
            setDeletingServiceId('');
        }
    }, [asset?._id, fetchAssetDetails, serviceDeleteTarget, toast]);

    useEffect(() => {
        if (!permissionsMounted || activeTab !== 'document') return;
        const liveOk = vehicleDocumentInnerTabVisible('live');
        const oldOk = vehicleDocumentInnerTabVisible('old');
        if (!liveOk && !oldOk) return;
        if (documentInnerTab === 'live' && !liveOk && oldOk) {
            setDocumentInnerTab('old');
        } else if (documentInnerTab === 'old' && !oldOk && liveOk) {
            setDocumentInnerTab('live');
        } else if (documentInnerTab === 'live' && !liveOk) {
            setDocumentInnerTab('old');
        } else if (documentInnerTab === 'old' && !oldOk) {
            setDocumentInnerTab('live');
        }
    }, [permissionsMounted, activeTab, documentInnerTab]);

    if (loading && !asset) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500 font-semibold">Loading vehicle details...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!asset) {
        return (
            <div className="flex min-h-screen w-full bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Navbar />
                    <div className="p-8">
                        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-100">
                            <AlertCircle className="mx-auto text-gray-300 mb-4" size={56} />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Vehicle Not Found</h2>
                            <ListReturnBackButton onNavigate={handleListReturnBack} className="mx-auto" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const formatDate = (date) => {
        if (!date) return 'Not Set';
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatMoneyAed = (n) => {
        if (n === null || n === undefined || n === '') return null;
        const v = Number(n);
        if (Number.isNaN(v)) return null;
        return `AED ${v.toLocaleString()}`;
    };

    const buildVehicleBasicDetailsRows = (a) => {
        if (!a) return [];
        const base = [
            { label: 'Asset ID', value: a.assetId },
            { label: 'Brand', value: getVehicleBrandLabel(a) || '—' },
            { label: 'Model', value: a.name },
            { label: 'Plate Number', value: `${a.plateEmirate || ''} ${a.plateNumber || ''}`.trim() },
            { label: 'Model Year', value: a.modelYear },
            { label: 'Asset Value', value: a.assetValue ? `AED ${Number(a.assetValue).toLocaleString()}` : null },
            { label: 'Current KM', value: `${Number(a.currentKilometer || 0).toLocaleString()} KM` },
        ];
        const disp = String(a.vehicleDispositionStatus || 'active').toLowerCase();
        const wfStage = String(a.vehicleDispositionWorkflow?.stage || '').toLowerCase();
        const wfTarget = String(a.vehicleDispositionWorkflow?.targetStatus || '').toLowerCase();
        let dispositionLabel =
            disp === 'sold' ? 'Sold' : disp === 'total loss' ? 'Total loss' : 'Active';
        if (disp === 'active' && wfStage === 'pending_hr' && wfTarget) {
            const targetWord = wfTarget === 'sold' ? 'Sold' : 'Total loss';
            dispositionLabel = `Active (pending ${targetWord} — HR)`;
        } else if (disp === 'active' && wfStage === 'pending_finance' && wfTarget) {
            const targetWord = wfTarget === 'sold' ? 'Sold' : 'Total loss';
            dispositionLabel = `Active (awaiting ${targetWord} — Accounts or Management)`;
        }
        const extras = [{ label: 'Status', value: dispositionLabel }];
        if (disp === 'sold') {
            const sv = formatMoneyAed(a.soldValue);
            if (sv) extras.push({ label: 'Sold value', value: sv });
            const re = formatMoneyAed(a.registrationExpense);
            if (re) extras.push({ label: 'Registration expense', value: re });
            const oe = formatMoneyAed(a.otherExpense);
            if (oe) extras.push({ label: 'Other expenses', value: oe });
        }
        if (disp === 'total loss') {
            const tv = formatMoneyAed(a.totalLossValue);
            if (tv) extras.push({ label: 'Total loss value', value: tv });
            const re = formatMoneyAed(a.registrationExpense);
            if (re) extras.push({ label: 'Registration expense', value: re });
            const oe = formatMoneyAed(a.otherExpense);
            if (oe) extras.push({ label: 'Other expenses', value: oe });
        }
        const loanVal = formatMoneyAed(a.currentLoanAmount);
        if (loanVal) extras.push({ label: 'Current loan amount', value: loanVal });
        const bal = formatMoneyAed(a.balanceInHand);
        if (bal) extras.push({ label: 'Balance in hand', value: bal });
        if (disp === 'total loss' && a.accidentReportAttachment) {
            extras.push({
                label: 'Accident report',
                value: (
                    <button
                        type="button"
                        onClick={() => openFilePreview(a.accidentReportAttachment, 'Accident report')}
                        className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[12px] ml-auto"
                    >
                        View
                    </button>
                ),
            });
        }
        const basicDetailCount = (a.documents || []).filter(
            (d) => String(d?.type || '').trim().toLowerCase() === 'basic detail attachment',
        ).length;
        if (basicDetailCount > 0) {
            extras.push({ label: 'Basic detail documents', value: `${basicDetailCount} file(s)` });
        }
        return [...base, ...extras];
    };

    const formatTableDate = (date) => (date ? formatDate(date) : '-');

    const parseVehicleDocDescription = (doc) => {
        if (!doc?.description) return {};
        try {
            return JSON.parse(doc.description);
        } catch {
            return {};
        }
    };

    const renderWarrantyDetailCard = (doc, meta, cardIdx) => {
        const cardAttachments = warrantyAttachmentsForDoc(doc, asset?.documents || []);
        const cardStart = doc?.issueDate || null;
        const cardEnd = doc?.expiryDate || null;
        const cardCurrentKm = meta?.currentKm ?? meta?.km ?? '';
        const cardEndKm = meta?.endKm ?? '';
        const hasCardCurrentKm =
            cardCurrentKm !== null &&
            cardCurrentKm !== undefined &&
            String(cardCurrentKm).trim() !== '';
        const hasCardEndKm =
            cardEndKm !== null &&
            cardEndKm !== undefined &&
            String(cardEndKm).trim() !== '';
        const coveredLabel = Array.isArray(meta.warrantyCovered)
            ? meta.warrantyCovered.join(', ')
            : meta.warrantyCovered;

        return (
            <div
                key={doc._id || `warranty-card-${cardIdx}`}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0"
            >
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-800">
                        Warranty Details
                        {warrantyCards.length > 1 ? ` #${cardIdx + 1}` : ''}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                        {vehicleCardActionFlags('warranty').showEdit && (
                        <button
                            type="button"
                            onClick={() => {
                                setDocTabWarrantyDoc(doc);
                                setIsWarrantyRenew(false);
                                setShowWarrantyModal(true);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                        >
                            <PencilLine size={18} />
                        </button>
                        )}
                        {vehicleCardActionFlags('warranty').showRenew && (
                            <button
                                type="button"
                                onClick={() => {
                                    setDocTabWarrantyDoc(doc);
                                    setIsWarrantyRenew(true);
                                    setShowWarrantyModal(true);
                                }}
                                className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                                title="Renew"
                            >
                                <RefreshCw size={18} />
                            </button>
                        )}
                        {vehicleCardActionFlags('warranty').showDelete ? (
                            <button
                                type="button"
                                onClick={() => setDocToDelete(doc)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={18} />
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="px-5 pb-4">
                    {[
                        { label: 'Warranty By', value: meta.warrantyBy || null },
                        { label: 'Covered', value: coveredLabel || null },
                        { label: 'Start Date', value: cardStart ? formatDate(cardStart) : null },
                        { label: 'End Date', value: cardEnd ? formatDate(cardEnd) : null },
                        {
                            label: 'Current KM',
                            value: hasCardCurrentKm
                                ? `${Number(cardCurrentKm).toLocaleString()} KM`
                                : null,
                        },
                        {
                            label: 'End KM',
                            value: hasCardEndKm
                                ? `${Number(cardEndKm).toLocaleString()} KM`
                                : null,
                        },
                    ]
                        .filter((r) => r.value)
                        .map((row, idx, arr) => (
                            <div
                                key={row.label}
                                className={`flex items-center justify-between gap-3 py-3 ${idx !== arr.length - 1 || doc?.attachment || cardAttachments.length > 0 ? 'border-b border-slate-100' : ''}`}
                            >
                                <span className="text-[13px] text-slate-500 shrink-0">{row.label}</span>
                                <span className="text-[13px] font-semibold text-slate-700 text-right break-words ml-auto">{row.value}</span>
                            </div>
                        ))}

                    {(doc?.attachment || cardAttachments.length > 0) && (
                        <div className="mt-4 pt-4 border-t border-slate-50">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Warranty Documents</h4>
                            <div className="space-y-2">
                                {doc?.attachment && (
                                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-teal-600 shadow-sm shrink-0">
                                                <FileText size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold text-slate-700 truncate">Warranty Certificate</p>
                                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Primary Document</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openFilePreview(doc.attachment, doc?.type || 'Document')}
                                            className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                        >
                                            <Eye size={12} /> View
                                        </button>
                                    </div>
                                )}
                                {cardAttachments.map((att, attIdx) => (
                                    <div key={att._id || attIdx} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-teal-600 shadow-sm shrink-0">
                                                <FileText size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold text-slate-700 truncate">{att.description || 'Document'}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openFilePreview(att.attachment, att?.name || 'Attachment')}
                                            className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                        >
                                            <Eye size={12} /> View
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const clearDocTabModalContext = () => {
        setDocTabRegistrationOverride(null);
        setDocTabInsuranceDoc(null);
        setDocTabWarrantyDoc(null);
    };

    const calculateDaysLeft = (date) => {
        if (!date) return null;
        const diff = new Date(date) - new Date();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    };

    const getExpiryColor = (days) => {
        if (days === null) return 'bg-white/20';
        if (days < 0) return 'bg-rose-400';
        if (days < 30) return 'bg-orange-400';
        return 'bg-emerald-400';
    };

    const registrationDoc = resolveLiveRegistrationDoc(vehicleDocumentLifecycleBuckets?.live);
    const registrationAttachments = registrationAttachmentsForDoc(registrationDoc, asset?.documents || []);
    let registrationMeta = { fee: null, notes: [] };
    if (registrationDoc?.description) {
        try {
            const parsed = JSON.parse(registrationDoc.description);
            registrationMeta = {
                fee: parsed?.fee ?? null,
                notes: Array.isArray(parsed?.notes) ? parsed.notes.filter((n) => n && n.description) : [],
            };
        } catch {
            registrationMeta = { fee: null, notes: [] };
        }
    }

    const insuranceDoc = resolveLiveInsuranceDoc(vehicleDocumentLifecycleBuckets?.live);
    const insuranceAttachments = insuranceAttachmentsForDoc(insuranceDoc, asset?.documents || []);
    let insuranceMeta = { policy: '', company: '', premiumAmount: null, excessCharge: null };
    if (insuranceDoc?.description) {
        try {
            const parsed = JSON.parse(insuranceDoc.description);
            insuranceMeta = {
                policy: parsed?.policy != null ? String(parsed.policy) : '',
                company: parsed?.company || '',
                premiumAmount: parsed?.premiumAmount || parsed?.value || null,
                excessCharge: parsed?.excessCharge || null,
            };
        } catch {
            insuranceMeta = { policy: '', company: '', premiumAmount: null, excessCharge: null };
        }
    }

    const warrantyDoc = resolveLiveWarrantyDoc(vehicleDocumentLifecycleBuckets?.live);
    const warrantyAttachments = warrantyAttachmentsForDoc(warrantyDoc, asset?.documents || []);
    let warrantyMeta = { km: '', currentKm: '', endKm: '', warrantyBy: '', warrantyCovered: [] };
    if (warrantyDoc?.description) {
        try {
            const parsed = JSON.parse(warrantyDoc.description);
            const currentKmRaw =
                parsed?.currentKm != null ? parsed.currentKm : parsed?.km != null ? parsed.km : '';
            warrantyMeta = {
                km: currentKmRaw !== '' ? String(currentKmRaw) : '',
                currentKm: currentKmRaw !== '' ? String(currentKmRaw) : '',
                endKm: parsed?.endKm != null ? String(parsed.endKm) : '',
                warrantyBy: parsed?.warrantyBy || '',
                warrantyCovered: Array.isArray(parsed?.warrantyCovered) ? parsed.warrantyCovered : [],
            };
        } catch {
            warrantyMeta = { km: '', currentKm: '', endKm: '', warrantyBy: '', warrantyCovered: [] };
        }
    }

    const hasRegistrationCardData = Boolean(
        registrationDoc?.issueDate ||
        registrationDoc?.expiryDate ||
        registrationDoc?.attachment ||
        registrationMeta?.fee != null ||
        (registrationAttachments && registrationAttachments.length > 0)
    );

    const hasInsuranceCardData = Boolean(
        insuranceDoc?.issueDate ||
        insuranceDoc?.expiryDate ||
        insuranceDoc?.attachment ||
        (insuranceMeta?.policy && String(insuranceMeta.policy).trim()) ||
        (insuranceMeta?.company && String(insuranceMeta.company).trim()) ||
        insuranceMeta?.premiumAmount != null ||
        insuranceMeta?.excessCharge != null ||
        (insuranceAttachments && insuranceAttachments.length > 0)
    );

    const parseWarrantyEnabled = (value) => {
        if (typeof value === 'boolean') return value;
        const raw = String(value || '').toLowerCase().trim();
        if (['yes', 'true', '1', 'enabled', 'active'].includes(raw)) return true;
        if (['no', 'false', '0', 'disabled', 'inactive'].includes(raw)) return false;
        return null;
    };
    const warrantyEnabledFromAsset =
        parseWarrantyEnabled(asset?.warrantyEnabled) ??
        parseWarrantyEnabled(asset?.warranty) ??
        parseWarrantyEnabled(asset?.isWarranty) ??
        parseWarrantyEnabled(asset?.hasWarranty) ??
        parseWarrantyEnabled(asset?.warrantyRequired);
    const warrantyCurrentKmEffective =
        warrantyMeta?.currentKm ??
        warrantyMeta?.km ??
        asset?.warrantyKm ??
        asset?.warrantyKM ??
        asset?.kmWarranty ??
        '';
    const warrantyEndKmEffective = warrantyMeta?.endKm ?? '';
    const hasWarrantyCurrentKmValue = !(
        warrantyCurrentKmEffective === null ||
        warrantyCurrentKmEffective === undefined ||
        String(warrantyCurrentKmEffective).trim() === ''
    );
    const hasWarrantyEndKmValue = !(
        warrantyEndKmEffective === null ||
        warrantyEndKmEffective === undefined ||
        String(warrantyEndKmEffective).trim() === ''
    );
    const warrantyKmForHeader = hasWarrantyEndKmValue
        ? warrantyEndKmEffective
        : (asset?.warrantyKm ?? asset?.warrantyKM ?? (hasWarrantyCurrentKmValue ? warrantyCurrentKmEffective : ''));
    const warrantyKmEffective = warrantyKmForHeader;
    const hasWarrantyKmValue = !(
        warrantyKmEffective === null ||
        warrantyKmEffective === undefined ||
        String(warrantyKmEffective).trim() === ''
    );
    const warrantyByEffective =
        warrantyMeta?.warrantyBy ||
        asset?.warrantyBy ||
        asset?.warrantyProvider ||
        '';
    const warrantyStartEffective =
        warrantyDoc?.issueDate ||
        asset?.warrantyStartDate ||
        asset?.warrantyIssueDate ||
        '';
    const warrantyEndEffective =
        warrantyDoc?.expiryDate ||
        asset?.warrantyExpiryDate ||
        asset?.warrantyEndDate ||
        asset?.warrantyDate ||
        '';
    const hasWarrantyDocumentData = Boolean(
        warrantyStartEffective ||
        warrantyEndEffective ||
        hasWarrantyKmValue ||
        (warrantyByEffective && String(warrantyByEffective).trim()) ||
        (warrantyAttachments && warrantyAttachments.length > 0)
    );
    const warrantyRequiredForCompletion = (() => {
        if (typeof warrantyEnabledFromAsset === 'boolean') return warrantyEnabledFromAsset;
        return hasWarrantyDocumentData;
    })();

    const vehicleExpirySources = resolveVehicleExpirySources(asset, vehicleDocumentLifecycleBuckets?.live);

    const dispositionWorkflowStage = String(asset?.vehicleDispositionWorkflow?.stage || '').toLowerCase();
    const dispositionTargetLabel =
        String(asset?.vehicleDispositionWorkflow?.targetStatus || '').toLowerCase() === 'sold'
            ? 'Sold'
            : 'Total loss';

    const canReviewDispositionHr = !!asset && dispositionWorkflowStage === 'pending_hr' && isFlowchartHr;
    const canSubmitDispositionAccounts =
        !!asset &&
        dispositionWorkflowStage === 'pending_finance' &&
        !asset.vehicleDispositionWorkflow?.accountsCompletedAt &&
        isFlowchartAccounts;
    const canSubmitDispositionManagement =
        !!asset &&
        dispositionWorkflowStage === 'pending_finance' &&
        !asset.vehicleDispositionWorkflow?.managementCompletedAt &&
        isFlowchartManagement;
    const showDispositionReviewControl =
        canReviewDispositionHr || canSubmitDispositionAccounts || canSubmitDispositionManagement;

    const isVehicleProfileActivationSubmitter =
        !!asset?.vehicleProfileActivationSubmittedBy &&
        !!currentUserEmployeeId &&
        String(asset.vehicleProfileActivationSubmittedBy) === String(currentUserEmployeeId);

    const holdNote = String(asset?.vehicleProfileActivationHold?.comment || '').trim();

    const { profilePct } = computeVehicleProfileCompletionPercent(asset);

    const vehicleDispositionKey = String(asset?.vehicleDispositionStatus || 'active').toLowerCase().trim();
    const isDisposedFleetProfile =
        vehicleDispositionKey === 'sold' || vehicleDispositionKey === 'total loss';

    const canSubmitVehicleProfileActivation =
        profilePct === 100 &&
        !isDisposedFleetProfile &&
        !isFlowchartHr &&
        (vehicleActPhase === 'inactive' ||
            vehicleActPhase === 'rejected' ||
            (vehicleActPhase === 'on_hold' && isVehicleProfileActivationSubmitter));

    const showVehicleProfileReviewBanner = profilePct === 100 && vehicleActPhase === 'pending_review';

    const canReviewVehicleProfileActivation =
        !!asset && showVehicleProfileReviewBanner && isFlowchartHr;

    const vehicleEditReviewStatus = String(asset?.vehicleProfileEditReviewStatus || 'none').toLowerCase();
    const vehicleProfileEditQueued = hasVehicleProfileEditQueue(asset);
    const showVehicleProfileEditReviewBanner =
        vehicleActPhase === 'active' && vehicleEditReviewStatus === 'pending_hr';
    const canReviewVehicleProfileEdit = !!asset && showVehicleProfileEditReviewBanner && isFlowchartHr;
    const isVehicleProfileEditSubmitter =
        !!asset?.vehicleProfileEditSubmittedBy &&
        !!currentUserEmployeeId &&
        String(asset.vehicleProfileEditSubmittedBy) === String(currentUserEmployeeId);
    const canSubmitVehicleProfileEdit =
        vehicleActPhase === 'active' &&
        vehicleProfileEditQueued &&
        (vehicleEditReviewStatus === 'draft' || vehicleEditReviewStatus === 'rejected');
    const showVehicleProfileEditDraftBanner =
        canSubmitVehicleProfileEdit && !isFlowchartHr;

    const vehicleInspectionStatus = String(asset?.vehicleInspectionStatus || 'none').toLowerCase();

    const profileInactiveForInspection =
        vehicleActPhase === 'inactive' ||
        vehicleActPhase === 'none' ||
        vehicleActPhase === 'rejected' ||
        vehicleActPhase === 'on_hold' ||
        vehicleActPhase === 'pending_review';

    const isCreateInspectionDisabled = (() => {
        if (isFlowchartAdminController) return false;
        if (!currentUserEmployeeId) return true;
        if (vehicleInspectionStatus === 'draft') return true;
        if (vehicleInspectionStatus === 'pending_hr') return true;
        if (profileInactiveForInspection) {
            return true;
        }
        if (vehicleActPhase !== 'active') return true;
        return false;
    })();

    const createInspectionDisabledReason = (() => {
        if (isFlowchartAdminController) return '';
        if (!currentUserEmployeeId) {
            return 'Your login must be linked to an employee profile.';
        }
        if (vehicleInspectionStatus === 'draft') {
            return 'Complete the inspection assessment in the handover table.';
        }
        if (vehicleInspectionStatus === 'pending_hr') {
            return 'Awaiting HR approval on your request.';
        }
        if (profileInactiveForInspection) {
            return 'Only the flowchart Admin Officer can request inspection while the profile is inactive.';
        }
        if (vehicleActPhase !== 'active' && !profileInactiveForInspection) {
            return 'Available after the vehicle profile is activated.';
        }
        return '';
    })();

    const canRequestVehicleInspection = !isCreateInspectionDisabled;

    const showVehicleInspectionReviewBanner =
        vehicleActPhase === 'active' && vehicleInspectionStatus === 'pending_hr';
    const canReviewVehicleInspection = !!asset && showVehicleInspectionReviewBanner && isFlowchartHr;
    const isVehicleInspectionSubmitter =
        !!asset?.vehicleInspectionSubmittedBy &&
        !!currentUserEmployeeId &&
        String(asset.vehicleInspectionSubmittedBy) === String(currentUserEmployeeId);

    const vehicleMortgageCloseStatus = String(asset?.vehicleMortgageCloseStatus || 'none').toLowerCase();
    const showVehicleMortgageCloseReviewBanner =
        vehicleActPhase === 'active' && vehicleMortgageCloseStatus === 'pending_hr';
    const canReviewVehicleMortgageClose = !!asset && showVehicleMortgageCloseReviewBanner && isFlowchartHr;
    const isVehicleMortgageCloseSubmitter =
        !!asset?.vehicleMortgageCloseSubmittedBy &&
        !!currentUserEmployeeId &&
        String(asset.vehicleMortgageCloseSubmittedBy) === String(currentUserEmployeeId);

    const resolveFleetActionRequiredById = (vehicleAsset) => {
        const approver = vehicleAsset?.actionRequiredBy;
        if (!approver) return null;
        return (approver._id || approver).toString();
    };

    const fleetProfileActiveForAssignment = isVehicleProfileActiveForAssignment(vehicleActPhase);

    const guardFleetAssignmentProfileActive = () => {
        if (fleetProfileActiveForAssignment) return true;
        toast({
            variant: 'destructive',
            title: 'Profile not active',
            description:
                'Assign, reassign, and return are only available after the vehicle profile is activated.',
        });
        return false;
    };

    const canAssignFleetVehicle = isFlowchartAdminController;

    const isVehicleAssignedStatus =
        String(asset?.status || '').trim().toLowerCase() === 'assigned';

    const canManageFleetHandoverAssignment =
        isFlowchartAdminController ||
        (isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser) &&
            isVehicleAssignedStatus);

    const canApplyVehicleDocRenewalDirectly =
        isFlowchartHr || canManageFleetHandoverAssignment;

    const handleAdminDeleteMortgage = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete mortgage?',
            description:
                'This permanently removes all live mortgage details from this vehicle. Archived mortgage rows in Old Documents must be deleted separately from the Document tab.',
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                try {
                    await axiosInstance.put(`/AssetType/${assetId}`, {
                        mortgageBankName: '',
                        mortgageVehicleName: '',
                        mortgageAmount: 0,
                        loanAmount: 0,
                        downPayment: 0,
                        interestRate: 0,
                        loanTenureMonths: 0,
                        mortgageStartDate: null,
                        mortgageEndDate: null,
                        monthlyPayment: 0,
                        balancePayment: 0,
                        processCharge: 0,
                        totalInterest: 0,
                        totalPayable: 0,
                        currentLoanAmount: 0,
                        mortgageBankDocument: null,
                        mortgageSecurityCheckAttachment: null,
                        mortgageScheduleListAttachment: null,
                        mortgageExtraAttachments: [],
                        mortgageBank: '',
                    });
                    toast({ title: 'Deleted', description: 'Mortgage details removed.' });
                    fetchAssetDetails();
                } catch (error) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: error?.response?.data?.message || 'Failed to delete mortgage details.',
                    });
                }
            },
        });
    };

    const openHandoverForAssignment = () => {
        if (!guardFleetAssignmentProfileActive()) return;
        const inspectionStatus = String(asset?.vehicleInspectionStatus || 'none').toLowerCase();
        if (inspectionStatus === 'draft' || inspectionStatus === 'pending_hr') {
            toast({
                variant: 'destructive',
                title: 'Inspection not complete',
                description:
                    inspectionStatus === 'pending_hr'
                        ? 'Approve the vehicle inspection handover (HR step) before assigning or reassigning.'
                        : 'Complete and approve the vehicle inspection handover before assigning or reassigning.',
            });
            return;
        }
        const assigned = !!(asset?.assignedTo || asset?.assignedCompany);
        if (!assigned && !canAssignFleetVehicle) {
            toast({
                variant: 'destructive',
                title: 'Not allowed',
                description: 'Only the flowchart Admin Officer can assign fleet vehicles.',
            });
            return;
        }
        setActiveTab('handover');
        setShowAssignModal(true);
    };

    const openReturnAssetModal = () => {
        if (!guardFleetAssignmentProfileActive()) return;
        setShowReturnModal(true);
    };

    const submitReturnAsset = async () => {
        if (!asset?._id) return;
        if (!guardFleetAssignmentProfileActive()) return;
        setIsReturning(true);
        try {
            const response = await axiosInstance.put(`/AssetItem/${asset._id}/return`, {}, {
                timeout: 30000,
                skipToast: true,
            });
            const updated = response?.data?.asset || response?.data;
            if (updated?._id) {
                setAsset((prev) => (prev ? { ...prev, ...updated } : updated));
            }
            toast({
                title: 'Success',
                description: response?.data?.message || 'Return request processed.',
            });
            setShowReturnModal(false);
            void fetchAssetDetails({ silent: true });
            void fetchAssetHistory();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to return vehicle.',
            });
        } finally {
            setIsReturning(false);
        }
    };

    const handleFleetWorkflowApproval = async (approve) => {
        if (!asset?._id) return;
        setIsProcessingFleetActionApproval(true);
        try {
            const { data } = await axiosInstance.put(`/AssetItem/${asset._id}/approve-action`, {
                approve,
                comment: '',
            }, { skipToast: true, timeout: 30000 });
            const updated = data?.asset || data;
            if (updated?._id) {
                setAsset((prev) => (prev ? { ...prev, ...updated } : updated));
            }
            toast({
                title: approve ? 'Approved' : 'Rejected',
                description: approve
                    ? 'The vehicle workflow request was approved.'
                    : 'The vehicle workflow request was rejected.',
            });
            void fetchAssetDetails({ silent: true });
            void fetchAssetHistory();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to process request.',
            });
        } finally {
            setIsProcessingFleetActionApproval(false);
        }
    };

    const handleVehicleInspectionApproval = async (approved) => {
        setIsProcessingInspectionApproval(true);
        try {
            const endpoint = approved
                ? `/AssetItem/${assetId}/approve-vehicle-inspection`
                : `/AssetItem/${assetId}/reject-vehicle-inspection`;
            await axiosInstance.post(endpoint);
            toast({
                title: approved ? 'Approved' : 'Rejected',
                description: approved
                    ? 'Vehicle inspection record has been created.'
                    : 'The inspection create request was rejected.',
            });
            fetchAssetDetails();
            fetchAssetHistory();
            invalidateAssetPendingInbox('vehicle');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to process inspection request.',
            });
        } finally {
            setIsProcessingInspectionApproval(false);
        }
    };

    const openApproveVehicleInspection = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Approve vehicle inspection?',
            description:
                'This will create the first vehicle inspection record on this vehicle. The full inspection form is still under development.',
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                await handleVehicleInspectionApproval(true);
            },
        });
    };

    const openRejectVehicleInspection = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Reject vehicle inspection request?',
            description: 'The submitter will be notified. They may submit a new request later.',
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                await handleVehicleInspectionApproval(false);
            },
        });
    };

    const handleVehicleMortgageCloseApproval = async (approved) => {
        setIsProcessingMortgageCloseApproval(true);
        try {
            const endpoint = approved
                ? `/AssetItem/${assetId}/approve-vehicle-mortgage-close`
                : `/AssetItem/${assetId}/reject-vehicle-mortgage-close`;
            await axiosInstance.post(endpoint);
            toast({
                title: approved ? 'Approved' : 'Rejected',
                description: approved
                    ? 'Mortgage archived to Old Documents and removed from live records.'
                    : 'The mortgage close request was rejected.',
            });
            fetchAssetDetails();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to process mortgage close request.',
            });
        } finally {
            setIsProcessingMortgageCloseApproval(false);
        }
    };

    const openApproveVehicleMortgageClose = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Approve mortgage close?',
            description:
                'This will archive the mortgage to Old Documents and clear live mortgage details on this vehicle.',
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                await handleVehicleMortgageCloseApproval(true);
            },
        });
    };

    const openRejectVehicleMortgageClose = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Reject mortgage close request?',
            description: 'The submitter will be notified. Live mortgage details will remain unchanged.',
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                await handleVehicleMortgageCloseApproval(false);
            },
        });
    };

    const currentUserIsVehicleAssignee = isCurrentUserVehicleAssignee(
        asset,
        currentUserEmployeeId,
        currentUser,
    );
    const fleetAssigneeReassignRequest =
        !!asset &&
        currentUserIsVehicleAssignee &&
        isVehicleActivelyAssigned(asset) &&
        !canManageFleetHandoverAssignment;

    const isAssigneeFleetReassignSubmitter =
        !!asset &&
        asset.pendingAction === 'Reassign Asset' &&
        !!currentUserEmployeeId &&
        (String(asset.pendingActionDetails?.requestedBy || '') === String(currentUserEmployeeId) ||
            isCurrentUserVehicleAssignee(asset, currentUserEmployeeId, currentUser));

    const vehicleHandoverCardActionButtons = evaluateVehicleHandoverCardActions({
        asset,
        canAssignFleetVehicle,
        canManageAssignment: canManageFleetHandoverAssignment,
        currentUserEmployeeId,
        currentUser,
        vehicleActPhase,
        onAssign: openHandoverForAssignment,
        onReassign: openHandoverForAssignment,
        onReturn: openReturnAssetModal,
        onCreateInspection: async () => {
            if (isCreatingInspection || !assetId) return;
            if (!isFlowchartAdminController && isCreateInspectionDisabled) return;

            if (isFlowchartAdminController) {
                if (vehicleInspectionStatus === 'draft' || vehicleInspectionStatus === 'pending_hr') {
                    setActiveTab('handover');
                    toast({
                        title:
                            vehicleInspectionStatus === 'draft'
                                ? 'Inspection in progress'
                                : 'Pending HR approval',
                        description:
                            vehicleInspectionStatus === 'draft'
                                ? 'Open the handover row to complete the vehicle accessories.'
                                : 'This inspection request is awaiting HR approval.',
                    });
                    return;
                }
            }

            setIsCreatingInspection(true);
            try {
                await axiosInstance.post(`/AssetItem/${assetId}/submit-vehicle-inspection-request`);
                toast({
                    title: 'Inspection created',
                    description: 'A handover row was added. Open View to complete the vehicle accessories.',
                });
                setActiveTab('handover');
                await fetchAssetDetails({ deferServiceSigning: true, silent: false });
                invalidateAssetPendingInbox('vehicle');
                await fetchAssetHistory({ forHandover: true });
            } catch (err) {
                toast({
                    variant: 'destructive',
                    title: 'Create failed',
                    description: err.response?.data?.message || 'Could not create inspection handover.',
                });
            } finally {
                setIsCreatingInspection(false);
            }
        },
        isCreateInspectionDisabled:
            (isFlowchartAdminController ? false : isCreateInspectionDisabled) || isCreatingInspection,
        createInspectionDisabledReason: isCreatingInspection
            ? 'Creating inspection…'
            : createInspectionDisabledReason,
    });

    const isFleetWorkflowPendingForHr =
        !!asset?.pendingAction &&
        (asset.pendingAction === 'Return Asset' || asset.pendingAction === 'Reassign Asset') &&
        (isFlowchartHr ||
            isAdmin ||
            checkIsAdmin() ||
            currentUser?.isAdministrator === true ||
            (permissionsMounted &&
                (hasPermission('hrm_asset', 'isEdit') || hasPermission('hrm_asset_vehicle', 'isEdit'))));

    const openApproveVehicleProfileEdit = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Approve profile edits?',
            description:
                'This will apply all pending changes to basic details, registration, insurance, or profile photo.',
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                try {
                    await axiosInstance.post(`/AssetItem/${assetId}/approve-vehicle-profile-edit`);
                    toast({ title: 'Approved', description: 'Profile edits applied.' });
                    fetchAssetDetails();
                } catch (err) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: err.response?.data?.message || 'Failed to approve edits.',
                    });
                }
            },
        });
    };

    const openRejectVehicleProfileEdit = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Reject profile edits?',
            description: 'Pending changes will be discarded. The submitter will be notified.',
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                try {
                    await axiosInstance.post(`/AssetItem/${assetId}/reject-vehicle-profile-edit`, { reason: '' });
                    toast({ title: 'Rejected', description: 'Profile edit request rejected.' });
                    fetchAssetDetails();
                } catch (err) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: err.response?.data?.message || 'Failed to reject edits.',
                    });
                }
            },
        });
    };

    const openQuickApproveVehicleProfileActivation = () => {
        if (!vehicleActivationApprovedSectionsPayload.length) {
            toast({
                variant: 'destructive',
                title: 'Nothing to approve',
                description: 'No sections were included in this request.',
            });
            return;
        }
        const assigneeLabel = vehicleProfileActivationHrName || 'HR';
        setConfirmDialog({
            isOpen: true,
            title: 'Accept all sections?',
            description: `This approves every section in the request and completes profile activation. Only ${assigneeLabel} had the pending dashboard task; it will be cleared after approval.`,
            onConfirm: async () => {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                try {
                    await axiosInstance.post(`/AssetItem/${assetId}/approve-vehicle-profile-activation`, {
                        selectionProvided: true,
                        approvedSections: vehicleActivationApprovedSectionsPayload,
                    });
                    toast({ title: 'Approved', description: 'Vehicle profile activation approved.' });
                    fetchAssetDetails();
                } catch (err) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: err.response?.data?.message || 'Failed to approve.',
                    });
                }
            },
        });
    };

    const petrolDoc = asset?.documents?.find(d => (d.type || '').toLowerCase() === 'petrol') || null;
    const petrolAttachments = (asset?.documents || []).filter(
        (d) => (d.type || '').toLowerCase() === 'petrol attachment'
    );
    let petrolMeta = { vendor: '', tagNo: '', limit: '' };
    if (petrolDoc?.description) {
        try {
            const parsed = JSON.parse(petrolDoc.description);
            petrolMeta = {
                vendor: parsed?.vendor || '',
                tagNo: parsed?.tagNo || '',
                limit: parsed?.limit || '',
            };
        } catch {
            petrolMeta = { vendor: '', tagNo: '', limit: '' };
        }
    }

    const hasPetrolCardData = Boolean(
        petrolDoc?.issueDate ||
        petrolDoc?.attachment ||
        petrolMeta?.vendor ||
        petrolMeta?.tagNo ||
        (petrolAttachments && petrolAttachments.length > 0)
    );

    const tollDoc = asset?.documents?.find(d => (d.type || '').toLowerCase() === 'toll') || null;
    const tollAttachments = (asset?.documents || []).filter(
        (d) => (d.type || '').toLowerCase() === 'toll attachment'
    );
    let tollMeta = { vendor: '', tagNo: '', tagDetails: '', pinNo: '', accountNo: '', limit: '' };
    if (tollDoc?.description) {
        try {
            const parsed = JSON.parse(tollDoc.description);
            const tagDetails = parsed?.tagDetails || parsed?.tagNo || '';
            tollMeta = {
                vendor: parsed?.vendor || '',
                tagNo: parsed?.tagNo || '',
                tagDetails,
                pinNo: parsed?.pinNo || '',
                accountNo: parsed?.accountNo || '',
                limit: parsed?.limit || '',
            };
        } catch {
            tollMeta = { vendor: '', tagNo: '', tagDetails: '', pinNo: '', accountNo: '', limit: '' };
        }
    }

    const hasTollCardData = Boolean(
        tollDoc?.attachment ||
        tollMeta?.vendor ||
        tollMeta?.tagDetails ||
        tollMeta?.tagNo ||
        tollMeta?.pinNo ||
        tollMeta?.accountNo ||
        (tollAttachments && tollAttachments.length > 0)
    );

    const permitDocs = vehicleDocumentLifecycleBuckets?.live?.permit || [];
    const permitCards = permitDocs.map((d) => {
        let meta = { documentType: '', permitName: '', descriptionText: '' };
        if (d?.description) {
            try {
                const parsed = JSON.parse(d.description);
                meta = {
                    documentType: parsed?.documentType || '',
                    permitName: parsed?.permitName || parsed?.permitType || '',
                    descriptionText: parsed?.descriptionText || '',
                };
            } catch {
                meta = { documentType: '', permitName: '', descriptionText: '' };
            }
        }
        return { doc: d, meta };
    });

    const primaryPermit = permitCards.find((pc) => pc.doc?.expiryDate || (pc.meta?.permitType && String(pc.meta.permitType).trim()));
    let permitHint = '';
    if (primaryPermit?.meta?.unlimited) {
        permitHint = `${primaryPermit.meta.permitType || 'Permit'} · Unlimited`;
    } else if (primaryPermit?.doc?.expiryDate) {
        permitHint = `${primaryPermit.meta.permitType || 'Permit'} · Expires ${formatDate(primaryPermit.doc.expiryDate)}`;
    } else if (primaryPermit?.meta?.permitType) {
        permitHint = primaryPermit.meta.permitType;
    }

    const mortgageAttachmentRows = [
        { label: 'Security Check Attachment', file: asset?.mortgageSecurityCheckAttachment || null },
        { label: 'Schedule List Attachment', file: asset?.mortgageScheduleListAttachment || null },
        ...(Array.isArray(asset?.mortgageExtraAttachments) ? asset.mortgageExtraAttachments : []),
    ].filter((row) => row?.file);
    const hasMortgageData = Boolean(
        (asset?.mortgageBankName && String(asset.mortgageBankName).trim()) ||
        (asset?.mortgageVehicleName && String(asset.mortgageVehicleName).trim()) ||
        Number(asset?.mortgageAmount || 0) > 0 ||
        Number(asset?.downPayment || 0) > 0 ||
        Number(asset?.interestRate || 0) > 0 ||
        Number(asset?.loanTenureMonths || 0) > 0 ||
        asset?.mortgageStartDate ||
        asset?.mortgageEndDate ||
        Number(asset?.monthlyPayment || 0) > 0 ||
        Number(asset?.balancePayment || 0) > 0 ||
        Number(asset?.processCharge || 0) > 0 ||
        mortgageAttachmentRows.length > 0
    );

    const getVehicleIcon = () => {
        const type = getVehicleBrandLabel(asset).toLowerCase();
        if (type.includes('car')) return <Car size={64} strokeWidth={1} />;
        if (type.includes('van') || type.includes('pickup') || type.includes('truck') || type.includes('bus')) {
            return <Truck size={64} strokeWidth={1} />;
        }
        return <Truck size={64} strokeWidth={1} />; // Default
    };

    return (
        <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#F2F6F9]">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                <div className="p-8">

                    {/* Header + creation approval (aligned with main asset detail page) */}
                    <div className="flex flex-col gap-4 mb-8">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <ListReturnBackButton onNavigate={handleListReturnBack} />
                                {asset &&
                                    isCreatorUser &&
                                    ((asset.status === 'Draft' && !asset.actionRequiredBy) || asset.status === 'Rejected') ? (
                                    <button
                                        type="button"
                                        onClick={() => setEditVehicleModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-bold shadow-sm hover:bg-slate-50"
                                    >
                                        <PencilLine size={16} />
                                        Edit vehicle
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        {asset && (() => {
                            const isCreatorForBanner =
                                asset?.createdBy?._id?.toString() === currentUserId ||
                                asset?.createdBy?.toString() === currentUserId;
                            const isAssignmentAcknowledgmentCase =
                                asset?.acceptanceStatus === 'Pending' &&
                                !asset?.pendingAction &&
                                (asset?.status === 'Pending' || asset?.status === 'Assigned') &&
                                (asset?.assignedTo || asset?.assignedCompany);

                            const isSaveOnlyDraft =
                                asset?.status === 'Draft' &&
                                !asset?.actionRequiredBy &&
                                !asset?.creationReturnedToDraftAt;
                            const isReturnedForResubmit =
                                asset?.status === 'Draft' &&
                                !asset?.actionRequiredBy &&
                                !!asset?.creationReturnedToDraftAt;
                            const isAwaitingCreationApprovalUi =
                                asset?.status === 'Submitted for Approval' ||
                                (!isSaveOnlyDraft &&
                                    asset?.status === 'Draft' &&
                                    asset?.actionRequiredBy) ||
                                (asset?.actionRequiredBy != null &&
                                    asset?.status === 'Pending' &&
                                    !isAssignmentAcknowledgmentCase &&
                                    !asset?.pendingAction);

                            if (isReturnedForResubmit && isCreatorForBanner) {
                                return (
                                    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Not approved</p>
                                            <p className="text-[13px] font-bold text-rose-950 leading-snug">
                                                This vehicle was returned to draft. Update details if needed, then publish to the fleet list.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSubmitDraftForApproval()}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                        >
                                            Publish vehicle
                                        </button>
                                    </div>
                                );
                            }

                            if (isSaveOnlyDraft && isCreatorForBanner) {
                                return (
                                    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                                            <Plus size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Draft</p>
                                            <p className="text-[13px] font-bold text-slate-900 leading-snug">
                                                Saved as draft — not on the fleet list yet. Use <strong>Publish vehicle</strong> when
                                                ready, then complete the profile and submit for activation.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSubmitDraftForApproval()}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                        >
                                            Publish vehicle
                                        </button>
                                    </div>
                                );
                            }

                            if (!isAwaitingCreationApprovalUi || vehicleActStatus === 'active') return null;

                            const approverName = getAssetApproverDisplayName(asset);
                            const showActions =
                                asset.canApproveAssetCreation === true ||
                                asset.canApproveAssetCreation === 'true';

                            if (showActions) {
                                return (
                                    <div id="asset-focus-pendingApproval" className="flex flex-wrap items-center gap-4 px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                            <Plus size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Vehicle creation approval</p>
                                            <p className="text-[13px] font-bold text-amber-900 leading-snug">
                                                {asset?.status === 'Submitted for Approval'
                                                    ? `Submitted for approval — awaiting HR${approverName ? ` (${approverName})` : ''}. On approve, the vehicle stays inactive until profile activation.`
                                                    : asset?.status === 'Draft'
                                                        ? `Draft pending HR review${approverName ? ` — ${approverName}` : ''}.`
                                                        : `Awaiting HR creation approval${approverName ? ` — ${approverName}` : ''}.`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                disabled={!!creationDecisionBusy}
                                                onClick={() => handleAssetCreationResponse('Approve')}
                                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md inline-flex items-center justify-center gap-2 min-w-[7.5rem]"
                                            >
                                                {creationDecisionBusy === 'Approve' ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Approve'
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!!creationDecisionBusy}
                                                onClick={() => handleAssetCreationResponse('Reject')}
                                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md inline-flex items-center justify-center gap-2 min-w-[7.5rem]"
                                            >
                                                {creationDecisionBusy === 'Reject' ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Reject'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div className="flex items-center gap-4 px-6 py-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                                    <RefreshCw size={18} className="text-amber-600 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pending approval</p>
                                        <p className="text-[13px] font-bold text-amber-900">
                                            Awaiting HR{approverName ? ` — ${approverName}` : ''}…
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                        {asset && showVehicleProfileReviewBanner && (
                            <div id="asset-focus-pendingApproval" className="flex flex-wrap items-center gap-4 px-6 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">
                                        Vehicle profile review
                                    </p>
                                    <p className="text-[13px] font-bold text-emerald-950 leading-snug">
                                        Profile submitted for <strong>HR</strong> review (flowchart).
                                        {vehicleProfileActivationHrName ? (
                                            <>
                                                {' '}
                                                <strong>{vehicleProfileActivationHrName}</strong> is assigned — only HR
                                                sees the dashboard task until it is actioned.
                                            </>
                                        ) : (
                                            <>Only the flowchart <strong>HR</strong> assignee sees the dashboard task.</>
                                        )}
                                        {canReviewVehicleProfileActivation ? (
                                            <span className="block mt-1.5 text-[12px] font-semibold text-emerald-900">
                                                Use <strong>Approve</strong> when the profile is ready, or{' '}
                                                <strong>Reject</strong> with a reason.
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                {canReviewVehicleProfileActivation ? (
                                    <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={openQuickApproveVehicleProfileActivation}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowVehicleActivationReviewModal(true)}
                                            className="px-5 py-2.5 border-2 border-red-600 bg-white text-red-700 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        title={
                                            vehicleProfileActivationHrName
                                                ? `Waiting for ${vehicleProfileActivationHrName} (HR).`
                                                : 'Only flowchart HR can complete this review.'
                                        }
                                        className="px-5 py-2.5 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-[10px] font-black uppercase tracking-widest shrink-0 cursor-default opacity-90 max-w-[220px] sm:max-w-none text-center leading-tight"
                                    >
                                        {vehicleProfileActivationHrName
                                            ? `Awaiting ${vehicleProfileActivationHrName}`
                                            : 'Awaiting HR review'}
                                    </button>
                                )}
                            </div>
                        )}
                        {asset && showVehicleProfileEditReviewBanner && (
                            <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-violet-50 border border-violet-200 rounded-2xl shadow-sm mt-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-violet-600 uppercase tracking-widest leading-none mb-1">
                                        Profile edit review
                                    </p>
                                    <p className="text-[13px] font-bold text-violet-950 leading-snug">
                                        A user submitted changes to basic details, registration, insurance, or profile
                                        photo on this <strong>active</strong> vehicle. HR approval is required before
                                        changes apply.
                                    </p>
                                </div>
                                {canReviewVehicleProfileEdit ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setVehicleProfileEditModalReadOnly(true);
                                                setShowVehicleProfileEditSubmitModal(true);
                                            }}
                                            className="px-5 py-2.5 border-2 border-violet-600 bg-white text-violet-700 hover:bg-violet-50 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm"
                                        >
                                            View changes
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openApproveVehicleProfileEdit}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openRejectVehicleProfileEdit}
                                            className="px-5 py-2.5 border-2 border-red-600 bg-white text-red-700 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-800 shrink-0">
                                        Awaiting HR
                                    </span>
                                )}
                            </div>
                        )}
                        {asset && showVehicleProfileEditDraftBanner && (
                            <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-violet-50/80 border border-violet-100 rounded-2xl shadow-sm mt-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-violet-600 uppercase tracking-widest leading-none mb-1">
                                        Profile edits saved
                                    </p>
                                    <p className="text-[13px] font-bold text-violet-950 leading-snug">
                                        You have unsent changes to mandatory profile cards. Progress stays below 100%
                                        until HR approves. Submit when all edits are ready.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVehicleProfileEditModalReadOnly(false);
                                        setShowVehicleProfileEditSubmitModal(true);
                                    }}
                                    className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md shrink-0"
                                >
                                    Submit for HR approval
                                </button>
                            </div>
                        )}
                        {asset &&
                            vehicleActPhase === 'active' &&
                            vehicleEditReviewStatus === 'pending_hr' &&
                            !isFlowchartHr && (
                                <div className="flex items-center gap-4 px-6 py-4 bg-violet-50/60 border border-violet-100 rounded-2xl mt-3">
                                    <RefreshCw size={18} className="text-violet-600 shrink-0" />
                                    <p className="text-[13px] font-bold text-violet-900">
                                        Your profile edit request is awaiting HR approval. Live data is unchanged until
                                        approved.
                                    </p>
                                </div>
                            )}
                        {asset && showDispositionReviewControl && (
                            <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm mt-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest leading-none mb-1">
                                        Vehicle disposition — {dispositionTargetLabel}
                                    </p>
                                    <p className="text-[13px] font-bold text-amber-950">
                                        {canReviewDispositionHr
                                            ? 'HR review required (Accept / Reject).'
                                            : dispositionWorkflowStage === 'pending_finance'
                                              ? 'Either Accounts or Management may submit once — vehicle becomes Sold / Total loss and both tasks are cleared.'
                                              : canSubmitDispositionAccounts
                                                ? 'Accounts: open Review to submit.'
                                                : 'Management: open Review to submit.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (canReviewDispositionHr) setDispositionReviewMode('hr');
                                        else if (canSubmitDispositionAccounts) setDispositionReviewMode('accounts');
                                        else setDispositionReviewMode('management');
                                        setShowDispositionReviewModal(true);
                                    }}
                                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md shrink-0"
                                >
                                    Review request
                                </button>
                            </div>
                        )}
                        {asset && isAssigneeFleetReassignSubmitter && !isFleetWorkflowPendingForHr && (
                            <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm mt-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                                    <AlertCircle size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">
                                        Reassign request pending
                                    </p>
                                    <p className="text-[13px] font-bold text-amber-950 leading-snug">
                                        Your reassign request was sent to HR (email + dashboard task). The vehicle
                                        stays assigned to you until HR approves or rejects.
                                    </p>
                                </div>
                            </div>
                        )}
                        {asset && isFleetWorkflowPendingForHr && (
                            <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm mt-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                                    <AlertCircle size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">
                                        Vehicle {asset.pendingAction}
                                    </p>
                                    <p className="text-[13px] font-bold text-rose-900 leading-snug">
                                        {asset.pendingAction === 'Return Asset'
                                            ? 'An assigned employee requested to return this vehicle. HR approval is required.'
                                            : 'An assigned employee requested to reassign this vehicle. HR approval is required.'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleFleetWorkflowApproval(true)}
                                        disabled={isProcessingFleetActionApproval}
                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFleetWorkflowApproval(false)}
                                        disabled={isProcessingFleetActionApproval}
                                        className="px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-rose-100"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        )}
                        {asset && showVehicleInspectionReviewBanner && (
                            <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-sky-50 border border-sky-200 rounded-2xl shadow-sm mt-3">
                                <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700 shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest leading-none mb-1">
                                        Vehicle inspection request
                                    </p>
                                    <p className="text-[13px] font-bold text-sky-950 leading-snug">
                                        A user requested to create the first vehicle inspection record. HR approval is
                                        required before the record is created.
                                    </p>
                                </div>
                                {canReviewVehicleInspection ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={openApproveVehicleInspection}
                                            disabled={isProcessingInspectionApproval}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openRejectVehicleInspection}
                                            disabled={isProcessingInspectionApproval}
                                            className="px-5 py-2.5 border-2 border-red-600 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-800 shrink-0">
                                        Awaiting HR
                                    </span>
                                )}
                            </div>
                        )}
                        {asset &&
                            vehicleActPhase === 'active' &&
                            vehicleInspectionStatus === 'pending_hr' &&
                            isVehicleInspectionSubmitter &&
                            !isFlowchartHr && (
                                <div className="flex items-center gap-4 px-6 py-4 bg-sky-50/60 border border-sky-100 rounded-2xl mt-3">
                                    <RefreshCw size={18} className="text-sky-600 shrink-0" />
                                    <p className="text-[13px] font-bold text-sky-900">
                                        Your vehicle inspection create request is awaiting HR approval.
                                    </p>
                                </div>
                            )}
                        {asset && showVehicleMortgageCloseReviewBanner && (
                            <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-violet-50 border border-violet-200 rounded-2xl shadow-sm mt-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 shrink-0">
                                    <CreditCard size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest leading-none mb-1">
                                        Mortgage close request
                                    </p>
                                    <p className="text-[13px] font-bold text-violet-950 leading-snug">
                                        A user requested to close this vehicle mortgage. HR approval will archive it to
                                        Old Documents and remove live mortgage details.
                                    </p>
                                </div>
                                {canReviewVehicleMortgageClose ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={openApproveVehicleMortgageClose}
                                            disabled={isProcessingMortgageCloseApproval}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openRejectVehicleMortgageClose}
                                            disabled={isProcessingMortgageCloseApproval}
                                            className="px-5 py-2.5 border-2 border-red-600 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-800 shrink-0">
                                        Awaiting HR
                                    </span>
                                )}
                            </div>
                        )}
                        {asset &&
                            vehicleActPhase === 'active' &&
                            vehicleMortgageCloseStatus === 'pending_hr' &&
                            isVehicleMortgageCloseSubmitter &&
                            !isFlowchartHr && (
                                <div className="flex items-center gap-4 px-6 py-4 bg-violet-50/60 border border-violet-100 rounded-2xl mt-3">
                                    <RefreshCw size={18} className="text-violet-600 shrink-0" />
                                    <p className="text-[13px] font-bold text-violet-900">
                                        Your mortgage close request is awaiting HR approval.
                                    </p>
                                </div>
                            )}
                    </div>


                    <div className="mt-10 flex flex-col gap-10">
                        <div className="grid w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                            <div className="min-w-0">
                                <VehicleAssetProfileHeader
                                    className="h-full"
                                    asset={asset}
                                    assetHistory={assetHistory}
                                    registrationExpirySrc={vehicleExpirySources.registrationExpirySrc}
                                    insuranceExpirySrc={vehicleExpirySources.insuranceExpirySrc}
                                    warrantyExpirySrc={vehicleExpirySources.warrantyExpirySrc}
                                    insuranceProviderLabel={insuranceMeta.policy}
                                    warrantyKmLabel={warrantyKmEffective}
                                    warrantyRequired={warrantyRequiredForCompletion}
                                    permitHint={permitHint}
                                    onSuccess={fetchAssetDetails}
                                    vehicleActPhase={vehicleActPhase}
                                    holdNote={holdNote}
                                    vehicleActivationFlowchartAdminName={vehicleProfileActivationHrName}
                                    canRequestActivationAfterHold={isVehicleProfileActivationSubmitter}
                                    canSubmitForActivation={canSubmitVehicleProfileActivation}
                                    canSubmitProfileEdit={canSubmitVehicleProfileEdit}
                                    onProfileEditSubmit={() => {
                                        setVehicleProfileEditModalReadOnly(false);
                                        setShowVehicleProfileEditSubmitModal(true);
                                    }}
                                    onActivationRequest={() => setShowVehicleActivationModal(true)}
                                />
                            </div>
                            <div className="min-w-0">
                                <VehicleExpirySummaryCard
                                    className="min-h-[200px] sm:min-h-[220px]"
                                    registrationExpirySrc={vehicleExpirySources.registrationExpirySrc}
                                    insuranceExpirySrc={vehicleExpirySources.insuranceExpirySrc}
                                    warrantyExpirySrc={vehicleExpirySources.warrantyExpirySrc}
                                    serviceExpirySrc={vehicleExpirySources.serviceExpirySrc}
                                    showExpirySummary={activeTab !== 'handover'}
                                    actionsAtTop={activeTab === 'handover'}
                                    actionButtons={
                                        activeTab === 'handover' ? vehicleHandoverCardActionButtons : []
                                    }
                                />
                            </div>
                        </div>


                    </div>


                    {/* Bottom Section: Sub Tabs (Employee Profile Style) */}
                    <div className="mt-10 space-y-8">
                        {/* Tab Headers */}
                        <div className="space-y-3">
                            <div className="bg-white border border-slate-200 rounded-2xl px-4">
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] font-semibold">
                                    {visibleVehicleDetailTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`relative px-1 py-3 whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id
                                                ? 'text-blue-600 border-blue-500'
                                                : 'text-slate-500 border-transparent hover:text-slate-700'
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-start gap-2">
                                {activeTab === 'basic' && asset.assignedTo && (
                                    <button
                                        type="button"
                                        onClick={() => setShowHandoverModal(true)}
                                        className="px-4 py-2 bg-[#13c5c0] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-[#0fb2ad] transition-all flex items-center gap-2"
                                    >
                                        <Printer size={14} /> Print
                                    </button>
                                )}

                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="min-h-[600px]">
                            {activeTab === 'basic' && (
                                 <div className="w-full max-w-none">
                                      <div className="flex flex-col lg:flex-row gap-3 items-start">
                                          {/* Left Column */}
                                          <div className="flex-1 space-y-3 w-full">
                                              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                   <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                       <h3 className="text-base font-bold text-slate-800">Basic Details</h3>
                                                       <div className="flex items-center gap-2 flex-wrap justify-end">
                                                           {showDispositionReviewControl && (
                                                               <button
                                                                   type="button"
                                                                   onClick={() => {
                                                                       if (canReviewDispositionHr) {
                                                                           setDispositionReviewMode('hr');
                                                                       } else if (canSubmitDispositionAccounts) {
                                                                           setDispositionReviewMode('accounts');
                                                                       } else {
                                                                           setDispositionReviewMode('management');
                                                                       }
                                                                       setShowDispositionReviewModal(true);
                                                                   }}
                                                                   className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest shadow-sm"
                                                               >
                                                                   Review disposition
                                                               </button>
                                                           )}
                                                           {vehicleCardActionFlags('vehicle').showEdit && (
                                                           <button
                                                               type="button"
                                                               className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                                               title="Edit"
                                                               onClick={() => {
                                                                   setEditBasicDetailsModalOpen(true);
                                                               }}
                                                           >
                                                               <PencilLine size={18} />
                                                           </button>
                                                           )}
                                                           {canDeleteVehicleServiceRecords && (
                                                               <button
                                                                   type="button"
                                                                   onClick={handleDeleteVehicle}
                                                                   className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                   title="Delete vehicle (admin, profile active)"
                                                               >
                                                                   <Trash2 size={18} />
                                                               </button>
                                                           )}
                                                       </div>
                                                   </div>

                                                   <div className="px-5 pb-4">
                                                       {buildVehicleBasicDetailsRows(asset)
                                                           .map((row, idx, arr) => (
                                                               <div
                                                                   key={`${row.label}-${idx}`}
                                                                   className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}
                                                               >
                                                                   <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                   <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words flex items-center justify-end gap-2">
                                                                       {row.value != null && row.value !== '' ? (
                                                                           row.value
                                                                       ) : (
                                                                           <span className="text-slate-300 font-semibold">—</span>
                                                                       )}
                                                                   </span>
                                                               </div>
                                                           ))}
                                                   </div>
                                              </div>

                                              {hasInsuranceCardData && (
                                                  <div id="asset-focus-vehicleInsurance" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                          <h3 className="text-base font-bold text-slate-800">Insurance Details</h3>
                                                          <div className="flex items-center gap-2">
                                                              {vehicleCardActionFlags('insurance').showRenew && (
                                                                  <button
                                                                      type="button"
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                                                                      title="Renew"
                                                                      onClick={() => { clearDocTabModalContext(); setIsInsuranceRenew(true); setShowInsuranceModal(true); }}
                                                                  >
                                                                      <RefreshCw size={18} />
                                                                  </button>
                                                              )}
                                                              {vehicleCardActionFlags('insurance').showNotRenew && insuranceDoc && (
                                                                  <button
                                                                      type="button"
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                                                                      title="Not Renew"
                                                                      onClick={() => setDocToNotRenew(insuranceDoc)}
                                                                  >
                                                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                          <circle cx="12" cy="12" r="10" />
                                                                          <path d="M4.9 4.9l14.2 14.2" />
                                                                      </svg>
                                                                  </button>
                                                              )}
                                                              {vehicleCardActionFlags('insurance').showEdit && (
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                                  onClick={() => { clearDocTabModalContext(); setIsInsuranceRenew(false); setShowInsuranceModal(true); }}
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              )}
                                                              {vehicleCardActionFlags('insurance').showDelete && (
                                                                  <button
                                                                      type="button"
                                                                      onClick={() => { setDocToDelete(insuranceDoc); }}
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                      title="Delete"
                                                                  >
                                                                      <Trash2 size={18} />
                                                                  </button>
                                                              )}
                                                          </div>
                                                      </div>

                                                      <div className="px-5 pb-4">
                                                          {[
                                                              { label: 'Insurance Company', value: insuranceMeta.company },
                                                              { label: 'Policy Number', value: insuranceMeta.policy },
                                                              { label: 'Start Date', value: insuranceDoc?.issueDate ? formatDate(insuranceDoc.issueDate) : null },
                                                              { label: 'End Date', value: insuranceDoc?.expiryDate ? formatDate(insuranceDoc.expiryDate) : null },
                                                              { label: 'Premium Amount', value: insuranceMeta.premiumAmount ? `AED ${Number(insuranceMeta.premiumAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : null },
                                                              { label: 'Excess Charge', value: insuranceMeta.excessCharge ? `AED ${Number(insuranceMeta.excessCharge).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : null },
                                                          ].filter(r => r.value).map((row, idx, arr) => (
                                                              <div
                                                                  key={row.label}
                                                                  className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 || insuranceAttachments.length > 0 ? 'border-b border-slate-100' : ''}`}
                                                              >
                                                                  <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                  <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">{row.value}</span>
                                                              </div>
                                                          ))}

                                                          {insuranceAttachments.length > 0 && (
                                                              <div className="mt-4 pt-4 border-t border-slate-50">
                                                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Insurance Documents</h4>
                                                                  <div className="space-y-2">
{insuranceAttachments.map((att, idx) => (
                                                                          <div key={att._id || idx} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                                                                      <FileText size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">{att.description || 'Document'}</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => openFilePreview(att.attachment, att?.name || 'Attachment')}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      ))}
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              )}

                                              {hasPetrolCardData && (
                                                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                          <h3 className="text-base font-bold text-slate-800">Petrol tag</h3>
                                                          <div className="flex items-center gap-2">
                                                              {vehicleCardActionFlags('petrol').showEdit && (
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                                  onClick={() => { setShowPetrolModal(true); }}
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              )}
                                                              {vehicleCardActionFlags('petrol').showDelete && (
                                                                  <button
                                                                      type="button"
                                                                      onClick={() => { setDocToDelete(petrolDoc); }}
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                      title="Delete"
                                                                  >
                                                                      <Trash2 size={18} />
                                                                  </button>
                                                              )}
                                                          </div>
                                                      </div>

                                                      <div className="px-5 pb-4">
                                                          {[
                                                              { label: 'Petrol company', value: petrolMeta.vendor },
                                                              { label: 'Tag name', value: petrolMeta.tagNo },
                                                              { label: 'Monthly limit', value: petrolMeta.limit },
                                                              { label: 'Installation date', value: formatDate(petrolDoc?.issueDate) },
                                                          ].filter(r => r.value).map((row, idx, arr) => (
                                                              <div
                                                                  key={row.label}
                                                                  className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 || petrolDoc?.attachment || petrolAttachments.length > 0 ? 'border-b border-slate-100' : ''}`}
                                                              >
                                                                  <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                  <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">{row.value}</span>
                                                              </div>
                                                          ))}

                                                          {/* Petrol Documents */}
                                                          {(petrolDoc?.attachment || petrolAttachments.length > 0) && (
                                                              <div className="mt-4 pt-4 border-t border-slate-50">
                                                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Petrol Documents</h4>
                                                                  <div className="space-y-2">
                                                                      {petrolDoc?.attachment && (
                                                                          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                                                                                      <Fuel size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">Petrol Card</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Primary Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => openFilePreview(petrolDoc.attachment, 'Petrol document')}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      )}
                                                                      {petrolAttachments.map((att, idx) => (
                                                                          <div key={att._id || idx} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                                                                                      <Fuel size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">{att.description || 'Petrol Attachment'}</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Additional Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => openFilePreview(att.attachment, att?.name || 'Attachment')}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      ))}
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              )}

                                              {warrantyCards.map(({ doc, meta }, cardIdx) =>
                                                  cardIdx % 2 === 0 ? renderWarrantyDetailCard(doc, meta, cardIdx) : null,
                                              )}
                                          </div>

                                          {/* Right Column */}
                                          <div className="flex-1 space-y-3 w-full">
                                              {hasRegistrationCardData && (
                                                  <div id="asset-focus-vehicleRegistration" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                          <h3 className="text-base font-bold text-slate-800">Mulkia (Registration)</h3>
                                                          <div className="flex items-center gap-2">
                                                              {vehicleCardActionFlags('mulkia').showRenew && (
                                                                  <button
                                                                      type="button"
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                                                                      title="Renew"
                                                                      onClick={() => {
                                                                          setShowRegistrationModal(true);
                                                                          setIsRegistrationRenew(true);
                                                                          clearDocTabModalContext();
                                                                      }}
                                                                  >
                                                                      <RefreshCw size={18} />
                                                                  </button>
                                                              )}
                                                              {vehicleCardActionFlags('mulkia').showNotRenew && registrationDoc && (
                                                                  <button
                                                                      type="button"
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                                                                      title="Not Renew"
                                                                      onClick={() => setDocToNotRenew(registrationDoc)}
                                                                  >
                                                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                          <circle cx="12" cy="12" r="10" />
                                                                          <path d="M4.9 4.9l14.2 14.2" />
                                                                      </svg>
                                                                  </button>
                                                              )}
                                                              {vehicleCardActionFlags('mulkia').showEdit && (
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                                  onClick={() => {
                                                                      setShowRegistrationModal(true);
                                                                      setIsRegistrationRenew(false);
                                                                      clearDocTabModalContext();
                                                                  }}
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              )}
                                                              {vehicleCardActionFlags('mulkia').showDelete && (
                                                                  <button
                                                                      type="button"
                                                                      onClick={() => { setDocToDelete(registrationDoc); }}
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                      title="Delete"
                                                                  >
                                                                      <Trash2 size={18} />
                                                                  </button>
                                                              )}
                                                          </div>
                                                      </div>

                                                      <div className="px-5 pb-4">
                                                          {[
                                                              { label: 'Registration Date', value: formatDate(registrationDoc?.issueDate) },
                                                              { label: 'Expiry Date', value: formatDate(registrationDoc?.expiryDate) },
                                                              { label: 'Registration Value', value: registrationMeta.fee ? `AED ${Number(registrationMeta.fee).toLocaleString()}` : null },
                                                          ].map((row, idx, arr) => (
                                                              <div
                                                                  key={row.label}
                                                                  className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 || registrationDoc?.attachment || registrationAttachments.length > 0 ? 'border-b border-slate-100' : ''}`}
                                                              >
                                                                  <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                  <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">
                                                                      {row.value || <span className="text-slate-300 font-semibold">—</span>}
                                                                  </span>
                                                              </div>
                                                          ))}

                                                          {(registrationDoc?.attachment || registrationAttachments.length > 0) && (
                                                              <div className="mt-4 pt-4 border-t border-slate-50">
                                                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Registration Documents</h4>
                                                                  <div className="space-y-2">
                                                                      {registrationDoc?.attachment && (
                                                                          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                                                                      <FileText size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">Registration Card</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Primary Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => openFilePreview(registrationDoc.attachment, 'Registration document')}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      )}
                                                                      {registrationAttachments.map((att, idx) => (
                                                                          <div key={att._id || idx} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                                                                      <FileText size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">{att.description || 'Registration Attachment'}</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Additional Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => openFilePreview(att.attachment, att?.name || 'Attachment')}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      ))}
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              )}

                                              {hasTollCardData && (
                                                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                          <h3 className="text-base font-bold text-slate-800">Toll tag (Salik / Darb)</h3>
                                                          <div className="flex items-center gap-2">
                                                              {vehicleCardActionFlags('toll').showEdit && (
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                                  onClick={() => { setShowTollModal(true); }}
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              )}
                                                              {vehicleCardActionFlags('toll').showDelete && (
                                                                  <button
                                                                      type="button"
                                                                      onClick={() => { setDocToDelete(tollDoc); }}
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                      title="Delete"
                                                                  >
                                                                      <Trash2 size={18} />
                                                                  </button>
                                                              )}
                                                          </div>
                                                      </div>

                                                      <div className="px-5 pb-4">
                                                          {[
                                                              { label: 'Toll company', value: tollMeta.vendor },
                                                              { label: 'Tag details', value: tollMeta.tagDetails },
                                                              { label: 'PIN number', value: tollMeta.pinNo },
                                                              { label: 'Monthly limit', value: tollMeta.limit },
                                                          ].filter(r => r.value).map((row, idx, arr) => (
                                                              <div
                                                                  key={row.label}
                                                                  className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 || tollDoc?.attachment || tollAttachments.length > 0 ? 'border-b border-slate-100' : ''}`}
                                                              >
                                                                  <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                  <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">{row.value}</span>
                                                              </div>
                                                          ))}

                                                          {/* Toll Documents */}
                                                          {(tollDoc?.attachment || tollAttachments.length > 0) && (
                                                              <div className="mt-4 pt-4 border-t border-slate-50">
                                                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Toll Documents</h4>
                                                                  <div className="space-y-2">
                                                                      {tollDoc?.attachment && (
                                                                          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                                                                      <CreditCard size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">Toll Card</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Primary Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => openFilePreview(tollDoc.attachment, 'Toll document')}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      )}
                                                                      {tollAttachments.map((att, idx) => (
                                                                          <div key={att._id || idx} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                                                                      <CreditCard size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">{att.description || 'Toll Attachment'}</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Additional Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => openFilePreview(att.attachment, att?.name || 'Attachment')}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      ))}
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              )}

                                              {hasMortgageData && (
                                                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                          <h3 className="text-base font-bold text-slate-800">Mortgage Details</h3>
                                                          <div className="flex items-center gap-2">
                                                              {vehicleCardActionFlags('mortgage').showEdit && (
                                                              <button
                                                                  type="button"
                                                                  onClick={() => setShowMortgageModal(true)}
                                                                  disabled={vehicleMortgageCloseStatus === 'pending_hr'}
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                  title="Edit"
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              )}
                                                              {vehicleCardActionFlags('mortgage').showEdit && (
                                                              <button
                                                                  type="button"
                                                                  onClick={() => setShowMortgageCloseModal(true)}
                                                                  disabled={
                                                                      vehicleMortgageCloseStatus === 'pending_hr' ||
                                                                      vehicleActPhase !== 'active'
                                                                  }
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                  title={
                                                                      vehicleMortgageCloseStatus === 'pending_hr'
                                                                          ? 'Awaiting HR approval'
                                                                          : 'Close mortgage'
                                                                  }
                                                              >
                                                                  <XCircle size={18} />
                                                              </button>
                                                              )}
                                                              {vehicleCardActionFlags('mortgage').showDelete && vehicleMortgageCloseStatus !== 'pending_hr' && (
                                                                  <button
                                                                      type="button"
                                                                      onClick={handleAdminDeleteMortgage}
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                      title="Delete mortgage"
                                                                  >
                                                                      <Trash2 size={18} />
                                                                  </button>
                                                              )}
                                                          </div>
                                                      </div>
                                                      <div className="px-5 pb-4">
                                                          {[
                                                              { label: 'Bank Name', value: asset?.mortgageBankName || null },
                                                              { label: 'Vehicle Name', value: asset?.mortgageVehicleName || null },
                                                              { label: 'Vehicle Amount', value: asset?.mortgageAmount != null ? `AED ${Number(asset.mortgageAmount || 0).toLocaleString()}` : null },
                                                              {
                                                                  label: 'Loan Amount',
                                                                  value:
                                                                      asset?.mortgageAmount != null ||
                                                                      asset?.loanAmount != null
                                                                          ? (() => {
                                                                                const loan =
                                                                                    asset?.loanAmount != null &&
                                                                                    asset.loanAmount !== ''
                                                                                        ? Number(asset.loanAmount)
                                                                                        : Math.max(
                                                                                              0,
                                                                                              Number(
                                                                                                  asset?.mortgageAmount ||
                                                                                                      0,
                                                                                              ) -
                                                                                                  Number(
                                                                                                      asset?.downPayment ||
                                                                                                          0,
                                                                                                  ),
                                                                                          );
                                                                                return `AED ${loan.toLocaleString()}`;
                                                                            })()
                                                                          : null,
                                                              },
                                                              { label: 'Down Payment', value: asset?.downPayment != null ? `AED ${Number(asset.downPayment || 0).toLocaleString()}` : null },
                                                              { label: 'Interest', value: asset?.interestRate != null ? `${Number(asset.interestRate || 0)}%` : null },
                                                              { label: 'Loan Tenure', value: asset?.loanTenureMonths != null ? `${Number(asset.loanTenureMonths || 0)} months` : null },
                                                              { label: 'Start Date', value: asset?.mortgageStartDate ? formatDate(asset.mortgageStartDate) : null },
                                                              { label: 'End Date', value: asset?.mortgageEndDate ? formatDate(asset.mortgageEndDate) : null },
                                                              { label: 'Monthly Payment', value: asset?.monthlyPayment != null ? `AED ${Number(asset.monthlyPayment || 0).toLocaleString()}` : null },
                                                              { label: 'Balance Payment', value: asset?.balancePayment != null ? `AED ${Number(asset.balancePayment || 0).toLocaleString()}` : null },
                                                              { label: 'Process Charge', value: asset?.processCharge != null ? `AED ${Number(asset.processCharge || 0).toLocaleString()}` : null },
                                                          ].filter((row) => row.value).map((row, idx, arr) => (
                                                              <div
                                                                  key={row.label}
                                                                  className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 || mortgageAttachmentRows.length > 0 ? 'border-b border-slate-100' : ''}`}
                                                              >
                                                                  <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                  <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">{row.value}</span>
                                                              </div>
                                                          ))}

                                                          {mortgageAttachmentRows.length > 0 && (
                                                              <div className="mt-6 pt-6 border-t border-slate-50">
                                                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Mortgage Attachments</h4>
                                                                  <div className="space-y-3">
                                                                      {mortgageAttachmentRows.map((row, idx) => (
                                                                          <div key={`${row.label}-${idx}`} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100 transition-all hover:bg-slate-50">
                                                                              <div className="flex items-center gap-4 min-w-0">
                                                                                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm border border-slate-50 shrink-0">
                                                                                      <FileText size={20} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[13px] font-bold text-slate-800 truncate">{row.docName || row.label}</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  type="button"
                                                                                  onClick={() => openFilePreview(row.file, row.docName || row.label || 'Attachment')}
                                                                                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-blue-600 font-bold hover:bg-blue-50 transition-all text-[12px] shrink-0"
                                                                              >
                                                                                  <Eye size={16} /> View
                                                                              </button>
                                                                          </div>
                                                                      ))}
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              )}

                                              {warrantyCards.map(({ doc, meta }, cardIdx) =>
                                                  cardIdx % 2 === 1 ? renderWarrantyDetailCard(doc, meta, cardIdx) : null,
                                              )}
                                          </div>
                                      </div>

                                      <div className="mt-6">
                                          <div className="flex flex-wrap gap-3">
                                              {!hasRegistrationCardData && (
                                                  <button
                                                      type="button"
                                                      onClick={() => { clearDocTabModalContext(); setIsRegistrationRenew(false); setShowRegistrationModal(true); }}
                                                      className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                                  >
                                                      Registration
                                                  </button>
                                              )}
                                              {!hasInsuranceCardData && (
                                                  <button
                                                      type="button"
                                                      onClick={() => { clearDocTabModalContext(); setIsInsuranceRenew(false); setShowInsuranceModal(true); }}
                                                      className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                                  >
                                                      Insurance
                                                  </button>
                                              )}
                                              {(warrantyRequiredForCompletion || warrantyCards.length > 0) && (
                                                  <button
                                                      type="button"
                                                      onClick={() => {
                                                          clearDocTabModalContext();
                                                          setDocTabWarrantyDoc(null);
                                                          setIsWarrantyRenew(false);
                                                          setShowWarrantyModal(true);
                                                      }}
                                                      className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                                  >
                                                      {warrantyCards.length === 0 ? 'Warranty' : 'Add Warranty'}
                                                  </button>
                                              )}
                                              {!hasPetrolCardData && (
                                                  <button
                                                      type="button"
                                                      onClick={() => setShowPetrolModal(true)}
                                                      className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                                  >
                                                      Petrol
                                                  </button>
                                              )}
                                              {!hasTollCardData && (
                                                  <button
                                                      type="button"
                                                      onClick={() => setShowTollModal(true)}
                                                      className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                                  >
                                                      Toll
                                                  </button>
                                              )}
                                              {!hasMortgageData && (
                                                  <button
                                                      type="button"
                                                      onClick={() => setShowMortgageModal(true)}
                                                      className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                                  >
                                                      Mortgage
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                 </div>
                            )}

                            {activeTab === 'permit' && (
                                <div className="w-full px-2 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Permit</h3>
                                        {permitTabAccess.create && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPermitDoc(null);
                                                setIsPermitRenew(false);
                                                setShowPermitModal(true);
                                            }}
                                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                        >
                                            <PlusCircle size={14} /> Add Permit
                                        </button>
                                        )}
                                    </div>

                                    {permitCards.length === 0 ? (
                                        <div className="bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100 py-16 flex flex-col items-center justify-center text-center px-6">
                                            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                                                <PenTool size={32} />
                                            </div>
                                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[.25em] mb-2">No Permits</h5>
                                            <p className="text-[10px] text-slate-300 font-medium max-w-sm">Click “Add Permit” to create the first permit record.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                            {permitCards.map(({ doc, meta }, idx) => (
                                                <div key={doc._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                    <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                        <h3 className="text-base font-bold text-slate-800">Permit Details {permitCards.length > 1 ? `#${idx + 1}` : ''}</h3>
                                                        <div className="flex items-center gap-2">
                                                            {showVehicleCardRenewActions && permitTabAccess.edit && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedPermitDoc(doc);
                                                                        setIsPermitRenew(true);
                                                                        setShowPermitModal(true);
                                                                    }}
                                                                    className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                                                                    title="Renew"
                                                                >
                                                                    <RefreshCw size={18} />
                                                                </button>
                                                            )}
                                                            {permitTabAccess.edit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedPermitDoc(doc);
                                                                    setIsPermitRenew(false);
                                                                    setShowPermitModal(true);
                                                                }}
                                                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                title="Edit"
                                                            >
                                                                <PencilLine size={18} />
                                                            </button>
                                                            )}
                                                            {showVehicleCardDelete && permitTabAccess.delete && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setDocToDelete(doc); }}
                                                                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="px-5 pb-4">
                                                        {[
                                                            { label: 'Document type', value: meta.documentType || null },
                                                            { label: 'Permit name', value: meta.permitName || null },
                                                            { label: 'Discription', value: meta.descriptionText || null },
                                                            { label: 'Issue date', value: doc.issueDate ? formatDate(doc.issueDate) : null },
                                                        ].filter(r => r.value).map((row, rowIndex, arr) => (
                                                            <div
                                                                key={row.label}
                                                                className={`flex items-center justify-between py-3 ${rowIndex !== arr.length - 1 || doc.attachment || permitAttachmentsForDoc(doc, asset?.documents || []).length > 0 ? 'border-b border-slate-100' : ''}`}
                                                            >
                                                                <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">{row.value}</span>
                                                            </div>
                                                        ))}

                                                        {/* Permit Attachments */}
                                                        {(() => {
                                                            const atts = permitAttachmentsForDoc(doc, asset?.documents || []);
                                                            if (!doc.attachment && atts.length === 0) return null;
                                                            return (
                                                                <div className="mt-6 pt-6 border-t border-slate-50">
                                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Permit Documents</h4>
                                                                    <div className="space-y-3">
                                                                        {doc.attachment && (
                                                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100 transition-all hover:bg-slate-50">
                                                                                <div className="flex items-center gap-4 min-w-0">
                                                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm border border-slate-50 shrink-0">
                                                                                        <FileText size={20} />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-[13px] font-bold text-slate-800 truncate">Permit Certificate</p>
                                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Primary Document</p>
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => openFilePreview(doc.attachment, doc?.type || 'Document')}
                                                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-blue-600 font-bold hover:bg-blue-50 transition-all text-[12px] shrink-0"
                                                                                >
                                                                                    <Eye size={16} /> View
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        {atts.map((att, aIdx) => (
                                                                            <div key={att._id || aIdx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100 transition-all hover:bg-slate-50">
                                                                                <div className="flex items-center gap-4 min-w-0">
                                                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm border border-slate-50 shrink-0">
                                                                                        <FileText size={20} />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-[13px] font-bold text-slate-800 truncate">{att.description || 'Permit Attachment'}</p>
                                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Additional Document</p>
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => openFilePreview(att.attachment, att?.name || 'Attachment')}
                                                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-blue-600 font-bold hover:bg-blue-50 transition-all text-[12px] shrink-0"
                                                                                >
                                                                                    <Eye size={16} /> View
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                             )}

                            {activeTab === 'fine' && (
                                <div className="w-full px-2">
                                    <div className="flex justify-end mb-4">
                                        {fineTabAccess.create && (
                                        <button
                                            type="button"
                                            onClick={() => setShowVehicleFineModal(true)}
                                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                        >
                                            <Plus size={14} />
                                            Add Fine
                                        </button>
                                        )}
                                    </div>
                                    {loadingFines ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading fines...</p>
                                        </div>
                                    ) : fines.length === 0 ? (
                                        <div className="bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100 py-20 flex flex-col items-center justify-center text-center px-6 mt-2">
                                            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                                                <Receipt size={32} />
                                            </div>
                                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[.25em] mb-2">No Fines Recorded</h5>
                                            <p className="text-[10px] text-slate-300 font-medium max-w-sm">This vehicle has no registered fines or traffic violations in the system.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    <tr>
                                                        <th className="px-6 py-4">Fine ID</th>
                                                        <th className="px-6 py-4">Type</th>
                                                        <th className="px-6 py-4">Offender</th>
                                                        <th className="px-6 py-4">Amount</th>
                                                        <th className="px-6 py-4">Date</th>
                                                        <th className="px-6 py-4">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {fines.map((fine) => (
                                                        <tr
                                                            key={fine._id}
                                                            className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                            onClick={() => router.push(`/HRM/Fine/${fine._id}`)}
                                                        >
                                                            <td className="px-6 py-4 text-sm font-bold text-blue-600">{fine.fineId || '—'}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{fine.fineType || '—'}</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600">{fine.assignedEmployees?.[0]?.employeeName || fine.employeeName || '—'}</td>
                                                            <td className="px-6 py-4 text-sm font-black text-rose-600">AED {Number(fine.fineAmount || 0).toLocaleString()}</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600">{fine.awardedDate ? new Date(fine.awardedDate).toLocaleDateString() : '—'}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                                                    {fine.fineStatus || '—'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'service' && asset && (() => {
                                const serviceCounts = serviceCountByType(asset.services);
                                const isOilServiceTab = serviceInnerTab === 'Oil Service';
                                const isCarWashTab = serviceInnerTab === 'Car Wash';
                                const isVehicleServiceTabRequest = isVehicleServiceTabRequestType(serviceInnerTab);
                                const canManageServiceTabRequest = canManageOilService;
                                const openServiceTypeRequest = () => {
                                    if (isCarWashTab) {
                                        if (!canManageCarWash) {
                                            toast({
                                                variant: 'destructive',
                                                title: 'Not allowed',
                                                description:
                                                    'Only the Super User, Admin Officer, or assigned user can raise a car wash request.',
                                            });
                                            return;
                                        }
                                        setCarWashModalService(null);
                                        setCarWashModalOpen(true);
                                        return;
                                    }
                                    if ((isOilServiceTab || isVehicleServiceTabRequest) && !canManageServiceTabRequest) {
                                        toast({
                                            variant: 'destructive',
                                            title: 'Not allowed',
                                            description:
                                                serviceInnerTab === 'Tire Change'
                                                    ? 'Only Super User, Admin Officer, or assigned user can request tire change. System auto-creation is not used for tire change.'
                                                    : 'Only the Super User, Admin Officer, or assigned user can raise this service request.',
                                        });
                                        return;
                                    }
                                    setConfirmDialog({
                                        isOpen: true,
                                        title: `Request ${serviceInnerTab}?`,
                                        description:
                                            isOilServiceTab || isVehicleServiceTabRequest
                                                ? `Click OK to add a pending ${serviceInnerTab.toLowerCase()} request for this vehicle.`
                                                : `${serviceInnerTab} requests are coming soon. You can confirm to acknowledge, but no record will be added yet.`,
                                        onConfirm: async () => {
                                            if (!isOilServiceTab && !isVehicleServiceTabRequest) {
                                                toast({
                                                    title: 'Coming soon',
                                                    description: `Request ${serviceInnerTab} will be available in a future update.`,
                                                });
                                                return;
                                            }
                                            const existingDraft = isOilServiceTab
                                                ? findOpenOilServiceDraft(asset)
                                                : findOpenVehicleServiceTabDraft(asset, serviceInnerTab);
                                            if (existingDraft) {
                                                toast({
                                                    title: 'Request already open',
                                                    description: `A pending ${serviceInnerTab.toLowerCase()} request is already in the list. Click the row to open it.`,
                                                });
                                                return;
                                            }
                                            const vehicleId = normalizeMongoId(asset?._id);
                                            if (!vehicleId) return;
                                            if (isOilServiceTab) {
                                                setCreatingOilServiceRequest(true);
                                            } else {
                                                setCreatingVehicleServiceTabRequest(true);
                                            }
                                            try {
                                                await axiosInstance.post(
                                                    `/AssetItem/${vehicleId}/service`,
                                                    isOilServiceTab
                                                        ? buildOilServiceDraftRequestBody(asset)
                                                        : buildVehicleServiceTabPendingRequestBody(asset, serviceInnerTab),
                                                );
                                                await fetchAssetDetails({ silent: true });
                                                toast({
                                                    title: 'Request added',
                                                    description:
                                                        'A new pending row was added. Click the row to complete assignment details.',
                                                });
                                            } catch (error) {
                                                toast({
                                                    variant: 'destructive',
                                                    title: 'Could not create request',
                                                    description:
                                                        error.response?.data?.message ||
                                                        'Try again in a moment.',
                                                });
                                            } finally {
                                                if (isOilServiceTab) {
                                                    setCreatingOilServiceRequest(false);
                                                } else {
                                                    setCreatingVehicleServiceTabRequest(false);
                                                }
                                            }
                                        },
                                    });
                                };
                                return (
                                <div className="w-full max-w-none space-y-5">
                                    {asset?.nextServiceDate ? (
                                        <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-950 w-full">
                                            <span className="font-bold">Next service:</span>{' '}
                                            {(() => {
                                                try {
                                                    return new Date(asset.nextServiceDate).toLocaleDateString();
                                                } catch {
                                                    return String(asset.nextServiceDate);
                                                }
                                            })()}
                                        </div>
                                    ) : null}

                                    <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-100/60 rounded-2xl border border-slate-100">
                                        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                                            {VEHICLE_SERVICE_TYPES.map((type) => {
                                                const count = serviceCounts[type] || 0;
                                                return (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => setServiceInnerTab(type)}
                                                        className={`relative px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                                            serviceInnerTab === type
                                                                ? 'bg-white text-blue-600 border border-slate-200 shadow-sm'
                                                                : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                    >
                                                        {type}
                                                        {count > 0 ? (
                                                            <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-black text-teal-800 tabular-nums">
                                                                {count}
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div
                                            className="hidden sm:block w-px self-stretch min-h-[2.25rem] bg-slate-300/80 shrink-0 mx-1"
                                            aria-hidden="true"
                                        />
                                        <button
                                            type="button"
                                            onClick={openServiceTypeRequest}
                                            disabled={
                                                (isOilServiceTab &&
                                                    (creatingOilServiceRequest || !canManageOilService)) ||
                                                (isVehicleServiceTabRequest &&
                                                    (creatingVehicleServiceTabRequest || !canManageServiceTabRequest)) ||
                                                (isCarWashTab && !canManageCarWash)
                                            }
                                            title={
                                                (isOilServiceTab || isVehicleServiceTabRequest) &&
                                                !canManageServiceTabRequest
                                                    ? 'Only the Super User, Admin Officer, or assigned user can raise this service request'
                                                    : isCarWashTab && !canManageCarWash
                                                      ? 'Only the Super User, Admin Officer, or assigned user can raise a car wash request'
                                                      : undefined
                                            }
                                            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 sm:px-5 py-2.5 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors shrink-0 w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isOilServiceTab && creatingOilServiceRequest ? (
                                                <Loader2 size={16} className="shrink-0 animate-spin" />
                                            ) : isVehicleServiceTabRequest && creatingVehicleServiceTabRequest ? (
                                                <Loader2 size={16} className="shrink-0 animate-spin" />
                                            ) : (
                                                <PlusCircle size={16} className="shrink-0" />
                                            )}
                                            Request {serviceInnerTab}
                                        </button>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 border-b border-slate-100">
                                            <h3 className="text-base font-bold text-slate-800">{serviceInnerTab}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {isOilServiceTab
                                                    ? oilServiceRequestRows.length
                                                        ? `${oilServiceRequestRows.length} request${oilServiceRequestRows.length === 1 ? '' : 's'}`
                                                        : 'No records for this service type yet'
                                                    : isCarWashTab
                                                      ? carWashRequestRows.length
                                                          ? `${carWashRequestRows.length} request${carWashRequestRows.length === 1 ? '' : 's'}`
                                                          : 'No records for this service type yet'
                                                      : isVehicleServiceTabRequest
                                                        ? vehicleServiceTabRequestRows.length
                                                            ? `${vehicleServiceTabRequestRows.length} request${vehicleServiceTabRequestRows.length === 1 ? '' : 's'}`
                                                            : 'No records for this service type yet'
                                                        : 'Coming soon'}
                                            </p>
                                        </div>

                                        {isOilServiceTab ? (
                                            <VehicleOilServiceRequestTable
                                                rows={oilServiceRequestRows}
                                                emptyHint={`Use Request ${serviceInnerTab} to add the first entry.`}
                                                onRowClick={openOilServiceDetail}
                                                canDelete={canDeleteVehicleServiceRecords}
                                                onDelete={requestDeleteVehicleService}
                                                deletingServiceId={deletingServiceId}
                                            />
                                        ) : isCarWashTab ? (
                                            <VehicleCarWashRequestTable
                                                rows={carWashRequestRows}
                                                emptyHint={`Use Request ${serviceInnerTab} to add the first entry.`}
                                                onRowClick={openCarWashRow}
                                                canDelete={canDeleteVehicleServiceRecords}
                                                onDelete={requestDeleteVehicleService}
                                                deletingServiceId={deletingServiceId}
                                            />
                                        ) : isVehicleServiceTabRequest ? (
                                            <VehicleServiceTabRequestTable
                                                rows={vehicleServiceTabRequestRows}
                                                emptyHint={`Use Request ${serviceInnerTab} to add the first entry.`}
                                                onRowClick={openVehicleServiceTabRow}
                                                canDelete={canDeleteVehicleServiceRecords}
                                                onDelete={requestDeleteVehicleService}
                                                deletingServiceId={deletingServiceId}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                                                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                                                    Coming soon
                                                </p>
                                                <p className="text-xs text-slate-400 mt-2 max-w-sm">
                                                    {serviceInnerTab} requests and records will be available here in a
                                                    future update.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })()}

                            {activeTab === 'accessoriesList' && (
                                <VehicleAccessoriesListTab
                                    asset={asset}
                                    assetHistory={assetHistory}
                                    loading={loadingHandoverHistory}
                                    canEdit={accessoriesListTabAccess.edit}
                                    canManageItemFines={fineTabAccess.create}
                                    isFlowchartHr={isFlowchartHr}
                                    onUpdate={refreshData}
                                />
                            )}

                            {activeTab === 'handover' && (
                                <div className="max-w-full mx-auto px-2">
                                    <VehicleHandoverHistoryTable
                                        assetHistory={assetHistory}
                                        asset={asset}
                                        loading={loadingHandoverHistory}
                                        canDelete={
                                            permissionsMounted &&
                                            currentUser?.isSystemSuperUser === true
                                        }
                                        onDeleted={(deletedId, entry) => {
                                            setAssetHistory((prev) =>
                                                prev.filter(
                                                    (row) => String(row?._id) !== String(deletedId),
                                                ),
                                            );

                                            startTransition(() => {
                                                setAsset((prev) => {
                                                    if (!prev) return prev;

                                                    const flowId =
                                                        prev.pendingActionDetails?.vehicleHandoverFlow
                                                            ?.historyId;
                                                    const inspId =
                                                        prev.vehicleInspectionHandoverHistoryId;
                                                    const matchesFlow =
                                                        flowId &&
                                                        String(flowId) === String(deletedId);
                                                    const matchesInsp =
                                                        inspId &&
                                                        String(inspId) === String(deletedId);
                                                    const isPendingAssigned =
                                                        entry &&
                                                        String(entry?.action || '').trim() ===
                                                            'Assigned' &&
                                                        String(prev.acceptanceStatus || '') ===
                                                            'Pending' &&
                                                        isSameHandoverAssignee(prev, entry);

                                                    if (
                                                        !matchesFlow &&
                                                        !matchesInsp &&
                                                        !isPendingAssigned
                                                    ) {
                                                        return prev;
                                                    }

                                                    const nextDetails = {
                                                        ...(prev.pendingActionDetails || {}),
                                                    };
                                                    if (matchesFlow || isPendingAssigned) {
                                                        delete nextDetails.vehicleHandoverFlow;
                                                    }

                                                    return {
                                                        ...prev,
                                                        acceptanceStatus:
                                                            isPendingAssigned || matchesFlow
                                                                ? 'Accepted'
                                                                : prev.acceptanceStatus,
                                                        pendingAction:
                                                            matchesFlow || isPendingAssigned
                                                                ? null
                                                                : prev.pendingAction,
                                                        actionRequiredBy:
                                                            matchesFlow || isPendingAssigned
                                                                ? null
                                                                : prev.actionRequiredBy,
                                                        vehicleInspectionHandoverHistoryId:
                                                            matchesInsp
                                                                ? null
                                                                : prev.vehicleInspectionHandoverHistoryId,
                                                        vehicleInspectionStatus: matchesInsp
                                                            ? null
                                                            : prev.vehicleInspectionStatus,
                                                        pendingActionDetails: Object.keys(nextDetails)
                                                            .length
                                                            ? nextDetails
                                                            : null,
                                                    };
                                                });
                                            });
                                        }}
                                        onDeleteFailed={() => {
                                            void fetchAssetHistory({ forHandover: true });
                                        }}
                                    />
                                </div>
                            )}

                            {activeTab === 'document' && (
                                <div className="max-w-full mx-auto space-y-6 px-2">
                                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                                <h3 className="text-xl font-semibold text-gray-800">Documents</h3>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setVehicleServicePresetType('');
                                                            setVehicleServiceEditingRecord(null);
                                                            setVehicleServiceModalOpen(true);
                                                        }}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                                    >
                                                        <PlusCircle size={16} /> Add service request
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setVehicleGeneralDoc(null);
                                                            setVehicleGeneralDocRenew(false);
                                                            setShowVehicleGeneralDocModal(true);
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                                    >
                                                        <Plus size={16} /> Add document
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6 border-b border-gray-100">
                                                {vehicleDocumentInnerTabVisible('live') && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDocumentInnerTab('live')}
                                                    className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${documentInnerTab === 'live'
                                                        ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    Live Documents
                                                </button>
                                                )}
                                                {vehicleDocumentInnerTabVisible('old') && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDocumentInnerTab('old')}
                                                    className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${documentInnerTab === 'old'
                                                        ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    Old Documents
                                                </button>
                                                )}
                                            </div>
                                           
                                        </div>

                                        {vehicleDocumentInnerTabVisible(documentInnerTab) ? (() => {
                                            const bucket = documentInnerTab === 'old'
                                                ? vehicleDocumentLifecycleBuckets.old
                                                : vehicleDocumentLifecycleBuckets.live;

                                            const documentTabServiceLiveRows = VEHICLE_SERVICE_TYPES.map(
                                                (st) => ({
                                                    serviceType: st,
                                                    srv: fleetServicesForTypeSortedDesc(asset?.services, st)[0] || null,
                                                }),
                                            ).filter((x) => x.srv);
                                            const documentTabServiceOldRows = VEHICLE_SERVICE_TYPES.flatMap((st) =>
                                                fleetServicesForTypeSortedDesc(asset?.services, st)
                                                    .slice(1)
                                                    .map((srv) => ({ serviceType: st, srv })),
                                            );
                                            const documentTabServiceRowsForTab =
                                                documentInnerTab === 'live'
                                                    ? documentTabServiceLiveRows
                                                    : documentTabServiceOldRows;

                                            const hasAny =
                                                bucket.basic.length > 0 ||
                                                bucket.registration.length > 0 ||
                                                bucket.insurance.length > 0 ||
                                                bucket.warranty.length > 0 ||
                                                bucket.permit.length > 0 ||
                                                bucket.mortgage.length > 0 ||
                                                !!asset?.invoiceFile ||
                                                documentTabServiceRowsForTab.length > 0;

                                            if (!hasAny) {
                                                return (
                                                    <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                                                            <FileText size={28} />
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-400">No documents in this view</p>
                                                    </div>
                                                );
                                            }

                                            const make = getVehicleBrandLabel(asset) || '-';
                                            const model = asset?.modelYear || '-';
                                            const aid = asset?.assetId || '-';
                                            const plate = asset?.plateNumber || '-';

                                            const attachmentBtn = (url, label) =>
                                                url ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openFilePreview(url, label || 'Attachment')}
                                                        className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <Download size={14} /> {label || 'View'}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                );

                                            const attachmentCell = (items) => {
                                                if (!items?.length) {
                                                    return <span className="text-slate-300">-</span>;
                                                }
                                                return (
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        {items.map((item, idx) => (
                                                            <span key={item.docId || `${item.label}-${idx}`} className="inline-flex">
                                                                {attachmentBtn(item.url, item.label)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            };

                                            const registrationRows = groupRegistrationDocumentRows(bucket.registration);
                                            const insuranceRows = groupInsuranceDocumentRows(bucket.insurance);
                                            const warrantyRows = groupWarrantyDocumentRows(bucket.warranty);
                                            const permitRows = groupPermitDocumentRows(bucket.permit);

                                            const parseMortgageArchivedSnapshot = (doc) => {
                                                let meta = {};
                                                try {
                                                    meta = JSON.parse(doc?.description || '{}');
                                                } catch {
                                                    meta = {};
                                                }
                                                return meta.snapshot || {};
                                            };

                                            const buildMortgageDocAttachmentItems = (doc) => {
                                                let meta = {};
                                                try {
                                                    meta = JSON.parse(doc?.description || '{}');
                                                } catch {
                                                    meta = {};
                                                }
                                                const snapshot = meta.snapshot || {};
                                                const items = [];
                                                const seen = new Set();
                                                const push = (url, label, docId) => {
                                                    if (!url || seen.has(String(url))) return;
                                                    seen.add(String(url));
                                                    items.push({ url, label, docId });
                                                };
                                                push(doc?.attachment, 'Clearance / Primary', doc?._id);
                                                push(meta.clearanceAttachment, 'Clearance letter');
                                                push(snapshot.mortgageSecurityCheckAttachment, 'Security check');
                                                push(snapshot.mortgageScheduleListAttachment, 'Schedule list');
                                                push(snapshot.mortgageBankDocument, 'Bank document');
                                                (snapshot.mortgageExtraAttachments || []).forEach((row, i) => {
                                                    const file = row?.file?.url || row?.file;
                                                    push(file, row?.docName || `Attachment ${i + 1}`);
                                                });
                                                return items;
                                            };

                                            const serviceAmountDisplay = (srv) => {
                                                if (srv?.value != null && Number(srv.value) > 0) {
                                                    return `AED ${Number(srv.value).toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}`;
                                                }
                                                return '-';
                                            };

                                            const sectionTitle = (label) => (
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="h-4 w-1 bg-blue-500 rounded-full" />
                                                    <h4 className="text-lg font-bold text-gray-800">{label}</h4>
                                                </div>
                                            );

                                            const basicRows = [];
                                            if (asset?.invoiceFile) {
                                                basicRows.push({ key: 'inv', doc: null, att: asset.invoiceFile, label: 'Invoice' });
                                            }
                                            bucket.basic.forEach((doc, i) => {
                                                basicRows.push({
                                                    key: doc._id || `b-${i}`,
                                                    doc,
                                                    att: doc.attachment,
                                                    label: doc.type || 'Document',
                                                });
                                            });
                                            if (basicRows.length === 0) {
                                                basicRows.push({ key: 'blank', doc: null, att: null, label: null });
                                            }

                                            const openRegistrationEdit = (doc) => {
                                                if (normDocType(doc.type) === 'registration') {
                                                    setDocTabRegistrationOverride({
                                                        existingDoc: doc,
                                                        existingAttachmentRows: registrationAttachmentsForDoc(doc, bucket.registration),
                                                    });
                                                    setIsRegistrationRenew(false);
                                                    setShowRegistrationModal(true);
                                                } else {
                                                    setVehicleGeneralDoc(doc);
                                                    setVehicleGeneralDocRenew(false);
                                                    setShowVehicleGeneralDocModal(true);
                                                }
                                            };

                                            const registrationProcessDate = (doc) => {
                                                const p = parseVehicleDocDescription(doc);
                                                if (p.processDate) return formatTableDate(p.processDate);
                                                return '-';
                                            };


                                            return (
                                                <div className="mt-6 space-y-10">
                                                    <div>
                                                        {sectionTitle('Basic details')}
                                                        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                            <table className="w-full min-w-[920px]">
                                                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                    <tr>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Asset ID</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Plate No.</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Model</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Make</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50">
                                                                    {basicRows.map((r) => (
                                                                        <tr key={r.key} className="hover:bg-blue-50/30 transition-colors">
                                                                            <td className="px-6 py-4 text-sm font-semibold text-gray-700">{aid}</td>
                                                                            <td className="px-6 py-4 text-sm text-gray-600">{plate}</td>
                                                                            <td className="px-6 py-4 text-sm text-gray-600">{model}</td>
                                                                            <td className="px-6 py-4 text-sm text-gray-600">{make}</td>
                                                                            <td className="px-6 py-4 text-sm">
                                                                                {attachmentBtn(
                                                                                    r.att,
                                                                                    r.label,
                                                                                    r.key === 'inv' ? '__invoice__' : r.doc?._id,
                                                                                )}
                                                                            </td>
                                                                            <td className="px-6 py-4">
                                                                                {r.doc ? (
                                                                                    <div className="flex items-center gap-3">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setVehicleGeneralDoc(r.doc);
                                                                                                setVehicleGeneralDocRenew(false);
                                                                                                setShowVehicleGeneralDocModal(true);
                                                                                            }}
                                                                                            className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                            title="Edit"
                                                                                        >
                                                                                            <PencilLine size={16} />
                                                                                        </button>
                                                                                        {showVehicleCardRenewActions && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setVehicleGeneralDoc(r.doc);
                                                                                                    setVehicleGeneralDocRenew(true);
                                                                                                    setShowVehicleGeneralDocModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                        )}
                                                                                        {showVehicleCardRenewActions && documentInnerTab === 'live' && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setDocToNotRenew(r.doc)}
                                                                                                className="text-slate-500 hover:text-slate-700 transition-colors"
                                                                                                title="Not Renew"
                                                                                            >
                                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                    <circle cx="12" cy="12" r="10" />
                                                                                                    <path d="M4.9 4.9l14.2 14.2" />
                                                                                                </svg>
                                                                                            </button>
                                                                                        )}
                                                                                        {showVehicleCardDelete && (
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(r.doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-slate-300">-</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {registrationRows.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Mulkia (Registration)')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[1020px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Record</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Registration date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Expiry</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Process date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {registrationRows.map((row, idx) => {
                                                                            const doc = row.primary;
                                                                            return (
                                                                            <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                                                                                    Registration card
                                                                                </td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{registrationProcessDate(doc)}</td>
                                                                                <td className="px-6 py-4 text-sm">{attachmentCell(row.attachmentItems)}</td>
                                                                                <td className="px-6 py-4">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => { openRegistrationEdit(doc); }}
                                                                                            className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                            title="Edit"
                                                                                        >
                                                                                            <PencilLine size={16} />
                                                                                        </button>
                                                                                        {showVehicleCardRenewActions && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                if (normDocType(doc.type) === 'registration') {
                                                                                                    setDocTabRegistrationOverride({
                                                                                                        existingDoc: doc,
                                                                                                        existingAttachmentRows: row.attachments,
                                                                                                    });
                                                                                                    setIsRegistrationRenew(true);
                                                                                                    setShowRegistrationModal(true);
                                                                                                } else {
                                                                                                    setVehicleGeneralDoc(doc);
                                                                                                    setVehicleGeneralDocRenew(true);
                                                                                                    setShowVehicleGeneralDocModal(true);
                                                                                                }
                                                                                            }}
                                                                                            className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                            title="Renew"
                                                                                        >
                                                                                            <RefreshCw size={16} />
                                                                                        </button>
                                                                                        )}
                                                                                        {showVehicleCardRenewActions && documentInnerTab === 'live' && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setDocToNotRenew(doc)}
                                                                                                className="text-slate-500 hover:text-slate-700 transition-colors"
                                                                                                title="Not Renew"
                                                                                            >
                                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                    <circle cx="12" cy="12" r="10" />
                                                                                                    <path d="M4.9 4.9l14.2 14.2" />
                                                                                                </svg>
                                                                                            </button>
                                                                                        )}
                                                                                        {showVehicleCardDelete && (
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
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
                                                    )}

                                                    {insuranceRows.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Insurance')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[1080px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Insurance date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Expiry</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Policy number</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Insurance company</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {insuranceRows.map((row, idx) => {
                                                                            const doc = row.primary;
                                                                            const meta = parseVehicleDocDescription(doc);
                                                                            const policy = meta.policy != null && String(meta.policy).trim() !== '' ? String(meta.policy) : '-';
                                                                            const company = doc.issueAuthority ? String(doc.issueAuthority) : '-';
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{policy}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{company}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentCell(row.attachmentItems)}</td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabInsuranceDoc(doc);
                                                                                                    setIsInsuranceRenew(false);
                                                                                                    setShowInsuranceModal(true);
                                                                                                }}
                                                                                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                                title="Edit"
                                                                                            >
                                                                                                <PencilLine size={16} />
                                                                                            </button>
                                                                                            {showVehicleCardRenewActions && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabInsuranceDoc(doc);
                                                                                                    setIsInsuranceRenew(true);
                                                                                                    setShowInsuranceModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                            )}
                                                                                            {showVehicleCardRenewActions && documentInnerTab === 'live' && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => setDocToNotRenew(doc)}
                                                                                                    className="text-slate-500 hover:text-slate-700 transition-colors"
                                                                                                    title="Not Renew"
                                                                                                >
                                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                        <circle cx="12" cy="12" r="10" />
                                                                                                        <path d="M4.9 4.9l14.2 14.2" />
                                                                                                    </svg>
                                                                                                </button>
                                                                                            )}
                                                                                            {showVehicleCardDelete && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                    title="Delete"
                                                                                                    onClick={() => setDocToDelete(doc)}
                                                                                                >
                                                                                                    <XCircle size={16} />
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
                                                    )}

                                                    {warrantyRows.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Warranty')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[1120px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Warranty start</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">End date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Purchase date</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Amount</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">KM</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {warrantyRows.map((row, idx) => {
                                                                            const doc = row.primary;
                                                                            const meta = parseVehicleDocDescription(doc);
                                                                            const km =
                                                                                meta.km != null && String(meta.km).trim() !== ''
                                                                                    ? `${Number(meta.km).toLocaleString()} KM`
                                                                                    : '-';
                                                                            const isPrimaryLive =
                                                                                documentInnerTab === 'live' &&
                                                                                warrantyDoc &&
                                                                                String(warrantyDoc._id || '') === String(doc._id || '');
                                                                            const purchaseRaw = meta.purchaseDate || (isPrimaryLive ? asset?.purchaseDate : null);
                                                                            const purchaseDisp = purchaseRaw ? formatTableDate(purchaseRaw) : '-';
                                                                            let amountDisp = '-';
                                                                            if (meta.amount != null && meta.amount !== '') {
                                                                                amountDisp = `AED ${Number(meta.amount).toLocaleString()}`;
                                                                            } else if (isPrimaryLive && asset?.assetValue != null) {
                                                                                amountDisp = `AED ${Number(asset.assetValue).toLocaleString()}`;
                                                                            }
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{purchaseDisp}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{amountDisp}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{km}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentCell(row.attachmentItems)}</td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabWarrantyDoc(doc);
                                                                                                    setIsWarrantyRenew(false);
                                                                                                    setShowWarrantyModal(true);
                                                                                                }}
                                                                                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                                title="Edit"
                                                                                            >
                                                                                                <PencilLine size={16} />
                                                                                            </button>
                                                                                            {showVehicleCardRenewActions && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabWarrantyDoc(doc);
                                                                                                    setIsWarrantyRenew(true);
                                                                                                    setShowWarrantyModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                            )}
                                                                                            {showVehicleCardRenewActions && documentInnerTab === 'live' && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => setDocToNotRenew(doc)}
                                                                                                    className="text-slate-500 hover:text-slate-700 transition-colors"
                                                                                                    title="Not Renew"
                                                                                                >
                                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                        <circle cx="12" cy="12" r="10" />
                                                                                                        <path d="M4.9 4.9l14.2 14.2" />
                                                                                                    </svg>
                                                                                                </button>
                                                                                            )}
                                                                                            {showVehicleCardDelete && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                    title="Delete"
                                                                                                    onClick={() => setDocToDelete(doc)}
                                                                                                >
                                                                                                    <XCircle size={16} />
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
                                                    )}

                                                    {permitRows.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Permit')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[900px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Permit type</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Start</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">End</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {permitRows.map((row, idx) => {
                                                                            const doc = row.primary;
                                                                            const meta = parseVehicleDocDescription(doc);
                                                                            const pType = meta.permitType ? String(meta.permitType) : '-';
                                                                            const endDisp = meta.unlimited && !doc.expiryDate ? 'Unlimited' : formatTableDate(doc.expiryDate);
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">{pType}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{endDisp}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentCell(row.attachmentItems)}</td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setSelectedPermitDoc(doc);
                                                                                                    setIsPermitRenew(false);
                                                                                                    setShowPermitModal(true);
                                                                                                }}
                                                                                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                                                                                title="Edit"
                                                                                            >
                                                                                                <PencilLine size={16} />
                                                                                            </button>
                                                                                            {showVehicleCardRenewActions && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setSelectedPermitDoc(doc);
                                                                                                    setIsPermitRenew(true);
                                                                                                    setShowPermitModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                            )}
                                                                                            {showVehicleCardRenewActions && documentInnerTab === 'live' && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => setDocToNotRenew(doc)}
                                                                                                    className="text-slate-500 hover:text-slate-700 transition-colors"
                                                                                                    title="Not Renew"
                                                                                                >
                                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                        <circle cx="12" cy="12" r="10" />
                                                                                                        <path d="M4.9 4.9l14.2 14.2" />
                                                                                                    </svg>
                                                                                                </button>
                                                                                            )}
                                                                                            {showVehicleCardDelete && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                    title="Delete"
                                                                                                    onClick={() => setDocToDelete(doc)}
                                                                                                >
                                                                                                    <XCircle size={16} />
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
                                                    )}

                                                    {bucket.mortgage.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Mortgage')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[1160px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Bank</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Start</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">End</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Loan amount</th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Attachment</th>
                                                                            {showVehicleCardDelete ? (
                                                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Actions</th>
                                                                            ) : null}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {bucket.mortgage.map((doc, idx) => {
                                                                            const snapshot = parseMortgageArchivedSnapshot(doc);
                                                                            const bank =
                                                                                doc.issueAuthority ||
                                                                                snapshot.mortgageBankName ||
                                                                                snapshot.mortgageBank ||
                                                                                '-';
                                                                            const loanAmt =
                                                                                snapshot.loanAmount != null
                                                                                    ? `AED ${Number(snapshot.loanAmount || 0).toLocaleString()}`
                                                                                    : '-';
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">{bank}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{loanAmt}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentCell(buildMortgageDocAttachmentItems(doc))}</td>
                                                                                    {showVehicleCardDelete ? (
                                                                                        <td className="px-6 py-4">
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
                                                                                            </button>
                                                                                        </td>
                                                                                    ) : null}
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {documentTabServiceRowsForTab.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Service')}
                                                            <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                                <table className="w-full min-w-[1180px]">
                                                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                                                                                Service type
                                                                            </th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                                                                                Service date
                                                                            </th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                                                                                Workflow
                                                                            </th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                                                                                KM
                                                                            </th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                                                                                Amount
                                                                            </th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                                                                                Description
                                                                            </th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                                                                                Attachment
                                                                            </th>
                                                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                                                                                Add
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50">
                                                                        {documentTabServiceRowsForTab.map(({ serviceType, srv }, idx) => {
                                                                            const remark = parseServiceRemark(srv?.remark);
                                                                            const vendor =
                                                                                remark?.vendorName && String(remark.vendorName).trim()
                                                                                    ? String(remark.vendorName).trim()
                                                                                    : '';
                                                                            const descRaw =
                                                                                srv?.description && String(srv.description).trim()
                                                                                    ? String(srv.description).trim()
                                                                                    : '';
                                                                            const descDisp =
                                                                                descRaw.length > 72 ? `${descRaw.slice(0, 72)}…` : descRaw || '-';
                                                                            const kmDisp =
                                                                                srv?.currentKm != null &&
                                                                                String(srv.currentKm).trim() !== ''
                                                                                    ? String(srv.currentKm)
                                                                                    : '-';
                                                                            const attRows = fleetServiceAttachmentRows(srv);
                                                                            const primary = attRows[0] || null;
                                                                            return (
                                                                                <tr
                                                                                    key={`${String(srv?._id || idx)}-${serviceType}-${documentInnerTab}`}
                                                                                    className="hover:bg-blue-50/30 transition-colors"
                                                                                >
                                                                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                                                                                        {serviceType}
                                                                                        {vendor ? (
                                                                                            <span className="block text-xs font-normal text-gray-500 mt-0.5">
                                                                                                {vendor}
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                                                        {formatTableDate(srv?.date || srv?.createdAt)}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                                                        {fleetServiceWorkflowLabel(srv) || '-'}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                                                        {kmDisp}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                                                        {serviceAmountDisplay(srv)}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[220px]">
                                                                                        <span className="line-clamp-2 break-words" title={descRaw || undefined}>
                                                                                            {descDisp}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-sm">
                                                                                        {primary ? (
                                                                                            attachmentBtn(primary.url, primary.label || 'View')
                                                                                        ) : (
                                                                                            <span className="text-slate-300">-</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-6 py-4">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setVehicleServicePresetType(serviceType);
                                                                                                setVehicleServiceEditingRecord(null);
                                                                                                setVehicleServiceModalOpen(true);
                                                                                            }}
                                                                                            className="text-emerald-600 hover:text-emerald-700 transition-colors p-1 rounded-lg hover:bg-emerald-50"
                                                                                            title={`Add ${serviceType} request`}
                                                                                        >
                                                                                            <PlusCircle size={18} />
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}


                                                </div>
                                            );
                                        })() : (
                                            <div className="py-16 text-center text-sm text-gray-500 font-medium">
                                                You do not have permission to view this documents folder.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}



                            {activeTab === 'history' && (
                                <VehicleAssetHistoryTab
                                    assetHistory={assetHistory}
                                    onViewFile={(fileUrl) => openFilePreview(fileUrl, 'Attachment')}
                                />
                            )}

                        </div>
                    </div>
                </div>
            </div>

            <AssignAssetModal
                isOpen={showAssignModal && fleetProfileActiveForAssignment}
                onClose={() => setShowAssignModal(false)}
                asset={asset}
                onUpdate={handleVehicleAssignUpdate}
                fleetAssigneeReassignRequest={fleetAssigneeReassignRequest}
                assignmentContext="vehicle"
            />

            <HandoverFormModal
                isOpen={showHandoverModal}
                onClose={() => setShowHandoverModal(false)}
                asset={asset}
                employee={asset?.assignedTo}
            />

            <VehicleCarWashRequestModal
                isOpen={carWashModalOpen}
                onClose={closeCarWashModal}
                onSuccess={(updatedAsset) => {
                    closeCarWashModal();
                    if (updatedAsset) setAsset(updatedAsset);
                    else void fetchAssetDetails({ silent: true, light: true });
                    invalidateAssetPendingInbox('vehicle');
                }}
                assetId={assetId}
                asset={asset}
                assignedEmployee={
                    asset?.assignedTo && typeof asset.assignedTo === 'object' ? asset.assignedTo : null
                }
                assetController={asset?.assetController || null}
                assetControllerId={asset?.assetControllerId || null}
                existingService={carWashModalService}
                accountsReviewMode={carWashModalCanApprove}
            />

            <VehicleServiceModal
                isOpen={vehicleServiceModalOpen}
                onClose={() => {
                    setVehicleServiceModalOpen(false);
                    setVehicleServicePresetType('');
                    setVehicleServiceEditingRecord(null);
                }}
                onSuccess={() => {
                    setVehicleServiceModalOpen(false);
                    setVehicleServicePresetType('');
                    setVehicleServiceEditingRecord(null);
                    setDocumentInnerTab('live');
                    fetchAssetDetails();
                    toast({
                        title: 'Service request saved',
                        description:
                            'It is now the live record for that type on the Service tab and under Live documents. Earlier requests for the same type appear under Old documents.',
                    });
                }}
                assetId={assetId}
                presetServiceType={vehicleServicePresetType}
                editingServiceRecord={vehicleServiceEditingRecord}
                assignedEmployee={
                    asset?.assignedTo && typeof asset.assignedTo === 'object' ? asset.assignedTo : null
                }
                assetController={asset?.assetController || null}
                assetControllerId={asset?.assetControllerId || null}
                lastCompletedServiceDate={null}
                serviceRequestSource="vehicle_asset_detail"
            />

            <VehicleGeneralDocumentModal
                isOpen={showVehicleGeneralDocModal}
                onClose={() => {
                    setShowVehicleGeneralDocModal(false);
                    setVehicleGeneralDoc(null);
                    setVehicleGeneralDocRenew(false);
                }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={vehicleGeneralDoc}
                isRenew={vehicleGeneralDocRenew}
            />

            <VehicleActivationSubmitModal
                isOpen={showVehicleActivationModal}
                onClose={() => setShowVehicleActivationModal(false)}
                asset={asset}
                assetMongoId={assetId}
                onSuccess={refreshData}
            />

            <VehicleProfileEditSubmitModal
                isOpen={showVehicleProfileEditSubmitModal}
                onClose={() => {
                    setShowVehicleProfileEditSubmitModal(false);
                    setVehicleProfileEditModalReadOnly(false);
                }}
                asset={asset}
                assetMongoId={-assetId}
                readOnly={vehicleProfileEditModalReadOnly}
                onSuccess={refreshData}
            />

            <VehicleProfileActivationReviewModal
                isOpen={showVehicleActivationReviewModal}
                onClose={() => setShowVehicleActivationReviewModal(false)}
                asset={asset}
                assetMongoId={assetId}
                onSuccess={refreshData}
            />

            <EditVehicleBasicDetailsModal
                isOpen={editBasicDetailsModalOpen}
                assetMongoId={assetId}
                asset={asset}
                profileActivated={vehicleActPhase === 'active'}
                dispositionWorkflowStage={dispositionWorkflowStage}
                canOpenDispositionReview={showDispositionReviewControl}
                onOpenDispositionReview={() => {
                    setEditBasicDetailsModalOpen(false);
                    if (canReviewDispositionHr) setDispositionReviewMode('hr');
                    else if (canSubmitDispositionAccounts) setDispositionReviewMode('accounts');
                    else setDispositionReviewMode('management');
                    setShowDispositionReviewModal(true);
                }}
                onOpenDispositionRequest={(target) => {
                    setDispositionRequestTarget(target);
                    setShowDispositionRequestModal(true);
                }}
                onClose={() => setEditBasicDetailsModalOpen(false)}
                onSuccess={(updatedAsset) => {
                    if (updatedAsset) setAsset(updatedAsset);
                    setEditBasicDetailsModalOpen(false);
                }}
            />

            <VehicleDispositionRequestModal
                isOpen={showDispositionRequestModal}
                onClose={() => {
                    setShowDispositionRequestModal(false);
                    setDispositionRequestTarget('');
                }}
                onSuccess={() => {
                    fetchAssetDetails();
                    setEditBasicDetailsModalOpen(false);
                }}
                assetMongoId={assetId}
                asset={asset}
                targetStatus={dispositionRequestTarget}
            />

            <VehicleDispositionReviewModal
                isOpen={showDispositionReviewModal}
                onClose={() => setShowDispositionReviewModal(false)}
                onSuccess={fetchAssetDetails}
                assetMongoId={assetId}
                asset={asset}
                mode={dispositionReviewMode}
            />



            <VehicleRegistrationModal
                isOpen={showRegistrationModal}
                onClose={() => { setShowRegistrationModal(false); setIsRegistrationRenew(false); setDocTabRegistrationOverride(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                asset={asset}
                existingDoc={docTabRegistrationOverride?.existingDoc ?? registrationDoc}
                existingAttachmentRows={docTabRegistrationOverride?.existingAttachmentRows ?? registrationAttachments}
                isRenew={isRegistrationRenew}
                hrMayApplyDirectly={canApplyVehicleDocRenewalDirectly}
            />

            <VehicleInsuranceModal
                isOpen={showInsuranceModal}
                onClose={() => { setShowInsuranceModal(false); setIsInsuranceRenew(false); setDocTabInsuranceDoc(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                asset={asset}
                existingDoc={docTabInsuranceDoc ?? insuranceDoc}
                existingAttachmentRows={(() => {
                    if (isInsuranceRenew) return [];
                    const main = docTabInsuranceDoc ?? insuranceDoc;
                    const matched = insuranceAttachmentsForDoc(main, asset?.documents || []);
                    if (matched.length > 0) return matched;
                    if (!docTabInsuranceDoc) return insuranceAttachments;
                    return matched;
                })()}
                isRenew={isInsuranceRenew}
                hrMayApplyDirectly={canApplyVehicleDocRenewalDirectly}
            />

            <VehicleWarrantyModal
                isOpen={showWarrantyModal}
                onClose={() => { setShowWarrantyModal(false); setIsWarrantyRenew(false); setDocTabWarrantyDoc(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={docTabWarrantyDoc}
                existingAttachmentRows={
                    docTabWarrantyDoc
                        ? warrantyAttachmentsForDoc(docTabWarrantyDoc, asset?.documents || [])
                        : []
                }
                isRenew={isWarrantyRenew}
            />

            <VehiclePermitModal
                isOpen={showPermitModal}
                onClose={() => { setShowPermitModal(false); setIsPermitRenew(false); setSelectedPermitDoc(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={selectedPermitDoc}
                existingAttachmentRows={permitAttachmentsForDoc(selectedPermitDoc, (asset?.documents || []))}
                isRenew={isPermitRenew}
            />

            <AddVehicleFineModal
                isOpen={showVehicleFineModal}
                onClose={() => setShowVehicleFineModal(false)}
                onSuccess={() => {
                    fetchFines();
                    setShowVehicleFineModal(false);
                }}
                employees={fineModalEmployees}
                vehicles={fineModalVehicles}
                initialData={vehicleFineInitialData}
            />

            {showReturnModal && asset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                        <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/30">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-100">
                                    <Undo2 size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Return Vehicle</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {asset.assetId} — {asset.name}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowReturnModal(false)}
                                className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {canManageFleetHandoverAssignment
                                    ? 'Confirm to return this vehicle to the unassigned pool.'
                                    : 'A return request will be sent to HR for approval. The vehicle stays assigned until HR approves.'}
                            </p>
                        </div>
                        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                            <button
                                type="button"
                                onClick={() => setShowReturnModal(false)}
                                className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:border-slate-300 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitReturnAsset}
                                disabled={isReturning}
                                className="flex-[2] px-6 py-4 bg-amber-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-200 hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {isReturning ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <>
                                        <ArrowRightLeft size={18} strokeWidth={2.5} />
                                        Confirm Return
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Preview Modal */}
            <DocumentViewerModal
                isOpen={!!viewingDocument}
                onClose={() => setViewingDocument(null)}
                viewingDocument={viewingDocument}
            />

            <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
                <AlertDialogContent className="rounded-[32px] p-8 border border-slate-200 shadow-2xl z-[1000] max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900">
                            {confirmDialog.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-slate-600 leading-relaxed pt-2">
                            {confirmDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6 gap-3 sm:gap-3">
                        <AlertDialogCancel className="rounded-2xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 font-bold uppercase text-[10px] tracking-widest h-12 px-6 m-0">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async (e) => {
                                e.preventDefault();
                                try {
                                    await confirmDialog.onConfirm?.();
                                } finally {
                                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                                }
                            }}
                            className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-[0.2em] h-12 px-8 shadow-xl shadow-blue-100 m-0"
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!docToDelete} onOpenChange={(open) => { if (!open) setDocToDelete(null); }}>
                <AlertDialogContent className="rounded-[32px] p-8 border-none shadow-2xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {docToDelete?.type} Document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the <strong>{docToDelete?.type}</strong> record and any linked attachment files from this vehicle. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteDoc}
                            disabled={deleteLoading}
                            className="bg-rose-500 hover:bg-rose-600 text-white"
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={Boolean(serviceDeleteTarget)}
                onOpenChange={(open) => {
                    if (!open && !deletingServiceId) setServiceDeleteTarget(null);
                }}
            >
                <AlertDialogContent className="rounded-[32px] p-8 border-none shadow-2xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete service request?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This service request will be permanently removed from this vehicle. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={Boolean(deletingServiceId)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async (e) => {
                                e.preventDefault();
                                await executeDeleteVehicleService();
                            }}
                            disabled={Boolean(deletingServiceId)}
                            className="bg-rose-500 hover:bg-rose-600 text-white"
                        >
                            {deletingServiceId ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Not Renew Confirmation Dialog */}
            <AlertDialog open={!!docToNotRenew} onOpenChange={(open) => { if (!open) setDocToNotRenew(null); }}>
                <AlertDialogContent className="rounded-[32px] p-8 border-none shadow-2xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Not Renew {docToNotRenew?.type}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move the <strong>{docToNotRenew?.type}</strong> card and all related attachments
                            to Old Documents and remove them from Live Documents.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={notRenewLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleNotRenewDoc}
                            disabled={notRenewLoading}
                            className="bg-slate-700 hover:bg-slate-800 text-white"
                        >
                            {notRenewLoading ? 'Processing...' : 'Not Renew'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <VehiclePetrolModal
                isOpen={showPetrolModal}
                onClose={() => setShowPetrolModal(false)}
                onSuccess={fetchAssetDetails}
                assetId={assetId}
                existingDoc={petrolDoc}
                existingAttachmentRows={petrolAttachments}
            />
            <VehicleTollModal
                isOpen={showTollModal}
                onClose={() => setShowTollModal(false)}
                onSuccess={fetchAssetDetails}
                assetId={assetId}
                existingDoc={tollDoc}
                existingAttachmentRows={tollAttachments}
            />
            <VehicleMortgageModal
                isOpen={showMortgageModal}
                onClose={() => setShowMortgageModal(false)}
                onSuccess={fetchAssetDetails}
                assetId={assetId}
                asset={asset}
            />
            <VehicleMortgageCloseModal
                isOpen={showMortgageCloseModal}
                onClose={() => setShowMortgageCloseModal(false)}
                assetMongoId={assetId}
                onSuccess={fetchAssetDetails}
            />
        </div>
    );
}

export default function VehicleDetailsPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    <span className="text-gray-500 font-medium text-sm">Loading details...</span>
                </div>
            </div>
        );
    }

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    <span className="text-gray-500 font-medium text-sm">Loading details...</span>
                </div>
            </div>
        }>
            <VehicleDetailsPageContent />
        </Suspense>
    );
}
