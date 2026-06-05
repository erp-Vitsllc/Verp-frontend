'use client';



import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, Suspense } from 'react';

import { useParams, useRouter, useSearchParams } from 'next/navigation';

import Sidebar from '@/components/Sidebar';

import Navbar from '@/components/Navbar';

import axiosInstance from '@/utils/axios';
import { isAdmin, canViewAnyOf } from '@/utils/permissions';
import { COMPANY_MAIN_TAB_MODULES } from '@/constants/hrmModulePermissions';
import PermissionGuard from '@/components/PermissionGuard';
import {
    getCompanyProfileAccess,
    accessForCompanyModal,
    accessForCompanyDocumentContext,
    docStatusTabAccess,
    ownerDocAccessByKey,
    ownerDocHasContent,
    canOpenCompanyModal,
    notifyNoPermission,
} from '@/utils/companyPermissionModules';
import { hasLiveMoaInDocuments, isMoaForDocumentTab } from '@/utils/companyDocumentLive';
import { calculateCompanyActivationProgress as computeLocalActivationProgress } from '@/utils/companyActivationProgress';

import { Building, Mail, Phone, Globe, MapPin, Edit2, Plus, File, FileText, User, ChevronLeft, ChevronRight, Calendar, Camera, X, Upload, Check, RotateCcw, Download, ChevronDown, Trash2, Search, XCircle, Undo2, ArrowRightLeft, ArrowRight, PackageX, Square, CheckSquare, Ban, CheckCircle } from 'lucide-react';

import Select from 'react-select';
import { Country, State } from 'country-state-city';
import {
    validateCompanyAddressFields,
    hasCompleteCompanyAddress,
    formatCompanyAddressSummary,
    resolveCountryIso,
    resolveStateIso,
} from '@/utils/companyAddressValidation';
import {
    validateTradeLicenseFields,
    validateTradeLicensePdfFile,
    normalizeTradeLicenseNumber,
    ensureOwnerProfileIds,
} from '@/utils/tradeLicenseValidation';
import {
    validateOwnerDetailsFields,
    validateOwnerDetailsOwnersPayload,
    getOwnerRowEmail,
    validateOwnerPhone,
    normalizeOwnerDetailsPayload,
    redistributeOwnerShares,
    redistributeOwnerSharesEqually,
} from '@/utils/ownerDetailsValidation';
import {
    validateOwnerPassportFields,
    validatePassportPdfFile,
    normalizeOwnerPassportPayload,
    normalizePassportNumber,
} from '@/utils/ownerPassportValidation';
import {
    validateOwnerEmiratesIdFields,
    validateEmiratesIdPdfFile,
    normalizeOwnerEmiratesIdPayload,
    normalizeEmiratesIdNumber,
} from '@/utils/ownerEmiratesIdValidation';
import {
    validateOwnerLabourCardFields,
    validateLabourCardPdfFile,
    normalizeOwnerLabourCardPayload,
    normalizeLabourCardNumber,
} from '@/utils/ownerLabourCardValidation';
import {
    validateOwnerMedicalInsuranceFields,
    validateMedicalPdfFile,
    normalizeOwnerMedicalInsurancePayload,
    normalizeMedicalProvider,
    normalizeMedicalPolicyNumber,
} from '@/utils/ownerMedicalInsuranceValidation';
import {
    validateOwnerDrivingLicenseFields,
    validateDrivingLicensePdfFile,
    normalizeOwnerDrivingLicensePayload,
    normalizeDrivingLicenseNumber,
} from '@/utils/ownerDrivingLicenseValidation';
import {
    validateOwnerVisaFields,
    validateVisaPdfFile,
    normalizeOwnerVisaPayload,
    normalizeVisaNumber,
    OWNER_VISA_LABELS,
} from '@/utils/ownerVisaValidation';
import {
    migrateLegacyOwnersVisa,
    isOwnerVisaDocKey,
    isOwnerLiveUpdateDocKey,
    ownerHasAnyVisaCard,
} from '@/utils/ownerVisaCompat';
import { parseCertificateStoredDescription, certificateTypeSectionId, CERTIFICATE_TYPE_OPTIONS } from '@/utils/companyCertificateUtils';
import {
    validateCompanyMoaFields,
    validateMoaPdfFile,
    normalizeCompanyMoaPayload,
    normalizeMoaVersion,
    normalizeMoaNote,
} from '@/utils/companyMoaValidation';
import {
    validateCompanyMemoFields,
    validateMemoPdfFile,
    normalizeCompanyMemoPayload,
    normalizeMemoDocumentName,
    normalizeMemoDescription,
    memoTextWhileTyping,
    normalizeMemoCategory,
    memoCategorySectionId,
    MEMO_CATEGORY_OPTIONS,
} from '@/utils/companyMemoValidation';
import {
    isLiveCompanyDocForm,
    buildCompanyLiveDocumentTypeOptions,
    isCompanyCertificateDocument,
} from '@/utils/companyLiveDocumentUtils';
import {
    validateCompanyLiveDocumentFields,
    validateLiveDocumentPdfFile,
    normalizeCompanyLiveDocumentPayload,
    normalizeLiveDocumentNote,
} from '@/utils/companyLiveDocumentValidation';

const OWNER_VISA_TYPE_OPTIONS = [
    { key: 'visitVisa', label: 'Visit Visa' },
    { key: 'employmentVisa', label: 'Employment Visa' },
    { key: 'spouseVisa', label: 'Spouse Visa' },
];
import {
    validateEstablishmentCardFields,
    validateEstablishmentCardAttachmentFile,
    normalizeEstablishmentCardNumber,
    sanitizeEstablishmentFileName,
} from '@/utils/establishmentCardValidation';
import {
    validateEjariFields,
    validateEjariPdfFile,
    normalizeEjariType,
    normalizeEjariNote,
    isEjariModalContext,
} from '@/utils/ejariValidation';
import {
    generateOwnerProfileId,
    resolveOwnerProfileId,
    normalizeOwnerProfileId,
    collectOwnerProfileIdsFromCompanies,
    collectOwnerProfileIdsFromOwnerList,
} from '@/utils/ownerProfileId';

import Image from 'next/image';

import { useToast } from '@/hooks/use-toast';
import { tryNavigateListReturn } from '@/utils/listReturnNavigation';

import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";

import dynamic from 'next/dynamic';

import {

    validateEmail,

    validatePhoneNumber,

    extractCountryCode,

    validateRequired

} from '@/utils/validation';

import {
    mergePendingReactivationForActivationSnapshot,
    mergeCompanyOwnersSnapshot,
    shouldOverlayPendingReactivationChanges,
    pendingReactivationEntryTouchesOwnerDetails,
    pendingReactivationEntryTouchesOwnerDoc,
} from '@/utils/mergeCompanyPendingActivationProposed';



const PhoneInputField = dynamic(() => import('@/components/ui/phone-input'), {

    ssr: false,

    loading: () => <div className="h-11 w-full bg-gray-50 border border-gray-200 rounded-xl animate-pulse" />

});

const companyAddressSelectStyles = {
    control: (provided, state) => ({
        ...provided,
        borderRadius: '0.75rem',
        borderColor: state.isFocused ? '#3b82f6' : '#e5e7eb',
        boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
        padding: '2px',
        minHeight: '46px',
        backgroundColor: '#f9fafb',
    }),
    placeholder: (provided) => ({
        ...provided,
        color: '#9ca3af',
        fontSize: '0.875rem',
    }),
};



import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';
import CertificateModal from '@/components/modals/CertificateModal';
import ActivationHoldReviewModal from './components/ActivationHoldReviewModal';
import { buildHeldActivationEditState } from './utils/heldActivationEditModal.js';
import {
    buildActivationSnapshotRows,
    buildCompanyPendingDisplayGroups,
    pendingEntryIncludedInSubmittedCards,
    pendingOwnerDisplayLabel,
    resolveFullCardReviewData,
} from './utils/pendingActivationSnapshotRows';
import {
    viewerOwnsPendingChange as entryOwnedByViewer,
    viewerCanSeeCompanyPendingChange,
    isCompanyHrActivationReviewer,
    isHrQueuedPendingCard,
    stampPendingChangesWithViewer,
} from './utils/companyPendingChangeVisibility';

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



const getInitials = (name) => {

    if (!name) return 'C';

    const parts = name.split(' ');

    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();

    return name[0].toUpperCase();

};

/** Match pending not-renew row to a UI target (must align with backend samePendingTarget). */
const companyNotRenewPendingMatches = (r, t) => {
    if (!r || r.status !== 'pending' || !t) return false;
    if (r.kind !== t.kind) return false;
    if (t.kind === 'tradeLicense' || t.kind === 'establishmentCard') return true;
    if (t.kind === 'document') {
        if (t.documentItemId && r.documentItemId) return String(r.documentItemId) === String(t.documentItemId);
        return (
            typeof t.documentIndex === 'number' &&
            typeof r.documentIndex === 'number' &&
            r.documentIndex === t.documentIndex
        );
    }
    if (t.kind === 'ownerDoc') {
        return r.ownerIndex === t.ownerIndex && String(r.docKey || '') === String(t.docKey || '');
    }
    if (t.kind === 'ejari' || t.kind === 'insurance') {
        if (t.arrayItemId && r.arrayItemId) return String(r.arrayItemId) === String(t.arrayItemId);
        return typeof t.arrayIndex === 'number' && r.arrayIndex === t.arrayIndex;
    }
    return false;
};

/** Strip signed-URL noise so two copies of the same S3 object dedupe correctly. */
const companyDocumentUrlFingerprint = (doc) => {
    const raw = String(doc?.document?.url || doc?.attachment || '').trim();
    if (!raw) return '';
    const noQuery = raw.split('?')[0].trim().toLowerCase();
    for (const m of ['company-documents', 'employee-documents']) {
        const idx = noQuery.indexOf(m);
        if (idx !== -1) return noQuery.slice(idx);
    }
    return noQuery;
};

const companyDocumentStableKey = (d) => {
    if (!d || typeof d !== 'object') return '';
    const type = String(d.type || '').trim().toLowerCase();
    const desc = String(d.description || '').trim().toLowerCase();
    const exp = d?.expiryDate ? new Date(d.expiryDate).getTime() : '';
    const fp = companyDocumentUrlFingerprint(d);
    if (fp) return `file:${type}|${desc}|${exp}|${fp}`;
    const id = d?._id != null ? String(d._id) : '';
    return `nourl:${id}|${type}|${desc}|${exp}`;
};

/** Keep Mongo id when editing/renewing a document row so the server does not treat it as a delete. */
function mergeCompanyDocumentRowEdit(existing, patch) {
    if (!existing || typeof existing !== 'object') return patch;
    const id = existing._id ?? existing.id;
    return {
        ...existing,
        ...patch,
        ...(id != null ? { _id: id } : {}),
    };
}

/** Prevent duplicate rows in PATCH payloads (stops DB array bloat when state already contained copies). */
function dedupeCompanyDocumentsPayload(documents) {
    if (!Array.isArray(documents)) return [];
    const seen = new Set();
    const out = [];
    for (const d of documents) {
        if (!d || typeof d !== 'object') continue;
        const id = d?._id != null ? String(d._id) : '';
        const k = id ? `id:${id}` : companyDocumentStableKey(d);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(d);
    }
    return out;
}

/** Old tab merges `documents` + `oldDocuments`; same file can appear twice after repeated archives — show once, prefer `oldDocuments`. */
function dedupeOldDocumentsMergedSources(docs) {
    if (!Array.isArray(docs) || docs.length === 0) return [];
    const byKey = new Map();
    for (const d of docs) {
        const k = companyDocumentStableKey(d);
        if (!k) continue;
        const cur = byKey.get(k);
        if (!cur || (d.sourceKind === 'oldDocuments' && cur.sourceKind !== 'oldDocuments')) {
            byKey.set(k, d);
        }
    }
    const out = [];
    const seen = new Set();
    for (const d of docs) {
        const k = companyDocumentStableKey(d);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(byKey.get(k));
    }
    return out;
}

function memoIssueTimeMsFromRow(row) {
    const raw = row?.issueDate;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function memoRowMatchesIssueDateRange(row, startDateStr, endDateStr) {
    const hasStart = Boolean(startDateStr);
    const hasEnd = Boolean(endDateStr);
    if (!hasStart && !hasEnd) return true;
    const rowMs = memoIssueTimeMsFromRow(row);
    if (rowMs == null) return false;
    if (hasStart) {
        const start = new Date(startDateStr);
        if (Number.isNaN(start.getTime())) return true;
        start.setHours(0, 0, 0, 0);
        if (rowMs < start.getTime()) return false;
    }
    if (hasEnd) {
        const end = new Date(endDateStr);
        if (Number.isNaN(end.getTime())) return true;
        end.setHours(23, 59, 59, 999);
        if (rowMs > end.getTime()) return false;
    }
    return true;
}

/** Memo / certificate views merge `documents` + `oldDocuments`; the same row can exist in both — show once, prefer live `documents` for actions. */
function dedupeMergedDocumentSourcesPreferLive(docs) {
    if (!Array.isArray(docs) || docs.length === 0) return [];
    const byKey = new Map();
    for (const d of docs) {
        const k = companyDocumentStableKey(d);
        if (!k) continue;
        const cur = byKey.get(k);
        if (!cur) {
            byKey.set(k, d);
            continue;
        }
        const preferNew = d.sourceKind === 'documents' && cur.sourceKind !== 'documents';
        if (preferNew) {
            byKey.set(k, d);
        }
    }
    const out = [];
    const seen = new Set();
    for (const d of docs) {
        const k = companyDocumentStableKey(d);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(byKey.get(k));
    }
    return out;
}

const RESPONSIBILITY_CATEGORIES = [

    { id: 'hr', label: 'HR' },

    { id: 'accounts', label: 'Accounts' },

    { id: 'assetcontroller', label: 'Asset Controller' },

    { id: 'management', label: 'Management' },

    { id: 'admincontroller', label: 'Admin Controller' }

];



function CompanyProfilePageContent() {

    const params = useParams();

    const router = useRouter();

    const searchParams = useSearchParams();

    const { toast } = useToast();

    const companyId = decodeURIComponent(String(params?.companyId || '')).trim();

    const handleBackNavigation = () => {
        if (tryNavigateListReturn(router)) return;

        // Reconstruct filters for return navigation
        const params = new URLSearchParams();
        const filters = ['search', 'tab', 'page']; // tab/page might be useful if Company list gets pagination/tabs later
        filters.forEach(filter => {
            const value = searchParams.get(filter);
            if (value) params.append(filter, value);
        });

        const queryString = params.toString();
        if (queryString) {
            router.push(`/Company?${queryString}`);
        } else {
            router.push('/Company');
        }
    };



    const [company, setCompany] = useState(null);

    const [employeeCount, setEmployeeCount] = useState(0);

    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState(() => {
        const tabParam = searchParams?.get('tab');
        if (tabParam && String(tabParam).toLowerCase() === 'certificate') {
            return 'others';
        }
        return tabParam || 'basic';
    });

    const [docStatusTab, setDocStatusTab] = useState(() => {
        const tabParam = searchParams?.get('tab');
        if (tabParam && String(tabParam).toLowerCase() === 'certificate') {
            return 'certificate';
        }
        const v = searchParams?.get('docStatusTab');
        return v && ['live', 'old', 'memo', 'certificate'].includes(v) ? v : 'live';
    });
    /** Filter certificate table by recipient (matches Add Certificate "Issued to" / employee salary certificate names). */
    const [certificateIssuedToFilter, setCertificateIssuedToFilter] = useState('');
    /** Certificate tab: filter by certificate type section (Installer / Safety / etc.). */
    const [certificateTypeFilter, setCertificateTypeFilter] = useState('');
    /** Memo tab: filter by category and issue date range. */
    const [memoCategoryFilter, setMemoCategoryFilter] = useState('');
    const [memoIssueRangeFrom, setMemoIssueRangeFrom] = useState('');
    const [memoIssueRangeTo, setMemoIssueRangeTo] = useState('');
    const [companySectionPages, setCompanySectionPages] = useState({});
    const [companySectionExpanded, setCompanySectionExpanded] = useState({});

    const [activeFlowTab, setActiveFlowTab] = useState('responsibilities');

    const [activeOwnerTabIndex, setActiveOwnerTabIndex] = useState(0);

    const [imageError, setImageError] = useState(false);

    const [allCompanies, setAllCompanies] = useState([]);
    const [ownersCatalog, setOwnersCatalog] = useState([]);

    const fetchOwnersCatalog = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Company/all-owners');
            setOwnersCatalog(response.data?.owners || []);
        } catch (err) {
            console.error('Error fetching owners catalog:', err);
            setOwnersCatalog([]);
        }
    }, []);

    const getAllUsedOwnerProfileIds = useCallback((extraOwners = []) => {
        const used = collectOwnerProfileIdsFromCompanies(allCompanies);
        collectOwnerProfileIdsFromOwnerList(extraOwners).forEach((id) => used.add(id));
        collectOwnerProfileIdsFromOwnerList(ownersCatalog).forEach((id) => used.add(id));
        return used;
    }, [allCompanies, ownersCatalog]);

    const getUniqueOwners = useCallback(() => {
        return (ownersCatalog || [])
            .map((owner) => ({
                ...owner,
                ownerProfileId: resolveOwnerProfileId(owner),
                fromCompany: owner.fromCompany || owner._companyName || '',
            }))
            .filter((o) => Boolean(o.ownerProfileId) && Boolean(o.name?.trim()));
    }, [ownersCatalog]);

    const [allEmployees, setAllEmployees] = useState([]);

    const [allUsers, setAllUsers] = useState([]);

    const [selectedCategory, setSelectedCategory] = useState(null);

    const [responsibilities, setResponsibilities] = useState([]);



    // Modal State

    const [modalType, setModalType] = useState(null); // 'tradeLicense' | 'establishmentCard' | 'companyDocument'

    const [modalData, setModalData] = useState({});

    const [modalErrors, setModalErrors] = useState({});
    const [ownerDocTouched, setOwnerDocTouched] = useState({});
    const ownerDocInitialDataRef = useRef(null);
    const [ownerDetailsPhoneValid, setOwnerDetailsPhoneValid] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [visaDropdownOpen, setVisaDropdownOpen] = useState(false);

    const [editingIndex, setEditingIndex] = useState(null);

    const [isRenewalModal, setIsRenewalModal] = useState(false);

    const openCompanyAttachmentPreview = useCallback(async (docOrAttachment, { name = 'Document', mimeType = 'application/pdf' } = {}) => {
        let raw = docOrAttachment;
        let label = name;
        let mime = mimeType;

        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            label = raw.type || raw.name || name;
            if (raw.document?.url != null) {
                raw = {
                    url: raw.document.url,
                    mimeType: raw.document.mimeType,
                    name: raw.document.name,
                    publicId: raw.document.publicId,
                };
                mime = raw.mimeType || mimeType;
            } else if (raw.attachment != null) {
                raw = raw.attachment;
            } else if (raw.url == null && raw.data == null && raw.publicId == null) {
                raw = null;
            }
        }

        if (raw == null || raw === '') {
            toast({
                variant: 'destructive',
                title: 'Cannot open attachment',
                description: 'No file is attached to this record.',
            });
            return;
        }

        const result = await openAttachmentInNewTab(raw, { name: label, mimeType: mime });
        if (!result.ok) {
            toast({
                variant: 'destructive',
                title: 'Cannot open attachment',
                description: result.error || 'The file could not be loaded.',
            });
        }
    }, [toast]);

    const [dynamicTabs, setDynamicTabs] = useState(['assets']);

    const [activeDynamicTabs, setActiveDynamicTabs] = useState([]);

    const [isAddMoreOpen, setIsAddMoreOpen] = useState(false);

    const [isAddingNewTab, setIsAddingNewTab] = useState(false);

    const [newTabInput, setNewTabInput] = useState('');

    const fileInputRef = useRef(null);

    const visaDropdownRef = useRef(null);

    const addMoreRef = useRef(null);

    const respDropdownRef = useRef(null);
    const progressBarRef = useRef(null);
    const progressTooltipRef = useRef(null);

    const [respDropdownOpen, setRespDropdownOpen] = useState(false);

    const [itemToDelete, setItemToDelete] = useState(null);

    /** Not renew: `{ kind, ... }` including ejari/insurance with arrayIndex / arrayItemId. */
    const [notRenewData, setNotRenewData] = useState(null);
    const [notRenewReason, setNotRenewReason] = useState('');
    const [notRenewFile, setNotRenewFile] = useState(null);
    const [notRenewSubmitting, setNotRenewSubmitting] = useState(false);
    const [viewerIsDesignatedFlowchartHr, setViewerIsDesignatedFlowchartHr] = useState(false);
    const [hrRejectRequestId, setHrRejectRequestId] = useState(null);
    const [hrRejectComment, setHrRejectComment] = useState('');
    const [hrRespondSubmitting, setHrRespondSubmitting] = useState(false);

    const [ownerToDelete, setOwnerToDelete] = useState(null);

    const [documentToDelete, setDocumentToDelete] = useState(null);

    const [confirmDialog, setConfirmDialog] = useState(null);
    const [confirmDialogLoading, setConfirmDialogLoading] = useState(false);

    const closeConfirmDialog = () => {
        if (!confirmDialogLoading) setConfirmDialog(null);
    };

    const openConfirmDialog = (config) => {
        setConfirmDialog({ open: true, ...config });
    };

    const runConfirmDialogAction = async () => {
        if (!confirmDialog?.onConfirm) return;
        setConfirmDialogLoading(true);
        try {
            await confirmDialog.onConfirm();
            setConfirmDialog(null);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: error?.response?.data?.message || error?.message || 'Something went wrong.',
            });
        } finally {
            setConfirmDialogLoading(false);
        }
    };

    const [companyAssets, setCompanyAssets] = useState([]);

    const [assetsLoading, setAssetsLoading] = useState(false);
    const [selectedCompanyAssetIds, setSelectedCompanyAssetIds] = useState([]);
    const [companyBulkSubmitting, setCompanyBulkSubmitting] = useState(false);
    const [companyBulkDialog, setCompanyBulkDialog] = useState({
        open: false,
        mode: null, // 'return' | 'transfer' | 'endOfServices'
        leaveDuration: '1',
    });

    const [companyFines, setCompanyFines] = useState([]);

    const [finesLoading, setFinesLoading] = useState(false);
    const [activationSubmitting, setActivationSubmitting] = useState(false);
    const [showProgressTooltip, setShowProgressTooltip] = useState(false);
    const [isProgressTooltipLocked, setIsProgressTooltipLocked] = useState(false);
    const [activationDecisionLoading, setActivationDecisionLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [activationProgressFromApi, setActivationProgressFromApi] = useState(null);
    const [activationSubmitModalOpen, setActivationSubmitModalOpen] = useState(false);
    const [activationReviewModalOpen, setActivationReviewModalOpen] = useState(false);
    /** Non–Flowchart HR submit modal: queued entry ids included; unchecked rows are dropped on submit. */
    const [activationSubmitSelectedEntryIds, setActivationSubmitSelectedEntryIds] = useState([]);
    const [activationRowNotesByGroupKey, setActivationRowNotesByGroupKey] = useState({});
    const [activationSelectedChangeIds, setActivationSelectedChangeIds] = useState([]);
    const [activationHoldReviewModalOpen, setActivationHoldReviewModalOpen] = useState(false);
    const [viewingCompanyChange, setViewingCompanyChange] = useState(null);
    const [isDirectHrAction, setIsDirectHrAction] = useState(false);

    const [addForm, setAddForm] = useState({
        title: '',
        issueDate: '',
        attachment: null,
        isUploading: false
    });

    const [summaryPageIndex, setSummaryPageIndex] = useState(0);
    const [isSummaryHovered, setIsSummaryHovered] = useState(false);
    const [summaryPageVisible, setSummaryPageVisible] = useState(true);
    const [showCertificateModal, setShowCertificateModal] = useState(false);
    const [editingCertificateData, setEditingCertificateData] = useState(null);
    const [editingCertificateIndex, setEditingCertificateIndex] = useState(null);

    const coTabVis = (key) => isAdmin() || canViewAnyOf(COMPANY_MAIN_TAB_MODULES[key] || []);
    const companyPerms = useMemo(() => getCompanyProfileAccess(), []);
    /** Business rule: once company status is Active, keep active behavior during approval cycles. */
    const isCompanyActivationComplete = useMemo(
        () => String(company?.status || '').toLowerCase() === 'active',
        [company?.status],
    );
    const isCompanyProfileActivated = isCompanyActivationComplete;
    const tradeLicenseCanView = isAdmin() || companyPerms.tradeLicense.view;
    const tradeLicenseCanEdit = isAdmin() || companyPerms.tradeLicense.edit;
    const tradeLicenseCanCreate = isAdmin() || companyPerms.tradeLicense.create;
    const tradeLicenseCanDownload = isAdmin() || companyPerms.tradeLicense.download;
    const tradeLicenseCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.tradeLicense.delete);
    /** Active company: listed cards queue in pendingReactivationChanges until HR approves via Submit pending. */
    const activeCompanyHrQueueOnSave =
        isCompanyActivationComplete && !viewerIsDesignatedFlowchartHr && !isAdmin();
    const tradeLicenseNeedsHrApprovalOnSave = activeCompanyHrQueueOnSave;
    const basicDetailsNeedsHrApprovalOnSave = activeCompanyHrQueueOnSave;
    const canAlterTradeLicenseAttachment = tradeLicenseCanEdit;
    const establishmentCanView = isAdmin() || companyPerms.establishment.view;
    const establishmentCanEdit = isAdmin() || companyPerms.establishment.edit;
    const establishmentCanCreate = isAdmin() || companyPerms.establishment.create;
    const establishmentCanDownload = isAdmin() || companyPerms.establishment.download;
    const establishmentCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.establishment.delete);
    const establishmentNeedsHrApprovalOnSave = activeCompanyHrQueueOnSave;
    const canAlterEstablishmentAttachment = establishmentCanEdit;

    const hasLiveTradeLicense = useMemo(() => {
        const n = company?.tradeLicenseNumber;
        return n != null && String(n).trim() !== '';
    }, [company?.tradeLicenseNumber]);

    const hasLiveEstablishmentCard = useMemo(() => {
        const n = company?.establishmentCardNumber;
        return n != null && String(n).trim() !== '';
    }, [company?.establishmentCardNumber]);
    const establishmentExpiryMinDate = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 1);
        return d;
    }, []);
    const ejariCanView = isAdmin() || companyPerms.ejari.view;
    const ejariCanEdit = isAdmin() || companyPerms.ejari.edit;
    const ejariCanCreate = isAdmin() || companyPerms.ejari.create;
    const ejariCanDownload = isAdmin() || companyPerms.ejari.download;
    const ejariCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.ejari.delete);
    const ownerInfoCanView = isAdmin() || companyPerms.ownerInfo.view;
    const ownerInfoCanCreate = isAdmin() || companyPerms.ownerInfo.create;
    const ownerDetailsCanView = isAdmin() || companyPerms.ownerDetails.view;
    const ownerDetailsCanEdit = isAdmin() || companyPerms.ownerDetails.edit;
    const ownerDetailsCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.ownerDetails.delete);
    const ownerDetailsNeedsHrApprovalOnSave = activeCompanyHrQueueOnSave;
    const ownerPassportCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.ownerPassport.delete);
    const ownerPassportNeedsHrApprovalOnSave = activeCompanyHrQueueOnSave;
    const ownerEmiratesIdCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.ownerEmiratesId.delete);
    const ownerEmiratesIdNeedsHrApprovalOnSave = activeCompanyHrQueueOnSave;
    const ownerVisaCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.ownerVisa.delete);
    const ownerLabourCardCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.ownerLabourCard.delete);
    const ownerMedicalCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.ownerMedical.delete);
    const ownerDrivingLicenseCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.ownerDrivingLicense.delete);
    const canEditOwnerDocByKey = useCallback(
        (docKey) => isAdmin() || ownerDocAccessByKey(docKey, companyPerms).edit,
        [companyPerms],
    );
    const canViewOwnerDocByKey = useCallback(
        (docKey) => isAdmin() || ownerDocAccessByKey(docKey, companyPerms).view,
        [companyPerms],
    );
    const canDownloadOwnerDocByKey = useCallback(
        (docKey) => isAdmin() || ownerDocAccessByKey(docKey, companyPerms).download,
        [companyPerms],
    );
    const canDeleteOwnerDocByKey = useCallback(
        (docKey) =>
            isAdmin() ||
            (!isCompanyActivationComplete && ownerDocAccessByKey(docKey, companyPerms).delete),
        [companyPerms, isCompanyActivationComplete],
    );
    const basicDetailsLiveCanView =
        isAdmin() ||
        companyPerms.tradeLicense.view ||
        companyPerms.establishment.view ||
        companyPerms.ejari.view;
    const openOwnerDocModal = useCallback((ownerDocKey, ownerIndex, isRenewal = false) => {
        if (typeof ownerIndex === 'number') setActiveOwnerTabIndex(ownerIndex);
        if (isOwnerVisaDocKey(ownerDocKey)) {
            const visaDocKey = ownerDocKey === 'visa' ? 'visitVisa' : ownerDocKey;
            handleModalOpen('ownerVisa', null, visaDocKey, isRenewal);
            return;
        }
        const modalByKey = {
            passport: 'ownerPassport',
            labourCard: 'ownerLabourCard',
            emiratesId: 'ownerEmiratesId',
            medical: 'ownerMedical',
            drivingLicense: 'ownerDrivingLicense',
        };
        const mt = modalByKey[ownerDocKey];
        if (mt) handleModalOpen(mt, null, null, isRenewal);
    }, []);
    /** On active profiles, overlay queued owner basic fields (not passport/EID until HR approves). */
    const companyForOwnerDisplay = useMemo(() => {
        if (!company) return null;
        if (!isCompanyActivationComplete) return company;
        return mergePendingReactivationForActivationSnapshot(company, { viewer: currentUser });
    }, [company, isCompanyActivationComplete, currentUser]);
    const ownersForDisplay = useMemo(() => {
        const list = companyForOwnerDisplay?.owners ?? company?.owners ?? [];
        return migrateLegacyOwnersVisa(list);
    }, [companyForOwnerDisplay?.owners, company?.owners]);
    const missingOwnerVisaTypesForActiveOwner = useMemo(() => {
        const owner = ownersForDisplay[activeOwnerTabIndex];
        if (!owner) return [];
        return OWNER_VISA_TYPE_OPTIONS.filter(
            (opt) => !ownerDocHasContent(owner[opt.key]),
        );
    }, [ownersForDisplay, activeOwnerTabIndex]);
    const showOwnerVisaAddButton = useMemo(() => {
        const owner = ownersForDisplay[activeOwnerTabIndex];
        if (!owner || ownerHasAnyVisaCard(owner)) return false;
        return isAdmin() || companyPerms.ownerVisa.view;
    }, [ownersForDisplay, activeOwnerTabIndex, companyPerms]);
    const activationStatusForPendingVisibility = String(company?.activationStatus || '').toLowerCase();
    const pendingChangeVisibilityOpts = useMemo(
        () => ({
            isDesignatedFlowchartHr: viewerIsDesignatedFlowchartHr,
            isAdminViewer: isAdmin(),
            activationStatus: activationStatusForPendingVisibility,
            activationSubmitterEmployeeObjectId: company?.activationSubmittedBy || '',
        }),
        [viewerIsDesignatedFlowchartHr, activationStatusForPendingVisibility, company?.activationSubmittedBy],
    );
    const viewerPendingReactivationChanges = useMemo(
        () =>
            (company?.pendingReactivationChanges || []).filter(
                (c) =>
                    isHrQueuedPendingCard(c) &&
                    viewerCanSeeCompanyPendingChange(c, currentUser, pendingChangeVisibilityOpts),
            ),
        [company?.pendingReactivationChanges, currentUser, pendingChangeVisibilityOpts],
    );
    const viewerHasPendingMatch = useCallback(
        (matcher) => viewerPendingReactivationChanges.some(matcher),
        [viewerPendingReactivationChanges],
    );
    const hasPendingOwnerDetailsChange = useMemo(
        () => viewerPendingReactivationChanges.some((c) => pendingReactivationEntryTouchesOwnerDetails(c)),
        [viewerPendingReactivationChanges],
    );
    const hasPendingOwnerPassportChange = useMemo(
        () => viewerPendingReactivationChanges.some((c) => pendingReactivationEntryTouchesOwnerDoc(c, 'passport')),
        [viewerPendingReactivationChanges],
    );
    const hasPendingOwnerEmiratesIdChange = useMemo(
        () => viewerPendingReactivationChanges.some((c) => pendingReactivationEntryTouchesOwnerDoc(c, 'emiratesId')),
        [viewerPendingReactivationChanges],
    );
    const hasPendingBasicDetailsChange = useMemo(
        () =>
            viewerPendingReactivationChanges.some((c) =>
                String(c?.card || '').toLowerCase().includes('basic details'),
            ),
        [viewerPendingReactivationChanges],
    );
    const moaNeedsHrApprovalOnSave = activeCompanyHrQueueOnSave;
    const ejariNeedsHrApprovalOnSave = false;
    const insuranceCanView = isAdmin() || companyPerms.docLiveWithExpiry.view;
    const insuranceCanEdit = isAdmin() || companyPerms.docLiveWithExpiry.edit;
    const insuranceCanDownload = isAdmin() || companyPerms.docLiveWithExpiry.download;
    const insuranceCanDelete =
        isAdmin() || (!isCompanyActivationComplete && companyPerms.docLiveWithExpiry.delete);
    const ejariExpiryMinDate = establishmentExpiryMinDate;
    const isEjariForm =
        modalType === 'addEjari' ||
        (modalType === 'companyDocument' && modalData?.context === 'ejari');
    const isInsuranceForm =
        modalType === 'addInsurance' ||
        (modalType === 'companyDocument' && modalData?.context === 'insurance');
    const isMoaForm =
        modalType === 'companyDocument' && modalData?.context === 'moa';
    const isLiveCompanyDocModal = isLiveCompanyDocForm(modalData, modalType);
    const canAlterEjariAttachment = ejariCanEdit;
    const canAlterInsuranceAttachment = insuranceCanEdit;
    const canAlterMoaAttachment = isAdmin() || companyPerms.moa.edit;
    const canAlterLiveDocumentAttachment =
        isAdmin() ||
        companyPerms.docLiveWithExpiry.edit ||
        companyPerms.docLiveWithoutExpiry.edit;
    const canAlterCompanyDocumentAttachment = isEjariForm
        ? canAlterEjariAttachment
        : isInsuranceForm
          ? canAlterInsuranceAttachment
          : isMoaForm
            ? canAlterMoaAttachment
            : canAlterLiveDocumentAttachment;
    const liveDocumentTypeOptions = useMemo(
        () => buildCompanyLiveDocumentTypeOptions(company?.documents || [], modalData?.type),
        [company?.documents, modalData?.type],
    );
    const isEjariOrInsuranceComplianceForm =
        isEjariForm ||
        isInsuranceForm ||
        (modalType === 'companyDocument' &&
            (String(modalData?.type || '').toLowerCase().includes('ejar') ||
                String(modalData?.type || '').toLowerCase().includes('insur')));
    const ownerPassportLiveErrors = useMemo(() => {
        if (modalType !== 'ownerPassport') return {};
        return validateOwnerPassportFields(modalData, {
            owners: ownersForDisplay,
            ownerIndex: activeOwnerTabIndex,
            isRenewal: isRenewalModal,
            requireAttachment: !modalData?.attachment,
        });
    }, [modalType, modalData, ownersForDisplay, activeOwnerTabIndex, isRenewalModal]);
    const ownerPassportSaveBlocked = Object.keys(ownerPassportLiveErrors).length > 0;
    const ownerEmiratesIdLiveErrors = useMemo(() => {
        if (modalType !== 'ownerEmiratesId') return {};
        return validateOwnerEmiratesIdFields(modalData, {
            owners: ownersForDisplay,
            ownerIndex: activeOwnerTabIndex,
            requireAttachment: !modalData?.attachment,
        });
    }, [modalType, modalData, ownersForDisplay, activeOwnerTabIndex]);
    const ownerEmiratesIdSaveBlocked = Object.keys(ownerEmiratesIdLiveErrors).length > 0;
    const passportExpiryMinDate = useMemo(() => {
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (modalData?.issueDate) {
            const afterIssue = new Date(modalData.issueDate);
            afterIssue.setHours(0, 0, 0, 0);
            afterIssue.setDate(afterIssue.getDate() + 1);
            return afterIssue > tomorrow ? afterIssue : tomorrow;
        }
        return tomorrow;
    }, [modalData?.issueDate]);
    const emiratesIdExpiryMinDate = useMemo(() => {
        if (!modalData?.issueDate) return undefined;
        const afterIssue = new Date(modalData.issueDate);
        afterIssue.setHours(0, 0, 0, 0);
        afterIssue.setDate(afterIssue.getDate() + 1);
        return afterIssue;
    }, [modalData?.issueDate]);
    const ownerVisaLiveErrors = useMemo(() => {
        if (modalType !== 'ownerVisa') return {};
        return validateOwnerVisaFields(modalData, {
            visaDocKey: modalData?.visaDocKey || 'visitVisa',
            owners: ownersForDisplay,
            ownerIndex: activeOwnerTabIndex,
            requireAttachment: !modalData?.attachment,
        });
    }, [modalType, modalData, ownersForDisplay, activeOwnerTabIndex]);
    const ownerVisaSaveBlocked = Object.keys(ownerVisaLiveErrors).length > 0;
    const ownerLabourCardLiveErrors = useMemo(() => {
        if (modalType !== 'ownerLabourCard') return {};
        return validateOwnerLabourCardFields(modalData, {
            requireAttachment: !modalData?.attachment,
        });
    }, [modalType, modalData]);
    const ownerLabourCardSaveBlocked = Object.keys(ownerLabourCardLiveErrors).length > 0;
    const ownerMedicalLiveErrors = useMemo(() => {
        if (modalType !== 'ownerMedical') return {};
        return validateOwnerMedicalInsuranceFields(modalData, {
            requireAttachment: !modalData?.attachment,
        });
    }, [modalType, modalData]);
    const ownerMedicalSaveBlocked = Object.keys(ownerMedicalLiveErrors).length > 0;
    const ownerDrivingLicenseLiveErrors = useMemo(() => {
        if (modalType !== 'ownerDrivingLicense') return {};
        return validateOwnerDrivingLicenseFields(modalData, {
            requireAttachment: !modalData?.attachment,
        });
    }, [modalType, modalData]);
    const ownerDrivingLicenseSaveBlocked = Object.keys(ownerDrivingLicenseLiveErrors).length > 0;
    const medicalExpiryMinDate = useMemo(() => {
        if (!modalData?.issueDate) return undefined;
        const afterIssue = new Date(modalData.issueDate);
        afterIssue.setHours(0, 0, 0, 0);
        afterIssue.setDate(afterIssue.getDate() + 1);
        return afterIssue;
    }, [modalData?.issueDate]);
    const drivingLicenseExpiryMinDate = useMemo(() => {
        if (!modalData?.issueDate) return undefined;
        const afterIssue = new Date(modalData.issueDate);
        afterIssue.setHours(0, 0, 0, 0);
        afterIssue.setDate(afterIssue.getDate() + 1);
        return afterIssue;
    }, [modalData?.issueDate]);
    const labourCardExpiryMinDate = useMemo(() => {
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }, []);
    const visaExpiryMinDate = useMemo(() => {
        if (!modalData?.issueDate) return undefined;
        const afterIssue = new Date(modalData.issueDate);
        afterIssue.setHours(0, 0, 0, 0);
        afterIssue.setDate(afterIssue.getDate() + 1);
        return afterIssue;
    }, [modalData?.issueDate]);
    const activeOwnerDocLiveErrors = useMemo(() => {
        if (modalType === 'ownerPassport') return ownerPassportLiveErrors;
        if (modalType === 'ownerEmiratesId') return ownerEmiratesIdLiveErrors;
        if (modalType === 'ownerVisa') return ownerVisaLiveErrors;
        if (modalType === 'ownerLabourCard') return ownerLabourCardLiveErrors;
        if (modalType === 'ownerMedical') return ownerMedicalLiveErrors;
        if (modalType === 'ownerDrivingLicense') return ownerDrivingLicenseLiveErrors;
        return {};
    }, [
        modalType,
        ownerPassportLiveErrors,
        ownerEmiratesIdLiveErrors,
        ownerVisaLiveErrors,
        ownerLabourCardLiveErrors,
        ownerMedicalLiveErrors,
        ownerDrivingLicenseLiveErrors,
    ]);
    const OWNER_DOC_MODAL_FIELD_KEYS = {
        ownerPassport: ['number', 'nationality', 'issueDate', 'expiryDate', 'countryOfIssue', 'attachment'],
        ownerEmiratesId: ['number', 'issueDate', 'expiryDate', 'attachment'],
        ownerVisa: ['number', 'issueDate', 'expiryDate', 'sponsor', 'attachment'],
        ownerLabourCard: ['number', 'expiryDate', 'attachment'],
        ownerMedical: ['provider', 'number', 'issueDate', 'expiryDate', 'attachment'],
        ownerDrivingLicense: ['number', 'issueDate', 'expiryDate', 'issuingCountry', 'attachment'],
    };
    useLayoutEffect(() => {
        const fieldKeys = OWNER_DOC_MODAL_FIELD_KEYS[modalType];
        if (!fieldKeys) {
            ownerDocInitialDataRef.current = null;
            setOwnerDocTouched({});
            return;
        }
        ownerDocInitialDataRef.current = JSON.parse(JSON.stringify(modalData || {}));
        setOwnerDocTouched({});
    }, [modalType, isRenewalModal, editingIndex, activeOwnerTabIndex]);

    useEffect(() => {
        const fieldKeys = OWNER_DOC_MODAL_FIELD_KEYS[modalType];
        const initial = ownerDocInitialDataRef.current;
        if (!fieldKeys || !initial) return;
        setOwnerDocTouched((prev) => {
            const next = { ...prev };
            let changed = false;
            fieldKeys.forEach((k) => {
                if (JSON.stringify(initial[k]) !== JSON.stringify(modalData?.[k])) {
                    if (!next[k]) changed = true;
                    next[k] = true;
                }
            });
            return changed ? next : prev;
        });
    }, [modalData, modalType]);

    useEffect(() => {
        const fieldKeys = OWNER_DOC_MODAL_FIELD_KEYS[modalType];
        if (!fieldKeys) return;
        setModalErrors((prev) => {
            const next = { ...prev };
            fieldKeys.forEach((k) => {
                if (ownerDocTouched[k] && activeOwnerDocLiveErrors[k]) next[k] = activeOwnerDocLiveErrors[k];
                else delete next[k];
            });
            return next;
        });
    }, [modalType, activeOwnerDocLiveErrors, ownerDocTouched]);
    const ownerDocCanDeleteByKey = canDeleteOwnerDocByKey;
    const ownerDetailsSaveBlocked = useMemo(() => {
        if (modalType !== 'ownerDetails') return false;
        const fieldErrors = validateOwnerDetailsFields(modalData, {
            requireEmail: isCompanyActivationComplete,
            owners: ownersForDisplay,
            ownerIndex: activeOwnerTabIndex,
        });
        if (Object.keys(fieldErrors).length > 0) return true;
        if (!modalData?.phone) return true;
        if (validateOwnerPhone(modalData.phone)) return true;
        return !ownerDetailsPhoneValid;
    }, [
        modalType,
        modalData,
        isCompanyActivationComplete,
        ownersForDisplay,
        activeOwnerTabIndex,
        ownerDetailsPhoneValid,
    ]);
    const companyAddressFilled = useMemo(
        () => hasCompleteCompanyAddress(company),
        [company?.address, company?.country, company?.state],
    );
    const companyAssetsCanView = isAdmin() || companyPerms.assets.view;
    const companyFineCanView = isAdmin() || companyPerms.fine.view;
    /** Company assets are managed via flowchart admin; system admin gets full asset actions on this tab. */
    const companyAssetsCanManage = isAdmin();
    const companyAddressCanView = isAdmin() || companyPerms.address.view;
    const companyAddressCanEdit = isAdmin() || companyPerms.address.edit;
    const companyAddressCanAdd = isAdmin() || companyPerms.address.create;
    const companyCountryOptions = useMemo(
        () => Country.getAllCountries().map((c) => ({ label: c.name, value: c.isoCode })),
        [],
    );
    const companyModalStateOptions = useMemo(() => {
        if (modalType !== 'companyAddress' || !modalData?.country) return [];
        return State.getStatesOfCountry(modalData.country).map((s) => ({
            label: s.name,
            value: s.isoCode,
        }));
    }, [modalType, modalData?.country]);

    useEffect(() => {
        if (!company) return;
        const simple = ['basic', 'owner', 'assets', 'fine'];
        if (!simple.includes(activeTab)) return;
        const vis = (k) => isAdmin() || canViewAnyOf(COMPANY_MAIN_TAB_MODULES[k] || []);
        if (vis(activeTab)) return;
        for (const t of simple) {
            if (vis(t)) {
                setActiveTab(t);
                return;
            }
        }
    }, [company, activeTab]);





    // Handle tab + owner sub-tab from URL (e.g. document expiry deep link). Avoid leaving memo/certificate sub-tabs when URL targets another main tab.
    useEffect(() => {
        const tabParam = searchParams?.get('tab');
        const tabLower = tabParam ? String(tabParam).toLowerCase() : '';
        const isLegacyCertificateTab = tabLower === 'certificate';

        if (isLegacyCertificateTab) {
            setActiveTab('others');
            setDocStatusTab('certificate');
            return;
        }

        const canonicalTabs = new Set(['basic', 'owner', 'assets', 'fine', 'others', 'add', 'moa']);
        if (tabParam && canonicalTabs.has(tabLower)) {
            setActiveTab(tabLower);
        }

        const ownerTabParam = searchParams?.get('ownerTab');
        if (tabLower === 'owner') {
            if (ownerTabParam !== null && ownerTabParam !== '') {
                const idx = parseInt(ownerTabParam, 10);
                if (!Number.isNaN(idx) && idx >= 0) {
                    setActiveOwnerTabIndex(idx);
                }
            } else {
                setActiveOwnerTabIndex(0);
            }
        } else if (tabParam && tabLower !== 'others' && tabLower !== 'add' && tabLower !== 'moa') {
            setActiveOwnerTabIndex(0);
        }

        const docStatusParam = searchParams?.get('docStatusTab');
        if (tabLower === 'others' || tabLower === 'add' || tabLower === 'moa') {
            if (docStatusParam && ['live', 'old', 'memo', 'certificate'].includes(docStatusParam)) {
                setDocStatusTab(docStatusParam);
            } else {
                setDocStatusTab('live');
            }
        } else if (tabParam) {
            setDocStatusTab('live');
        }
    }, [searchParams]);

    useEffect(() => {
        if (docStatusTab !== 'memo') {
            setMemoCategoryFilter('');
            setMemoIssueRangeFrom('');
            setMemoIssueRangeTo('');
        }
    }, [docStatusTab]);

    useLayoutEffect(() => {
        if (activeTab === 'Certificate') {
            setActiveTab('others');
            setDocStatusTab('certificate');
        }
    }, [activeTab]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const rawEmployeeUser = localStorage.getItem('employeeUser');
        const rawUser = localStorage.getItem('user');
        try {
            if (rawEmployeeUser) {
                setCurrentUser(JSON.parse(rawEmployeeUser));
                return;
            }
            if (rawUser) {
                setCurrentUser(JSON.parse(rawUser));
            }
        } catch {
            setCurrentUser(null);
        }
    }, []);

    // Close dropdown when clicking outside

    useEffect(() => {

        const handleClickOutside = (event) => {

            if (visaDropdownRef.current && !visaDropdownRef.current.contains(event.target)) {

                setVisaDropdownOpen(false);

            }

            if (addMoreRef.current && !addMoreRef.current.contains(event.target)) {

                setIsAddMoreOpen(false);

            }

            if (respDropdownRef.current && !respDropdownRef.current.contains(event.target)) {

                setRespDropdownOpen(false);

            }

        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => document.removeEventListener('mousedown', handleClickOutside);

    }, []);

    useEffect(() => {
        const handleProgressTooltipOutsideClick = (event) => {
            if (!showProgressTooltip && !isProgressTooltipLocked) return;
            const target = event.target;
            const clickedInsideBar = progressBarRef.current?.contains(target);
            const clickedInsideTooltip = progressTooltipRef.current?.contains(target);
            if (!clickedInsideBar && !clickedInsideTooltip) {
                setShowProgressTooltip(false);
                setIsProgressTooltipLocked(false);
            }
        };

        document.addEventListener('mousedown', handleProgressTooltipOutsideClick);
        return () => document.removeEventListener('mousedown', handleProgressTooltipOutsideClick);
    }, [showProgressTooltip, isProgressTooltipLocked]);



    const fetchCompany = useCallback(async () => {

        try {

            setLoading(true);

            const response = await axiosInstance.get(`/Company/${encodeURIComponent(companyId)}`);

            setCompany(response.data.company);
            setActivationProgressFromApi(response.data.activationProgress || null);
            setViewerIsDesignatedFlowchartHr(!!response.data.viewerIsDesignatedFlowchartHr);

            setEmployeeCount(response.data.employeeCount || 0);

        } catch (err) {

            console.error('Error fetching company:', err);

        } finally {

            setLoading(false);

        }

    }, [companyId]);



    useEffect(() => {

        if (companyId) fetchCompany();

    }, [fetchCompany, companyId]);



    useEffect(() => {

        if (company) {

            const baseTabs = ['assets', 'legal document with expiry', 'legal document without expiry', 'moa'];

            const backendTabs = company.customTabs || [];

            const mergedTabs = Array.from(new Set([...baseTabs, ...backendTabs]));

            setDynamicTabs(mergedTabs);



            // Automatically activate custom tabs that have data (but not insurance/ejari as they are cards now)

            const tabsToActivate = [];



            // Activate any custom tabs that were created

            backendTabs.forEach(tab => {

                if (!['insurance', 'ejari', 'assets', 'Certificate'].includes(tab) && !tabsToActivate.includes(tab)) {

                    tabsToActivate.push(tab);

                }

            });



            setActiveDynamicTabs(prev => {

                const filteredPrev = prev.filter(t => !['insurance', 'ejari', 'Certificate'].includes(t));

                const uniqueTabs = new Set([...filteredPrev, ...tabsToActivate]);

                return Array.from(uniqueTabs);

            });



            if (company.responsibilities) {

                setResponsibilities(company.responsibilities);

            }

        }

    }, [company]);



    const fetchAllEmployees = useCallback(async (compId) => {

        if (!compId) return;

        try {

            const response = await axiosInstance.get('/Employee', { params: { limit: 1000 } });

            const employees = response.data.employees || response.data || [];

            // Filter only employees belonging to this company (using the robust _id comparison)

            const companyEmployees = employees.filter(emp => {

                const empCompId = emp.company?._id || emp.company;

                return String(empCompId) === String(compId);

            });

            setAllEmployees(companyEmployees);

        } catch (err) {

            console.error('Error fetching employees:', err);

        }

    }, []);



    const fetchAllUsers = useCallback(async () => {

        try {

            const response = await axiosInstance.get('/User', { params: { limit: 1000 } });

            setAllUsers(response.data.users || response.data || []);

        } catch (err) {

            console.error('Error fetching users:', err);

        }

    }, []);



    const fetchAllCompanies = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Company');
            setAllCompanies(response.data.companies || response.data || []);
        } catch (err) {
            console.error('Error fetching all companies:', err);
        }
    }, []);

    useEffect(() => {
        fetchAllCompanies();
        fetchOwnersCatalog();
    }, [fetchAllCompanies, fetchOwnersCatalog]);

    useEffect(() => {

        if (company?._id) {

            fetchAllEmployees(company._id);

        }

        fetchAllUsers();

    }, [company?._id, fetchAllEmployees, fetchAllUsers]);



    const fetchCompanyAssets = useCallback(async () => {
        if (!company?._id || !companyAssetsCanView) return;
        try {
            setAssetsLoading(true);
            const res = await axiosInstance.get('/AssetItem/assigned/all', {
                params: { companyId: company._id },
            });
            const rows = res.data || [];
            const filtered = rows.filter((a) => {
                if (String(a?.assignedToType || '').toLowerCase() !== 'company') return false;
                const assetCompId = a.assignedCompany?._id || a.assignedCompany;
                return assetCompId && String(assetCompId) === String(company._id);
            });
            setCompanyAssets(filtered);
        } catch (err) {
            console.error('Error fetching company assets:', err);
            setCompanyAssets([]);
        } finally {
            setAssetsLoading(false);
        }
    }, [company?._id, companyAssetsCanView]);

    useEffect(() => {
        if (activeTab === 'assets' && company?._id && companyAssetsCanView) {
            fetchCompanyAssets();
        }
    }, [activeTab, company?._id, companyAssetsCanView, fetchCompanyAssets]);

    useEffect(() => {

        if (activeTab === 'fine' && company?._id && companyFineCanView) {

            setFinesLoading(true);

            axiosInstance.get('/Fine', { params: { companyId: company._id, limit: 1000 } })

                .then(res => {
                    setCompanyFines(res.data?.fines || res.data || []);
                })

                .catch(err => {
                    console.error('Error fetching company fines:', err);
                    setCompanyFines([]);
                })

                .finally(() => setFinesLoading(false));

        }

    }, [activeTab, company?._id, companyFineCanView]);



    const handleRemoveConfirm = async () => {

        if (itemToDelete === null) return;

        const updated = responsibilities.filter((_, i) => i !== itemToDelete);

        setResponsibilities(updated);

        try {

            await axiosInstance.patch(`/Company/${companyId}`, { responsibilities: updated });

            toast({ title: "Updated", description: "Responsibility removed successfully" });

            fetchCompany();

        } catch (err) {

            console.error('Error removing responsibility:', err);

            toast({ title: "Error", description: "Failed to remove responsibility", variant: "destructive" });

        } finally {

            setItemToDelete(null);

        }

    };



    const findPendingNotRenew = useCallback(
        (target) => (company?.pendingNotRenewRequests || []).find((r) => companyNotRenewPendingMatches(r, target)),
        [company]
    );

    useEffect(() => {
        if (!notRenewData) {
            setNotRenewReason('');
            setNotRenewFile(null);
        }
    }, [notRenewData]);

    const buildNotRenewPayload = () => {
        if (!notRenewData || !company?._id) return null;
        const base = {
            kind: notRenewData.kind,
            label: notRenewData.label || '',
            reason: notRenewReason.trim(),
            supportingAttachmentKey: '',
            supportingAttachmentName: '',
        };
        if (notRenewData.kind === 'tradeLicense' || notRenewData.kind === 'establishmentCard') return base;
        if (notRenewData.kind === 'document') {
            return {
                ...base,
                documentIndex: typeof notRenewData.index === 'number' ? notRenewData.index : undefined,
                documentItemId: notRenewData.documentItemId || undefined,
            };
        }
        if (notRenewData.kind === 'ownerDoc') {
            return {
                ...base,
                ownerIndex: notRenewData.ownerIndex,
                docKey: notRenewData.docKey,
                ownerProfileId: notRenewData.ownerProfileId || undefined,
            };
        }
        if (notRenewData.kind === 'ejari' || notRenewData.kind === 'insurance') {
            return {
                ...base,
                arrayIndex: typeof notRenewData.arrayIndex === 'number' ? notRenewData.arrayIndex : undefined,
                arrayItemId: notRenewData.arrayItemId || undefined,
            };
        }
        return null;
    };

    const handleNotRenewSubmit = async () => {
        if (!notRenewData || !company?._id) return;
        if (notRenewData.kind === 'ownerDoc' && notRenewData.docKey && !canEditOwnerDocByKey(notRenewData.docKey)) {
            notifyNoPermission(toast, 'request not renew for this document');
            return;
        }
        if (notRenewData.kind === 'tradeLicense' && !tradeLicenseCanEdit) {
            notifyNoPermission(toast, 'request not renew for this document');
            return;
        }
        if (notRenewData.kind === 'establishmentCard' && !establishmentCanEdit) {
            notifyNoPermission(toast, 'request not renew for this document');
            return;
        }
        const reason = notRenewReason.trim();
        if (reason.length < 3) {
            toast({
                title: 'Reason required',
                description: 'Please enter at least 3 characters explaining why this document will not be renewed.',
                variant: 'destructive',
            });
            return;
        }
        const labelFallback = notRenewData.label || 'document';
        setNotRenewSubmitting(true);
        try {
            let supportingAttachmentKey = '';
            let supportingAttachmentName = '';
            if (notRenewFile) {
                const reader = new FileReader();
                const base64Data = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(notRenewFile);
                });
                const uploadRes = await axiosInstance.post(`/Company/${company._id}/upload`, {
                    fileData: base64Data,
                    fileName: notRenewFile.name || 'attachment',
                    folder: `company-documents/${company.companyId || companyId}/not-renew-support`,
                });
                supportingAttachmentKey = uploadRes.data.key || uploadRes.data.url || '';
                supportingAttachmentName = notRenewFile.name || '';
            }
            const payload = buildNotRenewPayload();
            if (!payload) {
                toast({ title: 'Error', description: 'Invalid not-renew target.', variant: 'destructive' });
                return;
            }
            payload.reason = reason;
            payload.supportingAttachmentKey = supportingAttachmentKey;
            payload.supportingAttachmentName = supportingAttachmentName;

            const response = await axiosInstance.post(`/Company/${company._id}/not-renew-requests`, payload);
            if (response?.data?.activationProgress) {
                setActivationProgressFromApi(response.data.activationProgress);
            }
            const message = String(response?.data?.message || '').toLowerCase();
            const wasAutoApproved = message.includes('moved to old documents') || message.includes('not renew applied');
            toast(
                wasAutoApproved
                    ? {
                          title: 'Completed',
                          description: 'Not renew applied. Document removed from Live and moved to Old Documents.',
                      }
                    : {
                          title: 'Submitted',
                          description: 'HR has been notified. This document is pending approval.',
                      }
            );
            setNotRenewData(null);
            fetchCompany();
        } catch (error) {
            console.error('Not Renew submit error:', error);
            toast({
                title: 'Error',
                description: error.response?.data?.message || `Failed to submit not-renew for ${labelFallback}`,
                variant: 'destructive',
            });
        } finally {
            setNotRenewSubmitting(false);
        }
    };

    const handleHrApproveNotRenew = async (requestId) => {
        if (!company?._id || !requestId) return;
        setHrRespondSubmitting(true);
        try {
            const response = await axiosInstance.post(`/Company/${company._id}/not-renew-requests/${requestId}/respond`, { action: 'approve' });
            if (response?.data?.activationProgress) {
                setActivationProgressFromApi(response.data.activationProgress);
            }
            toast({ title: 'Approved', description: 'Not renew applied and document archived.' });
            fetchCompany();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Could not approve.',
                variant: 'destructive',
            });
        } finally {
            setHrRespondSubmitting(false);
        }
    };

    const handleHrRejectNotRenew = async () => {
        if (!company?._id || !hrRejectRequestId) return;
        const hrComment = hrRejectComment.trim();
        if (hrComment.length < 3) {
            toast({
                title: 'Comment required',
                description: 'Please enter at least 3 characters for the rejection reason.',
                variant: 'destructive',
            });
            return;
        }
        setHrRespondSubmitting(true);
        try {
            await axiosInstance.post(`/Company/${company._id}/not-renew-requests/${hrRejectRequestId}/respond`, {
                action: 'reject',
                hrComment,
            });
            toast({ title: 'Rejected', description: 'The requester has been notified.' });
            setHrRejectRequestId(null);
            setHrRejectComment('');
            fetchCompany();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Could not reject.',
                variant: 'destructive',
            });
        } finally {
            setHrRespondSubmitting(false);
        }
    };



    const viewerIsCompanyActivationSubmitter = useMemo(() => {
        if (!company || !currentUser) return false;
        const sid = company.activationSubmittedBy;
        const myObj = String(
            currentUser.employeeObjectId || currentUser.empObjectId || currentUser.linkedEmployee || '',
        ).trim();
        if (sid && myObj && String(sid) === String(myObj)) return true;
        return false;
    }, [company, currentUser]);

    const hasCompanyActivationHoldPending = useMemo(() => {
        return (
            Array.isArray(company?.activationHold?.unapprovedEntryIds) &&
            company.activationHold.unapprovedEntryIds.length > 0
        );
    }, [company?.activationHold?.unapprovedEntryIds]);

    const activationHoldUnapprovedCount = useMemo(() => {
        const ids = company?.activationHold?.unapprovedEntryIds;
        return Array.isArray(ids) ? ids.length : 0;
    }, [company?.activationHold?.unapprovedEntryIds]);

    /** Every held row must be re-saved (green) before resubmit is offered. */
    const activationHoldAllItemsResolved = useMemo(() => {
        if (activationHoldUnapprovedCount === 0) return false;
        const resolved = new Set((company?.activationHold?.resolvedEntryIds || []).map(String));
        const unapproved = (company?.activationHold?.unapprovedEntryIds || []).map(String);
        return unapproved.every((id) => resolved.has(id));
    }, [company?.activationHold, activationHoldUnapprovedCount]);

    /** Submitter may resubmit only when hold cards exist, all fixed, and they click Submit (never auto). */
    const activationHoldResubmitEligible = useMemo(() => {
        if (!company || !currentUser) return false;
        const status = String(company.activationStatus || '').trim().toLowerCase();
        if (status !== 'submitted' && status !== 'hold') return false;
        if (!viewerIsCompanyActivationSubmitter) return false;
        return activationHoldUnapprovedCount > 0 && activationHoldAllItemsResolved;
    }, [
        company,
        currentUser,
        viewerIsCompanyActivationSubmitter,
        activationHoldUnapprovedCount,
        activationHoldAllItemsResolved,
    ]);

    const handleModalOpen = (type, index = null, contextTab = null, isRenewal = false) => {
        const ctx = contextTab || activeTab;
        const modalAccess = accessForCompanyModal(type, ctx, companyPerms);
        const isNewDoc = type === 'companyDocument' && index === null;
        const isNewTradeLicense = type === 'tradeLicense' && !company.tradeLicenseNumber;
        if (
            !canOpenCompanyModal(modalAccess, {
                isRenewal,
                isNew: isRenewal || isNewDoc || isNewTradeLicense,
            })
        ) {
            notifyNoPermission(
                toast,
                isRenewal
                    ? 'renew this item'
                    : isNewDoc || isNewTradeLicense
                      ? 'add this item'
                      : 'edit this item'
            );
            return;
        }

        setModalType(type);

        setIsRenewalModal(isRenewal);

        setModalErrors({});

        const currentIndex = type === 'companyDocument'
            ? index
            : (index !== null ? index : editingIndex);

        let currentTab = contextTab || activeTab;



        if (type === 'tradeLicense') {
            const isNewTradeLicense = !company.tradeLicenseNumber;
            const formatDate = (val) => (val ? new Date(val).toISOString().split('T')[0] : '');
            const rawOwners = isNewTradeLicense
                ? []
                : company.owners?.length
                  ? isRenewal
                      ? company.owners.map((o) => ({ ...o, attachment: null }))
                      : [...company.owners]
                  : [];
            const ownersWithIds = ensureOwnerProfileIds(rawOwners, allCompanies);

            setModalData({
                number: company.tradeLicenseNumber || '',
                issueDate: isRenewal
                    ? formatDate(company.tradeLicenseIssueDate)
                    : formatDate(company.tradeLicenseIssueDate) ||
                      formatDate(company.establishedDate),
                expiryDate: isRenewal ? '' : formatDate(company.tradeLicenseExpiry),
                owners: ownersWithIds,
                attachment: isRenewal ? null : company.tradeLicenseAttachment || null,
                publicId: isRenewal ? null : company.tradeLicenseAttachment || null,
            });

        } else if (type === 'establishmentCard') {
            const formatEstDate = (val) => (val ? new Date(val).toISOString().split('T')[0] : '');
            setModalData({
                companyName: company.name || '',
                number: company.establishmentCardNumber || '',
                expiryDate: isRenewal ? '' : formatEstDate(company.establishmentCardExpiry),
                attachment: isRenewal ? null : company.establishmentCardAttachment || null,
                publicId: isRenewal ? null : company.establishmentCardAttachment || null,
            });
        } else if (type === 'basicDetails') {

            setModalData({

                companyId: company.companyId || '',

                name: company.name || '',

                nickName: company.nickName || '',

                email: company.email || '',

                phone: company.phoneCountryCode ? `${company.phoneCountryCode}${company.phone}` : (company.phone || ''),

                establishedDate: company.establishedDate ? new Date(company.establishedDate).toISOString().split('T')[0] : '',

                expiryDate: company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toISOString().split('T')[0] : ''

            });

        } else if (type === 'companyAddress') {
            const countryIso = resolveCountryIso(company.country);
            setModalData({
                address: company.address || '',
                country: countryIso,
                state: resolveStateIso(company.state, countryIso),
                city: company.city || '',
                postalCode: company.postalCode || '',
            });

        } else if (type === 'companyDocument') {

            let doc = {};

            if (currentIndex !== null) {

                if (currentTab === 'insurance') doc = company.insurance?.[currentIndex] || {};

                else if (currentTab === 'ejari') doc = company.ejari?.[currentIndex] || {};

                else doc = company.documents?.[currentIndex] || {};



                // Use saved context if available

                if (doc.context) currentTab = doc.context;

            }

            const rawIssueDate = doc.issueDate || doc.startDate;
            const issueDate = rawIssueDate ? new Date(rawIssueDate).toISOString().split('T')[0] : '';
            const expiryDate = doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '';
            const valueRaw = doc.value ?? '';
            const isNoExpiryByContext =
                String(currentTab || '').toLowerCase() === 'document_without_expiry' ||
                String(currentTab || '').toLowerCase() === 'moa';

            if (String(currentTab || '').toLowerCase() === 'ejari') {
                setEditingIndex(currentIndex);
                setModalData({
                    type: doc?.type != null ? String(doc.type).trim() : '',
                    description: typeof doc.description === 'string' ? doc.description : '',
                    issueDate: isRenewal ? '' : issueDate,
                    startDate: isRenewal ? '' : issueDate,
                    hasExpiry: true,
                    expiryDate: isRenewal ? '' : expiryDate,
                    hasValue: !(valueRaw === '' || valueRaw === null || valueRaw === undefined),
                    value: valueRaw,
                    context: 'ejari',
                    attachment: isRenewal ? null : (doc.document?.url || null),
                    fileName: isRenewal ? '' : (doc.document?.name || ''),
                    mimeType: 'application/pdf',
                    provider: doc.provider || '',
                    authority: doc.authority || '',
                });
                return;
            }

            setEditingIndex(currentIndex);
            const isLiveWithExpiryContext =
                String(currentTab || doc?.context || '').toLowerCase() === 'document_with_expiry';
            setModalData({
                type: isRenewal && !isLiveWithExpiryContext
                    ? ''
                    : (doc?.type != null && String(doc.type).trim() !== '' ? String(doc.type) : ''),
                description: isRenewal ? '' : (typeof doc.description === 'string' ? doc.description : ''),
                issueDate: isRenewal ? '' : issueDate,
                startDate: isRenewal ? '' : issueDate,
                hasExpiry: isRenewal ? true : !isNoExpiryByContext,
                expiryDate: isRenewal ? '' : expiryDate,
                hasValue: isRenewal ? false : !(valueRaw === '' || valueRaw === null || valueRaw === undefined),
                value: isRenewal ? '' : valueRaw,
                context: currentTab,
                attachment: isRenewal ? null : (doc.document?.url || null),
                fileName: isRenewal ? '' : (doc.document?.name || ''),
                mimeType: isRenewal ? 'application/pdf' : (doc.document?.mimeType || 'application/pdf'),
                provider: doc.provider || '',
                authority: doc.authority || '',
            });
            return;

        } else if (type === 'addNewCategory') {

            setModalData({

                type: '',

                issueDate: '',

                startDate: '',

                expiryDate: '',

                value: '',

                attachment: null

            });

        } else if (type === 'ownerDetails') {

            const owner = ownersForDisplay[activeOwnerTabIndex];

            setModalData({

                name: owner?.name || '',

                sharePercentage: owner?.sharePercentage || '',

                email: getOwnerRowEmail(owner) || owner?.email || '',

                phone: owner?.phone || '',

                nationality: owner?.nationality || ''

            });

            setOwnerDetailsPhoneValid(
                owner?.phone ? validateOwnerPhone(owner.phone) === '' : false,
            );

        } else if (type === 'ownerVisa') {
            const owner = ownersForDisplay[activeOwnerTabIndex];
            const visaDocKey = contextTab || 'visitVisa';
            const docData = (!isRenewal && owner?.[visaDocKey]) || {};
            const visaType =
                visaDocKey === 'visitVisa' ? 'Visit' : visaDocKey === 'spouseVisa' ? 'Spouse' : 'Employment';
            if (isRenewal) {
                setModalData({
                    visaDocKey,
                    number: docData.number || '',
                    type: visaType,
                    issueDate: '',
                    expiryDate: '',
                    sponsor: '',
                    attachment: null,
                    publicId: null,
                });
            } else {
                setModalData({
                    visaDocKey,
                    number: docData.number || '',
                    type: docData.type || visaType,
                    issueDate: docData.issueDate ? new Date(docData.issueDate).toISOString().split('T')[0] : '',
                    expiryDate: docData.expiryDate ? new Date(docData.expiryDate).toISOString().split('T')[0] : '',
                    sponsor: docData.sponsor || '',
                    attachment: docData.attachment || null,
                    publicId: docData.attachment || null,
                });
            }
        } else if (type === 'ownerLabourCard') {
            const owner = ownersForDisplay[activeOwnerTabIndex];
            const docData = owner?.labourCard || {};
            if (isRenewal) {
                setModalData({
                    number: docData.number || '',
                    expiryDate: '',
                    attachment: null,
                    publicId: null,
                });
            } else {
                setModalData({
                    number: docData.number || '',
                    expiryDate: docData.expiryDate
                        ? new Date(docData.expiryDate).toISOString().split('T')[0]
                        : '',
                    attachment: docData.attachment || null,
                    publicId: docData.attachment || null,
                });
            }
        } else if (type === 'ownerMedical') {
            const owner = ownersForDisplay[activeOwnerTabIndex];
            const docData = owner?.medical || {};
            if (isRenewal) {
                setModalData({
                    provider: docData.provider || '',
                    number: docData.number || '',
                    issueDate: '',
                    expiryDate: '',
                    attachment: null,
                    publicId: null,
                });
            } else {
                setModalData({
                    provider: docData.provider || '',
                    number: docData.number || '',
                    issueDate: docData.issueDate
                        ? new Date(docData.issueDate).toISOString().split('T')[0]
                        : '',
                    expiryDate: docData.expiryDate
                        ? new Date(docData.expiryDate).toISOString().split('T')[0]
                        : '',
                    attachment: docData.attachment || null,
                    publicId: docData.attachment || null,
                });
            }
        } else if (type === 'ownerDrivingLicense') {
            const owner = ownersForDisplay[activeOwnerTabIndex];
            const docData = owner?.drivingLicense || {};
            if (isRenewal) {
                setModalData({
                    number: docData.number || '',
                    issuingCountry: docData.issuingCountry || '',
                    issueDate: '',
                    expiryDate: '',
                    attachment: null,
                    publicId: null,
                });
            } else {
                setModalData({
                    number: docData.number || '',
                    issuingCountry: docData.issuingCountry || '',
                    issueDate: docData.issueDate
                        ? new Date(docData.issueDate).toISOString().split('T')[0]
                        : '',
                    expiryDate: docData.expiryDate
                        ? new Date(docData.expiryDate).toISOString().split('T')[0]
                        : '',
                    attachment: docData.attachment || null,
                    publicId: docData.attachment || null,
                });
            }
        } else if (['ownerPassport', 'ownerEmiratesId'].includes(type)) {

            const owner = ownersForDisplay[activeOwnerTabIndex];

            const fieldMap = {

                ownerPassport: 'passport',

                ownerEmiratesId: 'emiratesId',

            };

            const docField = fieldMap[type];

            const docData = (!isRenewal && owner[docField]) || {};
            const existingPassport = owner?.passport || {};

            const existingEmiratesId = owner?.emiratesId || {};

            if (type === 'ownerPassport' && isRenewal) {
                setModalData({
                    number: existingPassport.number || '',
                    nationality: existingPassport.nationality || owner?.nationality || '',
                    type: '',
                    issueDate: '',
                    placeOfIssue: '',
                    countryOfIssue: '',
                    sponsor: '',
                    provider: '',
                    attachment: null,
                    publicId: null,
                    lastUpdated: '',
                    expiryDate: '',
                });
            } else if (type === 'ownerEmiratesId' && isRenewal) {
                setModalData({
                    number: existingEmiratesId.number || '',
                    nationality: '',
                    type: '',
                    issueDate: '',
                    placeOfIssue: '',
                    countryOfIssue: '',
                    sponsor: '',
                    provider: '',
                    attachment: null,
                    publicId: null,
                    lastUpdated: '',
                    expiryDate: '',
                });
            } else {
                setModalData({
                    number: docData.number || '',
                    nationality: docData.nationality || '',
                    type: docData.type || '',
                    issueDate: docData.issueDate ? new Date(docData.issueDate).toISOString().split('T')[0] : '',
                    placeOfIssue: docData.placeOfIssue || '',
                    countryOfIssue: docData.countryOfIssue || '',
                    sponsor: docData.sponsor || '',
                    provider: docData.provider || '',
                    attachment: docData.attachment || null,
                    publicId: docData.attachment || null,
                    lastUpdated: docData.lastUpdated ? new Date(docData.lastUpdated).toISOString().split('T')[0] : '',
                    expiryDate: docData.expiryDate ? new Date(docData.expiryDate).toISOString().split('T')[0] : '',
                });
            }

        } else if (type === 'addEjari' || type === 'addInsurance') {

            setModalType('companyDocument');

            const docType = type === 'addEjari' ? 'Ejari' : 'Insurance';

            setModalData({
                type: '',
                description: '',
                provider: '',
                authority: '',
                issueDate: '',
                startDate: '',
                hasExpiry: true,
                hasValue: true,
                value: '',
                expiryDate: '',
                attachment: null,
                fileName: '',
                mimeType: 'application/pdf',
                context: type === 'addEjari' ? 'ejari' : 'insurance',
            });

        }

    };

    const handleHeldActivationEdit = useCallback(
        (entry) => {
            const st = buildHeldActivationEditState(company, entry);
            if (!st?.ok) {
                toast({
                    title: 'Unable to open edit',
                    description: 'No saved proposal was found for this hold item.',
                    variant: 'destructive',
                });
                return;
            }
            setIsRenewalModal(false);
            setModalErrors({});
            if (st.tabAfterOpen) setActiveTab(st.tabAfterOpen);
            if (st.modalType === 'certificate') {
                setEditingCertificateData(st.modalData);
                setEditingCertificateIndex(st.editingIndex ?? null);
                setShowCertificateModal(true);
            } else {
                setEditingIndex(st.editingIndex ?? null);
                setModalData(st.modalData);
                setModalType(st.modalType);
            }
        },
        [company, toast],
    );

    const handleModalClose = () => {

        setModalType(null);

        setModalData({});

        setModalErrors({});

        setOwnerDocTouched({});
        ownerDocInitialDataRef.current = null;

        setOwnerDetailsPhoneValid(false);

        setEditingIndex(null);

        setIsRenewalModal(false);

    };

    const handleTradeLicenseOwnerPickerBack = () => {
        setModalData((prev) => {
            const next = { ...prev };
            delete next.filteredOwners;
            delete next.allOwners;
            return next;
        });
        setModalType('tradeLicense');
    };

    const handleOpenOwnerVisaTypeSelection = () => {
        const modalAccess = accessForCompanyModal('ownerVisa', null, companyPerms);
        if (!canOpenCompanyModal(modalAccess, { isNew: true })) {
            notifyNoPermission(toast, 'add visa');
            return;
        }
        const owner = ownersForDisplay[activeOwnerTabIndex];
        if (!owner || ownerHasAnyVisaCard(owner) || !missingOwnerVisaTypesForActiveOwner.length) return;
        setModalType('ownerVisaTypeSelection');
        setIsRenewalModal(false);
        setModalErrors({});
        setModalData({});
    };

    const openCompanyAddDocumentModal = () => {
        setModalErrors({});
        setEditingIndex(null);
        setModalData({
            type: '',
            description: '',
            issueDate: '',
            startDate: '',
            hasExpiry: false,
            expiryDate: '',
            hasValue: false,
            value: '',
            context: undefined,
            attachment: null,
            fileName: '',
            mimeType: 'application/pdf',
            provider: '',
            authority: '',
        });
        setModalType('companyDocument');
        setIsRenewalModal(false);
    };



    const handleFileChange = async (e) => {

        const file = e.target.files[0];

        if (!file) return;

        if (modalType === 'tradeLicense') {
            const pdfErr = validateTradeLicensePdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (modalType === 'establishmentCard') {
            const attachErr = validateEstablishmentCardAttachmentFile(file);
            if (attachErr) {
                toast({ title: 'Error', description: attachErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (isEjariModalContext(modalData, modalType)) {
            const pdfErr = validateEjariPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (modalType === 'ownerPassport') {
            const pdfErr = validatePassportPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (modalType === 'ownerEmiratesId') {
            const pdfErr = validateEmiratesIdPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (modalType === 'ownerVisa') {
            const pdfErr = validateVisaPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (modalType === 'ownerLabourCard') {
            const pdfErr = validateLabourCardPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (modalType === 'ownerMedical') {
            const pdfErr = validateMedicalPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (modalType === 'ownerDrivingLicense') {
            const pdfErr = validateDrivingLicensePdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (isMoaForm) {
            const pdfErr = validateMoaPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (modalType === 'addMemo') {
            const pdfErr = validateMemoPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (isLiveCompanyDocModal) {
            const pdfErr = validateLiveDocumentPdfFile(file);
            if (pdfErr) {
                toast({ title: 'Error', description: pdfErr, variant: 'destructive' });
                e.target.value = '';
                return;
            }
        } else if (file.size > 5 * 1024 * 1024) {
            toast({ title: "Error", description: "File size exceeds 5MB limit", variant: "destructive" });
            return;
        }



        try {

            setIsSubmitting(true);



            const reader = new FileReader();

            reader.readAsDataURL(file);

            reader.onload = async () => {

                const base64Data = reader.result;



                try {

                    const uploadName =
                        modalType === 'establishmentCard'
                            ? sanitizeEstablishmentFileName(file.name)
                            : file.name;
                    const response = await axiosInstance.post(`/Company/${company._id}/upload`, {

                        fileData: base64Data,

                        fileName: uploadName,

                        folder: `company-documents/${company.companyId}`

                    });



                    setModalData(prev => ({

                        ...prev,

                        attachment: response.data.key || response.data.publicId || response.data.url,

                        publicId: response.data.key || response.data.publicId,

                        fileName: file.name,

                        mimeType: file.type

                    }));



                    toast({ title: "Success", description: "File uploaded successfully" });

                } catch (error) {

                    console.error('Error uploading file:', error);

                    toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });

                } finally {

                    setIsSubmitting(false);

                }

            };

            reader.onerror = () => {

                toast({ title: "Error", description: "Failed to read file", variant: "destructive" });

                setIsSubmitting(false);

            };

        } catch (error) {

            console.error('File operation error:', error);

            setIsSubmitting(false);

        }

    };

    /** Avoid sending `attachment: null` on owner rows when saving a doc card (passport, visa, etc.). */
    const buildOwnerRowForDocCardSave = (owner, docField, docPayload, extra = {}) => {
        const row = { ...owner, ...extra, [docField]: docPayload };
        if (row.attachment == null) delete row.attachment;
        return row;
    };

    /** Live owner rows for PATCH — avoids re-submitting pending HR overlay data for other owners. */
    const getOwnersBaseForDocCardSave = () => {
        const live = Array.isArray(company?.owners) ? company.owners.map((o) => ({ ...o })) : [];
        if (live.length > 0) return live;
        return ownersForDisplay.map((o) => ({ ...o }));
    };

    const resolveOwnerIndexForSave = (ownersList) => {
        const displayOwner = ownersForDisplay[activeOwnerTabIndex];
        if (!displayOwner) {
            return activeOwnerTabIndex < ownersList.length ? activeOwnerTabIndex : 0;
        }
        if (displayOwner._id != null) {
            const byId = ownersList.findIndex((o) => String(o._id) === String(displayOwner._id));
            if (byId >= 0) return byId;
        }
        return activeOwnerTabIndex < ownersList.length ? activeOwnerTabIndex : 0;
    };

    const handleSave = async (e) => {

        if (e) e.preventDefault();



        // Validation logic

        const errors = {};

        if (modalType === 'tradeLicense') {
            const existingOwnerNames = getUniqueOwners()
                .map((o) => o.name)
                .filter(Boolean);
            Object.assign(
                errors,
                validateTradeLicenseFields(modalData, {
                    existingOwnerNames,
                    requireAttachment: true,
                }),
            );
        } else if (modalType === 'establishmentCard') {
            Object.assign(
                errors,
                validateEstablishmentCardFields(modalData, {
                    requireAttachment: true,
                    companies: allCompanies,
                    excludeCompanyId: company?.companyId,
                    excludeCompanyMongoId: company?._id,
                }),
            );
        } else if (modalType === 'basicDetails') {

            // 1. Company Name validation
            if (!modalData.name) {
                errors.name = 'Company Name is required';
            } else {
                const trimmedName = modalData.name.trim();
                if (trimmedName.length < 3 || trimmedName.length > 100) {
                    errors.name = 'Company Name must be between 3 and 100 characters';
                } else {
                    const nameRegex = /^[A-Za-z0-9&.,()\' -]{3,100}$/;
                    if (!nameRegex.test(trimmedName)) {
                        errors.name = 'Company Name contains restricted special characters';
                    }
                }
            }

            // 2. Short Name (Nick Name) validation
            if (modalData.nickName) {
                const trimmedNick = modalData.nickName.trim();
                if (trimmedNick.length > 50) {
                    errors.nickName = 'Short Name cannot exceed 50 characters';
                } else {
                    const nickRegex = /^[A-Za-z0-9&.\' -]{0,50}$/;
                    if (!nickRegex.test(trimmedNick)) {
                        errors.nickName = 'Short Name contains restricted characters';
                    }
                }
            }

            // 3. Email validation
            if (!modalData.email) {
                errors.email = 'Company Email ID is required';
            } else {
                const trimmedEmail = modalData.email.trim();
                if (trimmedEmail.includes(' ')) {
                    errors.email = 'Company Email ID cannot contain spaces';
                } else {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(trimmedEmail)) {
                        errors.email = 'Please enter a valid email address';
                    }
                }
            }

            // 4. Phone validation
            if (!modalData.phone) {
                errors.phone = 'Phone Number is required';
            }

            // 5. Established Date validation
            if (!modalData.establishedDate) {
                errors.establishedDate = 'Establishment Date is required';
            } else {
                const estDate = new Date(modalData.establishedDate);
                if (isNaN(estDate.getTime())) {
                    errors.establishedDate = 'Establishment Date must be a valid date';
                } else {
                    if (estDate > new Date()) {
                        errors.establishedDate = 'Establishment Date cannot be in the future';
                    }
                    if (estDate.getFullYear() < 1900) {
                        errors.establishedDate = 'Establishment Date minimum year is 1900';
                    }
                }
            }

            // 6. Expiry Date validation
            if (modalData.expiryDate) {
                const expDate = new Date(modalData.expiryDate);
                if (isNaN(expDate.getTime())) {
                    errors.expiryDate = 'Expiry Date must be a valid date';
                } else {
                    if (expDate.getFullYear() < 1900) {
                        errors.expiryDate = 'Expiry Date minimum year is 1900';
                    }
                    if (modalData.establishedDate) {
                        const estDate = new Date(modalData.establishedDate);
                        if (!isNaN(estDate.getTime()) && expDate <= estDate) {
                            errors.expiryDate = 'Expiry Date must be greater than the Establishment Date';
                        }
                    }
                }
            }

        } else if (modalType === 'companyAddress') {
            Object.assign(errors, validateCompanyAddressFields(modalData));

        } else if (isEjariModalContext(modalData, modalType)) {
            Object.assign(
                errors,
                validateEjariFields(modalData, { requireAttachment: true }),
            );
        } else if (['companyDocument', 'addNewCategory', 'addEjari', 'addInsurance'].includes(modalType)) {

            if (modalData.context === 'moa') {
                Object.assign(
                    errors,
                    validateCompanyMoaFields(modalData, {
                        requireAttachment: true,
                    }),
                );
            } else if (isLiveCompanyDocForm(modalData, modalType)) {
                Object.assign(
                    errors,
                    validateCompanyLiveDocumentFields(modalData, {
                        requireAttachment: true,
                        existingDocuments: company?.documents || [],
                        editingIndex,
                        allowedTypeOptions: buildCompanyLiveDocumentTypeOptions(
                            company?.documents || [],
                            modalData?.type,
                        ),
                    }),
                );
            } else if (!modalData.type) errors.type = (modalData.context === 'ejari' ? 'Ejari Type' : modalData.context === 'insurance' ? 'Insurance Type' : 'Document Type') + ' is required';

            const isNoExpiry =
                modalData.context === 'moa' ||
                (isLiveCompanyDocForm(modalData, modalType) && modalData.hasExpiry === false) ||
                (!isLiveCompanyDocForm(modalData, modalType) && (
                modalData.hasExpiry === false ||
                modalData.context === 'document_without_expiry' ||
                modalData.type?.toLowerCase().includes('without expiry')));



            const docTypeLower = String(modalData.type || '').toLowerCase();
            const requiresIssueDate =
                modalData.context === 'insurance' ||
                docTypeLower.includes('insur');
            if (modalData.context !== 'moa' && !isLiveCompanyDocForm(modalData, modalType) && requiresIssueDate && !modalData.issueDate && !modalData.startDate) errors.issueDate = 'Issue Date is required';



            if (modalData.context !== 'moa' && !isLiveCompanyDocForm(modalData, modalType) && !modalData.expiryDate && !isNoExpiry) {

                errors.expiryDate = 'Expiry Date is required';

            }

            if (!modalData.attachment) errors.attachment = 'Attachment is required';

        } else if (modalType === 'addMemo') {
            Object.assign(
                errors,
                validateCompanyMemoFields(modalData, { requireAttachment: true }),
            );

        } else if (modalType === 'ownerDetails') {
            const ownerFieldErrors = validateOwnerDetailsFields(modalData, {
                requireEmail: isCompanyActivationComplete,
                owners: ownersForDisplay,
                ownerIndex: activeOwnerTabIndex,
            });
            Object.assign(errors, ownerFieldErrors);
            if (!errors.phone && modalData.phone && validateOwnerPhone(modalData.phone)) {
                errors.phone = validateOwnerPhone(modalData.phone);
            }
            if (!errors.phone && modalData.phone && !ownerDetailsPhoneValid) {
                errors.phone = 'Please enter a valid contact number';
            }
        } else if (modalType === 'ownerPassport') {
            const passportErrors = validateOwnerPassportFields(modalData, {
                owners: ownersForDisplay,
                ownerIndex: activeOwnerTabIndex,
                isRenewal: isRenewalModal,
                requireAttachment: true,
            });
            Object.assign(errors, passportErrors);
        } else if (modalType === 'ownerEmiratesId') {
            const eidErrors = validateOwnerEmiratesIdFields(modalData, {
                owners: ownersForDisplay,
                ownerIndex: activeOwnerTabIndex,
                requireAttachment: true,
            });
            Object.assign(errors, eidErrors);
        } else if (modalType === 'ownerVisa') {
            const visaErrors = validateOwnerVisaFields(modalData, {
                visaDocKey: modalData?.visaDocKey || 'visitVisa',
                owners: ownersForDisplay,
                ownerIndex: activeOwnerTabIndex,
                requireAttachment: true,
            });
            Object.assign(errors, visaErrors);
        } else if (modalType === 'ownerLabourCard') {
            const labourCardErrors = validateOwnerLabourCardFields(modalData, {
                requireAttachment: true,
            });
            Object.assign(errors, labourCardErrors);
        } else if (modalType === 'ownerMedical') {
            const medicalErrors = validateOwnerMedicalInsuranceFields(modalData, {
                requireAttachment: true,
            });
            Object.assign(errors, medicalErrors);
        } else if (modalType === 'ownerDrivingLicense') {
            const drivingLicenseErrors = validateOwnerDrivingLicenseFields(modalData, {
                requireAttachment: true,
            });
            Object.assign(errors, drivingLicenseErrors);
        }



        if (Object.keys(errors).length > 0) {

            setModalErrors(errors);

            const firstError = Object.values(errors).find((m) => typeof m === 'string' && m.trim()) || '';

            toast({

                title: "Validation Error",

                description: firstError || "Please fill all required fields correctly",

                variant: "destructive"

            });

            return;

        }



        try {

            setIsSubmitting(true);

            const payload = {};

            if (modalType === 'tradeLicense') {

                payload.tradeLicenseNumber = normalizeTradeLicenseNumber(modalData.number);

                payload.tradeLicenseIssueDate = modalData.issueDate;

                payload.tradeLicenseExpiry = modalData.expiryDate;

                payload.owners = (modalData.owners || []).map((o, idx) => {
                    const existing =
                        (company?.owners || []).find(
                            (co) =>
                                (o._id && String(co._id) === String(o._id)) ||
                                (o.ownerProfileId &&
                                    co.ownerProfileId &&
                                    String(co.ownerProfileId) === String(o.ownerProfileId)),
                        ) || company?.owners?.[idx] || {};
                    return {
                        ...existing,
                        ...o,
                        name: String(o.name || '').trim(),
                        ownerProfileId: resolveOwnerProfileId(o),
                    };
                });

                if (modalData.attachment) {
                    payload.tradeLicenseAttachment = modalData.publicId || modalData.attachment;
                }

                if (modalData.owners && modalData.owners.length > 0) {

                    payload.tradeLicenseOwnerName = modalData.owners[0].name;

                }

            } else if (modalType === 'establishmentCard') {
                payload.establishmentCardNumber = normalizeEstablishmentCardNumber(modalData.number);
                payload.establishmentCardExpiry = modalData.expiryDate;
                if (modalData.attachment) {
                    payload.establishmentCardAttachment = modalData.publicId || modalData.attachment;
                }
            } else if (modalType === 'basicDetails') {

                payload.name = modalData.name ? modalData.name.trim() : '';

                payload.nickName = modalData.nickName ? modalData.nickName.trim() : '';

                payload.email = modalData.email ? modalData.email.trim().toLowerCase() : '';

                let dialCode = '971';
                let nationalNumber = modalData.phone ? modalData.phone.trim() : '';
                if (nationalNumber.startsWith('+')) {
                    const countryCode = extractCountryCode(nationalNumber);
                    if (countryCode) {
                        dialCode = countryCode;
                        nationalNumber = nationalNumber.substring(countryCode.length + 1);
                    }
                }
                payload.phone = nationalNumber.replace(/\D/g, '');
                payload.phoneCountryCode = `+${dialCode}`;

                payload.establishedDate = modalData.establishedDate;

                payload.tradeLicenseExpiry = modalData.expiryDate;

            } else if (modalType === 'companyAddress') {
                payload.address = modalData.address ? modalData.address.trim() : '';
                payload.city = modalData.city ? modalData.city.trim() : '';
                payload.postalCode = modalData.postalCode ? modalData.postalCode.trim() : '';
                payload.country = Country.getCountryByCode(modalData.country)?.name || modalData.country;
                payload.state = State.getStateByCodeAndCountry(modalData.state, modalData.country)?.name || modalData.state;

            } else if (modalType === 'ownerVisa') {
                const visaDocKey = modalData.visaDocKey || 'visitVisa';
                const updatedOwners = getOwnersBaseForDocCardSave();
                const saveIndex = resolveOwnerIndexForSave(updatedOwners);
                const owner = updatedOwners[saveIndex];
                const nextOwner = buildOwnerRowForDocCardSave(owner, visaDocKey, {
                    ...normalizeOwnerVisaPayload(modalData, visaDocKey),
                    attachment: modalData.publicId || modalData.attachment,
                });
                if (nextOwner.visa) delete nextOwner.visa;
                updatedOwners[saveIndex] = nextOwner;
                payload.owners = updatedOwners;
            } else if (modalType === 'ownerLabourCard') {
                const updatedOwners = getOwnersBaseForDocCardSave();
                const saveIndex = resolveOwnerIndexForSave(updatedOwners);
                const owner = updatedOwners[saveIndex];
                updatedOwners[saveIndex] = buildOwnerRowForDocCardSave(owner, 'labourCard', {
                    ...normalizeOwnerLabourCardPayload(modalData),
                    attachment: modalData.publicId || modalData.attachment,
                });
                payload.owners = updatedOwners;
            } else if (modalType === 'ownerMedical') {
                const updatedOwners = getOwnersBaseForDocCardSave();
                const saveIndex = resolveOwnerIndexForSave(updatedOwners);
                const owner = updatedOwners[saveIndex];
                updatedOwners[saveIndex] = buildOwnerRowForDocCardSave(owner, 'medical', {
                    ...normalizeOwnerMedicalInsurancePayload(modalData),
                    attachment: modalData.publicId || modalData.attachment,
                });
                payload.owners = updatedOwners;
            } else if (modalType === 'ownerDrivingLicense') {
                const updatedOwners = getOwnersBaseForDocCardSave();
                const saveIndex = resolveOwnerIndexForSave(updatedOwners);
                const owner = updatedOwners[saveIndex];
                updatedOwners[saveIndex] = buildOwnerRowForDocCardSave(owner, 'drivingLicense', {
                    ...normalizeOwnerDrivingLicensePayload(modalData),
                    attachment: modalData.publicId || modalData.attachment,
                });
                payload.owners = updatedOwners;
            } else if (['ownerPassport', 'ownerEmiratesId'].includes(modalType)) {

                const fieldMap = {

                    ownerPassport: 'passport',

                    ownerEmiratesId: 'emiratesId',

                };

                const docField = fieldMap[modalType];

                const updatedOwners = getOwnersBaseForDocCardSave();
                const saveIndex = resolveOwnerIndexForSave(updatedOwners);
                const owner = updatedOwners[saveIndex];

                // Superseded owner documents are archived server-side (oldDocuments).

                const docPayload =
                    modalType === 'ownerPassport'
                        ? {
                              ...normalizeOwnerPassportPayload(modalData),
                              attachment: modalData.publicId || modalData.attachment,
                          }
                        : modalType === 'ownerEmiratesId'
                          ? {
                                ...normalizeOwnerEmiratesIdPayload(modalData),
                                attachment: modalData.publicId || modalData.attachment,
                            }
                          : {
                                provider: modalData.provider,
                                number: modalData.number,
                                nationality: modalData.nationality,
                                type: modalData.type,
                                issueDate: modalData.issueDate,
                                placeOfIssue: modalData.placeOfIssue,
                                countryOfIssue: modalData.countryOfIssue,
                                sponsor: modalData.sponsor,
                                lastUpdated: modalData.lastUpdated,
                                expiryDate: modalData.expiryDate,
                                attachment: modalData.publicId || modalData.attachment,
                            };

                updatedOwners[saveIndex] = buildOwnerRowForDocCardSave(
                    owner,
                    docField,
                    docPayload,
                );

                payload.owners = updatedOwners;

            } else if (modalType === 'companyDocument') {

                const issueOrStart =
                    modalData.startDate ||
                    modalData.issueDate ||
                    '';
                const baseContext = String(modalData.context || '').toLowerCase();
                const shouldUseContextAsIs =
                    baseContext === 'ejari' || baseContext === 'insurance' || baseContext === 'moa';
                const resolvedContext = shouldUseContextAsIs
                    ? baseContext
                    : (modalData.hasExpiry === false ? 'document_without_expiry' : 'document_with_expiry');

                const isEjariSave = modalData.context === 'ejari' || modalType === 'addEjari';
                const isMoaSave = modalData.context === 'moa';
                const isLiveDocSave = isLiveCompanyDocForm(modalData, modalType);
                const moaFields = isMoaSave ? normalizeCompanyMoaPayload(modalData) : null;
                const liveDocFields = isLiveDocSave ? normalizeCompanyLiveDocumentPayload(modalData) : null;
                const newDoc = isMoaSave
                    ? {
                          ...moaFields,
                          document: {
                              url: modalData.attachment,
                              name: modalData.fileName,
                              mimeType: 'application/pdf',
                          },
                      }
                    : isLiveDocSave
                      ? {
                            ...liveDocFields,
                            document: {
                                url: modalData.attachment,
                                name: modalData.fileName,
                                mimeType: 'application/pdf',
                            },
                        }
                    : {
                          type: isEjariSave ? normalizeEjariType(modalData.type) : modalData.type,
                          description: isEjariSave ? normalizeEjariNote(modalData.description) : modalData.description,
                          provider: modalData.provider,
                          issueDate: issueOrStart,
                          startDate: modalData.startDate || modalData.issueDate || '',
                          value: modalData.hasValue === false ? '' : modalData.value,
                          expiryDate: modalData.hasExpiry === false ? '' : modalData.expiryDate,
                          context: resolvedContext,
                          document: {
                              url: modalData.attachment,
                              name: modalData.fileName,
                              mimeType: isEjariSave ? 'application/pdf' : (modalData.mimeType || 'application/pdf'),
                          },
                      };



                const docType = modalData.type?.toLowerCase() || '';

                const isInsurance = modalData.context === 'insurance' || docType.includes('insur');

                const isEjari = modalData.context === 'ejari' || docType.includes('ejar');



                if (isInsurance) {

                    const updatedDocs = [...(company.insurance || [])];

                    if (isRenewalModal && editingIndex !== null && updatedDocs[editingIndex]) {
                        // Prior insurance file is archived server-side into oldDocuments (no duplicate flat row in documents[]).
                        updatedDocs[editingIndex] = mergeCompanyDocumentRowEdit(
                            updatedDocs[editingIndex],
                            newDoc,
                        );

                    } else if (editingIndex !== null) {

                        updatedDocs[editingIndex] = mergeCompanyDocumentRowEdit(
                            updatedDocs[editingIndex],
                            newDoc,
                        );

                    } else {

                        updatedDocs.push(newDoc);

                    }

                    payload.insurance = updatedDocs;

                } else if (isEjari) {

                    const updatedDocs = [...(company.ejari || [])];

                    if (isRenewalModal && editingIndex !== null && updatedDocs[editingIndex]) {
                        // Prior Ejari file is archived server-side into oldDocuments.
                        updatedDocs[editingIndex] = mergeCompanyDocumentRowEdit(
                            updatedDocs[editingIndex],
                            newDoc,
                        );

                    } else if (editingIndex !== null) {

                        updatedDocs[editingIndex] = mergeCompanyDocumentRowEdit(
                            updatedDocs[editingIndex],
                            newDoc,
                        );

                    } else {

                        updatedDocs.push(newDoc);

                    }

                    payload.ejari = updatedDocs;

                } else {

                    const updatedDocs = [...(company.documents || [])];

                    if (isMoaSave && isRenewalModal) {
                        // MOA has no renew flow; treat as edit on the same row.
                    } else if (isRenewalModal && editingIndex !== null && updatedDocs[editingIndex]) {
                        // Prior row is archived server-side into oldDocuments when attachment URL changes.
                        updatedDocs[editingIndex] = mergeCompanyDocumentRowEdit(
                            updatedDocs[editingIndex],
                            newDoc,
                        );
                        payload.documents = dedupeCompanyDocumentsPayload(updatedDocs);
                    } else if (editingIndex !== null) {
                        updatedDocs[editingIndex] = mergeCompanyDocumentRowEdit(
                            updatedDocs[editingIndex],
                            newDoc,
                        );
                        payload.documents = dedupeCompanyDocumentsPayload(updatedDocs);
                    } else {
                        updatedDocs.push(newDoc);
                        payload.documents = dedupeCompanyDocumentsPayload(updatedDocs);
                    }

                }

            } else if (modalType === 'addNewCategory') {

                if (!modalData.type || !modalData.attachment) {

                    toast({ title: "Error", description: "Title and Attachment are mandatory", variant: "destructive" });

                    return;

                }

                const categoryName = modalData.type.trim().toLowerCase();

                const isInsurance = categoryName.includes('insur');

                const isEjari = categoryName.includes('ejar');



                const newDoc = {

                    type: modalData.type,

                    issueDate: modalData.issueDate,

                    startDate: modalData.startDate,

                    expiryDate: modalData.expiryDate,

                    value: modalData.value,

                    document: {

                        url: modalData.attachment,

                        name: modalData.fileName,

                        mimeType: modalData.mimeType || 'application/pdf'

                    }

                };



                // Add to dynamicTabs if not exists

                const existingTabs = company.customTabs || [];

                if (!existingTabs.includes(categoryName) && !['asset', 'insurance', 'ejari'].includes(categoryName)) {

                    payload.customTabs = [...existingTabs, categoryName];

                }



                if (isInsurance || isEjari) {

                    const field = isInsurance ? 'insurance' : 'ejari';

                    const structuredDoc = {

                        ...newDoc,

                        context: isInsurance ? 'insurance' : 'ejari',

                    };

                    const updatedTypeDocs = [...(company[field] || [])];

                    updatedTypeDocs.push(structuredDoc);

                    payload[field] = updatedTypeDocs;

                    // Live copy lives only on insurance/ejari; Documents tab reads those for Live. Avoid duplicating into documents[].

                    // Switch back to basic tab as they show as cards there

                    setActiveTab('basic');

                } else {

                    const updatedDocs = [...(company.documents || [])];

                    updatedDocs.push(newDoc);

                    payload.documents = dedupeCompanyDocumentsPayload(updatedDocs);

                    // Switch to the new tab

                    setActiveTab(categoryName);

                    if (!activeDynamicTabs.includes(categoryName)) {

                        setActiveDynamicTabs(prev => [...prev, categoryName]);

                    }

                }

            } else if (modalType === 'ownerDetails') {
                const normalized = normalizeOwnerDetailsPayload(modalData);
                let updatedOwners = redistributeOwnerShares(
                    ownersForDisplay,
                    activeOwnerTabIndex,
                    normalized.sharePercentage,
                );
                updatedOwners[activeOwnerTabIndex] = {
                    ...updatedOwners[activeOwnerTabIndex],
                    ...normalized,
                };
                payload.owners = updatedOwners;
            } else if (modalType === 'addMemo') {
                const memoFields = normalizeCompanyMemoPayload(modalData);
                const newDoc = {
                    ...memoFields,
                    document: {
                        url: modalData.attachment,
                        name: modalData.fileName || memoFields.type,
                        mimeType: 'application/pdf',
                    },
                };
                const prevDocs = [...(company.documents || [])];
                if (editingIndex !== null && prevDocs[editingIndex]) {
                    prevDocs[editingIndex] = { ...prevDocs[editingIndex], ...newDoc };
                    payload.documents = dedupeCompanyDocumentsPayload(prevDocs);
                } else {
                    payload.documents = dedupeCompanyDocumentsPayload([...prevDocs, newDoc]);
                }
            }



            if (
                modalType === 'ownerDetails' &&
                Array.isArray(payload.owners) &&
                payload.owners.length > 0 &&
                isCompanyActivationComplete
            ) {
                const ownersCheck = validateOwnerDetailsOwnersPayload(payload.owners, {
                    profileActive: true,
                    requireEmail: true,
                    onlyValidateDetailIndices: [activeOwnerTabIndex],
                });
                if (!ownersCheck.ok) {
                    toast({
                        title: 'Error',
                        description: ownersCheck.message,
                        variant: 'destructive',
                    });
                    setIsSubmitting(false);
                    return;
                }
            }

            const res = await axiosInstance.patch(`/Company/${company._id}`, payload);

            const queuedForHr =
                modalType !== 'addMemo' && Boolean(res?.data?.queuedForHrApproval);
            const apiMessage =
                typeof res?.data?.message === "string" ? res.data.message : "Details updated successfully";

            toast({
                title: queuedForHr ? "Queued for HR approval" : "Success",
                description: queuedForHr
                    ? `${apiMessage} Use Submit for HR approval when you are finished editing.`
                    : apiMessage,
            });

            if (res?.data?.company) {
                let nextCompany = res.data.company;
                if (queuedForHr && currentUser) {
                    nextCompany = stampPendingChangesWithViewer(nextCompany, currentUser);
                }
                if (Array.isArray(payload.owners) && payload.owners.length > 0 && !queuedForHr) {
                    const mergedOwners =
                        modalType === 'tradeLicense'
                            ? payload.owners
                            : mergeCompanyOwnersSnapshot(nextCompany.owners || [], payload.owners);
                    nextCompany = {
                        ...nextCompany,
                        owners: migrateLegacyOwnersVisa(mergedOwners),
                    };
                }
                setCompany(nextCompany);
            }

            await fetchCompany();
            if (queuedForHr && currentUser) {
                setCompany((prev) => (prev ? stampPendingChangesWithViewer(prev, currentUser) : prev));
            }

            handleModalClose();

        } catch (error) {

            console.error("Update error:", error);

            toast({ title: "Error", description: error.response?.data?.message || "Failed to update details", variant: "destructive" });

        } finally {

            setIsSubmitting(false);

        }

    };



    const handleAddOwner = () => {
        setModalData(prev => {
            const currentOwners = prev.owners || [];
            const newCount = currentOwners.length + 1;
            const equalShare = (100 / newCount).toFixed(2);
            const usedIds = getAllUsedOwnerProfileIds(currentOwners);

            const newOwner = {
                name: '',
                sharePercentage: equalShare,
                attachment: '',
                isNew: true,
                isExisting: false,
                ownerProfileId: generateOwnerProfileId(usedIds),
            };

            const updatedOwners = currentOwners.map(o => ({
                ...o,
                sharePercentage: equalShare
            }));

            const list = [...updatedOwners, newOwner];

            return {
                ...prev,
                owners: list
            };
        });
    };



    const handleRemoveOwner = (index) => {

        setOwnerToDelete(index);

    };



    const confirmRemoveOwner = () => {

        if (ownerToDelete === null) return;

        const index = ownerToDelete;

        setModalData(prev => {

            const temp = prev.owners.filter((_, i) => i !== index);

            if (temp.length === 0) return { ...prev, owners: [] };



            const updatedOwners = redistributeOwnerSharesEqually(temp);

            return {

                ...prev,

                owners: updatedOwners

            };

        });

        setOwnerToDelete(null);

    };



    const handleOwnerChange = (index, field, value) => {
        setModalData((prev) => {
            if (field === 'sharePercentage') {
                const redistributed = redistributeOwnerShares(prev.owners || [], index, value);
                return { ...prev, owners: redistributed };
            }
            const newOwners = [...(prev.owners || [])];
            newOwners[index] = { ...newOwners[index], [field]: value };
            return { ...prev, owners: newOwners };
        });
    };

    const confirmDeleteDocument = async () => {
        if (!documentToDelete) return;
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete company documents.", variant: "destructive" });
            return;
        }

        try {
            const { kind, index, id: docId } = documentToDelete;
            let actionType = 'deleted';

            const isMongoSubdocId = (v) => {
                const s = v != null ? String(v).trim() : '';
                return /^[a-fA-F0-9]{24}$/.test(s);
            };

            const resolveDeleteTarget = (list) => {
                const idStr = docId != null ? String(docId).trim() : '';
                if (isMongoSubdocId(idStr)) return idStr;
                const docIndex = typeof index === 'number' ? index : parseInt(String(index), 10);
                const rows = Array.isArray(list) ? list : [];
                const row =
                    !Number.isNaN(docIndex) && docIndex >= 0 && docIndex < rows.length ? rows[docIndex] : null;
                const rowId = row?._id ?? row?.id;
                const rowIdStr = rowId != null ? String(rowId).trim() : '';
                if (isMongoSubdocId(rowIdStr)) return rowIdStr;
                if (!Number.isNaN(docIndex) && docIndex >= 0) return docIndex;
                return null;
            };

            if (kind === 'oldDocuments') {
                const deleteTarget = resolveDeleteTarget(company.oldDocuments);
                if (deleteTarget == null) {
                    toast({
                        title: 'Error',
                        description: 'Could not find that archived document. Refresh the page and try again.',
                        variant: 'destructive',
                    });
                    return;
                }
                await axiosInstance.delete(`/Company/${companyId}/old-document/${encodeURIComponent(deleteTarget)}`);
            } else if (kind === 'oldOwners') {
                const deleteTarget = docId || index;
                await axiosInstance.delete(`/Company/${companyId}/old-owner/${encodeURIComponent(deleteTarget)}`);
            } else {
                const deleteTarget = resolveDeleteTarget(company.documents);
                if (deleteTarget == null) {
                    toast({
                        title: 'Error',
                        description: 'Could not find that document (index out of date). Refresh the page and try again.',
                        variant: 'destructive',
                    });
                    return;
                }
                await axiosInstance.delete(`/Company/${companyId}/document/${encodeURIComponent(deleteTarget)}`);
            }

            toast({ title: "Success", description: `Document ${actionType} successfully` });
            await fetchCompany();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
        } finally {
            setDocumentToDelete(null);
        }
    };



    /** Opens Not Renew dialog for ejari / insurance (HR approval flow). */
    const openNotRenewEjariInsurance = (field, index, item) => {
        const label = field === 'ejari' ? 'Ejari' : field === 'insurance' ? 'Insurance' : field.charAt(0).toUpperCase() + field.slice(1);
        const row = item || company[field]?.[index];
        const detail = row?.type ? `${label} — ${row.type}` : label;
        setNotRenewData({
            kind: field,
            arrayIndex: index,
            arrayItemId: row?._id != null ? String(row._id) : undefined,
            label: detail,
        });
    };

    /** Admin delete Ejari / Insurance card — archived to Deleted Records (attachments kept until purge). */
    const handleHardDeleteArrayItem = async (field, index) => {
        const canDelete =
            field === 'ejari'
                ? ejariCanDelete
                : field === 'insurance'
                  ? isAdmin() || (!isCompanyProfileActivated && companyPerms.docLiveWithExpiry.delete)
                  : isAdmin();
        if (!canDelete) {
            toast({
                title: 'Access denied',
                description: isCompanyProfileActivated
                    ? `Only administrator can delete ${field === 'ejari' ? 'Ejari' : 'this record'} on an activated profile.`
                    : 'You do not have permission to delete this record.',
                variant: 'destructive',
            });
            return;
        }
        const label = field === 'ejari' ? 'Ejari' : field === 'insurance' ? 'Insurance' : field;
        openConfirmDialog({
            title: `Delete ${label} entry?`,
            description: isCompanyProfileActivated
                ? `${label} will be removed. Management will be notified and files are kept in Deleted Records for 60 days.`
                : `This entry will appear under Deleted Records for 60 days.`,
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                const list = company[field] || [];
                if (index < 0 || index >= list.length) return;
                const row = list[index];
                const target = row?._id != null ? String(row._id) : String(index);
                const res = await axiosInstance.delete(
                    `/Company/${companyId}/array-field/${field}/${encodeURIComponent(target)}`,
                );
                if (res?.data?.company) {
                    setCompany(res.data.company);
                }
                if (res?.data?.activationProgress) {
                    setActivationProgressFromApi(res.data.activationProgress);
                } else if (!res?.data?.company) {
                    await fetchCompany();
                }
                toast({ title: 'Deleted', description: `${label} entry removed. View attachment in Deleted Records.` });
            },
        });
    };



    const handleDeleteCategory = async (categoryToDelete) => {
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete categories.", variant: "destructive" });
            return;
        }

        openConfirmDialog({
            title: `Delete category "${categoryToDelete}"?`,
            description: 'This action cannot be undone.',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                const updatedCustomTabs = (company.customTabs || []).filter((t) => t !== categoryToDelete);
                await axiosInstance.patch(`/Company/${companyId}`, {
                    customTabs: updatedCustomTabs,
                });
                toast({
                    title: 'Success',
                    description: `Category "${categoryToDelete}" deleted successfully`,
                });
                setDynamicTabs((prev) => prev.filter((t) => t !== categoryToDelete));
                fetchCompany();
            },
        });
    };

    const handleDeleteTradeLicense = async () => {
        if (!tradeLicenseCanDelete) {
            toast({
                title: 'Access denied',
                description: isCompanyProfileActivated
                    ? 'Only administrator can delete Trade License on an activated profile.'
                    : 'You do not have permission to delete Trade License details.',
                variant: 'destructive',
            });
            return;
        }
        openConfirmDialog({
            title: 'Delete Trade License?',
            description: isCompanyProfileActivated
                ? 'Trade license details will be removed. Management will be notified and files are kept in Deleted Records for 60 days.'
                : 'Trade license card details will be permanently removed.',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                const res = await axiosInstance.delete(`/Company/${companyId}/card/tradeLicense`);
                if (res?.data?.company) {
                    setCompany(res.data.company);
                }
                if (res?.data?.activationProgress) {
                    setActivationProgressFromApi(res.data.activationProgress);
                } else if (!res?.data?.company) {
                    await fetchCompany();
                }
                toast({
                    title: 'Deleted',
                    description: 'Trade License details removed successfully.',
                });
            },
        });
    };

    const handleDeleteEstablishmentCard = async () => {
        if (!establishmentCanDelete) {
            toast({
                title: 'Access denied',
                description: isCompanyProfileActivated
                    ? 'Only administrator can delete Establishment Card on an activated profile.'
                    : 'You do not have permission to delete Establishment Card details.',
                variant: 'destructive',
            });
            return;
        }
        openConfirmDialog({
            title: 'Delete Establishment Card?',
            description: isCompanyProfileActivated
                ? 'Establishment card details will be removed. Management will be notified and files are kept in Deleted Records for 60 days.'
                : 'Establishment card details will be permanently removed.',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                const res = await axiosInstance.delete(`/Company/${companyId}/card/establishmentCard`);
                if (res?.data?.company) {
                    setCompany(res.data.company);
                }
                if (res?.data?.activationProgress) {
                    setActivationProgressFromApi(res.data.activationProgress);
                } else if (!res?.data?.company) {
                    await fetchCompany();
                }
                toast({
                    title: 'Deleted',
                    description: 'Establishment Card details removed successfully.',
                });
            },
        });
    };

    const clearOwnerDocInLocalState = (prevCompany, ownerTabIndex, docKey) => {
        if (!prevCompany) return prevCompany;
        const oi = typeof ownerTabIndex === 'number' ? ownerTabIndex : activeOwnerTabIndex;
        const owners = [...(prevCompany.owners || [])];
        const row = owners[oi];
        if (!row) return prevCompany;
        const nextRow = { ...row };
        if (docKey === 'attachment') {
            delete nextRow.attachment;
        } else {
            delete nextRow[docKey];
        }
        owners[oi] = nextRow;
        const sectionKey = `owner${String(docKey).toLowerCase()}`;
        const ownerRowId = row._id != null ? String(row._id) : row.id != null ? String(row.id) : '';
        const pendingReactivationChanges = (prevCompany.pendingReactivationChanges || [])
            .filter((c) => String(c?.section || '').toLowerCase() !== sectionKey)
            .map((entry) => {
                const pd = entry?.proposedData;
                if (!ownerRowId || !pd || !Array.isArray(pd.owners)) return entry;
                let touched = false;
                const nextOwners = pd.owners.map((o) => {
                    if (String(o?._id || o?.id || '') !== ownerRowId) return o;
                    touched = true;
                    const next = { ...o };
                    if (docKey === 'attachment') delete next.attachment;
                    else delete next[docKey];
                    return next;
                });
                if (!touched) return entry;
                return { ...entry, proposedData: { ...pd, owners: nextOwners } };
            });
        return { ...prevCompany, owners, pendingReactivationChanges };
    };

    const handleDeleteOwnerDocumentCard = async (docKey, ownerTabIndex = activeOwnerTabIndex) => {
        if (!canDeleteOwnerDocByKey(docKey)) {
            toast({
                title: 'Access denied',
                description: isCompanyActivationComplete
                    ? 'Only an administrator can delete this document after the profile is activated.'
                    : 'You do not have permission to delete this document.',
                variant: 'destructive',
            });
            return;
        }
        openConfirmDialog({
            title: 'Delete owner document?',
            description: 'This owner document card will be removed from the profile.',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                const oi = typeof ownerTabIndex === 'number' ? ownerTabIndex : activeOwnerTabIndex;
                const ownersList = ownersForDisplay.map((o) => ({ ...o }));
                const ownerRow = ownersList[oi];
                if (!ownerRow) return;
                setCompany((prev) => clearOwnerDocInLocalState(prev, oi, docKey));
                const ownerRowId =
                    ownerRow._id != null ? String(ownerRow._id).trim() : ownerRow.id != null ? String(ownerRow.id).trim() : '';
                const canCompactPatch = /^[a-fA-F0-9]{24}$/.test(ownerRowId);
                if (canCompactPatch && canDeleteOwnerDocByKey(docKey)) {
                    await axiosInstance.patch(`/Company/${companyId}`, {
                        clearLiveOwnerDocCard: { ownerId: ownerRowId, docKey },
                        skipArchive: true,
                    });
                    if (docKey === 'visitVisa' && ownerRow.visa) {
                        try {
                            await axiosInstance.patch(`/Company/${companyId}`, {
                                clearLiveOwnerDocCard: { ownerId: ownerRowId, docKey: 'visa' },
                                skipArchive: true,
                            });
                        } catch {
                            /* legacy slot optional */
                        }
                    }
                } else {
                    const nextOwners = [...ownersList];
                    const nextRow = { ...ownerRow };
                    if (docKey === 'attachment') delete nextRow.attachment;
                    else {
                        delete nextRow[docKey];
                        if (docKey === 'visitVisa') delete nextRow.visa;
                    }
                    nextOwners[oi] = nextRow;
                    await axiosInstance.patch(`/Company/${companyId}`, { owners: nextOwners, skipArchive: true });
                }
                toast({ title: 'Deleted', description: 'Owner document card removed successfully.' });
                fetchCompany();
            },
        });
    };

    const clearOldOwnerDocInLocalState = (prevCompany, oldOwnerIndex, docKey) => {
        if (!prevCompany) return prevCompany;
        const oi = typeof oldOwnerIndex === 'number' ? oldOwnerIndex : 0;
        const oldOwners = [...(prevCompany.oldOwners || [])];
        const row = oldOwners[oi];
        if (!row) return prevCompany;
        const nextRow = { ...row };
        if (docKey === 'attachment') delete nextRow.attachment;
        else delete nextRow[docKey];
        oldOwners[oi] = nextRow;
        return { ...prevCompany, oldOwners };
    };

    const handleDeleteOldOwnerDocumentCard = async (docKey, oldOwnerIndex) => {
        if (!isAdmin()) {
            toast({ title: "Access denied", description: "Only administrator can delete archived owner card records.", variant: "destructive" });
            return;
        }
        openConfirmDialog({
            title: 'Delete archived owner document?',
            description: 'This archived owner document card will be permanently removed.',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
                const oi = typeof oldOwnerIndex === 'number' ? oldOwnerIndex : 0;
                const updatedOld = [...(company.oldOwners || [])];
                const prev = updatedOld[oi];
                if (!prev) return;
                setCompany((c) => clearOldOwnerDocInLocalState(c, oi, docKey));
                const ownerRowId = prev?._id != null ? String(prev._id).trim() : prev?.id != null ? String(prev.id).trim() : '';
                const canCompactPatch = /^[a-fA-F0-9]{24}$/.test(ownerRowId);
                if (canCompactPatch) {
                    await axiosInstance.patch(`/Company/${companyId}`, {
                        clearOldOwnerDocCard: { ownerId: ownerRowId, docKey },
                        skipArchive: true,
                    });
                } else {
                    const nextRow = { ...prev };
                    if (docKey === 'attachment') delete nextRow.attachment;
                    else delete nextRow[docKey];
                    updatedOld[oi] = nextRow;
                    await axiosInstance.patch(`/Company/${companyId}`, { oldOwners: updatedOld, skipArchive: true });
                }
                toast({ title: 'Deleted', description: 'Archived owner document card removed successfully.' });
                fetchCompany();
            },
        });
    };

    const handleDeleteOwner = async (index) => {
        const ownersList = company.owners || [];
        if (ownersList.length <= 1) {
            toast({
                title: 'Cannot remove owner',
                description: 'At least one owner is required on the company profile.',
                variant: 'destructive',
            });
            return;
        }
        if (!ownerDetailsCanDelete) {
            notifyNoPermission(toast, 'delete owners');
            return;
        }
        if (isCompanyActivationComplete && !isAdmin()) {
            toast({
                title: 'Access denied',
                description: 'After activation, only an administrator can delete owners.',
                variant: 'destructive',
            });
            return;
        }
        openConfirmDialog({
            title: 'Delete owner entirely?',
            description:
                'This will remove the owner and all associated documents from the profile. Remaining owners\' share percentages will be adjusted to total 100%. This action cannot be undone.',
            confirmLabel: 'Delete owner',
            destructive: true,
            onConfirm: async () => {
                const updatedOwners = redistributeOwnerSharesEqually(
                    ownersList.filter((_, i) => i !== index),
                );
                await axiosInstance.patch(`/Company/${companyId}`, {
                    owners: updatedOwners,
                    skipArchive: true,
                });
                toast({ title: 'Deleted', description: 'Owner removed successfully.' });
                if (activeOwnerTabIndex >= index && activeOwnerTabIndex > 0) {
                    setActiveOwnerTabIndex((prev) => Math.max(0, prev - 1));
                }
                fetchCompany();
            },
        });
    };







    const formatDate = (dateString) => {

        if (!dateString) return '---';

        const d = dateString instanceof Date ? dateString : new Date(dateString);

        if (Number.isNaN(d.getTime())) return '---';

        return d.toLocaleDateString('en-GB');

    };

    const getExpiryVisualState = (dateString) => {
        // Old documents view should be strictly neutral (no red/amber styling).
        if (docStatusTab === 'old') return { className: 'text-gray-700 font-normal', tag: null };
        if (!dateString) return { className: 'text-gray-500', tag: null };
        const expiry = new Date(dateString);
        if (Number.isNaN(expiry.getTime())) return { className: 'text-gray-500', tag: null };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const e = new Date(expiry);
        e.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((e - today) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
            return { className: 'text-red-600 font-semibold', tag: 'Expired' };
        }
        if (daysLeft <= 30) {
            return { className: 'text-amber-600 font-semibold', tag: `${daysLeft}d left` };
        }
        return { className: 'text-gray-500', tag: null };
    };

    const isExpiredDate = (dateString) => getExpiryVisualState(dateString).tag === 'Expired';



    const getSummaryItems = () => {

        if (!company) return [];

        const items = [];

        const colors = ['bg-white', 'bg-blue-300', 'bg-sky-200'];



        const addExpiryItem = (label, date) => {

            if (date) {

                const d = new Date(date);

                if (!isNaN(d.getTime())) {

                    items.push({

                        text: `${label} expires on ${d.toLocaleDateString('en-GB')}`,

                        rawDate: d

                    });

                }

            }

        };



        const isOldDoc = (d) =>
            (d?.description?.toLowerCase()?.includes('previous') ?? false) ||
            (d?.type?.toLowerCase()?.includes('previous') ?? false);



        // Core Company Documents - explicitly prioritized

        addExpiryItem('Trade License', company.tradeLicenseExpiry);

        addExpiryItem('Establishment Card', company.establishmentCardExpiry);



        // Operational Documents (Collections)

        (company.insurance || []).forEach(ins => {

            if (ins == null || typeof ins !== 'object') return;

            if (!isOldDoc(ins)) addExpiryItem(ins.type || 'Insurance', ins.expiryDate);

        });

        (company.ejari || []).forEach(ej => {

            if (ej == null || typeof ej !== 'object') return;

            if (!isOldDoc(ej)) addExpiryItem(ej.type || 'Ejari', ej.expiryDate);

        });

        (company.documents || []).forEach(doc => {

            // Include only if not already covered (avoid duplicates if Logic changes)

            if (doc == null || typeof doc !== 'object') return;

            if (!isOldDoc(doc) && doc.expiryDate) {

                // optionally filter out if it's a known system type to avoid double listing

                const type = doc.type?.toLowerCase() || '';

                if (!type.includes('trade license') && !type.includes('establishment card')) {

                    addExpiryItem(doc.type || 'Document', doc.expiryDate);

                }

            }

        });



        // Owner Documents - specific fields as requested
        const formatOwnerNameForExpiry = (rawName) => {
            const safe = String(rawName || '').trim();
            if (!safe) return 'Owner';
            const parts = safe.split(/\s+/).filter(Boolean);
            if (parts.length < 2) return parts[0];
            const first = parts[0];
            const lastInitial = `${parts[parts.length - 1][0]}.`;
            return `${first} ${lastInitial}`;
        };

        (ownersForDisplay || []).forEach(owner => {
            if (owner == null || typeof owner !== 'object') return;

            const ownerName = formatOwnerNameForExpiry(owner.name);

            const docMap = {

                passport: 'Passport',

                visa: 'Visa',

                emiratesId: 'Emirates ID',

                medical: 'Medical Insurance',

                drivingLicense: 'Driving License',

                labourCard: 'Labour Card'

            };



            Object.entries(docMap).forEach(([field, label]) => {

                const doc = owner[field];

                if (doc && doc.expiryDate) {

                    addExpiryItem(`${ownerName}'s ${label}`, doc.expiryDate);

                }

            });

        });



        return items

            .sort((a, b) => a.rawDate - b.rawDate)

            .map((item, index) => ({

                ...item,

                color: colors[index % colors.length]

            }));

    };



    const statusItems = getSummaryItems();
    const SUMMARY_POINTS_PER_PAGE = 5;
    const summaryPages = useMemo(() => {
        if (!statusItems.length) return [];
        const pages = [];
        for (let i = 0; i < statusItems.length; i += SUMMARY_POINTS_PER_PAGE) {
            pages.push(statusItems.slice(i, i + SUMMARY_POINTS_PER_PAGE));
        }
        return pages;
    }, [statusItems]);

    useEffect(() => {
        if (summaryPages.length === 0) {
            setSummaryPageIndex(0);
            return;
        }
        setSummaryPageIndex((prev) => Math.min(prev, summaryPages.length - 1));
    }, [summaryPages.length]);

    useEffect(() => {
        if (isSummaryHovered || summaryPages.length <= 1) return;
        const timer = setInterval(() => {
            setSummaryPageIndex((prev) => (prev + 1) % summaryPages.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isSummaryHovered, summaryPages.length]);

    useEffect(() => {
        if (summaryPages.length <= 1) return;
        setSummaryPageVisible(false);
        const t = setTimeout(() => setSummaryPageVisible(true), 40);
        return () => clearTimeout(t);
    }, [summaryPageIndex, summaryPages.length]);
    const localComputedActivationProgress = useMemo(() => {
        if (!company) return { checks: [], percentage: 0, total: 0, completed: 0, missing: [] };
        return computeLocalActivationProgress(company);
    }, [company]);
    const companyActivationProgress = activationProgressFromApi || localComputedActivationProgress;
    const activationCheckComplete = useMemo(() => {
        const checks = Array.isArray(companyActivationProgress?.checks) ? companyActivationProgress.checks : [];
        return checks.reduce((acc, check) => {
            acc[check.key] = !!check.completed;
            return acc;
        }, {});
    }, [companyActivationProgress]);

    const activationHrSubmission = useMemo(() => {
        const workflow = Array.isArray(company?.activationWorkflow) ? company.activationWorkflow : [];
        const hrEntries = workflow
            .filter((w) => String(w?.role || '').toLowerCase() === 'hr')
            .slice()
            .sort((a, b) => new Date(b?.assignedAt || b?.actionedAt || 0) - new Date(a?.assignedAt || a?.actionedAt || 0));

        const submittedEntry =
            hrEntries.find((e) => e?.status === 'submitted') ||
            hrEntries[0] ||
            null;

        const raw = typeof submittedEntry?.comment === 'string' ? submittedEntry.comment : '';

        const parse = (text) => {
            if (!text || typeof text !== 'string') return { reason: '', description: '', attachment: '', requestedChanges: [], type: '' };

            // Stored by backend as:
            // "Reason: <reason> | Description: <desc> | Attachment: <url>"
            // Attachment part may be missing.
            const reasonMatch = text.match(/Reason:\s*(.*?)\s*\|\s*Description:/i);

            // First try the full form with Attachment block
            let descriptionMatch = text.match(/Description:\s*(.*?)\s*\|\s*Attachment:/i);
            // If there is no " | Attachment", capture until end of string
            if (!descriptionMatch) {
                descriptionMatch = text.match(/Description:\s*(.*)$/i);
            }

            const attachmentMatch = text.match(/Attachment:\s*(.*)$/i);
            const requestedChangesMatch = text.match(/Requested Changes:\s*(.*?)(\s*\|\s*Attachment:|$)/i);
            const typeMatch = text.match(/Type:\s*(.*?)(\s*\|\s*Reason:|$)/i);

            const reason = reasonMatch?.[1]?.trim() || '';
            const description = descriptionMatch?.[1]?.trim() || '';
            const attachment = attachmentMatch?.[1]?.trim() || '';
            const requestedChanges = (requestedChangesMatch?.[1] || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const type = typeMatch?.[1]?.trim() || '';

            // Fallback if comment doesn't follow the expected format at all.
            if (!reason && !description && !attachment) {
                return { reason: text.trim(), description: '', attachment: '', requestedChanges: [], type: '' };
            }

            return { reason, description, attachment, requestedChanges, type };
        };

        const { reason, description, attachment, requestedChanges, type } = parse(raw);
        const structuredReasonRaw = typeof submittedEntry?.reason === 'string' ? submittedEntry.reason.trim() : '';
        const structuredDescriptionRaw = typeof submittedEntry?.description === 'string' ? submittedEntry.description.trim() : '';
        const structuredAttachmentRaw = typeof submittedEntry?.attachment === 'string' ? submittedEntry.attachment.trim() : '';
        const parsedStructuredReason = parse(structuredReasonRaw);
        const parsedStructuredDescription = parse(structuredDescriptionRaw);
        const typeFromStructuredReason =
            structuredReasonRaw.match(/^Type:\s*(.*?)(\s*\||$)/i)?.[1]?.trim() || '';
        const reasonBodyFromStructuredReason = structuredReasonRaw
            .replace(/^Type:\s*.*?(?:\s*\|\s*|$)/i, '')
            .trim();

        const finalReason =
            reasonBodyFromStructuredReason ||
            parsedStructuredReason.reason ||
            reason;
        const finalDescription =
            structuredDescriptionRaw ||
            parsedStructuredReason.description ||
            parsedStructuredDescription.description ||
            description;
        const finalAttachment =
            structuredAttachmentRaw ||
            parsedStructuredReason.attachment ||
            parsedStructuredDescription.attachment ||
            attachment;

        return {
            entry: submittedEntry,
            raw,
            type: typeFromStructuredReason || type || parsedStructuredReason.type || '',
            reason: finalReason,
            description: finalDescription,
            attachment: finalAttachment,
            requestedChanges: requestedChanges.length
                ? requestedChanges
                : (parse(finalDescription).requestedChanges || []),
        };
    }, [company]);

    const openActivationSubmitModal = () => {
        if (!company?._id) return;
        if (
            !isCompanyActivationComplete &&
            (companyActivationProgress?.percentage || 0) < 100
        ) {
            toast({
                title: 'Completion required',
                description: 'Please complete all mandatory company sections to reach 100% before activation.',
                variant: 'destructive',
            });
            return;
        }
        if (
            !viewerIsDesignatedFlowchartHr &&
            isCompanyProfileActivated &&
            pendingCompanyDisplayGroups.length === 0
        ) {
            toast({
                title: 'No pending changes',
                description:
                    'Save edits on company cards first. Queued changes appear here when you are ready to submit.',
                variant: 'destructive',
            });
            return;
        }
        setActivationSubmitModalOpen(true);
    };

    const handleSubmitForActivation = async () => {
        if (!company?._id) return;
        if (
            !isCompanyActivationComplete &&
            (companyActivationProgress?.percentage || 0) < 100
        ) {
            toast({
                title: 'Completion required',
                description: 'Please complete all mandatory company sections to reach 100% before activation.',
                variant: 'destructive',
            });
            return;
        }

        const activationStatusNow = String(company.activationStatus || '').trim().toLowerCase();
        if (
            !viewerIsDesignatedFlowchartHr &&
            (activationStatusNow === 'submitted' || activationStatusNow === 'hold') &&
            pendingCompanyChanges.length === 0
        ) {
            toast({
                title: 'Nothing to submit',
                description:
                    'There are no pending activation changes. Edit and save company cards, or use Fix Items if HR left corrections.',
                variant: 'destructive',
            });
            return;
        }

        if (
            !viewerIsDesignatedFlowchartHr &&
            (activationStatusNow === 'submitted' || activationStatusNow === 'hold') &&
            activationHoldUnapprovedCount > 0 &&
            !activationHoldAllItemsResolved &&
            pendingCompanyChanges.length === 0
        ) {
            toast({
                title: 'Complete held items first',
                description: `Open Fix Items, edit each red row until it turns green, then use ${activationSubmitLabel}.`,
                variant: 'destructive',
            });
            return;
        }

        if (
            !viewerIsDesignatedFlowchartHr &&
            pendingCompanyDisplayGroups.length > 0 &&
            activationSubmitSelectedEntryIds.length === 0
        ) {
            toast({
                title: 'Select changes',
                description: 'Select at least one requested change to send to HR.',
                variant: 'destructive',
            });
            return;
        }

        if (
            !viewerIsDesignatedFlowchartHr &&
            pendingCompanyDisplayGroups.length === 0 &&
            !isInactiveFirstActivationSubmit
        ) {
            toast({
                title: 'No pending changes',
                description: 'There are no queued changes to submit.',
                variant: 'destructive',
            });
            return;
        }

        try {
            setActivationSubmitting(true);
            if (viewerIsDesignatedFlowchartHr) {
                const response = await axiosInstance.post(`/Company/${company._id}/approve-activation`, {
                    approvedChangeIds: [],
                    selectionProvided: false,
                });
                if (response?.data?.company) setCompany(response.data.company);
                if (response?.data?.activationProgress) setActivationProgressFromApi(response.data.activationProgress);
                await fetchCompany();
                toast({
                    title: 'Company activated',
                    description: response?.data?.message || 'The company is now active.',
                });
                setActivationSubmitModalOpen(false);
                return;
            }

            const submitBody = {
                // Backend requires these keys; keep static defaults since form fields were removed by request.
                reason: 'Company submitted for activation',
                description: 'Submitted for activation review',
            };
            if (activationSubmitAllEntryIds.length > 0) {
                submitBody.selectionProvided = true;
                submitBody.includedChangeEntryIds = [...activationSubmitSelectedEntryIds.map(String)];
            }
            const response = await axiosInstance.post(`/Company/${company._id}/submit-activation`, submitBody);
            if (response?.data?.company) setCompany(response.data.company);
            if (response?.data?.activationProgress) setActivationProgressFromApi(response.data.activationProgress);
            await fetchCompany();
            toast({
                title: 'Sent for activation',
                description: 'Company has been submitted to HR for activation review.',
            });
            setActivationSubmitModalOpen(false);
        } catch (err) {
            if (err?.response?.data?.activationProgress) {
                setActivationProgressFromApi(err.response.data.activationProgress);
            }
            toast({
                title: 'Submission failed',
                description: err?.response?.data?.message || 'Unable to submit company for activation.',
                variant: 'destructive',
            });
        } finally {
            setActivationSubmitting(false);
        }
    };

    const handleViewCompanyRequestedChange = (cardLabel = '') => {
        const label = String(cardLabel || '').toLowerCase();
        if (label.includes('owner')) return setActiveTab('owner');
        if (label.includes('trade') || label.includes('establishment') || label.includes('moa') || label.includes('document') || label.includes('insurance') || label.includes('ejari')) {
            return setActiveTab('others');
        }
        return setActiveTab('basic');
    };
    const toCompanyLabel = (key = '') => String(key)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
    const toCompanyDisplay = (value) => {
        if (value == null || value === '') return '-';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime()) && (value.includes('T') || /^\d{4}-\d{2}-\d{2}$/.test(value))) {
                return d.toLocaleDateString();
            }
            return value;
        }
        return JSON.stringify(value);
    };
    const fileNameFrom = (value) => {
        if (!value) return '-';
        if (typeof value === 'string') {
            const clean = value.split('?')[0];
            const tail = clean.split('/').filter(Boolean).pop();
            return tail || clean;
        }
        if (typeof value === 'object') {
            if (value.name) return value.name;
            if (value.url) return fileNameFrom(value.url);
        }
        return '-';
    };
    const pickShapeFromSource = (source, template) => {
        if (template == null) return template;
        if (Array.isArray(template)) {
            if (!Array.isArray(source)) return [];
            return source;
        }
        if (typeof template !== 'object') return source;
        const next = {};
        Object.keys(template).forEach((key) => {
            if (source && Object.prototype.hasOwnProperty.call(source, key)) {
                next[key] = pickShapeFromSource(source[key], template[key]);
            }
        });
        return next;
    };
    const getCompanyReviewData = (entry, kind = 'proposed', liveCompany = null) => {
        if (!entry || typeof entry !== 'object') return {};
        const live = liveCompany && typeof liveCompany === 'object' ? liveCompany : company;
        return resolveFullCardReviewData(entry, kind, live);
    };
    const companyRows = (data, entry = null) => buildActivationSnapshotRows(data, { entry });

    const filterCompanyReviewRowsToChangesOnly = (prevRows, propRows) => {
        const sig = (row) => {
            const ref = row?.attachmentRef;
            const refStr =
                ref != null
                    ? typeof ref === 'string'
                        ? ref.split('?')[0].trim()
                        : String(ref?.url || ref?.publicId || '')
                              .split('?')[0]
                              .trim()
                    : '';
            return `${String(row?.value ?? '').trim()}||${String(row?.url ?? '').split('?')[0].trim()}||${refStr}`;
        };
        const prevByLabel = new Map();
        for (const r of prevRows) {
            if (!prevByLabel.has(r.label)) prevByLabel.set(r.label, r);
        }
        const propLabels = new Set(propRows.map((r) => r.label));
        const changed = new Set();
        for (const pr of propRows) {
            const oldR = prevByLabel.get(pr.label);
            if (!oldR || sig(oldR) !== sig(pr)) changed.add(pr.label);
        }
        for (const r of prevRows) {
            if (!propLabels.has(r.label)) changed.add(r.label);
        }
        if (changed.size === 0) {
            return { prevRows, propRows };
        }
        return {
            prevRows: prevRows.filter((r) => changed.has(r.label)),
            propRows: propRows.filter((r) => changed.has(r.label)),
        };
    };

    const entryTouchesMoa = (entry) => {
        if (!entry || typeof entry !== 'object') return false;
        if (String(entry.card || '').toLowerCase().includes('moa')) return true;
        if (String(entry.section || '').toLowerCase() === 'moa') return true;
        const pd = entry.proposedData;
        if (!pd || !Array.isArray(pd.documents)) return false;
        return pd.documents.some((d) => {
            const t = String(d?.type || '').toLowerCase();
            const c = String(d?.context || '').toLowerCase();
            return t.includes('moa') || c === 'moa';
        });
    };

    const moaDocumentReviewRows = (data) => {
        if (!data || typeof data !== 'object') return [];
        const docs = Array.isArray(data.documents) ? data.documents : [];
        const moaDocs = docs.filter((d) => {
            const t = String(d?.type || '').toLowerCase();
            const c = String(d?.context || '').toLowerCase();
            return t.includes('moa') || c === 'moa';
        });
        const sorted = [...moaDocs].sort((a, b) => String(a?._id || '').localeCompare(String(b?._id || '')));
        const rows = [];
        sorted.forEach((d, idx) => {
            const suffix = sorted.length > 1 ? ` #${idx + 1}` : '';
            const prefix = `MOA${suffix}`;
            const push = (label, value, url = '') => {
                if (value === undefined || value === null || value === '') return;
                rows.push({ label: `${prefix} — ${label}`, value: toCompanyDisplay(value), url });
            };
            push('Document type', d.type);
            push('Description', d.description);
            if (d.issueDate) push('Issue date', d.issueDate);
            if (d.startDate) push('Start date', d.startDate);
            if (d.expiryDate) push('Expiry date', d.expiryDate);
            if (d.value != null && d.value !== '') push('Declared value', d.value);
            const attUrl = d.document?.url || '';
            const attName = d.document?.name || '';
            if (attUrl || attName) {
                const display = (attName || fileNameFrom({ url: attUrl })).trim() || 'Attached';
                rows.push({ label: `${prefix} — Attachment`, value: display, url: attUrl });
            }
        });
        return rows;
    };

    const companyRowsIncludingMoaDetails = (data, entry) => {
        const base = companyRows(data, entry);
        if (!entryTouchesMoa(entry)) return base;
        const withoutDocsLine = base.filter((r) => r.label !== 'Documents');
        return [...withoutDocsLine, ...moaDocumentReviewRows(data)];
    };

    const buildCompanyChangeReviewRows = (entry, kind = 'proposed') => {
        if (!entry) return [];
        const snapshot = getCompanyReviewData(entry, kind, company);
        return companyRowsIncludingMoaDetails(snapshot, entry);
    };

    const renderPendingChangeSnapshotBlock = (entry, { title, variant = 'gray' } = {}) => {
        const prevRows = buildCompanyChangeReviewRows(entry, 'previous');
        const propRows = buildCompanyChangeReviewRows(entry, 'proposed');
        const rows = String(title || '').toLowerCase() === 'edited card' ? propRows : prevRows;
        const shell =
            variant === 'blue'
                ? 'border-blue-200 bg-blue-50/40'
                : 'border-gray-200 bg-gray-50/80';

        return (
            <div className="space-y-1.5">
                <div
                    className={`text-[10px] font-bold uppercase tracking-wide ${
                        variant === 'blue' ? 'text-blue-700' : 'text-gray-600'
                    }`}
                >
                    {title}
                </div>
                {rows.length > 0 ? (
                    <div className={`rounded-lg border overflow-hidden ${shell}`}>
                        {rows.map((row, idx) => (
                            <div
                                key={`${title}-${idx}`}
                                className="grid grid-cols-12 gap-2 px-2.5 py-1.5 border-b border-gray-200/70 last:border-b-0 text-xs"
                            >
                                <div className="col-span-5 font-semibold text-gray-700">{row.label}</div>
                                <div className="col-span-7 text-gray-800 flex items-center justify-between gap-2 min-w-0">
                                    <span className="truncate">{row.value}</span>
                                    {row.isAttachment || row.url || row.attachmentRef ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openCompanyAttachmentPreview(row.attachmentRef || row.url, {
                                                    name: row.label,
                                                })
                                            }
                                            className="shrink-0 text-[10px] font-semibold text-blue-700 hover:underline"
                                        >
                                            View
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={`rounded-lg border px-2.5 py-2 text-xs text-gray-500 ${shell}`}>
                        No data available.
                    </div>
                )}
            </div>
        );
    };

    const pendingActivationItems = (companyActivationProgress?.checks || [])
        .filter((check) => !check.completed);
    const pendingCompanyChanges = useMemo(() => {
        if (!Array.isArray(company?.pendingReactivationChanges)) return [];
        const visibleQueue = company.pendingReactivationChanges.filter(
            (entry) =>
                isHrQueuedPendingCard(entry) &&
                viewerCanSeeCompanyPendingChange(entry, currentUser, pendingChangeVisibilityOpts),
        );
        return visibleQueue.map((entry, idx) => ({
            ...entry,
            _id: String(entry?._id || idx),
            card: String(entry?.card || '').trim() || 'Company Profile',
            changeType: String(entry?.changeType || '').trim(),
            section: String(entry?.section || '').trim(),
        }));
    }, [company?.pendingReactivationChanges, currentUser, pendingChangeVisibilityOpts]);

    const pendingCompanyDisplayGroups = useMemo(
        () => buildCompanyPendingDisplayGroups(pendingCompanyChanges),
        [pendingCompanyChanges],
    );

    const activationStatusValue = String(company?.activationStatus || '').toLowerCase();
    /** HR review: only cards included in this submission — not other queued drafts. */
    const activationReviewPendingChanges = useMemo(() => {
        if (!['submitted', 'hold'].includes(activationStatusValue)) return pendingCompanyChanges;
        const submittedLabels = activationHrSubmission?.requestedChanges || [];
        if (!submittedLabels.length) return pendingCompanyChanges;
        return pendingCompanyChanges.filter((entry) =>
            pendingEntryIncludedInSubmittedCards(entry, submittedLabels),
        );
    }, [pendingCompanyChanges, activationStatusValue, activationHrSubmission?.requestedChanges]);
    const activationReviewDisplayGroups = useMemo(
        () => buildCompanyPendingDisplayGroups(activationReviewPendingChanges),
        [activationReviewPendingChanges],
    );
    const companyStatusValue = String(company?.status || '').toLowerCase();
    /** Inactive @ 100%: first activation — no pending queue; submit whole profile to HR. */
    const isInactiveFirstActivationSubmit = useMemo(
        () =>
            companyStatusValue === 'inactive' &&
            activationStatusValue !== 'submitted' &&
            (companyActivationProgress?.percentage || 0) === 100,
        [companyStatusValue, activationStatusValue, companyActivationProgress?.percentage],
    );
    const showActivationSubmitModalUi =
        viewerIsDesignatedFlowchartHr ||
        pendingCompanyDisplayGroups.length > 0 ||
        isInactiveFirstActivationSubmit;

    const activationSubmitAllEntryIds = useMemo(
        () => pendingCompanyDisplayGroups.flatMap((g) => g.ids.map(String)),
        [pendingCompanyDisplayGroups],
    );

    useEffect(() => {
        if (!activationSubmitModalOpen || viewerIsDesignatedFlowchartHr) return;
        setActivationSubmitSelectedEntryIds([...activationSubmitAllEntryIds]);
    }, [activationSubmitModalOpen, viewerIsDesignatedFlowchartHr, activationSubmitAllEntryIds]);

    useEffect(() => {
        if (
            activationSubmitModalOpen &&
            !viewerIsDesignatedFlowchartHr &&
            pendingCompanyDisplayGroups.length === 0 &&
            !isInactiveFirstActivationSubmit
        ) {
            setActivationSubmitModalOpen(false);
        }
    }, [
        activationSubmitModalOpen,
        viewerIsDesignatedFlowchartHr,
        pendingCompanyDisplayGroups.length,
        isInactiveFirstActivationSubmit,
    ]);

    const activationSubmitAllRowsSelected =
        activationSubmitAllEntryIds.length > 0 &&
        activationSubmitAllEntryIds.every((id) => activationSubmitSelectedEntryIds.includes(id));

    const toggleActivationSubmitSelectAll = () => {
        if (activationSubmitAllRowsSelected) {
            setActivationSubmitSelectedEntryIds([]);
            return;
        }
        setActivationSubmitSelectedEntryIds([...activationSubmitAllEntryIds]);
    };

    const toggleActivationSubmitGroupSelection = (groupIds) => {
        if (!Array.isArray(groupIds) || groupIds.length === 0) return;
        const strIds = groupIds.map(String);
        setActivationSubmitSelectedEntryIds((prev) => {
            const allIn = strIds.every((id) => prev.includes(id));
            if (allIn) return prev.filter((x) => !strIds.includes(x));
            return [...new Set([...prev, ...strIds])];
        });
    };

    useEffect(() => {
        setActivationRowNotesByGroupKey((prev) => {
            let next = { ...prev };
            let changed = false;
            pendingCompanyDisplayGroups.forEach((g) => {
                const fully = g.ids.length > 0 && g.ids.every((id) => activationSelectedChangeIds.includes(id));
                if (fully && next[g.key]) {
                    delete next[g.key];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [activationSelectedChangeIds, pendingCompanyDisplayGroups]);

    const queuedCompanyChangeIdCount = pendingCompanyChanges.length;
    const selectedPendingChangeCount = pendingCompanyChanges.filter((c) =>
        activationSelectedChangeIds.includes(c._id),
    ).length;
    const allCompanyChangesSelected =
        queuedCompanyChangeIdCount > 0 && selectedPendingChangeCount === queuedCompanyChangeIdCount;
    /** Backend may keep status as submitted while activationHold lists HR corrections. */
    const onCompanyActivationHoldUi =
        hasCompanyActivationHoldPending || activationStatusValue === 'hold';
    const hasActivationWorkQueued =
        pendingCompanyChanges.length > 0 || activationHoldUnapprovedCount > 0;
    const activationSubmitLabel =
        companyStatusValue === 'inactive' ? 'Submit for activation' : 'Submit pending';
    const canProcessCompanyActivationAsHr = isCompanyHrActivationReviewer(currentUser, {
        isDesignatedFlowchartHr: viewerIsDesignatedFlowchartHr,
        isAdminViewer: isAdmin(),
    });

    /** Hide after submit — queued items stay in DB until HR acts; resubmit uses the banner when on hold. */
    const activationSubmitAlreadySent =
        activationStatusValue === 'submitted' && !activationHoldResubmitEligible;
    const showActivationRequestButton =
        !onCompanyActivationHoldUi &&
        !activationSubmitAlreadySent &&
        !viewerIsDesignatedFlowchartHr &&
        !canProcessCompanyActivationAsHr &&
        (((companyActivationProgress?.percentage || 0) === 100 &&
            companyStatusValue === 'inactive') ||
            (isCompanyProfileActivated && pendingCompanyChanges.length > 0));

    const submittedToId = typeof company?.activationSubmittedTo === 'object'
        ? company?.activationSubmittedTo?._id
        : company?.activationSubmittedTo;
    const currentEmpObjectId = currentUser?.employeeObjectId || currentUser?._id || currentUser?.id || null;
    const canCurrentUserReviewActivation =
        !hasCompanyActivationHoldPending &&
        activationStatusValue !== 'hold' &&
        (activationStatusValue === 'submitted' || canProcessCompanyActivationAsHr) &&
        (
            (submittedToId && currentEmpObjectId && String(submittedToId) === String(currentEmpObjectId)) ||
            canProcessCompanyActivationAsHr
        );

    const showActivationStatusBanner =
        (onCompanyActivationHoldUi && viewerIsCompanyActivationSubmitter) ||
        (activationStatusValue === 'submitted' &&
            !onCompanyActivationHoldUi &&
            (hasActivationWorkQueued || canProcessCompanyActivationAsHr));
    const openActivationReview = (isDirect = false) => {
        setIsDirectHrAction(isDirect);
        setActivationSelectedChangeIds(activationReviewPendingChanges.map((c) => c._id));
        setActivationRowNotesByGroupKey({});
        setActivationReviewModalOpen(true);
    };
    const toggleCompanyChangeGroupSelection = (groupIds) => {
        if (!Array.isArray(groupIds) || groupIds.length === 0) return;
        setActivationSelectedChangeIds((prev) => {
            const allIn = groupIds.every((id) => prev.includes(id));
            if (allIn) return prev.filter((x) => !groupIds.includes(x));
            return [...new Set([...prev, ...groupIds])];
        });
    };
    const toggleAllCompanyChanges = () => {
        if (allCompanyChangesSelected) {
            setActivationSelectedChangeIds([]);
            return;
        }
        setActivationSelectedChangeIds(pendingCompanyChanges.map((c) => c._id));
    };
    const filteredCompanyAssets = useMemo(() => companyAssets, [companyAssets]);

    const selectableCompanyAssetIds = useMemo(() => {
        return filteredCompanyAssets
            .filter((asset) => String(asset?.status || '').toLowerCase() === 'assigned' && !asset?.pendingAction)
            .map((asset) => String(asset?._id || asset?.id))
            .filter(Boolean);
    }, [filteredCompanyAssets]);

    useEffect(() => {
        const allowed = new Set(selectableCompanyAssetIds);
        setSelectedCompanyAssetIds((prev) => prev.filter((id) => allowed.has(String(id))));
    }, [selectableCompanyAssetIds]);

    const allSelectableCompanyAssetsSelected =
        selectableCompanyAssetIds.length > 0 &&
        selectableCompanyAssetIds.every((id) => selectedCompanyAssetIds.includes(String(id)));

    const toggleCompanyAssetSelection = (assetId) => {
        const id = String(assetId || '');
        if (!id) return;
        setSelectedCompanyAssetIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAllCompanyAssets = () => {
        if (allSelectableCompanyAssetsSelected) {
            setSelectedCompanyAssetIds([]);
            return;
        }
        setSelectedCompanyAssetIds(selectableCompanyAssetIds);
    };

    const processCompanyBulkReturn = async () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        try {
            setCompanyBulkSubmitting(true);
            await Promise.all(
                selectedCompanyAssetIds.map((id) => axiosInstance.put(`/AssetItem/${encodeURIComponent(id)}/return`, {}))
            );
            toast({ title: 'Success', description: `Return processed for ${selectedCompanyAssetIds.length} asset(s).` });
            setSelectedCompanyAssetIds([]);
            await fetchCompanyAssets();
            return true;
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err?.response?.data?.message || 'Bulk return failed.',
            });
            return false;
        } finally {
            setCompanyBulkSubmitting(false);
        }
    };

    const submitCompanyBulkAction = async (actionType, payloadExtras = {}) => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        try {
            setCompanyBulkSubmitting(true);
            await axiosInstance.put('/AssetItem/bulk/request-action', {
                assetIds: selectedCompanyAssetIds,
                actionType,
                ...payloadExtras,
            });
            toast({ title: 'Success', description: `${actionType} submitted for ${selectedCompanyAssetIds.length} asset(s).` });
            setSelectedCompanyAssetIds([]);
            await fetchCompanyAssets();
            return true;
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err?.response?.data?.message || `Bulk ${actionType} failed.`,
            });
            return false;
        } finally {
            setCompanyBulkSubmitting(false);
        }
    };

    const processCompanyBulkTransfer = async () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        const duration = parseInt(companyBulkDialog.leaveDuration, 10);
        if (!Number.isInteger(duration) || duration < 1 || duration > 30) {
            toast({ variant: 'destructive', title: 'Invalid duration', description: 'Please enter a number between 1 and 30.' });
            return false;
        }
        return submitCompanyBulkAction('Leave', {
            reason: `Leave duration: ${duration} days`,
            duration,
            leaveDuration: duration,
        });
    };

    const processCompanyBulkEndOfServices = async () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        return submitCompanyBulkAction('End of Services', {
            reason: 'End of Services return requested',
        });
    };

    const handleCompanyBulkReturn = () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        setCompanyBulkDialog({ open: true, mode: 'return', leaveDuration: '1' });
    };

    const handleCompanyBulkTransfer = () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        setCompanyBulkDialog({ open: true, mode: 'transfer', leaveDuration: '1' });
    };

    const handleCompanyBulkEndOfServices = () => {
        if (selectedCompanyAssetIds.length === 0 || companyBulkSubmitting) return;
        setCompanyBulkDialog({ open: true, mode: 'endOfServices', leaveDuration: '1' });
    };

    const handleCompanyBulkDialogConfirm = async () => {
        let ok = false;
        if (companyBulkDialog.mode === 'return') {
            ok = await processCompanyBulkReturn();
        } else if (companyBulkDialog.mode === 'transfer') {
            ok = await processCompanyBulkTransfer();
        } else if (companyBulkDialog.mode === 'endOfServices') {
            ok = await processCompanyBulkEndOfServices();
        }
        if (ok) {
            setCompanyBulkDialog({ open: false, mode: null, leaveDuration: '1' });
        }
    };

    const handleActivationOk = async () => {
        if (!company?._id) return;
        const reviewQueueCount = activationReviewPendingChanges.length;
        const reviewSelectedCount = activationReviewPendingChanges.filter((c) =>
            activationSelectedChangeIds.includes(c._id),
        ).length;
        const fullApprove =
            reviewQueueCount === 0 || reviewSelectedCount === reviewQueueCount;
        await handleActivationDecision(fullApprove ? 'approve' : 'hold');
    };

    const handleActivationDecision = async (decision, reasonOverride = '') => {
        if (!company?._id || !['approve', 'reject', 'hold'].includes(decision)) return;
        const rejectReason = String(reasonOverride || '').trim();
        if (decision === 'reject' && !rejectReason) {
            toast({
                title: 'Rejection reason required',
                description: 'Please enter a rejection description before rejecting this activation request.',
                variant: 'destructive',
            });
            return;
        }
        if (decision === 'hold') {
            const missingNoteGroup = activationReviewDisplayGroups.find((g) => {
                const unchecked = g.ids.filter((id) => !activationSelectedChangeIds.includes(id));
                if (!unchecked.length) return false;
                const note = String(activationRowNotesByGroupKey[g.key] || '').trim();
                return !note;
            });
            if (missingNoteGroup) {
                toast({
                    title: 'Instructions required',
                    description: `Add instructions for "${missingNoteGroup.displayLabel}" before clicking OK.`,
                    variant: 'destructive',
                });
                return;
            }
        }
        try {
            setActivationDecisionLoading(true);
            const endpoint =
                decision === 'approve'
                    ? 'approve-activation'
                    : decision === 'hold'
                      ? 'hold-activation'
                      : 'reject-activation';
            const body =
                decision === 'reject'
                    ? { reason: rejectReason }
                    : decision === 'hold'
                      ? {
                            approvedChangeIds: activationSelectedChangeIds,
                            selectionProvided: true,
                            comment: '',
                            rowNotesByEntryId: (() => {
                                const out = {};
                                activationReviewDisplayGroups.forEach((g) => {
                                    const unchecked = g.ids.filter((id) => !activationSelectedChangeIds.includes(id));
                                    if (!unchecked.length) return;
                                    const note = String(activationRowNotesByGroupKey[g.key] || '').trim();
                                    if (!note) return;
                                    unchecked.forEach((id) => {
                                        out[id] = note;
                                    });
                                });
                                return out;
                            })(),
                        }
                      : {
                            approvedChangeIds: activationSelectedChangeIds,
                            selectionProvided: true,
                        };
            const response = await axiosInstance.post(`/Company/${company._id}/${endpoint}`, body);
            if (response?.data?.company) setCompany(response.data.company);
            if (response?.data?.activationProgress) setActivationProgressFromApi(response.data.activationProgress);
            await fetchCompany();
            toast({
                title:
                    decision === 'approve'
                        ? 'Activation approved'
                        : decision === 'hold'
                          ? 'Sent back to submitter'
                          : 'Activation rejected',
                description: response?.data?.message || 'Company activation decision has been applied.',
            });
            setActivationReviewModalOpen(false);
            setActivationRowNotesByGroupKey({});
            setActivationSelectedChangeIds([]);
        } catch (err) {
            toast({
                title: 'Action failed',
                description: err?.response?.data?.message || 'Unable to process activation decision.',
                variant: 'destructive',
            });
        } finally {
            setActivationDecisionLoading(false);
        }
    };

    if (loading) {

        return (

            <div className="flex min-h-screen bg-[#F2F6F9]">

                <Sidebar />

                <div className="flex-1 flex flex-col items-center justify-center">

                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />

                </div>

            </div>

        );

    }



    if (!company) {

        return (

            <div className="flex min-h-screen bg-[#F2F6F9]">

                <Sidebar />

                <div className="flex-1 flex flex-col items-center justify-center">

                    <div className="text-gray-500 font-medium">Company not found</div>

                </div>

            </div>

        );

    }

    return (

        <PermissionGuard moduleId="hrm_company_view" redirectTo="/dashboard">

        <div className="flex min-h-screen w-full bg-[#F2F6F9]">

            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0 relative">

                <Navbar />

                <div className="p-8">

                    {/* Header Controls */}

                    <div className="flex items-center justify-between mb-6">

                        <button

                            onClick={handleBackNavigation}

                            className="bg-white p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"

                        >

                            <ChevronLeft size={20} />

                        </button>

                    </div>

                    {showActivationStatusBanner && (
                        <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${
                            onCompanyActivationHoldUi ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
                        }`}>
                            <div className={`text-sm ${onCompanyActivationHoldUi ? 'text-amber-900' : 'text-blue-900'}`}>
                                <span className="font-semibold">
                                    {onCompanyActivationHoldUi ? 'Activation on hold — HR needs corrections.' : 'Activation request pending HR action.'}
                                </span>
                                <span className="ml-1">
                                    {onCompanyActivationHoldUi
                                        ? (viewerIsCompanyActivationSubmitter ? 'Check the list and fix items.' : 'Wait for creator to fix and resubmit.')
                                        : (canCurrentUserReviewActivation ? 'Review.' : 'Wait for HR decision.')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                {canCurrentUserReviewActivation &&
                                    activationStatusValue === 'submitted' &&
                                    !onCompanyActivationHoldUi && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            openActivationReview(false);
                                        }}
                                        disabled={activationDecisionLoading}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                                    >
                                        Review
                                    </button>
                                )}
                                {onCompanyActivationHoldUi &&
                                    viewerIsCompanyActivationSubmitter &&
                                    pendingCompanyChanges.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setActivationHoldReviewModalOpen(true)}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-white bg-amber-500 hover:bg-amber-600 shadow-sm"
                                    >
                                        Fix Items
                                    </button>
                                )}
                                {viewerIsCompanyActivationSubmitter &&
                                    (activationHoldResubmitEligible ||
                                        (onCompanyActivationHoldUi &&
                                            pendingCompanyChanges.length > 0)) && (
                                    <button
                                        type="button"
                                        onClick={openActivationSubmitModal}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500 text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                                    >
                                        {activationSubmitLabel}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}



                    {/* Header Grid (Equal Width) */}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-stretch">

                        {/* Profile Card (Left - col-span-1) */}

                        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm p-6 flex flex-col items-start gap-3 relative min-h-[320px]">

                            <div className="flex items-start justify-between gap-6 w-full">
                                <div className="flex items-start gap-6 flex-1">

                                {/* Logo Section */}

                                <div className="relative group flex-shrink-0">

                                    <div className="w-32 h-36 rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-blue-500 relative">

                                        {company.logo && !imageError ? (

                                            <Image

                                                src={company.logo}

                                                alt={company.name}

                                                fill

                                                className="object-cover"

                                                onError={() => setImageError(true)}

                                            />

                                        ) : (

                                            <div className="w-full h-full flex items-center justify-center text-white text-3xl font-semibold">

                                                {getInitials(company.name)}

                                            </div>

                                        )}

                                    </div>

                                    <button className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10 border-2 border-white">

                                        <Camera size={14} />

                                    </button>

                                    {showActivationRequestButton && (
                                        <button
                                            type="button"
                                            disabled={activationSubmitting}
                                            onClick={() => {
                                                if (canProcessCompanyActivationAsHr) openActivationReview(true);
                                                else openActivationSubmitModal();
                                            }}
                                            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border border-emerald-600 text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                                        >
                                            {activationSubmitting
                                                ? 'Submitting...'
                                                : canProcessCompanyActivationAsHr
                                                  ? 'Review / Activate'
                                                  : activationSubmitLabel}
                                        </button>
                                    )}

                                </div>



                                {/* Name Section */}

                                <div className="flex-1 pt-2">

                                    <h1 className="text-2xl font-bold text-gray-800 leading-tight mb-1">

                                        {company.name} {company.nickName && <span className="text-gray-400 font-medium ml-2">({company.nickName})</span>}

                                    </h1>

                                    <div className="flex flex-col gap-2">

                                        <div className="flex items-center">

                                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wider">
                                                Registered Company
                                            </span>

                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-gray-500 text-[11px] font-medium mt-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Mail size={12} className="text-blue-500 flex-shrink-0" />
                                                <span className="truncate">{company.email || '---'}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={12} className="text-blue-500 flex-shrink-0" />
                                                <span>Established: {company.establishedDate ? new Date(company.establishedDate).toLocaleDateString('en-GB') : '---'}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <Phone size={12} className="text-blue-500 flex-shrink-0" />
                                                <span>{company.phoneCountryCode ? `${company.phoneCountryCode} ${company.phone}` : (company.phone || '---')}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <User size={12} className="text-blue-500 flex-shrink-0" />
                                                <span>Total Employees: {employeeCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                </div>

                                {/* Activation Badge (Top Right) */}
                                {String(company?.status || '').toLowerCase() === 'active' && (
                                    <div className="shrink-0 pt-2">
                                        <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-700 border border-green-200 whitespace-nowrap shadow-sm">
                                            Profile activated
                                        </span>
                                    </div>
                                )}
                            </div>



                            <div className="w-full pt-2 mt-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Profile Status</span>
                                    <span className="text-sm font-semibold text-gray-800">{companyActivationProgress?.percentage || 0}%</span>
                                </div>
                                <div
                                    ref={progressBarRef}
                                    className="relative w-full"
                                    onMouseEnter={() => setShowProgressTooltip(true)}
                                    onMouseLeave={() => {
                                        if (!isProgressTooltipLocked) setShowProgressTooltip(false);
                                    }}
                                    onClick={() => {
                                        setIsProgressTooltipLocked((prev) => !prev);
                                        setShowProgressTooltip(true);
                                    }}
                                >
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 cursor-default">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                            style={{ width: `${companyActivationProgress?.percentage || 0}%` }}
                                        />
                                    </div>

                                    {showProgressTooltip && (
                                        <div
                                            ref={progressTooltipRef}
                                            className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 text-gray-700 text-xs rounded-lg shadow-lg border border-gray-200 p-3 z-50 backdrop-blur-sm"
                                            onMouseEnter={() => setShowProgressTooltip(true)}
                                            onMouseLeave={() => {
                                                if (!isProgressTooltipLocked) setShowProgressTooltip(false);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="font-semibold mb-2 text-sm text-gray-800 flex justify-between items-center">
                                                <span>Pending for Activation</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pendingActivationItems.length > 0
                                                    ? 'bg-red-100 text-red-600'
                                                    : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {pendingActivationItems.length > 0 ? `${pendingActivationItems.length} Pending` : 'Completed'}
                                                </span>
                                            </div>
                                            {pendingActivationItems.length > 0 ? (
                                                <div className="flex flex-col gap-1.5">
                                                    {pendingActivationItems.map((item) => (
                                                        <span key={item.key} className="text-gray-600 pl-2 border-l-2 border-gray-200">
                                                            {item.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2.5 py-2">
                                                    All required activation items are completed.
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-4 transform translate-y-full">
                                                <div className="border-4 border-transparent border-t-white/95" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>



                        {/* Summary Card (Right - col-span-1) */}

                        <div className="lg:col-span-1 relative rounded-lg overflow-hidden shadow-sm text-white flex flex-col h-[320px]">

                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-sky-500 to-sky-400"></div>

                            <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-700/40 rounded-full"></div>

                            <div className="absolute -right-16 -top-16 w-48 h-48 bg-sky-300/30 rounded-full"></div>



                            <div className="relative p-8 flex-1 flex flex-col">

                                <h2 className="text-2xl font-semibold text-white mb-6">Company Summary</h2>

                                <div className="flex items-start gap-12 flex-1">

                                    {/* Icon Image */}

                                    <div className="relative flex-shrink-0 w-[114px] h-[177px]">

                                        <Image

                                            src="/assets/employee/tie-img.png"

                                            alt="Company Summary"

                                            width={114}

                                            height={177}

                                            className="object-contain"

                                        />

                                    </div>



                                    {/* Status List */}

                                    <div
                                        className="flex-1 pt-2"
                                        onMouseEnter={() => setIsSummaryHovered(true)}
                                        onMouseLeave={() => setIsSummaryHovered(false)}
                                    >
                                        <div
                                            className={`space-y-3 min-h-[180px] pr-2 transition-all duration-500 ease-in-out ${
                                                summaryPageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                                            }`}
                                        >
                                            {statusItems.length > 0 ? (
                                                (summaryPages[summaryPageIndex] || []).map((item, index) => (
                                                    <div key={`${item.text}-${index}`} className="flex items-center gap-3">
                                                        <div className={`w-5 h-2 rounded-full ${item.color} shadow-sm shrink-0`} />
                                                        <p className="text-white text-[13px] font-medium leading-tight">{item.text}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-2 rounded-full bg-white/20 shadow-sm shrink-0" />
                                                    <p className="text-white/60 text-[13px] font-medium">No expiring documents found</p>
                                                </div>
                                            )}
                                        </div>

                                        {summaryPages.length > 1 ? (
                                            <div className="mt-3 flex items-center justify-center gap-2">
                                                {summaryPages.map((_, idx) => (
                                                    <button
                                                        key={`summary-dot-${idx}`}
                                                        type="button"
                                                        onClick={() => setSummaryPageIndex(idx)}
                                                        aria-label={`Go to summary page ${idx + 1}`}
                                                        className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                                                            idx === summaryPageIndex
                                                                ? 'bg-white scale-125'
                                                                : 'bg-sky-200/80 hover:bg-sky-100'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>



                    {/* Tab Navigation (Matched to Employee Profile) */}

                    <div className="flex items-center gap-8 mb-6 border-b border-gray-200 px-6">

                        {coTabVis('basic') && (
                        <button
                            onClick={() => setActiveTab('basic')}
                            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'basic' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <div className="flex items-center">
                                Basic Details
                                {viewerHasPendingMatch(c => {
                                    const s = String(c?.section || '').toLowerCase();
                                    const cd = String(c?.card || '').toLowerCase();
                                    return s.includes('basic') || cd.includes('basic') || 
                                           s.includes('trade') || cd.includes('trade') || 
                                           s.includes('establishment') || cd.includes('establishment');
                                }) && (
                                    <span
                                        className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                        title="pending changes in this tab"
                                    >
                                        !
                                    </span>
                                )}
                            </div>
                            {activeTab === 'basic' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>
                        )}

                        {coTabVis('owner') && (
                        <button
                            onClick={() => setActiveTab('owner')}
                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'owner' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <div className="flex items-center">
                                Owner Information
                                {hasPendingOwnerDetailsChange && (
                                    <span
                                        className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                        title="pending changes in this tab"
                                    >
                                        !
                                    </span>
                                )}
                            </div>
                            {activeTab === 'owner' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>
                        )}

                        {coTabVis('assets') && (
                        <button

                            onClick={() => setActiveTab('assets')}

                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'assets' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'

                                }`}

                        >

                            Assets

                            {activeTab === 'assets' ? (

                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />

                            ) : null}

                        </button>
                        )}

                        {coTabVis('fine') && (
                        <button

                            onClick={() => setActiveTab('fine')}

                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'fine' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'

                                }`}

                        >

                            Fine

                            {activeTab === 'fine' ? (

                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />

                            ) : null}

                        </button>
                        )}

                        {coTabVis('documents') && (
                        <button
                            onClick={() => setActiveTab('others')}
                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'others' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <div className="flex items-center">
                                Documents
                                {viewerHasPendingMatch(c => {
                                    const s = String(c?.section || '').toLowerCase();
                                    const cd = String(c?.card || '').toLowerCase();
                                    return s.includes('document') || cd.includes('document') || 
                                           s.includes('moa') || cd.includes('moa') || 
                                           s.includes('ejari') || cd.includes('ejari') || 
                                           s.includes('insurance') || cd.includes('insurance');
                                }) && (
                                    <span
                                        className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                        title="pending changes in this tab"
                                    >
                                        !
                                    </span>
                                )}
                            </div>
                            {activeTab === 'others' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>
                        )}



                        {coTabVis('documents') && activeDynamicTabs.filter((tab) => tab !== 'Certificate').map((tab) => (

                            <div key={tab} className="group relative">

                                <button

                                    onClick={() => setActiveTab(tab)}

                                    className={`pb-3 text-sm font-semibold transition-all relative capitalize ${activeTab === tab ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}

                                >

                                    {tab}

                                    {activeTab === tab && (

                                        <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />

                                    )}

                                </button>

                                <button

                                    onClick={(e) => {

                                        e.stopPropagation();

                                        setActiveDynamicTabs(activeDynamicTabs.filter(t => t !== tab));

                                        if (activeTab === tab) setActiveTab('others');

                                    }}

                                    className="absolute -top-1 -right-2 p-0.5 bg-gray-100 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-gray-200"

                                    title="Close Tab"

                                >

                                    <X size={10} />

                                </button>

                            </div>

                        ))}



                        <div className="flex-1" />





                    </div>





                    {/* Tab Content */}

                    <div className="bg-transparent min-h-[400px]">

                        {activeTab === 'basic' && (

                            <div className="animate-in fade-in duration-500 space-y-8">

                                <div className="w-full columns-1 lg:columns-2 gap-6 space-y-0">

                                    {/* Masonry-style column flow (same pattern as employee BasicTab) */}

                                    <div className="mb-6 break-inside-avoid w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

                                        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">

                                            <div className="flex items-center">
                                                <h4 className="text-xl font-semibold text-gray-800">Basic Details</h4>
                                                {viewerHasPendingMatch(c => {
                                                    const s = String(c?.section || '').toLowerCase();
                                                    const cd = String(c?.card || '').toLowerCase();
                                                    return s.includes('basic') || cd.includes('basic');
                                                }) && (
                                                    <span
                                                        className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                        title="waiting for hr approval"
                                                    >
                                                        !
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {(isAdmin() || companyPerms.basic.edit) && (
                                                <button

                                                    onClick={() => handleModalOpen('basicDetails')}

                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"

                                                >

                                                    <Edit2 size={18} />

                                                </button>
                                                )}
                                            </div>

                                        </div>

                                        <div className="divide-y divide-gray-100">

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Company ID</span>

                                                <span className="text-sm font-medium text-gray-500">{company.companyId}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Company Name</span>

                                                <span className="text-sm font-medium text-gray-500">{company.name}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Nick Name</span>

                                                <span className="text-sm font-medium text-gray-500">{company.nickName || '---'}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Email Address</span>

                                                <span className="text-sm font-medium text-gray-500">{company.email}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Contact Number</span>

                                                <span className="text-sm font-medium text-gray-500">{company.phoneCountryCode ? `${company.phoneCountryCode} ${company.phone}` : (company.phone || '---')}</span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Establishment Date</span>

                                                <span className="text-sm font-medium text-gray-500">

                                                    {company.establishedDate ? new Date(company.establishedDate).toLocaleDateString('en-GB') : '---'}

                                                </span>

                                            </div>

                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                <span className="text-sm font-medium text-gray-500">Expiry Date</span>

                                                <span className={`text-sm font-medium ${getExpiryVisualState(company.tradeLicenseExpiry).className}`}>
                                                    {company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : '---'}
                                                </span>

                                            </div>

                                        </div>

                                        {isCompanyActivationComplete &&
                                        hasPendingBasicDetailsChange &&
                                        pendingCompanyChanges.length > 0 ? (
                                            <div className="px-8 py-4 border-t border-amber-100 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <p className="text-xs text-amber-900 leading-snug">
                                                    Basic details are saved in the temporary queue. The card above shows the
                                                    current approved values until HR approves. Use{' '}
                                                    <span className="font-semibold">{activationSubmitLabel}</span> when you are
                                                    finished.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={openActivationSubmitModal}
                                                    className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                                                >
                                                    {activationSubmitLabel}
                                                </button>
                                            </div>
                                        ) : null}

                                    </div>

                                    {companyAddressCanView && companyAddressFilled && (
                                        <div className="mb-6 break-inside-avoid w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
                                                <div className="flex items-center">
                                                    <h4 className="text-xl font-semibold text-gray-800">Company Address</h4>
                                                    {viewerHasPendingMatch((c) => {
                                                        const s = String(c?.section || '').toLowerCase();
                                                        const cd = String(c?.card || '').toLowerCase();
                                                        return s.includes('address') || cd.includes('address');
                                                    }) && (
                                                        <span
                                                            className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                            title="waiting for hr approval"
                                                        >
                                                            !
                                                        </span>
                                                    )}
                                                </div>
                                                {companyAddressCanEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleModalOpen('companyAddress')}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit Company Address"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-gray-500">Address</span>
                                                    <span className="text-sm font-medium text-gray-500 text-right max-w-[60%]">{company.address || '---'}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-gray-500">Country</span>
                                                    <span className="text-sm font-medium text-gray-500">{company.country || '---'}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-gray-500">State / Emirates</span>
                                                    <span className="text-sm font-medium text-gray-500">{company.state || '---'}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-gray-500">City</span>
                                                    <span className="text-sm font-medium text-gray-500">{company.city || '---'}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-gray-500">PO Box</span>
                                                    <span className="text-sm font-medium text-gray-500">{company.postalCode || '---'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {(companyAddressCanAdd || companyAddressCanEdit) && !companyAddressFilled && (
                                        <div className="mb-6 break-inside-avoid w-full">
                                            <button
                                                type="button"
                                                onClick={() => handleModalOpen('companyAddress')}
                                                className="bg-[#00B894] hover:bg-[#00A383] text-white px-5 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm"
                                            >
                                                Company Address <Plus size={14} strokeWidth={3} className="text-white/80" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Trade License Card */}

                                    {hasLiveTradeLicense && tradeLicenseCanView && (

                                        <div
                                            className={`mb-6 break-inside-avoid w-full rounded-xl shadow-sm border overflow-hidden ${
                                                isExpiredDate(company.tradeLicenseExpiry)
                                                    ? 'bg-red-50/70 border-red-200'
                                                    : 'bg-white border-slate-100'
                                            }`}
                                        >

                                            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">

                                                <div className="flex items-center">
                                                    <h4 className="text-xl font-semibold text-gray-800">Trade License Details</h4>
                                                    {viewerHasPendingMatch(c => {
                                                        const s = String(c?.section || '').toLowerCase();
                                                        const cd = String(c?.card || '').toLowerCase();
                                                        return s.includes('trade') || cd.includes('trade');
                                                    }) && (
                                                        <span
                                                            className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                            title="waiting for hr approval"
                                                        >
                                                            !
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">

                                                    {company.tradeLicenseAttachment && tradeLicenseCanDownload && (

                                                        <button

                                                            onClick={() => openCompanyAttachmentPreview(company.tradeLicenseAttachment, { name: 'Trade License' })}

                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"

                                                            title="View document in new tab"

                                                        >

                                                            <Download size={18} />

                                                        </button>

                                                    )}

                                                    {tradeLicenseCanEdit && (
                                                    <button

                                                        onClick={() => handleModalOpen('tradeLicense')}

                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"

                                                        title="Edit trade license"

                                                    >

                                                        <Edit2 size={18} />

                                                    </button>
                                                    )}

                                                    {tradeLicenseCanEdit && isCompanyActivationComplete && (
                                                    <button

                                                        onClick={() => handleModalOpen('tradeLicense', null, null, true)}

                                                        className="p-2 text-orange-400 hover:bg-orange-50 rounded-lg transition-all"

                                                        title="Renew license"

                                                    >

                                                        <RotateCcw size={18} />

                                                    </button>
                                                    )}

                                                    {tradeLicenseCanEdit && isCompanyActivationComplete && !findPendingNotRenew({ kind: 'tradeLicense' })?.requestId ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setNotRenewData({ kind: 'tradeLicense', label: 'Trade License' })
                                                            }
                                                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                            title="Not renew (requires HR approval when profile is active)"
                                                        >
                                                            <Ban size={18} />
                                                        </button>
                                                    ) : null}

                                                    {tradeLicenseCanDelete && (
                                                        <button
                                                            onClick={handleDeleteTradeLicense}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Delete trade license"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}

                                                </div>

                                            </div>

                                            {findPendingNotRenew({ kind: 'tradeLicense' })?.requestId ? (
                                                <div className="px-8 py-3 text-sm bg-amber-50 border-b border-amber-100 text-amber-900 flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <span className="font-semibold block">Pending HR approval</span>
                                                        {findPendingNotRenew({ kind: 'tradeLicense' })?.reason ? (
                                                            <span className="block text-xs text-amber-800/90 mt-1 font-medium whitespace-pre-wrap break-words">
                                                                {findPendingNotRenew({ kind: 'tradeLicense' }).reason}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {viewerIsDesignatedFlowchartHr ? (
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                type="button"
                                                                disabled={hrRespondSubmitting}
                                                                onClick={() => {
                                                                    const p = findPendingNotRenew({ kind: 'tradeLicense' });
                                                                    if (p?.requestId) handleHrApproveNotRenew(p.requestId);
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-emerald-600 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
                                                                title="Approve not renew"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={hrRespondSubmitting}
                                                                onClick={() => {
                                                                    const p = findPendingNotRenew({ kind: 'tradeLicense' });
                                                                    if (p?.requestId) {
                                                                        setHrRejectRequestId(p.requestId);
                                                                        setHrRejectComment('');
                                                                    }
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-40"
                                                                title="Reject request"
                                                            >
                                                                <XCircle size={18} />
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}

                                            <div className="divide-y divide-gray-100">

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">License Number</span>

                                                    <span className="text-sm font-medium text-gray-500">{company.tradeLicenseNumber}</span>

                                                </div>

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Issue Date</span>

                                                    <span className="text-sm font-medium text-gray-500">

                                                        {company.tradeLicenseIssueDate ? new Date(company.tradeLicenseIssueDate).toLocaleDateString('en-GB') : '---'}

                                                    </span>

                                                </div>

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Expiry Date</span>

                                                    <span className={`text-sm font-medium ${getExpiryVisualState(company.tradeLicenseExpiry).className}`}>
                                                        {company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : '---'}
                                                    </span>

                                                </div>

                                                <div className="px-8 py-4 hover:bg-slate-50/50 transition-colors">

                                                    <span className="text-sm font-bold text-slate-500 block mb-2">Owners</span>

                                                    <div className="space-y-2">

                                                        {ownersForDisplay && ownersForDisplay.length > 0 ? (

                                                            ownersForDisplay.map((owner, idx) => (

                                                                <div key={idx} className="flex items-center justify-between">

                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-medium text-gray-700">{owner.name}</span>
                                                                        {owner.ownerProfileId ? (
                                                                            <span className="text-[10px] text-blue-500 font-semibold">ID: {owner.ownerProfileId}</span>
                                                                        ) : null}
                                                                    </div>

                                                                    <span className="text-[11px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">

                                                                        {owner.sharePercentage || '0'}%

                                                                    </span>

                                                                </div>

                                                            ))

                                                        ) : (
                                                            <span className="text-sm font-medium text-gray-700">{company.tradeLicenseOwnerName || '---'}</span>

                                                        )}

                                                    </div>

                                                </div>

                                                {company.tradeLicenseAttachment && tradeLicenseCanDownload && (

                                                    <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">

                                                        <span className="text-sm font-medium text-gray-500">Attachment</span>

                                                        <button

                                                            onClick={() => openCompanyAttachmentPreview(company.tradeLicenseAttachment, { name: 'Trade License' })}

                                                            className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"

                                                        >

                                                            <FileText size={14} /> View Document

                                                        </button>

                                                    </div>

                                                )}

                                            </div>

                                        </div>

                                    )}



                                    {hasLiveEstablishmentCard && establishmentCanView && (

                                        <div
                                            className={`mb-6 break-inside-avoid w-full rounded-xl shadow-sm border overflow-hidden ${
                                                isExpiredDate(company.establishmentCardExpiry)
                                                    ? 'bg-red-50/70 border-red-200'
                                                    : 'bg-white border-slate-100'
                                            }`}
                                        >

                                            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">

                                                <div className="flex items-center">
                                                    <h4 className="text-xl font-semibold text-gray-800">Establishment Card Details</h4>
                                                    {viewerHasPendingMatch(c => {
                                                        const s = String(c?.section || '').toLowerCase();
                                                        const cd = String(c?.card || '').toLowerCase();
                                                        return s.includes('establishment') || cd.includes('establishment');
                                                    }) && (
                                                        <span
                                                            className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                            title="waiting for hr approval"
                                                        >
                                                            !
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">

                                                    {company.establishmentCardAttachment && establishmentCanDownload && (

                                                        <button

                                                            onClick={() => openCompanyAttachmentPreview(company.establishmentCardAttachment, { name: 'Establishment Card' })}

                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"

                                                            title="View document in new tab"

                                                        >

                                                            <Download size={18} />

                                                        </button>

                                                    )}

                                                    {establishmentCanEdit && (
                                                    <button

                                                        onClick={() => handleModalOpen('establishmentCard')}

                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"

                                                        title="Edit establishment card"

                                                    >

                                                        <Edit2 size={18} />

                                                    </button>
                                                    )}

                                                    {establishmentCanEdit && isCompanyActivationComplete && (
                                                    <button

                                                        onClick={() => handleModalOpen('establishmentCard', null, null, true)}

                                                        className="p-2 text-orange-400 hover:bg-orange-50 rounded-lg transition-all"

                                                        title="Renew card"

                                                    >

                                                        <RotateCcw size={18} />

                                                    </button>
                                                    )}

                                                    {establishmentCanEdit && isCompanyActivationComplete && !findPendingNotRenew({ kind: 'establishmentCard' })?.requestId ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setNotRenewData({ kind: 'establishmentCard', label: 'Establishment Card' })
                                                            }
                                                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                            title="Not renew (requires HR approval when profile is active)"
                                                        >
                                                            <Ban size={18} />
                                                        </button>
                                                    ) : null}

                                                    {establishmentCanDelete && (
                                                        <button
                                                            onClick={handleDeleteEstablishmentCard}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Delete establishment card"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}

                                                </div>

                                            </div>

                                            {findPendingNotRenew({ kind: 'establishmentCard' })?.requestId ? (
                                                <div className="px-8 py-3 text-sm bg-amber-50 border-b border-amber-100 text-amber-900 flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <span className="font-semibold block">Pending HR approval</span>
                                                        {findPendingNotRenew({ kind: 'establishmentCard' })?.reason ? (
                                                            <span className="block text-xs text-amber-800/90 mt-1 font-medium whitespace-pre-wrap break-words">
                                                                {findPendingNotRenew({ kind: 'establishmentCard' }).reason}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {viewerIsDesignatedFlowchartHr ? (
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                type="button"
                                                                disabled={hrRespondSubmitting}
                                                                onClick={() => {
                                                                    const p = findPendingNotRenew({ kind: 'establishmentCard' });
                                                                    if (p?.requestId) handleHrApproveNotRenew(p.requestId);
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-emerald-600 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
                                                                title="Approve not renew"
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={hrRespondSubmitting}
                                                                onClick={() => {
                                                                    const p = findPendingNotRenew({ kind: 'establishmentCard' });
                                                                    if (p?.requestId) {
                                                                        setHrRejectRequestId(p.requestId);
                                                                        setHrRejectComment('');
                                                                    }
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-40"
                                                                title="Reject request"
                                                            >
                                                                <XCircle size={18} />
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}

                                            <div className="divide-y divide-slate-50">

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Card Number</span>

                                                    <span className="text-sm font-medium text-gray-500">{company.establishmentCardNumber}</span>

                                                </div>



                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Expiry Date</span>

                                                    <span className={`text-sm font-medium ${getExpiryVisualState(company.establishmentCardExpiry).className}`}>
                                                        {company.establishmentCardExpiry ? new Date(company.establishmentCardExpiry).toLocaleDateString('en-GB') : '---'}
                                                    </span>

                                                </div>

                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">

                                                    <span className="text-sm font-medium text-gray-500">Company Name</span>

                                                    <span className="text-sm font-medium text-gray-500">{company.name}</span>

                                                </div>

                                                {company.establishmentCardAttachment && (

                                                    <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">

                                                        <span className="text-sm font-medium text-gray-500">Attachment</span>

                                                        <button

                                                            onClick={() => openCompanyAttachmentPreview(company.establishmentCardAttachment, { name: 'Establishment Card' })}

                                                            className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"

                                                        >

                                                            <FileText size={14} /> View Document

                                                        </button>

                                                    </div>

                                                )}

                                            </div>

                                        </div>

                                    )}

                                    {ejariCanView && (company.ejari || []).map((ej, ejIdx) => {
                                        if (!ej || typeof ej !== 'object') return null;
                                        const attachUrl = ej?.document?.url || ej?.attachment;
                                        const issueRaw = ej?.issueDate || ej?.startDate;
                                        const expiryRaw = ej?.expiryDate;
                                        return (
                                            <div
                                                key={ej?._id ? String(ej._id) : `ejari-${ejIdx}`}
                                                className={`mb-6 break-inside-avoid w-full rounded-xl shadow-sm border overflow-hidden ${
                                                    isExpiredDate(expiryRaw)
                                                        ? 'bg-red-50/70 border-red-200'
                                                        : 'bg-white border-slate-100'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
                                                    <h4 className="text-xl font-semibold text-gray-800">
                                                        Ejari{ej?.type ? ` — ${ej.type}` : ''}
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        {attachUrl && ejariCanDownload && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openCompanyAttachmentPreview(
                                                                        { document: { url: attachUrl, mimeType: ej?.document?.mimeType } },
                                                                        { name: ej?.type || 'Ejari', mimeType: ej?.document?.mimeType || 'application/pdf' },
                                                                    )
                                                                }
                                                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                title="View document in new tab"
                                                            >
                                                                <Download size={18} />
                                                            </button>
                                                        )}
                                                        {ejariCanEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingIndex(ejIdx);
                                                                handleModalOpen('companyDocument', ejIdx, 'ejari');
                                                            }}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit Ejari"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        )}
                                                        {ejariCanEdit && isCompanyActivationComplete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingIndex(ejIdx);
                                                                handleModalOpen('companyDocument', ejIdx, 'ejari', true);
                                                            }}
                                                            className="p-2 text-orange-400 hover:bg-orange-50 rounded-lg transition-all"
                                                            title="Renew Ejari"
                                                        >
                                                            <RotateCcw size={18} />
                                                        </button>
                                                        )}
                                                        {ejariCanEdit && isCompanyActivationComplete && !findPendingNotRenew({
                                                            kind: 'ejari',
                                                            arrayIndex: ejIdx,
                                                            arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                        })?.requestId ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openNotRenewEjariInsurance('ejari', ejIdx, ej)}
                                                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                title="Request not renew (requires HR approval)"
                                                            >
                                                                <Ban size={18} />
                                                            </button>
                                                        ) : null}
                                                        {ejariCanDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleHardDeleteArrayItem('ejari', ejIdx)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Delete Ejari entry"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {findPendingNotRenew({
                                                    kind: 'ejari',
                                                    arrayIndex: ejIdx,
                                                    arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                })?.requestId ? (
                                                    <div className="px-8 py-3 text-sm bg-amber-50 border-b border-amber-100 text-amber-900 flex flex-wrap items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <span className="font-semibold block">Pending HR approval</span>
                                                            {findPendingNotRenew({
                                                                kind: 'ejari',
                                                                arrayIndex: ejIdx,
                                                                arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                            })?.reason ? (
                                                                <span className="block text-xs text-amber-800/90 mt-1 font-medium whitespace-pre-wrap break-words">
                                                                    {
                                                                        findPendingNotRenew({
                                                                            kind: 'ejari',
                                                                            arrayIndex: ejIdx,
                                                                            arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                                        }).reason
                                                                    }
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {viewerIsDesignatedFlowchartHr ? (
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    disabled={hrRespondSubmitting}
                                                                    onClick={() => {
                                                                        const p = findPendingNotRenew({
                                                                            kind: 'ejari',
                                                                            arrayIndex: ejIdx,
                                                                            arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                                        });
                                                                        if (p?.requestId) handleHrApproveNotRenew(p.requestId);
                                                                    }}
                                                                    className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-emerald-600 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
                                                                    title="Approve not renew"
                                                                >
                                                                    <CheckCircle size={18} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={hrRespondSubmitting}
                                                                    onClick={() => {
                                                                        const p = findPendingNotRenew({
                                                                            kind: 'ejari',
                                                                            arrayIndex: ejIdx,
                                                                            arrayItemId: ej?._id != null ? String(ej._id) : undefined,
                                                                        });
                                                                        if (p?.requestId) {
                                                                            setHrRejectRequestId(p.requestId);
                                                                            setHrRejectComment('');
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-40"
                                                                    title="Reject request"
                                                                >
                                                                    <XCircle size={18} />
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                <div className="divide-y divide-slate-50">
                                                    {ej?.provider ? (
                                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                            <span className="text-sm font-medium text-gray-500">Provider</span>
                                                            <span className="text-sm font-medium text-gray-500">{ej.provider}</span>
                                                        </div>
                                                    ) : null}
                                                    {ej?.description ? (
                                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                            <span className="text-sm font-medium text-gray-500">Note</span>
                                                            <span className="text-sm font-medium text-gray-500 text-right max-w-[60%] whitespace-pre-wrap break-words">
                                                                {ej.description}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                    <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                        <span className="text-sm font-medium text-gray-500">Issue / Start</span>
                                                        <span className="text-sm font-medium text-gray-500">{formatDate(issueRaw)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                        <span className="text-sm font-medium text-gray-500">Expiry Date</span>
                                                        <span className={`text-sm font-medium ${getExpiryVisualState(expiryRaw).className}`}>
                                                            {formatDate(expiryRaw)}
                                                        </span>
                                                    </div>
                                                    {ej?.value != null && ej?.value !== '' ? (
                                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                            <span className="text-sm font-medium text-gray-500">Value (AED)</span>
                                                            <span className="text-sm font-medium text-gray-500">
                                                                {Number(ej.value).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                    {attachUrl ? (
                                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                            <span className="text-sm font-medium text-gray-500">Attachment</span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openCompanyAttachmentPreview(
                                                                        { document: { url: attachUrl, mimeType: ej?.document?.mimeType } },
                                                                        { name: ej?.type || 'Ejari', mimeType: ej?.document?.mimeType || 'application/pdf' },
                                                                    )
                                                                }
                                                                className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                                            >
                                                                <FileText size={14} /> View Document
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}

                                </div>

                                {/* Quick Access Buttons */}

                                <div className="flex flex-wrap gap-3 px-2">

                                    {!hasLiveTradeLicense && tradeLicenseCanCreate && (

                                        <button

                                            onClick={() => handleModalOpen('tradeLicense')}

                                            className="bg-[#00B894] hover:bg-[#00A383] text-white px-5 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm"

                                        >

                                            Trade License <Plus size={14} strokeWidth={3} className="text-white/80" />

                                        </button>

                                    )}

                                    {!hasLiveEstablishmentCard && establishmentCanCreate && (

                                        <button

                                            onClick={() => handleModalOpen('establishmentCard')}

                                            className="bg-[#00B894] hover:bg-[#00A383] text-white px-5 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm"

                                        >

                                            Establishment Card <Plus size={14} strokeWidth={3} className="text-white/80" />

                                        </button>

                                    )}

                                    {ejariCanCreate && (
                                    <button

                                        type="button"

                                        onClick={() => {

                                            setEditingIndex(null);

                                            handleModalOpen('addEjari');

                                        }}

                                        className="bg-[#00B894] hover:bg-[#00A383] text-white px-5 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm"

                                    >

                                        Ejari <Plus size={14} strokeWidth={3} className="text-white/80" />

                                    </button>
                                    )}





                                </div>

                            </div>

                        )}



                        {activeTab === 'owner' && (

                            <div className="animate-in fade-in duration-500 space-y-6">

                                {ownersForDisplay && ownersForDisplay.length > 0 ? (

                                    <>

                                        {/* Owner Sub-tabs Header */}

                                        <div className="flex items-center justify-between gap-4 pb-2 border-b border-gray-100">

                                            <div className="flex flex-wrap gap-8">

                                                {ownersForDisplay.map((owner, index) => (

                                                    <button

                                                        key={index}

                                                        onClick={() => setActiveOwnerTabIndex(index)}

                                                        className={`pb-3 text-sm font-semibold tracking-tight transition-all relative ${activeOwnerTabIndex === index

                                                            ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                            : 'text-gray-400 hover:text-gray-600'

                                                            }`}

                                                    >

                                                        {owner.name || `Owner ${index + 1}`}

                                                    </button>

                                                ))}

                                            </div>
                                        </div>



                                        {/* Owner Details Layout */}

                                        <div className="pt-6 space-y-8">

                                            {/* Top Grid: Personal Details and Filled Cards */}

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                                                {/* Card 1: Personal Details (Always First) */}
                                                {ownerDetailsCanView && (
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                                                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                                                        <div className="flex items-center">
                                                            <h4 className="text-xl font-semibold text-gray-800">Owner Details</h4>
                                                            {hasPendingOwnerDetailsChange && (
                                                                <span
                                                                    className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                                    title="waiting for hr approval"
                                                                >
                                                                    !
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5">

                                                            {ownerDetailsCanEdit && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleModalOpen('ownerDetails')}
                                                                className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                                title="Edit owner details"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            )}

                                                            {ownerDetailsCanDelete &&
                                                                ownersForDisplay.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteOwner(activeOwnerTabIndex)}
                                                                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                                    title={
                                                                        isCompanyActivationComplete && !isAdmin()
                                                                            ? 'Only administrator can delete owners after activation'
                                                                            : 'Delete owner'
                                                                    }
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}

                                                        </div>

                                                    </div>

                                                    <div className="p-8 space-y-0">

                                                        {[

                                                            { label: 'Full Name', value: ownersForDisplay[activeOwnerTabIndex]?.name },

                                                            { label: 'Email Address', value: ownersForDisplay[activeOwnerTabIndex]?.email, lowercase: true },

                                                            { label: 'Contact Number', value: ownersForDisplay[activeOwnerTabIndex]?.phone },

                                                            { label: 'Nationality', value: ownersForDisplay[activeOwnerTabIndex]?.nationality },

                                                            { label: 'Share Percentage', value: ownersForDisplay[activeOwnerTabIndex]?.sharePercentage ? `${ownersForDisplay[activeOwnerTabIndex].sharePercentage}%` : null },

                                                        ].map((item, idx) => (

                                                            <div key={idx} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/30 px-2 -mx-2 rounded-lg transition-colors">

                                                                <span className="text-sm font-medium text-gray-500">{item.label}</span>

                                                                <span className={`text-sm font-medium text-gray-500 ${item.lowercase ? 'lowercase' : ''}`}>{item.value || '---'}</span>

                                                            </div>

                                                        ))}

                                                    </div>

                                                    {isCompanyActivationComplete &&
                                                    hasPendingOwnerDetailsChange &&
                                                    pendingCompanyChanges.length > 0 ? (
                                                        <div className="px-8 py-4 border-t border-amber-100 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                            <p className="text-xs text-amber-900 leading-snug">
                                                                Owner details are saved in the temporary queue. Use{' '}
                                                                <span className="font-semibold">{activationSubmitLabel}</span> when you are
                                                                finished so HR can approve and apply them permanently.
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={openActivationSubmitModal}
                                                                className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                                                            >
                                                                {activationSubmitLabel}
                                                            </button>
                                                        </div>
                                                    ) : null}

                                                </div>
                                                )}



                                                {/* Map through docs and show cards if filled */}

                                                {[

                                                    { id: 'passport', label: 'Passport', fields: [{ key: 'number', label: 'Number' }, { key: 'nationality', label: 'Nationality' }, { key: 'issueDate', label: 'Issue date', isDate: true }, { key: 'expiryDate', label: 'Expiry date', isDate: true }, { key: 'countryOfIssue', label: 'Country of issue' }], modal: 'ownerPassport' },

                                                    { id: 'visitVisa', label: 'Visit Visa', visaDocKey: 'visitVisa', fields: [{ key: 'number', label: 'Visa Number' }, { key: 'issueDate', label: 'Issue date', isDate: true }, { key: 'expiryDate', label: 'Expiry date', isDate: true }], modal: 'ownerVisa' },

                                                    { id: 'employmentVisa', label: 'Employment Visa', visaDocKey: 'employmentVisa', fields: [{ key: 'number', label: 'Visa Number' }, { key: 'issueDate', label: 'Issue date', isDate: true }, { key: 'expiryDate', label: 'Expiry date', isDate: true }, { key: 'sponsor', label: 'Sponsor' }], modal: 'ownerVisa' },

                                                    { id: 'spouseVisa', label: 'Spouse Visa', visaDocKey: 'spouseVisa', fields: [{ key: 'number', label: 'Visa Number' }, { key: 'issueDate', label: 'Issue date', isDate: true }, { key: 'expiryDate', label: 'Expiry date', isDate: true }, { key: 'sponsor', label: 'Sponsor' }], modal: 'ownerVisa' },

                                                    { id: 'labourCard', label: 'Labour Card', fields: [{ key: 'number', label: 'Labour Card Number' }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerLabourCard' },

                                                    { id: 'emiratesId', label: 'Emirates ID', fields: [{ key: 'number', label: 'Number' }, { key: 'issueDate', label: 'Issue Date', isDate: true }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerEmiratesId' },

                                                    { id: 'medical', label: 'Medical Insurance', fields: [{ key: 'provider', label: 'Provider' }, { key: 'number', label: 'Policy Number' }, { key: 'issueDate', label: 'Issue Date', isDate: true }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerMedical' },

                                                    { id: 'drivingLicense', label: 'Driving License', fields: [{ key: 'number', label: 'License Number' }, { key: 'issueDate', label: 'Issue Date', isDate: true }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }, { key: 'issuingCountry', label: 'Issuing Country' }], modal: 'ownerDrivingLicense' }

                                                ].filter((doc) => {
                                                    if (!ownerDocHasContent(ownersForDisplay[activeOwnerTabIndex]?.[doc.id])) return false;
                                                    return isAdmin() || ownerDocAccessByKey(doc.id, companyPerms).view;
                                                }).map((doc, idx) => {
                                                    const oa = ownerDocAccessByKey(doc.id, companyPerms);
                                                    const docCanDelete = ownerDocCanDeleteByKey(doc.id);
                                                    return (

                                                    <div
                                                        key={idx}
                                                        className={`rounded-2xl shadow-sm border overflow-hidden ${
                                                            isExpiredDate(ownersForDisplay[activeOwnerTabIndex]?.[doc.id]?.expiryDate)
                                                                ? 'bg-red-50/70 border-red-200'
                                                                : 'bg-white border-gray-100'
                                                        }`}
                                                    >

                                                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/20">
                                                            <div className="flex items-center">
                                                                <h4 className="text-sm font-semibold text-gray-800">{doc.label}</h4>
                                                                {(doc.id === 'passport' && hasPendingOwnerPassportChange) ||
                                                                (doc.id === 'emiratesId' && hasPendingOwnerEmiratesIdChange) ? (
                                                                    <span
                                                                        className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                                        title="waiting for hr approval"
                                                                    >
                                                                        !
                                                                    </span>
                                                                ) : null}
                                                            </div>

                                                            <div className="flex items-center gap-1.5">

                                                                {canEditOwnerDocByKey(doc.id) && (
                                                                <button onClick={() => handleModalOpen(doc.modal, null, doc.visaDocKey || null)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={18} /></button>
                                                                )}

                                                                {isCompanyActivationComplete && canEditOwnerDocByKey(doc.id) && (
                                                                <button onClick={() => handleModalOpen(doc.modal, null, doc.visaDocKey || null, true)} className="p-1.5 text-orange-400 hover:bg-orange-50 rounded-lg transition-all" title={`Renew ${doc.label}`}><RotateCcw size={18} /></button>
                                                                )}

                                                                {docCanDelete && (
                                                                    <button
                                                                        onClick={() => handleDeleteOwnerDocumentCard(doc.id)}
                                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                        title={`Delete ${doc.label}`}
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                )}

                                                                {isCompanyActivationComplete && canEditOwnerDocByKey(doc.id) && !findPendingNotRenew({
                                                                    kind: 'ownerDoc',
                                                                    ownerIndex: activeOwnerTabIndex,
                                                                    docKey: doc.id,
                                                                })?.requestId ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setNotRenewData({
                                                                                kind: 'ownerDoc',
                                                                                ownerIndex: activeOwnerTabIndex,
                                                                                ownerProfileId:
                                                                                    ownersForDisplay[activeOwnerTabIndex]?.ownerProfileId ||
                                                                                    ownersForDisplay[activeOwnerTabIndex]?._id ||
                                                                                    '',
                                                                                docKey: doc.id,
                                                                                label: doc.label,
                                                                            })
                                                                        }
                                                                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                        title={`Request not renew for ${doc.label} (HR approval)`}
                                                                    >
                                                                        <Ban size={18} />
                                                                    </button>
                                                                ) : null}

                                                                {ownersForDisplay[activeOwnerTabIndex]?.[doc.id]?.attachment && (isAdmin() || oa.download) ? (

                                                                    <button

                                                                        onClick={() => openCompanyAttachmentPreview(
                                                                            ownersForDisplay[activeOwnerTabIndex][doc.id].attachment,
                                                                            { name: doc.label },
                                                                        )}

                                                                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"

                                                                    >

                                                                        <Download size={14} />

                                                                    </button>

                                                                ) : null}

                                                            </div>

                                                        </div>

                                                        {findPendingNotRenew({
                                                            kind: 'ownerDoc',
                                                            ownerIndex: activeOwnerTabIndex,
                                                            docKey: doc.id,
                                                        })?.requestId ? (
                                                            <div className="px-6 py-3 text-sm bg-amber-50 border-b border-amber-100 text-amber-900 flex flex-wrap items-start justify-between gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="font-semibold block">Pending HR approval</span>
                                                                    {findPendingNotRenew({
                                                                        kind: 'ownerDoc',
                                                                        ownerIndex: activeOwnerTabIndex,
                                                                        docKey: doc.id,
                                                                    })?.reason ? (
                                                                        <span className="block text-xs text-amber-800/90 mt-1 font-medium whitespace-pre-wrap break-words">
                                                                            {
                                                                                findPendingNotRenew({
                                                                                    kind: 'ownerDoc',
                                                                                    ownerIndex: activeOwnerTabIndex,
                                                                                    docKey: doc.id,
                                                                                }).reason
                                                                    }
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                                {viewerIsDesignatedFlowchartHr ? (
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            disabled={hrRespondSubmitting}
                                                                            onClick={() => {
                                                                                const p = findPendingNotRenew({
                                                                                    kind: 'ownerDoc',
                                                                                    ownerIndex: activeOwnerTabIndex,
                                                                                    docKey: doc.id,
                                                                                });
                                                                                if (p?.requestId) handleHrApproveNotRenew(p.requestId);
                                                                            }}
                                                                            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white p-2 text-emerald-600 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
                                                                            title="Approve not renew"
                                                                        >
                                                                            <CheckCircle size={18} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={hrRespondSubmitting}
                                                                            onClick={() => {
                                                                                const p = findPendingNotRenew({
                                                                                    kind: 'ownerDoc',
                                                                                    ownerIndex: activeOwnerTabIndex,
                                                                                    docKey: doc.id,
                                                                                });
                                                                                if (p?.requestId) {
                                                                                    setHrRejectRequestId(p.requestId);
                                                                                    setHrRejectComment('');
                                                                                }
                                                                            }}
                                                                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-40"
                                                                            title="Reject request"
                                                                        >
                                                                            <XCircle size={18} />
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        ) : null}

                                                        <div className="p-6 space-y-5">

                                                            {doc.fields.map((field, fIdx) => (

                                                                <div key={fIdx} className="flex justify-between items-center group">

                                                                    <span className="text-sm font-medium text-gray-500">{field.label}</span>

                                                                    <span className={`text-sm font-medium ${field.key === 'expiryDate'
                                                                        ? getExpiryVisualState(ownersForDisplay[activeOwnerTabIndex]?.[doc.id]?.[field.key]).className
                                                                        : 'text-gray-500'
                                                                        }`}>

                                                                        {field.isDate

                                                                            ? (ownersForDisplay[activeOwnerTabIndex]?.[doc.id]?.[field.key]

                                                                                ? new Date(ownersForDisplay[activeOwnerTabIndex][doc.id][field.key]).toLocaleDateString('en-GB')

                                                                                : '---')

                                                                            : (ownersForDisplay[activeOwnerTabIndex]?.[doc.id]?.[field.key] || '---')

                                                                        }

                                                                    </span>

                                                                </div>

                                                            ))}

                                                        </div>

                                                    </div>

                                                );
                                                })}

                                            </div>



                                            {/* Bottom Row: Missing Documents Buttons */}

                                            <div className="flex flex-wrap gap-4 pt-4">

                                                {[

                                                    { id: 'passport', label: 'Passport', modal: 'ownerPassport' },

                                                    { id: 'labourCard', label: 'Labour Card', modal: 'ownerLabourCard' },

                                                    { id: 'emiratesId', label: 'Emirates ID', modal: 'ownerEmiratesId' },

                                                    { id: 'medical', label: 'Medical Insurance', modal: 'ownerMedical' },

                                                    { id: 'drivingLicense', label: 'Driving License', modal: 'ownerDrivingLicense' }

                                                ].filter((doc) => {
                                                    if (ownerDocHasContent(ownersForDisplay[activeOwnerTabIndex]?.[doc.id])) return false;
                                                    return isAdmin() || ownerDocAccessByKey(doc.id, companyPerms).view;
                                                }).map((btn, idx) => (

                                                    <div key={idx} className="relative" ref={btn.isDropdown ? visaDropdownRef : null}>

                                                        <button

                                                            onClick={() => handleModalOpen(btn.modal, null, btn.visaDocKey || null)}

                                                            className="bg-[#00B894] hover:bg-[#00A383] text-white px-6 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shadow-sm"

                                                        >

                                                            {btn.label} <Plus size={16} strokeWidth={3} />

                                                        </button>

                                                    </div>

                                                ))}

                                                {showOwnerVisaAddButton && (
                                                    <button
                                                        type="button"
                                                        onClick={handleOpenOwnerVisaTypeSelection}
                                                        className="bg-[#00B894] hover:bg-[#00A383] text-white px-6 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shadow-sm"
                                                    >
                                                        Visa <Plus size={16} strokeWidth={3} />
                                                    </button>
                                                )}

                                            </div>

                                        </div>

                                    </>

                                ) : (

                                    <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center justify-center py-24 text-center border border-gray-100">

                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 border border-gray-100">

                                            <User size={32} />

                                        </div>

                                        <h4 className="text-lg font-bold text-gray-700">No Owner Records Found</h4>

                                        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">Ownership and stakeholder information has not been added to the trade license yet.</p>

                                        <button

                                            onClick={() => handleModalOpen('tradeLicense')}

                                            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"

                                        >

                                            Add Owner Info

                                        </button>

                                    </div>

                                )}

                            </div>

                        )}



                        {activeTab === 'assets' && coTabVis('assets') && (

                            <div className="animate-in fade-in duration-500">

                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 min-h-[400px]">

                                    <div className="flex items-center justify-between mb-6">

                                        <div>

                                            <h3 className="text-xl font-semibold text-gray-800">Company Assets</h3>

                                            <p className="text-sm text-gray-400 mt-0.5">Assets transferred and assigned to this company</p>

                                        </div>

                                    </div>

                                    {companyAssetsCanManage && (
                                    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                                        {selectedCompanyAssetIds.length > 0 && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                                                {selectedCompanyAssetIds.length} selected
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleCompanyBulkReturn}
                                            disabled={selectedCompanyAssetIds.length === 0 || companyBulkSubmitting}
                                            className="bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Bulk return"
                                        >
                                            <Undo2 size={14} />
                                            <span>Bulk Return</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCompanyBulkTransfer}
                                            disabled={selectedCompanyAssetIds.length === 0 || companyBulkSubmitting}
                                            className="bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Bulk transfer"
                                        >
                                            <ArrowRightLeft size={14} />
                                            <span>Bulk Transfer</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCompanyBulkEndOfServices}
                                            disabled={selectedCompanyAssetIds.length === 0 || companyBulkSubmitting}
                                            className="bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Bulk end of services"
                                        >
                                            <PackageX size={14} />
                                            <span>Bulk End Of Services</span>
                                        </button>
                                    </div>
                                    )}

                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">

                                        <table className="w-full text-left">

                                            <thead className="bg-gray-50/80 border-b border-gray-100">

                                                <tr>
                                                    {companyAssetsCanManage && (
                                                    <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-12">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSelectAllCompanyAssets();
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 disabled:opacity-40"
                                                            disabled={selectableCompanyAssetIds.length === 0}
                                                            aria-label="Select all assets"
                                                        >
                                                            {allSelectableCompanyAssetsSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                        </button>
                                                    </th>
                                                    )}

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Asset Name</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Asset ID</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Type / Category</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Value</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Date</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>

                                                </tr>

                                            </thead>

                                            <tbody className="divide-y divide-gray-50">

                                                {assetsLoading ? (

                                                    <tr>

                                                        <td colSpan={companyAssetsCanManage ? 9 : 8} className="px-6 py-20 text-center">

                                                            <div className="flex flex-col items-center gap-3 text-gray-300">

                                                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />

                                                                <span className="text-sm font-semibold text-gray-400">Loading assets...</span>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ) : filteredCompanyAssets.length === 0 ? (

                                                    <tr>

                                                        <td colSpan={companyAssetsCanManage ? 9 : 8} className="px-6 py-20 text-center">

                                                            <div className="flex flex-col items-center gap-3">

                                                                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">

                                                                    <Building size={28} className="text-gray-300" />

                                                                </div>

                                                                <span className="text-sm font-semibold text-gray-400">
                                                                    No assets transferred to this company yet
                                                                </span>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ) : (

                                                    filteredCompanyAssets.map((asset, idx) => {

                                                        const statusColors = {

                                                            'Assigned': 'bg-emerald-100 text-emerald-700',

                                                            'Unassigned': 'bg-gray-100 text-gray-500',

                                                            'Maintenance': 'bg-amber-100 text-amber-700',

                                                            'On Service': 'bg-blue-100 text-blue-600',

                                                            'Lost': 'bg-red-100 text-red-600',

                                                            'Returned': 'bg-purple-100 text-purple-600',

                                                            'Out of Service': 'bg-gray-100 text-gray-500',

                                                            'End of Life': 'bg-slate-100 text-slate-500',

                                                        };

                                                        const statusClass = statusColors[asset.status] || 'bg-blue-100 text-blue-600';

                                                        const empName = asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : '---';



                                                        return (

                                                            <tr
                                                                key={asset._id || idx}
                                                                className="hover:bg-blue-50/20 transition-colors group cursor-pointer"
                                                                onClick={() => router.push(`/HRM/Asset/details/${asset._id || asset.id}`)}
                                                            >
                                                                {companyAssetsCanManage && (
                                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                                    <button
                                                                        type="button"
                                                                        className="text-blue-600 hover:text-blue-800 disabled:opacity-30"
                                                                        onClick={() => toggleCompanyAssetSelection(asset._id || asset.id)}
                                                                        disabled={!(String(asset?.status || '').toLowerCase() === 'assigned' && !asset?.pendingAction)}
                                                                        aria-label={`Select ${asset.name || 'asset'}`}
                                                                    >
                                                                        {selectedCompanyAssetIds.includes(String(asset._id || asset.id)) ? (
                                                                            <CheckSquare size={16} />
                                                                        ) : (
                                                                            <Square size={16} />
                                                                        )}
                                                                    </button>
                                                                </td>
                                                                )}

                                                                <td className="px-6 py-4">

                                                                    <div className="flex flex-col">

                                                                        <span className="text-sm font-semibold text-gray-700">{asset.name || '---'}</span>

                                                                    </div>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">

                                                                        {asset.assetId || '---'}

                                                                    </span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm text-gray-600 capitalize">{asset.typeId?.name || asset.categoryId?.name || '---'}</span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-bold text-emerald-600">{asset.assetValue ? `${Number(asset.assetValue).toLocaleString()} AED` : '---'}</span>

                                                                </td>

                                                                <td className="px-6 py-4 text-sm font-medium text-gray-500">

                                                                    {asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString('en-GB') : '---'}

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>

                                                                        {asset.status || 'Assigned'}

                                                                    </span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <div className="flex items-center gap-2">
                                                                        {asset.invoiceFile && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openCompanyAttachmentPreview(asset.invoiceFile, { name: `${asset.name} Invoice` });
                                                                                }}
                                                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                                                title="View Invoice"
                                                                            >
                                                                                <FileText size={18} />
                                                                            </button>
                                                                        )}
                                                                        {(asset.documents || []).map((doc, dIdx) => (
                                                                            doc.attachment && (
                                                                                <button
                                                                                    key={dIdx}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        openCompanyAttachmentPreview(doc.attachment, {
                                                                                            name: `${asset.name} - ${doc.type || 'Document'}`,
                                                                                        });
                                                                                    }}
                                                                                    className="text-indigo-500 hover:text-indigo-700 transition-colors"
                                                                                    title={doc.type || 'Asset Document'}
                                                                                >
                                                                                    <File size={18} />
                                                                                </button>
                                                                            )
                                                                        ))}
                                                                        {!asset.invoiceFile && (asset.documents || []).filter(d => d.attachment).length === 0 && (
                                                                            <span className="text-gray-300">---</span>
                                                                        )}
                                                                    </div>

                                                                </td>

                                                                <td className="px-6 py-4 text-right">

                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            router.push(`/HRM/Asset/details/${asset._id || asset.id}`);
                                                                        }}

                                                                        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"

                                                                        title="View Asset Details"

                                                                    >

                                                                        <ChevronRight size={18} />

                                                                    </button>

                                                                </td>

                                                            </tr>

                                                        );

                                                    })

                                                )}



                                            </tbody>

                                        </table>

                                    </div>

                                </div>

                            </div>

                        )}





                        {activeTab === 'fine' && coTabVis('fine') && (

                            <div className="animate-in fade-in duration-500">

                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 min-h-[400px]">

                                    <div className="flex items-center justify-between mb-6">

                                        <div>

                                            <h3 className="text-xl font-semibold text-gray-800">Company Fines</h3>

                                            <p className="text-sm text-gray-400 mt-0.5">Approved company fines for this company from the Fine module</p>

                                        </div>

                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">

                                        <table className="w-full text-left">

                                            <thead className="bg-gray-50/80 border-b border-gray-100">

                                                <tr>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Fine ID</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Fine Type</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Company Share</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Awarded Date</th>

                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>

                                                </tr>

                                            </thead>

                                            <tbody className="divide-y divide-gray-50">

                                                {finesLoading ? (

                                                    <tr>

                                                        <td colSpan={7} className="px-6 py-20 text-center">

                                                            <div className="flex flex-col items-center gap-3 text-gray-300">

                                                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />

                                                                <span className="text-sm font-semibold text-gray-400">Loading fines...</span>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ) : companyFines.length === 0 ? (

                                                    <tr>

                                                        <td colSpan={7} className="px-6 py-20 text-center">

                                                            <div className="flex flex-col items-center gap-3">

                                                                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">

                                                                    <FileText size={28} className="text-gray-300" />

                                                                </div>

                                                                <span className="text-sm font-semibold text-gray-400">No company fines found for this company</span>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ) : (

                                                    companyFines.map((fine, idx) => {

                                                        const statusColors = {

                                                            'Pending': 'bg-yellow-100 text-yellow-700',

                                                            'Pending HR': 'bg-orange-100 text-orange-700',

                                                            'Pending Accounts': 'bg-blue-100 text-blue-700',

                                                            'Pending Authorization': 'bg-purple-100 text-purple-700',

                                                            'Approved': 'bg-green-100 text-green-700',

                                                            'Active': 'bg-emerald-100 text-emerald-700',

                                                            'Completed': 'bg-teal-100 text-teal-700',

                                                            'Paid': 'bg-gray-100 text-gray-700',

                                                            'Rejected': 'bg-red-100 text-red-700',

                                                            'Cancelled': 'bg-slate-100 text-slate-700',

                                                            'Draft': 'bg-gray-100 text-gray-500'

                                                        };

                                                        const statusClass = statusColors[fine.fineStatus] || 'bg-blue-100 text-blue-600';

                                                        const companyAmount = fine.companyAmount || 0;

                                                        const totalAmount = fine.fineAmount || 0;

                                                        return (

                                                            <tr
                                                                key={fine._id || idx}
                                                                className="hover:bg-blue-50/20 transition-colors group cursor-pointer"
                                                                onClick={() => router.push(`/HRM/Fine/${fine._id || fine.fineId}`)}
                                                            >

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">

                                                                        {fine.fineId || '---'}

                                                                    </span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm text-gray-600 capitalize">{fine.fineType || fine.subCategory || '---'}</span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-bold text-red-600">{totalAmount ? `${Number(totalAmount).toLocaleString()} AED` : '---'}</span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className="text-sm font-bold text-emerald-600">{companyAmount ? `${Number(companyAmount).toLocaleString()} AED` : '0 AED'}</span>

                                                                </td>

                                                                <td className="px-6 py-4">

                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>

                                                                        {fine.fineStatus || 'Pending'}

                                                                    </span>

                                                                </td>

                                                                <td className="px-6 py-4 text-sm font-medium text-gray-500">

                                                                    {fine.awardedDate ? new Date(fine.awardedDate).toLocaleDateString('en-GB') : '---'}

                                                                </td>

                                                                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>

                                                                    <button

                                                                        onClick={() => router.push(`/HRM/Fine/${fine._id || fine.fineId}`)}

                                                                        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"

                                                                        title="View Fine Details"

                                                                    >

                                                                        <ChevronRight size={18} />

                                                                    </button>

                                                                </td>

                                                            </tr>

                                                        );

                                                    })

                                                )}



                                            </tbody>

                                        </table>

                                    </div>

                                </div>

                            </div>

                        )}



                        {(activeTab === 'others' || activeTab === 'moa' || activeDynamicTabs.includes(activeTab) || activeTab === 'Certificate') && (

                            <div className={`${activeTab === 'moa' ? '' : 'bg-white rounded-xl shadow-sm border border-gray-100 p-8'} animate-in fade-in duration-500 min-h-[400px]`}>

                                <div className="flex flex-col gap-6 mb-8">

                                    <div className="flex items-center justify-between">

                                        <h3 className="text-xl font-semibold text-gray-800 capitalize">

                                            {activeTab === 'others' ? 'Documents' :

                                                activeTab === 'moa' ? 'MOA Documents' :

                                                    `${activeTab} Documents`}

                                        </h3>

                                        <div className="flex items-center gap-2 flex-wrap justify-end">
                                            {(isAdmin() || companyPerms.certificate.create) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingCertificateData(null);
                                                    setEditingCertificateIndex(null);
                                                    setShowCertificateModal(true);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                <Plus size={16} /> Add Certificate
                                            </button>
                                            )}
                                            {(isAdmin() || companyPerms.moa.create) && (activeTab === 'moa' || docStatusTab === 'live') && !isCompanyActivationComplete && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!isAdmin() && !companyPerms.moa.create) {
                                                        notifyNoPermission(toast, 'add MOA documents');
                                                        return;
                                                    }
                                                    setModalErrors({});
                                                    handleModalOpen('companyDocument', null, 'moa');
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                <Plus size={16} /> Add MOA
                                            </button>
                                            )}
                                            {(isAdmin() || companyPerms.memo.create) && docStatusTab === 'memo' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!isAdmin() && !companyPerms.memo.create) {
                                                        notifyNoPermission(toast, 'add memos');
                                                        return;
                                                    }
                                                    setEditingIndex(null);
                                                    setModalErrors({});
                                                    setModalData({
                                                        type: '',
                                                        description: '',
                                                        issueDate: '',
                                                        memoCategory: 'General',
                                                        attachment: null,
                                                        fileName: '',
                                                        mimeType: 'application/pdf'
                                                    });
                                                    setModalType('addMemo');
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                <Plus size={16} /> Add Memo
                                            </button>
                                            )}
                                            {(isAdmin() || companyPerms.docLiveWithExpiry.create || companyPerms.docLiveWithoutExpiry.create) && docStatusTab === 'live' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const canCreate =
                                                        isAdmin() ||
                                                        companyPerms.docLiveWithExpiry.create ||
                                                        companyPerms.docLiveWithoutExpiry.create;
                                                    if (!canCreate) {
                                                        notifyNoPermission(toast, 'add documents');
                                                        return;
                                                    }
                                                    setEditingIndex(null);
                                                    openCompanyAddDocumentModal();
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                                disabled={docStatusTab === 'memo'}
                                                title={docStatusTab === 'memo' ? 'Switch to Live or Old to add non-memo documents' : 'Add Document'}
                                            >
                                                <Plus size={16} /> Add Document
                                            </button>
                                            )}
                                        </div>

                                    </div>



                                    {/* Document Status Filter Tabs - Hide for MOA */}

                                    {activeTab !== 'moa' && (

                                        <div className="flex items-center gap-6 border-b border-gray-100">

                                            {(isAdmin() || companyPerms.docLive.view) && (
                                            <button

                                                onClick={() => setDocStatusTab('live')}

                                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'live'

                                                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                    : 'text-gray-400 hover:text-gray-600'

                                                    }`}

                                            >

                                                Live Documents

                                            </button>
                                            )}

                                            {(isAdmin() || companyPerms.docOld.view) && (
                                            <button

                                                onClick={() => setDocStatusTab('old')}

                                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'old'

                                                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                    : 'text-gray-400 hover:text-gray-600'

                                                    }`}

                                            >

                                                Old Documents

                                            </button>
                                            )}

                                            {(isAdmin() || companyPerms.memo.view) && (
                                            <button

                                                onClick={() => setDocStatusTab('memo')}

                                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'memo'

                                                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                    : 'text-gray-400 hover:text-gray-600'

                                                    }`}

                                            >

                                                Memo

                                            </button>
                                            )}

                                            {(isAdmin() || companyPerms.certificate.view) && (
                                            <button

                                                onClick={() => setDocStatusTab('certificate')}

                                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${docStatusTab === 'certificate'

                                                    ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'

                                                    : 'text-gray-400 hover:text-gray-600'

                                                    }`}

                                            >

                                                Certificate

                                            </button>
                                            )}

                                        </div>

                                    )}

                                </div>



                                {(() => {
                                    const isOldDoc = (d) =>
                                        (d?.description?.toLowerCase()?.includes('previous') ?? false) ||
                                        (d?.type?.toLowerCase()?.includes('previous') ?? false);
                                    const isMemoView = docStatusTab === 'memo';
                                    const isLiveView = docStatusTab === 'live';
                                    const isOldView = docStatusTab === 'old';
                                    const isCertificateView = docStatusTab === 'certificate';
                                    const tabAccess = docStatusTabAccess(docStatusTab, companyPerms);
                                    const oldDocCanView = isAdmin() || companyPerms.docOld.view;
                                    const oldDocCanDownload = isAdmin() || companyPerms.docOld.download;
                                    const rowWithPerms = (row, context) => {
                                        const a = isOldView
                                            ? companyPerms.docOld
                                            : context
                                              ? accessForCompanyDocumentContext(context, companyPerms)
                                              : tabAccess;
                                        const isComplianceCard =
                                            context === 'trade_license' || context === 'establishment_card';
                                        const isEjariRow = context === 'ejari';
                                        const isCertificateRow = context === 'certificate';
                                        const isMoaRow = context === 'moa';
                                        const isMemoRow = context === 'memo';
                                        const isDocWithExpiryRow = context === 'document_with_expiry';
                                        const isDocWithoutExpiryRow = context === 'document_without_expiry';
                                        const isInsuranceRow = context === 'insurance';
                                        const canEditRow = !isOldView && (isAdmin() || a.edit);
                                        const canDownloadRow = isAdmin() || a.download;
                                        const canDeleteRow = isOldView
                                            ? isAdmin()
                                            : isComplianceCard
                                              ? isAdmin() ||
                                                (!isCompanyActivationComplete && a.delete)
                                              : isCertificateRow || isMoaRow || isMemoRow || isDocWithExpiryRow || isDocWithoutExpiryRow || isInsuranceRow
                                                ? isAdmin() ||
                                                  (!isCompanyActivationComplete && a.delete)
                                                : isEjariRow
                                                  ? ejariCanDelete
                                                  : isAdmin();
                                        return {
                                            ...row,
                                            onView:
                                                row.onView && canDownloadRow ? row.onView : null,
                                            onEdit:
                                                row.onEdit && canEditRow ? row.onEdit : null,
                                            onRenew:
                                                row.onRenew && canEditRow ? row.onRenew : null,
                                            onNotRenew:
                                                row.onNotRenew && canEditRow ? row.onNotRenew : null,
                                            onDelete:
                                                row.onDelete && canDeleteRow ? row.onDelete : null,
                                        };
                                    };

                                    const documentsFromMain = (company.documents || []).map((d, i) => ({ ...d, sourceKind: 'documents', sourceIndex: i }));
                                    const documentsFromOld = (company.oldDocuments || []).map((d, i) => ({ ...d, sourceKind: 'oldDocuments', sourceIndex: i }));
                                    
                                    const mergedSource = [...documentsFromMain, ...documentsFromOld];

                                    const isLegacyNotRenewArchiveInDocuments = (doc) =>
                                        doc?.sourceKind === 'documents' && isOldDoc(doc);

                                    const docsSourceRaw = mergedSource.filter(
                                        (doc) =>
                                            doc &&
                                            (
                                                isMemoView || isCertificateView
                                                    ? true
                                                    : isOldView
                                                      ? doc.sourceKind === 'oldDocuments' ||
                                                        isLegacyNotRenewArchiveInDocuments(doc)
                                                      : (isLiveView ? (doc.sourceKind === 'documents' && !isOldDoc(doc)) : false)
                                            )
                                    );
                                    const docsSource = isOldView
                                        ? dedupeOldDocumentsMergedSources(docsSourceRaw)
                                        : isMemoView || isCertificateView
                                          ? dedupeMergedDocumentSourcesPreferLive(docsSourceRaw)
                                          : docsSourceRaw;
                                    const openAttachment = (doc, fallbackName = 'Document') => {
                                        openCompanyAttachmentPreview(doc, {
                                            name: doc?.type || fallbackName,
                                            mimeType: doc?.document?.mimeType || 'application/pdf',
                                        });
                                    };

                                    const checkIsQueued = (sectionName) => {
                                        return viewerPendingReactivationChanges.some((change) => {
                                            const sn = String(sectionName || '').toLowerCase();
                                            const s = String(change?.section || '').toLowerCase();
                                            const cd = String(change?.card || '').toLowerCase();
                                            if (sn === 'owner' || sn === 'ownerdetails') {
                                                return pendingReactivationEntryTouchesOwnerDetails(change);
                                            }
                                            return s === sn || s.includes(sn) || cd.includes(sn);
                                        });
                                    };

                                    let basicDetailsRows = isMemoView || isCertificateView
                                        ? []
                                        : isLiveView
                                        ? [
                                            ...(isAdmin() || companyPerms.tradeLicense.view
                                                ? [{
                                                documentType: 'Trade License',
                                                description: company.tradeLicenseNumber
                                                    ? `License No. ${company.tradeLicenseNumber}`
                                                    : '—',
                                                isQueued: checkIsQueued('tradelicense'),
                                                issueDate: company.tradeLicenseIssueDate,
                                                expiryDate: company.tradeLicenseExpiry,
                                                attachment: company.tradeLicenseAttachment,
                                                onView: company.tradeLicenseAttachment ? () => openAttachment({ attachment: company.tradeLicenseAttachment, type: 'Trade License' }, 'Trade License') : null,
                                                onEdit: () => handleModalOpen('tradeLicense'),
                                                onRenew: () => handleModalOpen('tradeLicense', null, null, true),
                                                onNotRenew: () => setNotRenewData({ kind: 'tradeLicense', label: 'Trade License' }),
                                                onDelete: handleDeleteTradeLicense,
                                                notRenewPendingTarget: { kind: 'tradeLicense' },
                                            }]
                                                : []),
                                            ...(isAdmin() || companyPerms.establishment.view
                                                ? [{
                                                documentType: 'Establishment Card',
                                                description: company.establishmentCardNumber
                                                    ? `Card No. ${company.establishmentCardNumber}`
                                                    : '—',
                                                isQueued: checkIsQueued('establishmentcard'),
                                                issueDate: company.establishmentCardIssueDate,
                                                expiryDate: company.establishmentCardExpiry,
                                                attachment: company.establishmentCardAttachment,
                                                onView: company.establishmentCardAttachment ? () => openAttachment({ attachment: company.establishmentCardAttachment, type: 'Establishment Card' }, 'Establishment Card') : null,
                                                onEdit: () => handleModalOpen('establishmentCard'),
                                                onRenew: () => handleModalOpen('establishmentCard', null, null, true),
                                                onNotRenew: () => setNotRenewData({ kind: 'establishmentCard', label: 'Establishment Card' }),
                                                onDelete: handleDeleteEstablishmentCard,
                                                notRenewPendingTarget: { kind: 'establishmentCard' },
                                            }]
                                                : []),
                                        ]
                                            .filter((r) => r.issueDate || r.expiryDate || r.attachment)
                                            .map((r) =>
                                                rowWithPerms(
                                                    r,
                                                    r.documentType === 'Trade License'
                                                        ? 'trade_license'
                                                        : 'establishment_card'
                                                )
                                            )
                                        : isOldView
                                        ? docsSource
                                             .filter((d) => {
                                                 const t = String(d?.type || '').toLowerCase();
                                                 const ctx = String(d?.context || '').toLowerCase();
                                                 return (
                                                     t.includes('trade license') ||
                                                     t.includes('establishment card') ||
                                                     ctx === 'ejari' ||
                                                     t.includes('ejari') ||
                                                     ctx === 'insurance' ||
                                                     t.includes('insurance')
                                                 );
                                             })
                                             .map((d) => {
                                                 const t = String(d?.type || '').toLowerCase();
                                                 const ctx = String(d?.context || '').toLowerCase();
                                                 const permContext = t.includes('trade license')
                                                     ? 'trade_license'
                                                     : t.includes('establishment')
                                                       ? 'establishment_card'
                                                       : t.includes('insurance') || ctx === 'insurance'
                                                         ? 'insurance'
                                                         : 'ejari';
                                                 const label =
                                                     t.includes('ejari') || ctx === 'ejari'
                                                         ? (d.type && !String(d.type).toLowerCase().includes('ejari')
                                                             ? `Ejari — ${d.type}`
                                                             : (d.type || 'Ejari'))
                                                         : t.includes('insurance') || ctx === 'insurance'
                                                           ? (d.type && !String(d.type).toLowerCase().includes('insurance')
                                                               ? `Insurance — ${d.type}`
                                                               : (d.type || 'Insurance'))
                                                           : (d.type || 'Document');
                                                 return rowWithPerms({
                                                     documentType: label,
                                                     description: d.description || '—',
                                                     issueDate: d.issueDate || d.startDate,
                                                     expiryDate: d.expiryDate,
                                                     attachment: d?.document?.url || d?.attachment,
                                                     onView: (d?.document?.url || d?.attachment)
                                                         ? () => openAttachment(d, label)
                                                         : null,
                                                     onDelete: () => setDocumentToDelete({
                                                         kind: 'oldDocuments',
                                                         index: d.sourceIndex,
                                                         id: d._id || d.id,
                                                     }),
                                                 }, permContext);
                                             })
                                             .filter((r) => r.issueDate || r.expiryDate || r.attachment)
                                        : [];

                                    const OWNER_ARCHIVE_DOC_TYPES = new Set([
                                        'passport',
                                        'visit visa',
                                        'employment visa',
                                        'spouse visa',
                                        'labour card',
                                        'emirates id',
                                        'medical insurance',
                                        'driving license',
                                        'owner attachment',
                                    ]);

                                    /** Not-renew / archived owner rows use `OwnerName - DocType` and belong only under Owner Details. */
                                    const isOwnerArchivedDocRow = (doc) => {
                                        if (!doc || typeof doc !== 'object') return false;
                                        if (String(doc?.context || '').toLowerCase() === 'owner_doc') return true;
                                        const rawType = String(doc?.type || '');
                                        const sepIndex = rawType.indexOf(' - ');
                                        if (sepIndex <= 0) return false;
                                        const docType = rawType.slice(sepIndex + 3).trim().toLowerCase();
                                        return OWNER_ARCHIVE_DOC_TYPES.has(docType);
                                    };

                                    const parseOwnerDocsFromSource = (sourceDocs) => {
                                        const grouped = {};
                                        sourceDocs.forEach((doc) => {
                                            if (doc == null || typeof doc !== 'object') return;
                                            const rawType = String(doc?.type || '');
                                            const sepIndex = rawType.indexOf(' - ');
                                            if (sepIndex <= 0) return;
                                            const ownerName = rawType.slice(0, sepIndex).trim();
                                            const docType = rawType.slice(sepIndex + 3).trim();
                                            if (!ownerName || !docType) return;
                                            if (!grouped[ownerName]) grouped[ownerName] = [];
                                            grouped[ownerName].push({
                                                ownerName,
                                                documentType: docType,
                                                documentNumber: '',
                                                issueDate: doc?.issueDate || doc?.startDate,
                                                expiryDate: doc?.expiryDate,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                sourceKind: doc.sourceKind,
                                                sourceIndex: doc.sourceIndex,
                                                _id: doc._id || doc.id,
                                                onDelete: () => setDocumentToDelete({ kind: doc.sourceKind, index: doc.sourceIndex, id: doc._id || doc.id })
                                            });
                                        });
                                        return grouped;
                                    };

                                    const ownerDocsFromSource = parseOwnerDocsFromSource(docsSource);

                                    const buildOwnerDocRowsFromOwnerObject = (owner, ownerIndex, { isArchived = false } = {}) => {
                                        const ownerName = owner?.name || `Owner ${ownerIndex + 1}`;
                                        const docs = [
                                            { key: 'passport', label: 'Passport' },
                                            { key: 'visitVisa', label: 'Visit Visa', skipActivationForRenew: true },
                                            { key: 'employmentVisa', label: 'Employment Visa', skipActivationForRenew: true },
                                            { key: 'spouseVisa', label: 'Spouse Visa', skipActivationForRenew: true },
                                            { key: 'labourCard', label: 'Labour Card', skipActivationForRenew: true },
                                            { key: 'emiratesId', label: 'Emirates ID' },
                                            { key: 'medical', label: 'Medical Insurance', skipActivationForRenew: true },
                                            { key: 'drivingLicense', label: 'Driving License', skipActivationForRenew: true }
                                        ].map((m) => {
                                            const d = owner?.[m.key] || {};
                                            const hrQueuedDoc =
                                                !isArchived &&
                                                ((m.key === 'passport' && hasPendingOwnerPassportChange) ||
                                                    (m.key === 'emiratesId' && hasPendingOwnerEmiratesIdChange));
                                            return {
                                                isQueued: hrQueuedDoc,
                                                ownerName,
                                                ownerIndex,
                                                ownerProfileId: owner?.ownerProfileId || owner?._id || '',
                                                ownerDocKey: m.key,
                                                isArchivedOldOwner: !!isArchived,
                                                documentType: m.label,
                                                documentNumber: d.number || d.idNumber || '',
                                                issueDate: d.issueDate || d.startDate,
                                                expiryDate: d.expiryDate,
                                                attachment: d.attachment,
                                                notRenewPendingTarget: isArchived
                                                    ? undefined
                                                    : {
                                                        kind: 'ownerDoc',
                                                        ownerIndex,
                                                        docKey: m.key,
                                                    },
                                                skipActivationForRenew: !!m.skipActivationForRenew,
                                            };
                                        }).filter((row) => ownerDocHasContent(owner?.[row.ownerDocKey]));

                                        // Owner-level attachment (legacy)
                                        if (owner?.attachment) {
                                            docs.push({
                                                isQueued: false,
                                                ownerName,
                                                ownerIndex,
                                                ownerProfileId: owner?.ownerProfileId || owner?._id || '',
                                                ownerDocKey: 'attachment',
                                                isArchivedOldOwner: !!isArchived,
                                                documentType: 'Owner Attachment',
                                                documentNumber: '',
                                                issueDate: null,
                                                expiryDate: null,
                                                attachment: owner.attachment,
                                                notRenewPendingTarget: undefined,
                                            });
                                        }

                                        return { ownerName, docs };
                                    };

                                    // Old Documents tab lists only explicit renew/not-renew archives — not full owner profile snapshots (oldOwners).
                                    const archivedOwnerGroups = [];

                                    // Map current live documents for each owner to allow filtering duplicates in Old view.
                                    const liveOwnerDocsMap = new Map();
                                    if (isOldView) {
                                        (company.owners || []).forEach((owner, idx) => {
                                            const ownerName = owner?.name || `Owner ${idx + 1}`;
                                            const built = buildOwnerDocRowsFromOwnerObject(owner, idx, { isArchived: false });
                                            liveOwnerDocsMap.set(String(ownerName).trim().toLowerCase(), built.docs);
                                        });
                                    }

                                    const ownerGroups = isMemoView || isCertificateView
                                        ? []
                                        : isLiveView
                                        ? (company.owners || []).map((owner, ownerIndex) => {
                                            const ownerName = owner?.name || `Owner ${ownerIndex + 1}`;
                                            const built = buildOwnerDocRowsFromOwnerObject(owner, ownerIndex, { isArchived: false });
                                            return { ownerName, docs: built.docs };
                                        }).map((g) => {
                                            // Keep backward compatibility for legacy rows in documents[].
                                            // But do not re-add the core owner card doc types here, otherwise
                                            // deleted/not-renewed owner cards can incorrectly appear in Live.
                                            const ownerCoreTypes = new Set([
                                                'passport',
                                                'visa',
                                                'labour card',
                                                'emirates id',
                                                'medical insurance',
                                                'driving license',
                                            ]);
                                            const legacyOwnerDocs = (ownerDocsFromSource[g.ownerName] || []).filter((x) => {
                                                const t = String(x?.documentType || '').trim().toLowerCase();
                                                return !ownerCoreTypes.has(t);
                                            });
                                            return { ...g, docs: [...g.docs, ...legacyOwnerDocs] };
                                        }).filter((g) => g.docs.length > 0)
                                        : (() => {
                                            const legacyGroups = Object.keys(ownerDocsFromSource).map((ownerName) => ({ ownerName, docs: ownerDocsFromSource[ownerName] }));
                                            const combined = legacyGroups;
                                            if (!isOldView) return combined;

                                            // Merge groups with same ownerName for Old view so each owner appears only once.
                                            const mapByOwner = new Map();
                                            for (const g of combined) {
                                                if (!g || !g.ownerName) continue;
                                                const key = String(g.ownerName).trim();
                                                const existing = mapByOwner.get(key);
                                                const liveDocs = liveOwnerDocsMap.get(key.toLowerCase()) || [];

                                                if (!existing) {
                                                    // Filter out docs that are currently live even for the first group found
                                                    const filteredDocs = (g.docs || []).filter(d => !liveDocs.some(ld => {
                                                        const typeMatch = String(ld.documentType || '').toLowerCase() === String(d.documentType || '').toLowerCase();
                                                        const issueMatch = String(ld.issueDate || '') === String(d.issueDate || '');
                                                        const expiryMatch = String(ld.expiryDate || '') === String(d.expiryDate || '');
                                                        const idMatch = d._id && ld._id && String(d._id) === String(ld._id);
                                                        return idMatch || (typeMatch && issueMatch && expiryMatch);
                                                    }));

                                                    mapByOwner.set(key, { ...g, docs: filteredDocs });
                                                } else {
                                                    // Merge docs while deduplicating identical entries and filtering live data
                                                    const newDocs = g.docs || [];
                                                    for (const d of newDocs) {
                                                        const isDuplicateInOld = existing.docs.some((ex) => {
                                                            const typeMatch = String(ex.documentType || '').toLowerCase() === String(d.documentType || '').toLowerCase();
                                                            const issueMatch = String(ex.issueDate || '') === String(d.issueDate || '');
                                                            const expiryMatch = String(ex.expiryDate || '') === String(d.expiryDate || '');
                                                            const idMatch = d._id && ex._id && String(d._id) === String(ex._id);
                                                            return idMatch || (typeMatch && issueMatch && expiryMatch);
                                                        });
                                                        const isCurrentlyLive = liveDocs.some((ld) => {
                                                            const typeMatch = String(ld.documentType || '').toLowerCase() === String(d.documentType || '').toLowerCase();
                                                            const issueMatch = String(ld.issueDate || '') === String(d.issueDate || '');
                                                            const expiryMatch = String(ld.expiryDate || '') === String(d.expiryDate || '');
                                                            const idMatch = d._id && ld._id && String(d._id) === String(ld._id);
                                                            return idMatch || (typeMatch && issueMatch && expiryMatch);
                                                        });
                                                        if (!isDuplicateInOld && !isCurrentlyLive) {
                                                            existing.docs.push(d);
                                                        }
                                                    }
                                                    // Prefer structured archive metadata when present.
                                                    if (!existing.archiveReason && g.archiveReason) existing.archiveReason = g.archiveReason;
                                                    if (!existing.replacedByName && g.replacedByName) existing.replacedByName = g.replacedByName;
                                                }
                                            }
                                            return Array.from(mapByOwner.values()).filter((g) => (g.docs || []).length > 0);
                                        })();

                                    const documentWithExpiryRows = [];
                                    const documentWithoutExpiryRows = [];
                                    const moaRows = [];
                                    const memoRows = [];
                                    const certificateRows = [];

                                    if (isLiveView) {
                                        if (isAdmin() || companyPerms.docLiveWithExpiry.view) {
                                        (company.insurance || []).filter(Boolean).forEach((doc, idx) => {
                                            documentWithExpiryRows.push(rowWithPerms({
                                                documentType: doc?.type ? `Insurance — ${doc.type}` : 'Insurance',
                                                isQueued: checkIsQueued('insurance'),
                                                issueDate: doc?.issueDate || doc?.startDate,
                                                expiryDate: doc?.expiryDate,
                                                description: doc?.description || '',
                                                amount: doc?.value,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, doc?.type || 'Insurance'),
                                                onEdit: () => { setEditingIndex(idx); handleModalOpen('companyDocument', idx, 'insurance'); },
                                                onRenew: () => { setEditingIndex(idx); handleModalOpen('companyDocument', idx, 'insurance', true); },
                                                onNotRenew: () => openNotRenewEjariInsurance('insurance', idx, doc),
                                                onDelete: () => handleHardDeleteArrayItem('insurance', idx),
                                                notRenewPendingTarget: {
                                                    kind: 'insurance',
                                                    arrayIndex: idx,
                                                    arrayItemId: doc?._id != null ? String(doc._id) : undefined,
                                                },
                                            }, 'insurance'));
                                        });
                                        }
                                        if (isAdmin() || companyPerms.ejari.view) {
                                        (company.ejari || []).filter(Boolean).forEach((doc, idx) => {
                                            basicDetailsRows.push(rowWithPerms({
                                                documentType: doc?.type ? `Ejari — ${doc.type}` : 'Ejari',
                                                isQueued: checkIsQueued('ejari'),
                                                issueDate: doc?.issueDate || doc?.startDate,
                                                expiryDate: doc?.expiryDate,
                                                description: doc?.description || '',
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, doc?.type || 'Ejari'),
                                                onEdit: () => { setEditingIndex(idx); handleModalOpen('companyDocument', idx, 'ejari'); },
                                                onRenew: () => { setEditingIndex(idx); handleModalOpen('companyDocument', idx, 'ejari', true); },
                                                onNotRenew: () => openNotRenewEjariInsurance('ejari', idx, doc),
                                                onDelete: () => handleHardDeleteArrayItem('ejari', idx),
                                                notRenewPendingTarget: {
                                                    kind: 'ejari',
                                                    arrayIndex: idx,
                                                    arrayItemId: doc?._id != null ? String(doc._id) : undefined,
                                                },
                                            }, 'ejari'));
                                        });
                                        }
                                    }

                                    docsSource.forEach((doc) => {
                                        const { sourceIndex, sourceKind } = doc;
                                        if (doc == null || typeof doc !== 'object') return;

                                        // Live Documents lists Ejari/Insurance from company.ejari / company.insurance only.
                                        // Skip flat copies in documents[] (legacy rows with context) so renewals stay: live in arrays, old in documents.
                                        if (isLiveView) {
                                            const ctxFlat = String(doc?.context || '').toLowerCase();
                                            if (ctxFlat === 'ejari' || ctxFlat === 'insurance') return;
                                        }

                                        const t = String(doc?.type || '').toLowerCase();
                                        const context = String(doc?.context || '').toLowerCase();
                                        const dLower = String(doc?.description || '').toLowerCase();
                                        const expiryRaw = doc?.expiryDate;
                                        const expiryStr = String(expiryRaw || '').trim().toLowerCase();
                                        const hasExpiryValue =
                                            !!expiryRaw &&
                                            !['---', '-', 'n/a', 'na', 'null', 'undefined'].includes(expiryStr);
                                        const isExplicitWithExpiry =
                                            context === 'document_with_expiry' ||
                                            t.includes('with expiry') ||
                                            dLower.includes('with expiry');
                                        const isMoa = isMoaForDocumentTab(doc, {
                                            isLiveView,
                                            isOldView,
                                            sourceKind: doc.sourceKind,
                                        });
                                        const isWithoutExpiry = context === 'document_without_expiry';
                                        const isOtherDocument =
                                            context === 'other_document' ||
                                            t.includes('other document') ||
                                            t === 'other';
                                        const isBasicSystemDoc =
                                            t.includes('trade license') ||
                                            t.includes('establishment card');
                                        // Memo list is driven by DB `context: 'memo'`. Do not use `t.includes('memo')` — it matches "memorandum" (MOA).
                                        const typeTrim = String(doc?.type || '').trim();
                                        const tl = typeTrim.toLowerCase();
                                        const isMemoDoc =
                                            !isMoa &&
                                            (context === 'memo' ||
                                                tl === 'memo' ||
                                                tl === 'add memo' ||
                                                /^memo([\s\-_:]|$)/i.test(typeTrim) ||
                                                (dLower === 'memo' &&
                                                    !!tl &&
                                                    !/\bmoa\b/i.test(tl) &&
                                                    !tl.includes('memorandum')));

                                        if (isMoa) {
                                            if (isMemoView || isCertificateView || isOldView) return;
                                            if (!isAdmin() && !companyPerms.moa.view) return;
                                            moaRows.push(rowWithPerms({
                                                documentType: doc.type || '—',
                                                isQueued: doc.isQueued || viewerHasPendingMatch(c => c.section === 'moa' || (c.section === 'document' && c.documentItemId === String(doc?._id))),
                                                issueDate: doc.issueDate || doc.startDate,
                                                description: doc.description || '',
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, 'MOA'),
                                                onEdit: (isLiveView && !isCompanyActivationComplete) ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'moa'); } : null,
                                                onDelete: !isCompanyActivationComplete ? () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }) : null,
                                            }, 'moa'));
                                            return;
                                        }

                                        if (isOwnerArchivedDocRow(doc) || isBasicSystemDoc) {
                                            return;
                                        }

                                        if (isWithoutExpiry) {
                                            if (isOldView || isCertificateView) return;
                                            if (!isAdmin() && !companyPerms.docLiveWithoutExpiry.view) return;
                                            documentWithoutExpiryRows.push(rowWithPerms({
                                                documentType: doc.type || 'Document',
                                                isQueued: doc.isQueued || viewerHasPendingMatch(c => c.section === 'document' && c.documentItemId === String(doc?._id)),
                                                description: doc.description || '',
                                                issueDate: doc.issueDate || doc.startDate,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc),
                                                onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'document_without_expiry'); } : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                            }, 'document_without_expiry'));
                                            return;
                                        }

                                        if (isMemoDoc) {
                                            if (!isMemoView) return;
                                            if (!isAdmin() && !companyPerms.memo.view) return;
                                            const isArchivedMemo = isOldDoc(doc);
                                            const memoCategory = normalizeMemoCategory(doc.provider || 'General');
                                            memoRows.push(rowWithPerms({
                                                rowKey:
                                                    doc._id != null
                                                        ? String(doc._id)
                                                        : `${sourceKind}-${sourceIndex}-${String(doc.issueDate || doc.startDate || '')}-${companyDocumentUrlFingerprint(doc) || tl}`,
                                                documentType: doc.type || 'Memo',
                                                issueDate: doc.issueDate || doc.startDate,
                                                description: doc.description || '',
                                                category: memoCategory,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, doc.type || 'Memo'),
                                                onEdit: !isArchivedMemo
                                                    ? () => {
                                                        setModalErrors({});
                                                        setEditingIndex(sourceIndex);
                                                        const rawIssue = doc.issueDate || doc.startDate;
                                                        setModalData({
                                                            type: doc.type || '',
                                                            description: doc.description || '',
                                                            issueDate: rawIssue ? new Date(rawIssue).toISOString().split('T')[0] : '',
                                                            memoCategory: memoCategory,
                                                            attachment: doc?.document?.url || doc?.attachment,
                                                            fileName: doc?.document?.name || doc.type || '',
                                                            mimeType: doc?.document?.mimeType || 'application/pdf'
                                                        });
                                                        setModalType('addMemo');
                                                    }
                                                    : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                            }, 'memo'));
                                            return;
                                        }

                                        if (isCompanyCertificateDocument(doc)) {
                                            if (!isCertificateView) return;
                                            const parsed = parseCertificateStoredDescription(doc.description);
                                            certificateRows.push(rowWithPerms({
                                                rowKey: doc._id != null ? String(doc._id) : `${sourceKind}-${sourceIndex}`,
                                                documentType: doc.type || 'Certificate',
                                                issuedBy: parsed.issuedBy,
                                                issuedTo: parsed.issuedTo,
                                                userDescription: parsed.userDescription,
                                                issueDate: doc.issueDate || doc.startDate,
                                                expiryDate: doc.expiryDate,
                                                hasExpiry: doc.expiryDate ? 'Yes' : 'No',
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc, doc.type || 'Certificate'),
                                                onEdit: sourceKind === 'documents' ? () => {
                                                    if (!isAdmin() && !companyPerms.certificate.edit) {
                                                        notifyNoPermission(toast, 'edit certificates');
                                                        return;
                                                    }
                                                    setEditingCertificateData(doc);
                                                    setEditingCertificateIndex(sourceIndex);
                                                    setShowCertificateModal(true);
                                                } : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                            }, 'certificate'));
                                            return;
                                        }

                                        if (isMemoView || isCertificateView) return;

                                        if (hasExpiryValue || isExplicitWithExpiry) {
                                            const ctxDoc = String(doc?.context || '').toLowerCase();
                                            if (ctxDoc === 'ejari') {
                                                if (isOldView) {
                                                    if (sourceKind !== 'oldDocuments' && !isLegacyNotRenewArchiveInDocuments(doc)) return;
                                                    basicDetailsRows.push(rowWithPerms({
                                                        documentType:
                                                            doc.type && doc.type !== 'Ejari Record'
                                                                ? `Ejari — ${doc.type}`
                                                                : 'Ejari',
                                                        description: doc.description || '—',
                                                        issueDate: doc.issueDate || doc.startDate,
                                                        expiryDate: doc.expiryDate,
                                                        attachment: doc?.document?.url || doc?.attachment,
                                                        onView: (doc?.document?.url || doc?.attachment)
                                                            ? () => openAttachment(doc, doc.type || 'Ejari')
                                                            : null,
                                                        onDelete: () => setDocumentToDelete({
                                                            kind: sourceKind,
                                                            index: sourceIndex,
                                                            id: doc._id || doc.id,
                                                        }),
                                                    }, 'ejari'));
                                                    return;
                                                }
                                                basicDetailsRows.push(rowWithPerms({
                                                    documentType:
                                                        doc.type && doc.type !== 'Ejari Record'
                                                            ? `Ejari — ${doc.type}`
                                                            : 'Ejari',
                                                    isQueued: doc.isQueued || viewerHasPendingMatch(c => c.section === 'ejari' || (c.section === 'document' && c.documentItemId === String(doc?._id))),
                                                    issueDate: doc.issueDate || doc.startDate,
                                                    expiryDate: doc.expiryDate,
                                                    description: doc.description || '',
                                                    attachment: doc?.document?.url || doc?.attachment,
                                                    onView: () => openAttachment(doc),
                                                    onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, 'ejari'); } : null,
                                                    onRenew: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, 'ejari', true); } : null,
                                                    onNotRenew: isLiveView
                                                        ? () =>
                                                              setNotRenewData({
                                                                  kind: 'document',
                                                                  index: sourceIndex,
                                                                  documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                                  label: doc.type || 'Ejari',
                                                              })
                                                        : null,
                                                    onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                                    notRenewPendingTarget: isLiveView
                                                        ? {
                                                              kind: 'document',
                                                              documentIndex: sourceIndex,
                                                              documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                          }
                                                        : undefined,
                                                }, 'ejari'));
                                                return;
                                            }
                                            let expiryDocLabel = doc.type || 'Document';
                                            if (ctxDoc === 'insurance' && isOldDoc(doc)) {
                                                expiryDocLabel = doc.type ? `Insurance — ${doc.type}` : 'Insurance (previous)';
                                            }
                                            if (isOldView) {
                                                if (!oldDocCanView) return;
                                            } else if (!isAdmin() && !companyPerms.docLiveWithExpiry.view && ctxDoc !== 'ejari' && ctxDoc !== 'insurance') return;
                                            documentWithExpiryRows.push(rowWithPerms({
                                                documentType: expiryDocLabel,
                                                isQueued: doc.isQueued || viewerHasPendingMatch(c => c.section === 'insurance' || (c.section === 'document' && c.documentItemId === String(doc?._id))),
                                                issueDate: doc.issueDate || doc.startDate,
                                                expiryDate: doc.expiryDate,
                                                description: doc.description || '',
                                                amount: doc.value,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc),
                                                onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'document_with_expiry'); } : null,
                                                onRenew: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'document_with_expiry', true); } : null,
                                                onNotRenew: isLiveView
                                                    ? () =>
                                                          setNotRenewData({
                                                              kind: 'document',
                                                              index: sourceIndex,
                                                              documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                              label: expiryDocLabel,
                                                          })
                                                    : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                                notRenewPendingTarget: isLiveView
                                                    ? {
                                                          kind: 'document',
                                                          documentIndex: sourceIndex,
                                                          documentItemId: doc?._id != null ? String(doc._id) : undefined,
                                                      }
                                                    : undefined,
                                            }, 'document_with_expiry'));
                                            return;
                                        }
                                        if (isOtherDocument) {
                                            return;
                                        } else if (!hasExpiryValue) {
                                            if (isOldView) return;
                                            if (!isAdmin() && !companyPerms.docLiveWithoutExpiry.view) return;
                                            documentWithoutExpiryRows.push(rowWithPerms({
                                                documentType: doc.type || 'Document',
                                                isQueued: doc.isQueued || viewerHasPendingMatch(c => c.section === 'document' && c.documentItemId === String(doc?._id)),
                                                description: doc.description || '',
                                                issueDate: doc.issueDate || doc.startDate,
                                                attachment: doc?.document?.url || doc?.attachment,
                                                onView: () => openAttachment(doc),
                                                onEdit: isLiveView ? () => { setEditingIndex(sourceIndex); handleModalOpen('companyDocument', sourceIndex, doc.context || 'document_without_expiry'); } : null,
                                                onDelete: () => setDocumentToDelete({ kind: sourceKind, index: sourceIndex, id: doc._id || doc.id }),
                                            }, 'document_without_expiry'));
                                        }
                                    });

                                    const normIssuedToKey = (s) =>
                                        String(s ?? '')
                                            .trim()
                                            .toLowerCase()
                                            .replace(/\s+/g, ' ');

                                    const certificateFilterNorm = normIssuedToKey(certificateIssuedToFilter);
                                    
                                    const visibleCertificateRows = certificateRows.filter((r) => {
                                        if (certificateFilterNorm && normIssuedToKey(r.issuedTo) !== certificateFilterNorm) {
                                            return false;
                                        }
                                        if (certificateTypeFilter) {
                                            const sectionId = certificateTypeSectionId(r.documentType);
                                            if (sectionId !== certificateTypeFilter) return false;
                                        }
                                        return true;
                                    });

                                    const certificateSections = (() => {
                                        const sections = [
                                            { id: 'Installer', label: 'Installer', rows: [] },
                                            { id: 'Safety', label: 'Safety', rows: [] },
                                            { id: 'Administration', label: 'Administration', rows: [] },
                                            { id: 'Others', label: 'Others', rows: [] }
                                        ];

                                        visibleCertificateRows.forEach(row => {
                                            const sectionId = certificateTypeSectionId(row.documentType);
                                            const section = sections.find((s) => s.id === sectionId);
                                            if (section) section.rows.push(row);
                                            else sections[3].rows.push(row);
                                        });

                                        let certNo = 0;
                                        return sections
                                            .filter((s) => s.rows.length > 0)
                                            .map((section) => ({
                                                ...section,
                                                rows: section.rows.map((row) => ({
                                                    ...row,
                                                    certNo: ++certNo,
                                                })),
                                            }));
                                    })();

                                    const certificateIssuedToOptions = (() => {
                                        const opts = [{ value: '', label: 'All recipients' }];
                                        const seen = new Set(['']);
                                        const add = (value, label) => {
                                            const v = String(value || '').trim();
                                            if (!v) return;
                                            const k = normIssuedToKey(v);
                                            if (seen.has(k)) return;
                                            seen.add(k);
                                            opts.push({ value: v, label: label || v });
                                        };

                                        // Only show recipients who actually have certificates
                                        const recipientsWithCerts = new Set(
                                            certificateRows.map(row => normIssuedToKey(row.issuedTo)).filter(Boolean)
                                        );

                                        const cn = String(company?.name || '').trim();
                                        if (cn && recipientsWithCerts.has(normIssuedToKey(cn))) {
                                            add(cn, `Company — ${cn}`);
                                        }

                                        for (const emp of allEmployees || []) {
                                            const full = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                                            if (!full) continue;
                                            if (recipientsWithCerts.has(normIssuedToKey(full))) {
                                                add(full, emp.employeeId ? `${full} (${emp.employeeId})` : full);
                                            }
                                        }

                                        // Fallback for custom recipients in the data not matched by employee list
                                        for (const row of certificateRows) {
                                            const t = String(row.issuedTo || '').trim();
                                            if (t) add(t, t);
                                        }
                                        return opts;
                                    })();

                                    const ownerCards = (() => {
                                        const filterOwnerDocRow = (row) => {
                                            if (isOldView) return oldDocCanView;
                                            if (!row?.ownerDocKey || row.ownerDocKey === 'attachment') {
                                                return ownerInfoCanView;
                                            }
                                            return canViewOwnerDocByKey(row.ownerDocKey);
                                        };
                                        if (isLiveView && ownerInfoCanView && (company.owners || []).length > 0) {
                                            return (company.owners || [])
                                                .map((owner, i) => {
                                                    const ownerName = owner?.name || `Owner ${i + 1}`;
                                                    const group = ownerGroups.find((g) => g.ownerName === ownerName) || { ownerName, docs: [] };
                                                    const docs = (group.docs || []).filter(filterOwnerDocRow);
                                                    return { ownerName, docs, onDelete: () => handleDeleteOwner(i) };
                                                })
                                                .filter((card) => (card.docs || []).length > 0);
                                        }
                                        if (isOldView && oldDocCanView) {
                                            return ownerGroups
                                                .map((g) => ({
                                                    ...g,
                                                    docs: (g.docs || []).filter(filterOwnerDocRow),
                                                }))
                                                .filter((g) => (g.docs || []).length > 0);
                                        }
                                        return [];
                                    })();

                                    const hasAnyDocs =
                                        isMemoView
                                            ? memoRows.length > 0
                                            : isCertificateView
                                            ? true
                                            : isOldView
                                            ? (
                                                basicDetailsRows.length > 0 ||
                                                ownerCards.length > 0 ||
                                                documentWithExpiryRows.length > 0
                                            )
                                            : (
                                                basicDetailsRows.length > 0 ||
                                                ownerCards.length > 0 ||
                                                documentWithExpiryRows.length > 0 ||
                                                documentWithoutExpiryRows.length > 0 ||
                                                ((isAdmin() || companyPerms.moa.view) && moaRows.length > 0)
                                            );

                                    const renderEmpty = () => (
                                        <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30 rounded-3xl border border-dashed border-gray-200">
                                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 mb-4 opacity-50">
                                                <Upload size={32} strokeWidth={1.5} />
                                            </div>
                                            <h4 className="text-sm font-bold text-gray-500 mb-1">No Documents Found</h4>
                                            <p className="text-xs font-medium text-gray-400 text-center max-w-xs">There are no {docStatusTab} documents in this view.</p>
                                        </div>
                                    );

                                    if (!hasAnyDocs) return renderEmpty();

                                    const docRowActions = ({ onView, onEdit, onRenew, onNotRenew, onDelete, pendingTarget }) => {
                                        const pendingRequest = pendingTarget
                                            ? findPendingNotRenew(pendingTarget)
                                            : null;
                                        const hasPending = !isOldView && !!pendingRequest?.requestId;
                                        const showHrActions = !isOldView && viewerIsDesignatedFlowchartHr && hasPending;
                                        const effOnView = onView;
                                        const effOnEdit = isOldView ? null : onEdit;
                                        const renewAllowed = isCompanyActivationComplete;
                                        const effOnRenew =
                                            isOldView || !renewAllowed ? null : onRenew;
                                        const effOnNotRenew =
                                            isOldView || !renewAllowed ? null : onNotRenew;
                                        const effOnDelete = (isOldView && !isAdmin()) ? null : onDelete;
                                        const has =
                                            effOnView ||
                                            effOnEdit ||
                                            effOnRenew ||
                                            (effOnNotRenew && !hasPending) ||
                                            effOnDelete ||
                                            hasPending ||
                                            showHrActions;
                                        if (!has) {
                                            return <span className="text-gray-300 text-sm">—</span>;
                                        }
                                        return (
                                            <div className="flex h-full min-h-[44px] flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
                                                {effOnView && (
                                                    <button
                                                        type="button"
                                                        onClick={effOnView}
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center ${isOldView ? 'text-gray-600 hover:bg-gray-50' : 'text-blue-600 hover:bg-blue-50'} rounded-lg transition-colors`}
                                                        title="Download / view attachment"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                )}
                                                {effOnEdit && (
                                                    !isOldView && (
                                                    <button
                                                        type="button"
                                                        onClick={effOnEdit}
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center ${isOldView ? 'text-gray-600 hover:bg-gray-50' : 'text-blue-600 hover:bg-blue-50'} rounded-lg transition-colors`}
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    )
                                                )}
                                                {effOnRenew && (
                                                    !isOldView && (
                                                    <button
                                                        type="button"
                                                        onClick={effOnRenew}
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center ${isOldView ? 'text-gray-600 hover:bg-gray-50' : 'text-amber-600 hover:bg-amber-50'} rounded-lg transition-colors`}
                                                        title="Renew"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                    )
                                                )}
                                                {hasPending && (
                                                    <div
                                                        className={`inline-flex max-w-[11rem] sm:max-w-[14rem] flex-nowrap items-center gap-1 rounded-lg border ${isOldView ? 'border-gray-200 bg-gray-50' : 'border-amber-200 bg-amber-50'} px-2 py-1.5 shrink-0`}
                                                        title={pendingRequest?.reason ? `Pending HR approval — ${pendingRequest.reason}` : 'Pending HR approval'}
                                                    >
                                                        <span
                                                            className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0 ${isOldView ? 'text-gray-700' : 'text-amber-900'}`}
                                                        >
                                                            Pending
                                                        </span>
                                                        {showHrActions && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    disabled={hrRespondSubmitting}
                                                                    onClick={() => handleHrApproveNotRenew(pendingRequest.requestId)}
                                                                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${isOldView ? 'border-gray-200 bg-white text-gray-600' : 'border-emerald-200 bg-white text-emerald-600'} shadow-sm hover:${isOldView ? 'bg-gray-50' : 'bg-emerald-50'} disabled:opacity-40`}
                                                                    title="Approve not renew"
                                                                >
                                                                    <CheckCircle size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={hrRespondSubmitting}
                                                                    onClick={() => {
                                                                        setHrRejectRequestId(pendingRequest.requestId);
                                                                        setHrRejectComment('');
                                                                    }}
                                                                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${isOldView ? 'border-gray-200 bg-white text-gray-600' : 'border-rose-200 bg-white text-rose-600'} shadow-sm hover:${isOldView ? 'bg-gray-50' : 'bg-rose-50'} disabled:opacity-40`}
                                                                    title="Reject request"
                                                                >
                                                                    <XCircle size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                {effOnNotRenew && !hasPending && (
                                                    !isOldView && (
                                                    <button
                                                        type="button"
                                                        onClick={effOnNotRenew}
                                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Request not renew (HR approval)"
                                                    >
                                                        <Ban size={16} />
                                                    </button>
                                                    )
                                                )}
                                                {effOnDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={onDelete}
                                                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors`}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    };

                                    const SECTION_PAGE_SIZE = 10;
                                    const getSectionPagination = (sectionKey, rows) => {
                                        const totalRows = rows.length;
                                        const isExpanded = !!companySectionExpanded[sectionKey];
                                        const totalPages = Math.max(1, Math.ceil(totalRows / SECTION_PAGE_SIZE));
                                        const currentPage = Math.min(companySectionPages[sectionKey] || 1, totalPages);
                                        const startIndex = (currentPage - 1) * SECTION_PAGE_SIZE;
                                        const pagedRows = isExpanded ? rows : rows.slice(startIndex, startIndex + SECTION_PAGE_SIZE);
                                        return { pagedRows, totalRows, totalPages, currentPage, isExpanded };
                                    };

                                    const renderSectionExpandToggle = (sectionKey, pagination) => (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCompanySectionExpanded((prev) => ({ ...prev, [sectionKey]: !pagination.isExpanded }));
                                                setCompanySectionPages((prev) => ({ ...prev, [sectionKey]: 1 }));
                                            }}
                                            className={
                                                isOldView
                                                    ? "px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                                                    : "px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                            }
                                        >
                                            {pagination.isExpanded ? 'Paginated View' : 'Expand All'}
                                        </button>
                                    );

                                    const renderSectionControls = (sectionKey, pagination) => (
                                        <div className="flex items-center justify-center gap-2 border-t border-gray-100 bg-gray-50/40 px-4 py-2">
                                            {!pagination.isExpanded && pagination.totalRows > SECTION_PAGE_SIZE && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCompanySectionPages((prev) => ({
                                                                ...prev,
                                                                [sectionKey]: Math.max(1, pagination.currentPage - 1)
                                                            }))
                                                        }
                                                        disabled={pagination.currentPage <= 1}
                                                        className="h-8 min-w-[64px] rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                                    >
                                                        Prev
                                                    </button>
                                                    <span className="h-8 min-w-[108px] inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 shadow-sm">
                                                        Page {pagination.currentPage} / {pagination.totalPages}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCompanySectionPages((prev) => ({
                                                                ...prev,
                                                                [sectionKey]: Math.min(pagination.totalPages, pagination.currentPage + 1)
                                                            }))
                                                        }
                                                        disabled={pagination.currentPage >= pagination.totalPages}
                                                        className="h-8 min-w-[64px] rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                                    >
                                                        Next
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    );

                                    const moaRowsSorted = [...moaRows].sort((a, b) => {
                                        const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                                        const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                                        if (tb !== ta) return tb - ta;
                                        return String(b.documentType || '').localeCompare(String(a.documentType || ''));
                                    });
                                    const basicPagination = getSectionPagination(`company:${docStatusTab}:basic`, basicDetailsRows);
                                    const moaPagination = getSectionPagination(`company:${docStatusTab}:moa`, moaRowsSorted);
                                    const expiryPagination = getSectionPagination(`company:${docStatusTab}:withExpiry`, documentWithExpiryRows);
                                    const noExpiryPagination = getSectionPagination(`company:${docStatusTab}:withoutExpiry`, documentWithoutExpiryRows);

                                    const memoRowsSorted = [...memoRows].sort((a, b) => {
                                        const ta = memoIssueTimeMsFromRow(a);
                                        const tb = memoIssueTimeMsFromRow(b);
                                        if (tb !== ta) {
                                            if (ta == null) return 1;
                                            if (tb == null) return -1;
                                            return tb - ta;
                                        }
                                        return String(b.rowKey || '').localeCompare(String(a.rowKey || ''));
                                    });
                                    const memoCatNorm = (c) => normalizeMemoCategory(String(c || 'General').trim());
                                    const memoCategoryOptions = [...MEMO_CATEGORY_OPTIONS];
                                    const memoRowsFiltered = memoRowsSorted.filter((row) => {
                                        if (memoCategoryFilter && memoCatNorm(row.category) !== memoCategoryFilter) return false;
                                        if (!memoRowMatchesIssueDateRange(row, memoIssueRangeFrom, memoIssueRangeTo)) {
                                            return false;
                                        }
                                        return true;
                                    });
                                    const memoRangeActive = Boolean(memoIssueRangeFrom || memoIssueRangeTo);
                                    const memoSections = (() => {
                                        const sections = MEMO_CATEGORY_OPTIONS.map((id) => ({
                                            id,
                                            label: id,
                                            rows: [],
                                        }));
                                        memoRowsFiltered.forEach((row) => {
                                            const sectionId = memoCategorySectionId(row.category);
                                            const section = sections.find((s) => s.id === sectionId);
                                            if (section) section.rows.push(row);
                                            else sections.find((s) => s.id === 'General')?.rows.push(row);
                                        });
                                        return sections.filter((s) => s.rows.length > 0);
                                    })();

                                    return (
                                        <div className="space-y-8">
                                            {!isMemoView && (isOldView ? oldDocCanView : basicDetailsLiveCanView) && basicDetailsRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">Basic Details</h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Type</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Expiry Date</th>
                                                                <th className="w-0 min-w-[7rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:basic`, basicPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {basicPagination.pagedRows.map((row, i) => (
                                                                <tr
                                                                    key={`basic-${i}`}
                                                                    className={`group transition-colors ${
                                                                        getExpiryVisualState(row.expiryDate).tag === 'Expired'
                                                                            ? 'bg-red-50/70 hover:bg-red-100/70'
                                                                            : 'hover:bg-blue-50/30'
                                                                    }`}
                                                                >
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                        <div className="flex items-center gap-2">
                                                                            {row.documentType}
                                                                            {row.isQueued && (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                                                                    title="waiting for hr approval"
                                                                                >
                                                                                    !
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {row.documentNumber ? (
                                                                            <div className="text-[11px] text-gray-400 font-medium">{row.documentNumber}</div>
                                                                        ) : null}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.description || '-'}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className={`px-6 py-3 text-sm ${getExpiryVisualState(row.expiryDate).className}`}>{formatDate(row.expiryDate)}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onRenew: row.onRenew,
                                                                            onNotRenew: row.onNotRenew,
                                                                            onDelete: row.onDelete,
                                                                            pendingTarget: row.notRenewPendingTarget,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:basic`, basicPagination)}
                                                </div>
                                            )}

                                            {!isMemoView && !isOldView && (isAdmin() || companyPerms.moa.view) && moaRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">MOA</h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">MOA Version</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                                                                <th className="w-0 min-w-[7rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:moa`, moaPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {moaPagination.pagedRows.map((row, i) => (
                                                                <tr key={`moa-${i}`} className="group hover:bg-blue-50/30 transition-colors">
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                        <div className="flex items-center gap-2">
                                                                            {row.documentType || '—'}
                                                                            {row.isQueued && (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                                                                    title="waiting for hr approval"
                                                                                >
                                                                                    !
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate" title={row.description || ''}>{row.description || '—'}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onDelete: row.onDelete,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:moa`, moaPagination)}
                                                </div>
                                            )}

                                            {!isMemoView && (isOldView ? oldDocCanView : ownerInfoCanView) && ownerCards.length > 0 && (
                                                <div className="rounded-xl border border-gray-100 shadow-sm bg-white p-6 space-y-5">
                                                    <h4 className="text-base font-bold text-gray-800">Owner Details</h4>
                                                    {ownerCards.map((ownerCard, i) => (
                                                        <div key={`owner-card-${i}`} className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                                                            {(() => {
                                                                const ownerSectionKey = `company:${docStatusTab}:owner:${ownerCard.ownerName}:${i}`;
                                                                const ownerPagination = getSectionPagination(ownerSectionKey, ownerCard.docs || []);
                                                                return (
                                                                    <>
                                                            <h5 className="px-6 py-4 text-sm font-bold text-gray-800 border-b border-gray-100">
                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                    <span>{ownerCard.ownerName}</span>
                                                                    {isOldView ? (
                                                                        isAdmin() && ownerCard.onDelete ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); ownerCard.onDelete(); }}
                                                                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                                title="Permanently delete this archived owner record"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        ) : null
                                                                    ) : (
                                                                        isAdmin() && ownerCard.onDelete && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); ownerCard.onDelete(); }}
                                                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                title="Delete Owner (Admin Only)"
                                                                            >
                                                                                <Trash2 size={18} />
                                                                            </button>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </h5>
                                                            <table className="w-full text-left">
                                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                                    <tr>
                                                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Type</th>
                                                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Expiry Date</th>
                                                                        <th className="w-0 min-w-[3rem] px-3 py-3" scope="col">
                                                                            {renderSectionExpandToggle(ownerSectionKey, ownerPagination)}
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50">
                                                                    {ownerPagination.totalRows > 0 ? ownerPagination.pagedRows.map((row, idx) => (
                                                                        <tr
                                                                            key={`owner-doc-${i}-${idx}`}
                                                                            className={`group transition-colors ${
                                                                                isOldView ? 'bg-white hover:bg-gray-50' : (getExpiryVisualState(row.expiryDate).tag === 'Expired'
                                                                                    ? 'bg-red-50/70 hover:bg-red-100/70'
                                                                                    : 'hover:bg-blue-50/30'
                                                                                )
                                                                            }`}
                                                                        >
                                                                            <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                                <div className="flex items-center gap-2">
                                                                                    {row.documentType}
                                                                                    {row.isQueued && (
                                                                                        <span
                                                                                            className={`inline-flex items-center justify-center w-4 h-4 ${isOldView ? 'bg-gray-200 text-gray-700' : 'bg-red-500 text-white'} text-[10px] font-bold rounded-full cursor-help animate-pulse`}
                                                                                            title="waiting for hr approval"
                                                                                        >
                                                                                            !
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                            <td className={`px-6 py-3 text-sm ${getExpiryVisualState(row.expiryDate).className}`}>{formatDate(row.expiryDate)}</td>
                                                                            <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                                {docRowActions({
                                                                                    onView:
                                                                                        row.attachment &&
                                                                                        (isOldView
                                                                                            ? oldDocCanDownload
                                                                                            : row.ownerDocKey
                                                                                              ? canDownloadOwnerDocByKey(row.ownerDocKey)
                                                                                              : isAdmin() || companyPerms.ownerInfo.download)
                                                                                            ? () =>
                                                                                                  openAttachment(
                                                                                                      { attachment: row.attachment, type: row.documentType },
                                                                                                      row.documentType
                                                                                                  )
                                                                                            : null,
                                                                                    onEdit:
                                                                                        isOldView
                                                                                            ? null
                                                                                            : typeof row.ownerIndex === 'number' &&
                                                                                              row.ownerDocKey &&
                                                                                              canEditOwnerDocByKey(row.ownerDocKey)
                                                                                              ? () => openOwnerDocModal(row.ownerDocKey, row.ownerIndex, false)
                                                                                              : null,
                                                                                    onRenew:
                                                                                        isOldView
                                                                                            ? null
                                                                                            : typeof row.ownerIndex === 'number' &&
                                                                                              row.ownerDocKey &&
                                                                                              canEditOwnerDocByKey(row.ownerDocKey)
                                                                                              ? () => openOwnerDocModal(row.ownerDocKey, row.ownerIndex, true)
                                                                                              : null,
                                                                                    onNotRenew:
                                                                                        isOldView
                                                                                            ? null
                                                                                            : typeof row.ownerIndex === 'number' &&
                                                                                              row.ownerDocKey &&
                                                                                              canEditOwnerDocByKey(row.ownerDocKey)
                                                                                              ? () =>
                                                                                                    setNotRenewData({
                                                                                                        kind: 'ownerDoc',
                                                                                                        ownerIndex: row.ownerIndex,
                                                                                                        ownerProfileId: row.ownerProfileId || '',
                                                                                                        docKey: row.ownerDocKey,
                                                                                                        label: row.documentType,
                                                                                                    })
                                                                                              : null,
                                                                                    onDelete: (() => {
                                                                                        if (isOldView) {
                                                                                            if (!isAdmin()) return null;
                                                                                            if (typeof row.onDelete === 'function') return row.onDelete;
                                                                                            if (
                                                                                                row.isArchivedOldOwner &&
                                                                                                typeof row.ownerIndex === 'number' &&
                                                                                                row.ownerDocKey
                                                                                            ) {
                                                                                                return () =>
                                                                                                    handleDeleteOldOwnerDocumentCard(row.ownerDocKey, row.ownerIndex);
                                                                                            }
                                                                                            return null;
                                                                                        }
                                                                                        if (typeof row.onDelete === 'function') return row.onDelete;
                                                                                        if (
                                                                                            typeof row.ownerIndex === 'number' &&
                                                                                            row.ownerDocKey &&
                                                                                            canDeleteOwnerDocByKey(row.ownerDocKey)
                                                                                        ) {
                                                                                            return () => {
                                                                                                setActiveOwnerTabIndex(row.ownerIndex);
                                                                                                handleDeleteOwnerDocumentCard(row.ownerDocKey, row.ownerIndex);
                                                                                            };
                                                                                        }
                                                                                        return null;
                                                                                    })(),
                                                                                    pendingTarget: row.notRenewPendingTarget,
                                                                                })}
                                                                            </td>
                                                                        </tr>
                                                                    )) : (
                                                                        <tr>
                                                                            <td className="px-6 py-4 text-sm text-gray-500 italic" colSpan={4}>
                                                                                No owner documents available for this owner.
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                            {renderSectionControls(ownerSectionKey, ownerPagination)}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {!isMemoView && (isOldView ? oldDocCanView : (isAdmin() || companyPerms.docLiveWithExpiry.view)) && documentWithExpiryRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">Document With Expiry</h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Type</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Description</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Expiry Date</th>
                                                                <th className="w-0 min-w-[7rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:withExpiry`, expiryPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {expiryPagination.pagedRows.map((row, i) => (
                                                                <tr
                                                                    key={`with-exp-${i}`}
                                                                    className={`group transition-colors ${
                                                                        getExpiryVisualState(row.expiryDate).tag === 'Expired'
                                                                            ? 'bg-red-50/70 hover:bg-red-100/70'
                                                                            : 'hover:bg-blue-50/30'
                                                                    }`}
                                                                >
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                        <div className="flex items-center gap-2">
                                                                            {row.documentType}
                                                                            {row.isQueued && (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                                                                    title="waiting for hr approval"
                                                                                >
                                                                                    !
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.description || '—'}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className={`px-6 py-3 text-sm ${getExpiryVisualState(row.expiryDate).className}`}>{formatDate(row.expiryDate)}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onRenew: row.onRenew,
                                                                            onNotRenew: row.onNotRenew,
                                                                            onDelete: row.onDelete,
                                                                            pendingTarget: row.notRenewPendingTarget,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:withExpiry`, expiryPagination)}
                                                </div>
                                            )}

                                            {!isMemoView && !isOldView && (isAdmin() || companyPerms.docLiveWithoutExpiry.view) && documentWithoutExpiryRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <h4 className="px-6 py-4 text-base font-bold text-gray-800 border-b border-gray-100">Document Without Expiry</h4>
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 border-b border-gray-100">
                                                            <tr>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Type</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Description</th>
                                                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                <th className="w-0 min-w-[5rem] px-3 py-3" scope="col">
                                                                    {renderSectionExpandToggle(`company:${docStatusTab}:withoutExpiry`, noExpiryPagination)}
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {noExpiryPagination.pagedRows.map((row, i) => (
                                                                <tr key={`without-exp-${i}`} className="group hover:bg-blue-50/30 transition-colors">
                                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                        <div className="flex items-center gap-2">
                                                                            {row.documentType}
                                                                            {row.isQueued && (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full cursor-help animate-pulse"
                                                                                    title="waiting for hr approval"
                                                                                >
                                                                                    !
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{row.description || '-'}</td>
                                                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                    <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                        {docRowActions({
                                                                            onView: row.onView,
                                                                            onEdit: row.onEdit,
                                                                            onRenew: null,
                                                                            onNotRenew: row.onNotRenew,
                                                                            onDelete: row.onDelete,
                                                                            pendingTarget: row.notRenewPendingTarget,
                                                                        })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {renderSectionControls(`company:${docStatusTab}:withoutExpiry`, noExpiryPagination)}
                                                </div>
                                            )}

                                            {isMemoView && (isAdmin() || companyPerms.memo.view) && memoRows.length > 0 && (
                                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                        <h4 className="text-base font-bold text-gray-800">Memo</h4>
                                                        <div className="flex flex-wrap items-center gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <label
                                                                    htmlFor="memo-category-filter"
                                                                    className="text-sm font-semibold text-gray-600 whitespace-nowrap"
                                                                >
                                                                    Category
                                                                </label>
                                                                <select
                                                                    id="memo-category-filter"
                                                                    value={memoCategoryFilter}
                                                                    onChange={(e) => setMemoCategoryFilter(e.target.value)}
                                                                    className="min-w-[10rem] max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                                >
                                                                    <option value="">All categories</option>
                                                                    {memoCategoryOptions.map((c) => (
                                                                        <option key={c} value={c}>
                                                                            {c}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <label
                                                                    htmlFor="memo-issue-date-range"
                                                                    className="text-sm font-semibold text-gray-600 whitespace-nowrap"
                                                                >
                                                                    Issue date
                                                                </label>
                                                                <DateRangePicker
                                                                    id="memo-issue-date-range"
                                                                    startValue={memoIssueRangeFrom}
                                                                    endValue={memoIssueRangeTo}
                                                                    onStartChange={setMemoIssueRangeFrom}
                                                                    onEndChange={setMemoIssueRangeTo}
                                                                    placeholder="Select issue date range"
                                                                />
                                                                {memoRangeActive ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setMemoIssueRangeFrom('');
                                                                            setMemoIssueRangeTo('');
                                                                        }}
                                                                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                                                                    >
                                                                        Clear
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {memoSections.length === 0 ? (
                                                        <div className="px-6 py-12 text-center text-sm text-gray-500 bg-white">
                                                            No memos match the selected category or issue date range.
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-gray-100">
                                                            {memoSections.map((section) => {
                                                                const sectionPagination = getSectionPagination(
                                                                    `company:${docStatusTab}:memo:${section.id}`,
                                                                    section.rows,
                                                                );
                                                                return (
                                                                    <div key={section.id}>
                                                                        <div className="bg-gray-50/50 px-6 py-2 border-y border-gray-100">
                                                                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                                                                {section.label}
                                                                            </span>
                                                                        </div>
                                                                        <table className="w-full text-left">
                                                                            <thead className="bg-white border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Document Name</th>
                                                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                                                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Issue Date</th>
                                                                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Category</th>
                                                                                    <th className="w-0 min-w-[5rem] px-3 py-3" scope="col">
                                                                                        {renderSectionExpandToggle(
                                                                                            `company:${docStatusTab}:memo:${section.id}`,
                                                                                            sectionPagination,
                                                                                        )}
                                                                                    </th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {sectionPagination.pagedRows.map((row, i) => (
                                                                                    <tr key={row.rowKey || `memo-${section.id}-${i}`} className="group hover:bg-blue-50/30 transition-colors">
                                                                                        <td className="px-6 py-3 text-sm font-semibold text-gray-700">{row.documentType}</td>
                                                                                        <td className="px-6 py-3 text-sm text-gray-600 max-w-md truncate" title={row.description || ''}>{row.description || '—'}</td>
                                                                                        <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.issueDate)}</td>
                                                                                        <td className="px-6 py-3 text-sm text-gray-600">{row.category || section.label}</td>
                                                                                        <td className="px-3 py-3 text-sm text-right align-middle whitespace-nowrap">
                                                                                            {docRowActions({
                                                                                                onView: row.onView,
                                                                                                onEdit: row.onEdit,
                                                                                                onDelete: row.onDelete,
                                                                                            })}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                        {renderSectionControls(
                                                                            `company:${docStatusTab}:memo:${section.id}`,
                                                                            sectionPagination,
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {docStatusTab === 'certificate' && (isAdmin() || companyPerms.certificate.view) && (
                                                <div className="rounded-xl border border-gray-100 shadow-sm bg-white">
                                                    <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                        <h4 className="text-base font-bold text-gray-800">Certificates</h4>
                                                        <div className="flex flex-wrap items-center gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <label htmlFor="certificate-type-filter" className="text-sm font-semibold text-gray-600 whitespace-nowrap">
                                                                    Type
                                                                </label>
                                                                <select
                                                                    id="certificate-type-filter"
                                                                    value={certificateTypeFilter}
                                                                    onChange={(e) => setCertificateTypeFilter(e.target.value)}
                                                                    className="min-w-[10rem] max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                                >
                                                                    <option value="">All types</option>
                                                                    {CERTIFICATE_TYPE_OPTIONS.map((t) => (
                                                                        <option key={t} value={t}>
                                                                            {t}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <label htmlFor="certificate-issued-to-filter" className="text-sm font-semibold text-gray-600 whitespace-nowrap">
                                                                    Issued to
                                                                </label>
                                                                <select
                                                                    id="certificate-issued-to-filter"
                                                                    value={certificateIssuedToFilter}
                                                                    onChange={(e) => setCertificateIssuedToFilter(e.target.value)}
                                                                    className="min-w-[12rem] max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                                >
                                                                    {certificateIssuedToOptions.map((opt) => (
                                                                        <option key={opt.value || '__all__'} value={opt.value}>
                                                                            {opt.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {certificateSections.length > 0 ? (
                                                        <div className="divide-y divide-gray-100">
                                                            {certificateSections.map((section) => (
                                                                <div key={section.id} className="p-0">
                                                                    <div className="bg-gray-50/50 px-6 py-2 border-y border-gray-100">
                                                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                                                            {section.label}
                                                                        </span>
                                                                    </div>
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-left">
                                                                            <thead className="bg-white border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="px-6 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-tight w-12">No</th>
                                                                                    <th className="px-6 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-tight">Type</th>
                                                                                    <th className="px-6 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-tight">Issued By</th>
                                                                                    <th className="px-6 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-tight">Description</th>
                                                                                    <th className="px-6 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-tight">Issued To</th>
                                                                                    <th className="px-6 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-tight">Expiry</th>
                                                                                    <th className="px-6 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-tight text-right">Control</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {section.rows.map((row) => (
                                                                                    <tr
                                                                                        key={row.rowKey}
                                                                                        className={`group transition-colors ${
                                                                                            row.expiryDate && getExpiryVisualState(row.expiryDate).tag === 'Expired'
                                                                                                ? 'bg-red-50/70 hover:bg-red-100/70'
                                                                                                : 'hover:bg-blue-50/30'
                                                                                        }`}
                                                                                    >
                                                                                        <td className="px-6 py-3 text-sm text-gray-500 font-medium">{row.certNo}</td>
                                                                                        <td className="px-6 py-3 text-sm font-semibold text-gray-700">{row.documentType}</td>
                                                                                        <td className="px-6 py-3 text-sm text-gray-600">{row.issuedBy}</td>
                                                                                        <td className="px-6 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={row.userDescription}>{row.userDescription}</td>
                                                                                        <td className="px-6 py-3 text-sm text-gray-600 font-medium">{row.issuedTo}</td>
                                                                                        <td className={`px-6 py-3 text-sm ${row.expiryDate ? getExpiryVisualState(row.expiryDate).className : 'text-gray-400'}`}>
                                                                                            {row.expiryDate ? formatDate(row.expiryDate) : '—'}
                                                                                        </td>
                                                                                        <td className="px-6 py-3 text-sm text-right whitespace-nowrap">
                                                                                            {docRowActions({
                                                                                                onView: row.onView,
                                                                                                onEdit: row.onEdit,
                                                                                                onDelete: row.onDelete,
                                                                                            })}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="px-6 py-12 text-center text-gray-400 italic bg-white rounded-b-xl">
                                                            {certificateRows.length > 0 && (certificateFilterNorm || certificateTypeFilter)
                                                                ? 'No certificates match the selected type or issued-to filter.'
                                                                : 'No certificates added yet.'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    );

                                })()}

                            </div>

                        )}







                    </div>

                </div>



                {/* Modal Overlay */}

                {modalType && (

                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">

                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                            {/* Modal Header */}

                            <div className={`px-8 py-6 border-b border-gray-100 flex items-center ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense'].includes(modalType) ? 'justify-center relative' : 'justify-between'} flex-shrink-0`}>

                                <div className={`flex flex-col ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense'].includes(modalType) ? 'items-center' : ''}`}>

                                    <h3 className="font-semibold text-xl text-gray-800 tracking-tight">

                                        {modalType === 'basicDetails' ? 'Edit Basic Details' :

                                            modalType === 'companyAddress'
                                                ? (companyAddressFilled ? 'Edit Company Address' : 'Add Company Address')
                                                :

                                            modalType === 'tradeLicense' ? 'Trade License Details' :

                                                modalType === 'selectEmployeeForOwner' ? 'Pick Existing Owner' :

                                                modalType === 'ownerVisaTypeSelection' ? 'Add Visa' :

                                                modalType === 'establishmentCard' ? 'Establishment Card Details' :

                                                    modalType === 'ownerPassport' ? 'Passport Details' :

                                                        modalType === 'ownerVisa' ? 'Visa Requirements' :

                                                            modalType === 'ownerEmiratesId' ? 'Owner Emirates ID' :

                                                                modalType === 'ownerMedical' ? 'Medical Insurance' :

                                                                    modalType === 'ownerDrivingLicense' ? 'Driving License' :

                                                                        modalType === 'ownerDetails' ? 'Owner Basic Details' :

                                                                            modalType === 'companyDocument'
                                                                                ? (modalData.context === 'moa'
                                                                                    ? (editingIndex !== null ? 'Edit MOA' : 'Add MOA')
                                                                                    : (isRenewalModal
                                                                                        ? 'Renew Document'
                                                                                        : (editingIndex !== null
                                                                                            ? 'Edit Document'
                                                                                            : 'Add Document')))
                                                                                :

                                                                                modalType === 'addEjari' ? (modalData.type ? `Add ${modalData.type}` : 'Add Ejari Record') :

                                                                                    modalType === 'addInsurance' ? `Add ${modalData.type || 'Insurance'} Policy` :

                                                                                        modalType === 'addNewCategory' ? 'Add New Category' :

                                                                                            modalType === 'ownerLabourCard' ? 'Labour Card' :
                                                                                                modalType === 'ownerVisa' ? (OWNER_VISA_LABELS[modalData?.visaDocKey] || 'Visa') :
                                                                                                modalType === 'addMemo' ? (editingIndex !== null ? 'Edit Memo' : 'Add Memo') :
                                                                                                    modalType === 'assignEmployee' ? `Assign ${selectedCategory?.toUpperCase() || ''} Responsibility` : ''}

                                    </h3>

                                    {modalType === 'ownerVisaTypeSelection' && (
                                        <p className="text-xs font-semibold text-gray-400">
                                            Choose the visa type to add
                                        </p>
                                    )}

                                    {modalType === 'ownerVisa' && (

                                        <p className="text-xs font-semibold text-gray-400">
                                            {OWNER_VISA_LABELS[modalData?.visaDocKey] || 'Visa'} details
                                        </p>

                                    )}

                                    {modalType === 'ownerLabourCard' && isRenewalModal && (
                                        <p className="text-xs font-semibold text-gray-400">
                                            Renew labour card
                                        </p>
                                    )}

                                    {modalType === 'ownerMedical' && isRenewalModal && (
                                        <p className="text-xs font-semibold text-gray-400">
                                            Renew medical insurance
                                        </p>
                                    )}

                                    {modalType === 'ownerDrivingLicense' && isRenewalModal && (
                                        <p className="text-xs font-semibold text-gray-400">
                                            Renew driving license
                                        </p>
                                    )}

                                </div>

                                <button
                                    onClick={modalType === 'selectEmployeeForOwner' ? handleTradeLicenseOwnerPickerBack : handleModalClose}
                                    className={`text-gray-400 hover:text-gray-600 transition-colors ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense'].includes(modalType) ? 'absolute right-8' : ''}`}
                                >

                                    <X size={20} />

                                </button>

                            </div>



                            {/* Modal Body */}

                            {modalType !== 'selectEmployeeForOwner' && modalType !== 'ownerVisaTypeSelection' && (
                            <div className="p-8 overflow-y-auto flex-1">

                                <form id="documentForm" onSubmit={handleSave} className="space-y-6">

                                    {modalType === 'basicDetails' && (

                                        <>

                                            {basicDetailsNeedsHrApprovalOnSave && (
                                                <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                                    This company profile is active. Saving will queue your changes for HR approval;
                                                    the Basic Details card will keep showing the current approved values until HR
                                                    approves and applies them.
                                                </p>
                                            )}

                                            {/* Company ID (Read-only) */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">Company ID</label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        value={modalData.companyId}

                                                        disabled

                                                        className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 cursor-not-allowed"

                                                    />

                                                </div>

                                            </div>

                                            {/* Name */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Company Name <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.name}

                                                        onChange={(e) => setModalData({ ...modalData, name: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.name ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                    />

                                                    {modalErrors.name && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.name}</p>}

                                                </div>

                                            </div>



                                            {/* Nick Name */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Nick Name</label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        value={modalData.nickName}

                                                        onChange={(e) => setModalData({ ...modalData, nickName: e.target.value })}

                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"

                                                        placeholder="Shorter name for internal use"

                                                    />

                                                </div>

                                            </div>



                                            {/* Email */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Email <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="email"

                                                        required

                                                        value={modalData.email}

                                                        onChange={(e) => setModalData({ ...modalData, email: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.email ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                    />

                                                    {modalErrors.email && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.email}</p>}

                                                </div>

                                            </div>



                                            {/* Phone */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Contact Number</label>

                                                <div className="w-2/3">

                                                    <PhoneInputField
                                                        defaultCountry="AE"
                                                        value={modalData.phone || ''}
                                                        onChange={(value) =>
                                                            setModalData((prev) => ({
                                                                ...prev,
                                                                phone: value || '',
                                                            }))
                                                        }
                                                        placeholder="Contact Number"
                                                        disabled={false}
                                                        error={modalErrors.phone}
                                                    />

                                                    {modalErrors.phone && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.phone}</p>}

                                                </div>

                                            </div>



                                            {/* Established Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Establishment Date</label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.establishedDate}
                                                        onChange={(date) => setModalData({ ...modalData, establishedDate: date })}
                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.establishedDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                    />
                                                    {modalErrors.establishedDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.establishedDate}</p>}

                                                </div>

                                            </div>



                                            {/* Expiry Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Expiry Date</label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.expiryDate}
                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}
                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                    />
                                                    {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>

                                        </>

                                    )}

                                    {modalType === 'companyAddress' && (
                                        <>
                                            <div className="flex items-start gap-6">
                                                <label className="w-1/3 text-sm font-medium text-gray-500 pt-3">
                                                    Address <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <textarea
                                                        rows={3}
                                                        value={modalData.address || ''}
                                                        onChange={(e) => setModalData({ ...modalData, address: e.target.value })}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.address ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}
                                                        placeholder="Building, Street, Area..."
                                                    />
                                                    {modalErrors.address && (
                                                        <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.address}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-medium text-gray-500">
                                                    Country <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <Select
                                                        styles={companyAddressSelectStyles}
                                                        options={companyCountryOptions}
                                                        value={companyCountryOptions.find((o) => o.value === modalData.country) || null}
                                                        onChange={(opt) =>
                                                            setModalData({
                                                                ...modalData,
                                                                country: opt?.value || '',
                                                                state: '',
                                                            })
                                                        }
                                                        placeholder="Select country..."
                                                    />
                                                    {modalErrors.country && (
                                                        <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.country}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-medium text-gray-500">
                                                    State / Emirates <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <Select
                                                        styles={companyAddressSelectStyles}
                                                        options={companyModalStateOptions}
                                                        value={companyModalStateOptions.find((o) => o.value === modalData.state) || null}
                                                        onChange={(opt) => setModalData({ ...modalData, state: opt?.value || '' })}
                                                        isDisabled={!modalData.country}
                                                        placeholder="Select state / emirate..."
                                                    />
                                                    {modalErrors.state && (
                                                        <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.state}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-medium text-gray-500">City</label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        value={modalData.city || ''}
                                                        onChange={(e) => setModalData({ ...modalData, city: e.target.value })}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.city ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}
                                                        placeholder="Optional"
                                                    />
                                                    {modalErrors.city && (
                                                        <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.city}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-medium text-gray-500">PO Box</label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        value={modalData.postalCode || ''}
                                                        onChange={(e) => setModalData({ ...modalData, postalCode: e.target.value })}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.postalCode ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}
                                                        placeholder="Optional"
                                                    />
                                                    {modalErrors.postalCode && (
                                                        <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.postalCode}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {modalType === 'addMemo' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Document Name <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        required
                                                        value={modalData.type || ''}
                                                        onChange={(e) => setModalData({
                                                            ...modalData,
                                                            type: memoTextWhileTyping(e.target.value, 200),
                                                        })}
                                                        onBlur={(e) => setModalData({
                                                            ...modalData,
                                                            type: normalizeMemoDocumentName(e.target.value),
                                                        })}
                                                        maxLength={200}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.type ? 'border-red-500' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                                        placeholder="Document name"
                                                    />
                                                    {modalErrors.type && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase">{modalErrors.type}</p>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Issue Date <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <DatePicker
                                                        maxDate={new Date()}
                                                        placeholder="dd/mm/yyyy"
                                                        value={modalData.issueDate || ''}
                                                        onChange={(date) => setModalData({ ...modalData, issueDate: date })}
                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                                    />
                                                    {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase">{modalErrors.issueDate}</p>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Category <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <select
                                                        value={modalData.memoCategory || 'General'}
                                                        onChange={(e) => setModalData({
                                                            ...modalData,
                                                            memoCategory: normalizeMemoCategory(e.target.value),
                                                        })}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.memoCategory ? 'border-red-500' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                                    >
                                                        {MEMO_CATEGORY_OPTIONS.map((cat) => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        ))}
                                                    </select>
                                                    {modalErrors.memoCategory && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase">{modalErrors.memoCategory}</p>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Description <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <textarea
                                                        value={modalData.description || ''}
                                                        onChange={(e) => setModalData({
                                                            ...modalData,
                                                            description: memoTextWhileTyping(e.target.value, 4000),
                                                        })}
                                                        onBlur={(e) => setModalData({
                                                            ...modalData,
                                                            description: normalizeMemoDescription(e.target.value),
                                                        })}
                                                        maxLength={4000}
                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.description ? 'border-red-500' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-h-[120px]`}
                                                        placeholder="Enter memo description (minimum 10 characters)"
                                                    />
                                                    {modalErrors.description && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase">{modalErrors.description}</p>}
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100">
                                                <label className="text-sm font-bold text-gray-500 mb-3 block">Attachment <span className="text-red-500">*</span></label>
                                                {modalData.attachment ? (
                                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                        <span className="text-sm font-medium text-blue-700 truncate">{modalData.fileName || 'File Attached'}</span>
                                                        <button type="button" onClick={() => setModalData({ ...modalData, attachment: null, fileName: '' })} className="text-blue-500 hover:text-blue-700"><X size={16} /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className={`w-full flex items-center justify-center gap-2 p-8 border-2 border-dashed ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'} rounded-xl transition-all group`}
                                                    >
                                                        <Upload size={18} className="text-gray-400 group-hover:text-blue-500" />
                                                        <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">Upload PDF (max 10MB)</span>
                                                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,application/pdf" />
                                                    </button>
                                                )}
                                                {modalErrors.attachment && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase text-center">{modalErrors.attachment}</p>}
                                            </div>
                                        </div>
                                    )}

                                    {modalType === 'establishmentCard' && (

                                        <div className="space-y-6">

                                            {establishmentNeedsHrApprovalOnSave && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                    This company profile is active. Your changes will be submitted for HR
                                                    approval before they apply.
                                                </div>
                                            )}

                                            {/* Card Number */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    Card Number <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.number}

                                                        onChange={(e) =>
                                                            setModalData({
                                                                ...modalData,
                                                                number: e.target.value.toUpperCase(),
                                                            })
                                                        }

                                                        readOnly={isRenewalModal}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.number ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 ${isRenewalModal ? 'opacity-80 cursor-not-allowed' : ''}`}

                                                        placeholder="e.g. AB12-3456"

                                                        maxLength={30}

                                                    />

                                                    {modalErrors.number && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.number}</p>}

                                                    {isRenewalModal ? (
                                                        <p className="text-[11px] text-gray-500 mt-1">
                                                            Previous card number is kept for renewal.
                                                        </p>
                                                    ) : null}

                                                </div>

                                            </div>







                                            {/* Expiry Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    Expiry Date <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.expiryDate}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        disabledDays={{ before: establishmentExpiryMinDate }}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}
                                                    {!modalErrors.expiryDate && modalData.expiryDate && getExpiryVisualState(modalData.expiryDate).tag ? (
                                                        <p className={`text-[11px] font-semibold mt-1 ${getExpiryVisualState(modalData.expiryDate).className}`}>
                                                            {getExpiryVisualState(modalData.expiryDate).tag === 'Expired'
                                                                ? 'This date is expired'
                                                                : `Warning: ${getExpiryVisualState(modalData.expiryDate).tag}`}
                                                        </p>
                                                    ) : null}

                                                </div>

                                            </div>



                                            {/* Attachment */}

                                            <div className="pt-4 border-t border-gray-100">

                                                <div className="flex items-center justify-between mb-3">

                                                    <label className="text-sm font-bold text-gray-500">
                                                        Attachment <span className="text-red-500">*</span>
                                                    </label>

                                                    <span className="text-[10px] text-gray-400 font-medium">PDF only — max 5MB</span>

                                                </div>

                                                {modalData.attachment ? (

                                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">

                                                        <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">
                                                            {modalData.fileName || 'Document Attached'}
                                                        </span>

                                                        {canAlterEstablishmentAttachment ? (
                                                        <button

                                                            type="button"

                                                            onClick={() =>
                                                                setModalData({
                                                                    ...modalData,
                                                                    attachment: null,
                                                                    publicId: null,
                                                                    fileName: '',
                                                                })
                                                            }

                                                            className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-100 rounded-full transition-colors"

                                                            title="Remove attachment"

                                                        >

                                                            <X size={16} />

                                                        </button>
                                                        ) : null}

                                                    </div>

                                                ) : (

                                                    <>

                                                        <button

                                                            type="button"

                                                            onClick={() => fileInputRef.current?.click()}

                                                            className={`w-full flex items-center justify-center gap-2 p-8 border-2 border-dashed ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'} rounded-xl transition-all group`}

                                                        >

                                                            <div className={`w-10 h-10 ${modalErrors.attachment ? 'bg-red-50' : 'bg-gray-50'} rounded-full flex items-center justify-center group-hover:scale-110 transition-transform`}>

                                                                <Upload size={18} className={`${modalErrors.attachment ? 'text-red-400' : 'text-gray-400 group-hover:text-blue-500'}`} />

                                                            </div>

                                                            <span className={`text-sm font-medium ${modalErrors.attachment ? 'text-red-500' : 'text-gray-500 group-hover:text-blue-600'}`}>Upload Establishment Card</span>

                                                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,application/pdf" />

                                                        </button>

                                                        {modalErrors.attachment && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight text-center">{modalErrors.attachment}</p>}

                                                    </>

                                                )}

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'tradeLicense' && (

                                        <div className="space-y-6">

                                            {tradeLicenseNeedsHrApprovalOnSave && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                    This company profile is active. Your changes will be submitted for HR
                                                    approval before they apply.
                                                </div>
                                            )}

                                            {/* License Number */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    License Number <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.number}

                                                        onChange={(e) =>
                                                            setModalData({
                                                                ...modalData,
                                                                number: normalizeTradeLicenseNumber(e.target.value),
                                                            })
                                                        }

                                                        readOnly={isRenewalModal}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.number ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 ${isRenewalModal ? 'opacity-80 cursor-not-allowed' : ''}`}

                                                        placeholder="e.g. AB12-3456"

                                                        maxLength={30}

                                                    />

                                                    {modalErrors.number && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.number}</p>}

                                                    {isRenewalModal ? (
                                                        <p className="text-[11px] text-gray-500 mt-1">
                                                            License number stays the same when renewing.
                                                        </p>
                                                    ) : null}

                                                </div>

                                            </div>



                                            {/* Issue Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    Issue Date <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.issueDate}

                                                        onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                        disabledDays={{ after: new Date(), before: new Date(1900, 0, 1) }}

                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                    />

                                                    {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.issueDate}</p>}

                                                </div>

                                            </div>



                                            {/* Expiry Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500">

                                                    Expiry Date <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        value={modalData.expiryDate}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        disabledDays={{
                                                            before: modalData.issueDate
                                                                ? new Date(
                                                                      Math.max(
                                                                          new Date(modalData.issueDate).getTime() + 86400000,
                                                                          new Date(new Date().setHours(0, 0, 0, 0)).getTime(),
                                                                      ),
                                                                  )
                                                                : new Date(new Date().setHours(0, 0, 0, 0)),
                                                        }}

                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>



                                            {/* Owners Section */}

                                            <div className="space-y-4 pt-4 border-t border-gray-100">

                                                <div className="flex items-center justify-between">

                                                    <div className="flex flex-col">

                                                        <label className="text-sm font-bold text-gray-500">Owners</label>

                                                        {isCompanyProfileActivated && (
                                                            <p className="text-[10px] text-gray-400 font-bold italic mt-1">
                                                                For an active company, owner changes are queued for HR activation approval before they apply.
                                                            </p>
                                                        )}
                                                        {(modalData.owners || []).length > 1 ? (
                                                            <p className="text-[10px] text-gray-400 font-medium mt-1">
                                                                Changing a share adjusts owners listed below only.
                                                            </p>
                                                        ) : null}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                await fetchOwnersCatalog();
                                                                setModalType('selectEmployeeForOwner');
                                                                const selectedIds = new Set(
                                                                    (modalData.owners || []).map((o) => resolveOwnerProfileId(o)),
                                                                );
                                                                const owners = getUniqueOwners().filter(
                                                                    (o) => !selectedIds.has(resolveOwnerProfileId(o)),
                                                                );
                                                                setModalData({ ...modalData, filteredOwners: owners, allOwners: owners });
                                                            }}
                                                            className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                                                        >
                                                            + Add Existing
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddOwner}
                                                            className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                                        >
                                                            + Add New Owner
                                                        </button>
                                                    </div>

                                                </div>

                                                <div className="space-y-3">

                                                    {(modalData.owners || []).length === 0 ? (
                                                        <div className="py-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                            <p className="text-sm text-gray-500 font-medium">
                                                                No owners added yet. Use &quot;Add Existing&quot; or &quot;Add New Owner&quot;.
                                                            </p>
                                                        </div>
                                                    ) : null}

                                                    {modalErrors.owners && (
                                                        <p className="text-[11px] text-red-500 font-bold uppercase">{modalErrors.owners}</p>
                                                    )}
                                                    {modalErrors.ownersTotal && (
                                                        <p className="text-[11px] text-red-500 font-bold uppercase">{modalErrors.ownersTotal}</p>
                                                    )}

                                                    {modalData.owners?.map((owner, index) => (

                                                        <div key={index} className="flex gap-2 items-end">

                                                            <div className="flex-1">

                                                                <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">

                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                                                        Owner Name
                                                                        {owner.ownerProfileId ? (
                                                                            <span className="ml-2 text-blue-500 normal-case">ID: {owner.ownerProfileId}</span>
                                                                        ) : null}
                                                                    </label>

                                                                    <input

                                                                        type="text"

                                                                        placeholder="Enter name"

                                                                        value={owner.name}

                                                                        readOnly={owner.isExisting === true}

                                                                        onChange={(e) => handleOwnerChange(index, "name", e.target.value)}

                                                                        className={`w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold mt-0.5 text-gray-900 ${owner.isExisting ? 'cursor-default' : ''}`}

                                                                    />

                                                                    {modalErrors[`owner_${index}_name`] && (
                                                                        <p className="text-[10px] text-red-500 font-bold mt-1">{modalErrors[`owner_${index}_name`]}</p>
                                                                    )}

                                                                </div>

                                                            </div>

                                                            <div className="w-24">

                                                                <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">

                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter text-center block">Share %</label>

                                                                    <div className="relative mt-0.5">

                                                                        <input

                                                                            type="number"

                                                                            step="0.01"

                                                                            min="0.01"

                                                                            max="100"

                                                                            placeholder="0"

                                                                            value={owner.sharePercentage}

                                                                            onChange={(e) => handleOwnerChange(index, "sharePercentage", e.target.value)}

                                                                            className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-black text-center text-blue-600"

                                                                        />

                                                                        <span className="absolute right-[-4px] top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">%</span>

                                                                    </div>

                                                                    {modalErrors[`owner_${index}_share`] && (
                                                                        <p className="text-[9px] text-red-500 font-bold mt-1 text-center">{modalErrors[`owner_${index}_share`]}</p>
                                                                    )}

                                                                </div>

                                                            </div>

                                                            <div className="pb-1 shrink-0">

                                                                <button

                                                                    type="button"

                                                                    onClick={() => handleRemoveOwner(index)}

                                                                    className="w-12 h-14 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"

                                                                    title="Delete Owner"

                                                                >

                                                                    <Trash2 size={18} />

                                                                </button>

                                                            </div>

                                                        </div>

                                                    ))}

                                                </div>

                                            </div>



                                            {/* Attachment */}

                                            <div className="pt-4 border-t border-gray-100">

                                                <div className="flex items-center justify-between mb-3">

                                                    <label className="text-sm font-bold text-gray-500">
                                                        Attachment <span className="text-red-500">*</span>
                                                    </label>

                                                </div>

                                                {modalData.attachment ? (

                                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">

                                                        <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">Document Attached</span>

                                                        {canAlterTradeLicenseAttachment ? (
                                                        <button

                                                            type="button"

                                                            onClick={() => setModalData({ ...modalData, attachment: null, publicId: null, fileName: '' })}

                                                            className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-100 rounded-full transition-colors"

                                                            title="Remove attachment"

                                                        >

                                                            <X size={16} />

                                                        </button>
                                                        ) : null}

                                                    </div>

                                                ) : (

                                                    <>

                                                        <button

                                                            type="button"

                                                            onClick={() => fileInputRef.current?.click()}

                                                            className={`w-full flex items-center justify-center gap-2 p-8 border-2 border-dashed ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'} rounded-xl transition-all group`}

                                                        >

                                                            <div className={`w-10 h-10 ${modalErrors.attachment ? 'bg-red-50' : 'bg-gray-50'} rounded-full flex items-center justify-center group-hover:scale-110 transition-transform`}>

                                                                <Upload size={18} className={`${modalErrors.attachment ? 'text-red-400' : 'text-gray-400 group-hover:text-blue-500'}`} />

                                                            </div>

                                                            <span className={`text-sm font-medium ${modalErrors.attachment ? 'text-red-500' : 'text-gray-500 group-hover:text-blue-600'}`}>Upload License Document (PDF, max 10MB)</span>

                                                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,application/pdf" />

                                                        </button>

                                                        {modalErrors.attachment && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight text-center">{modalErrors.attachment}</p>}

                                                    </>

                                                )}

                                            </div>

                                        </div>

                                    )}





                                    {modalType === 'ownerLabourCard' && (

                                        <div className="space-y-4">

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">
                                                    Labour Card Number <span className="text-red-500">*</span>
                                                </label>

                                                <input

                                                    type="text"

                                                    required

                                                    readOnly={isRenewalModal}

                                                    maxLength={20}

                                                    value={modalData.number || ''}

                                                    onChange={(e) =>
                                                        setModalData({
                                                            ...modalData,
                                                            number: normalizeLabourCardNumber(e.target.value),
                                                        })
                                                    }

                                                    placeholder="e.g. AB12345"

                                                    className={`w-2/3 px-4 py-2.5 bg-gray-50/50 border ${modalErrors.number ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all ${isRenewalModal ? 'opacity-80 cursor-not-allowed' : ''}`}

                                                />

                                                {modalErrors.number && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.number}</p>}

                                            </div>

                                            {isRenewalModal ? (
                                                <p className="text-[11px] text-gray-500 px-1">
                                                    Labour card number stays the same when renewing.
                                                </p>
                                            ) : null}

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        disabledDays={{ before: labourCardExpiryMinDate }}

                                                        value={modalData.expiryDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.expiryDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">

                                                <div className="flex items-center justify-between mb-4">

                                                    <label className="text-sm font-medium text-gray-700">
                                                        Labour Card Document <span className="text-red-500">*</span>
                                                    </label>

                                                    <div className="w-2/3">

                                                        {modalData.attachment ? (

                                                            <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-xl">

                                                                <span className="text-xs font-semibold text-blue-700 truncate max-w-[150px]">Document Attached</span>

                                                                <button type="button" onClick={() => setModalData({ ...modalData, attachment: null, publicId: null })} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>

                                                            </div>

                                                        ) : (

                                                            <>

                                                                <button

                                                                    type="button"

                                                                    onClick={() => fileInputRef.current?.click()}

                                                                    className={`w-full flex items-center border ${modalErrors.attachment ? 'border-red-300' : 'border-gray-100'} bg-gray-50/50 rounded-xl overflow-hidden group`}

                                                                >

                                                                    <span className={`bg-white px-4 py-2.5 ${modalErrors.attachment ? 'text-red-500' : 'text-blue-500'} text-sm font-semibold border-r border-gray-100 hover:bg-gray-50 transition-colors`}>Choose File</span>

                                                                    <span className="px-4 text-xs text-gray-400 truncate flex-1 text-left">No file chosen</span>

                                                                    <input
                                                                        ref={fileInputRef}
                                                                        type="file"
                                                                        className="hidden"
                                                                        onChange={handleFileChange}
                                                                        accept=".pdf,application/pdf"
                                                                    />

                                                                </button>

                                                                {modalErrors.attachment && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase text-right">{modalErrors.attachment}</p>}

                                                                {!modalData.attachment && (
                                                                    <p className="text-[10px] text-gray-400 font-medium mt-1 text-right">
                                                                        PDF only, max 10 MB
                                                                    </p>
                                                                )}

                                                            </>

                                                        )}

                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'ownerMedical' && (

                                        <div className="space-y-4">

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">
                                                    Insurance Provider <span className="text-red-500">*</span>
                                                </label>

                                                <input

                                                    type="text"

                                                    required

                                                    readOnly={isRenewalModal}

                                                    maxLength={100}

                                                    value={modalData.provider || ''}

                                                    onChange={(e) =>
                                                        setModalData({
                                                            ...modalData,
                                                            provider: normalizeMedicalProvider(e.target.value),
                                                        })
                                                    }

                                                    placeholder="e.g. Daman Health"

                                                    className={`w-2/3 px-4 py-2.5 bg-gray-50/50 border ${modalErrors.provider ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all ${isRenewalModal ? 'opacity-80 cursor-not-allowed' : ''}`}

                                                />

                                                {modalErrors.provider && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.provider}</p>}

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">
                                                    Policy Number <span className="text-red-500">*</span>
                                                </label>

                                                <input

                                                    type="text"

                                                    required

                                                    readOnly={isRenewalModal}

                                                    maxLength={30}

                                                    value={modalData.number || ''}

                                                    onChange={(e) =>
                                                        setModalData({
                                                            ...modalData,
                                                            number: normalizeMedicalPolicyNumber(e.target.value),
                                                        })
                                                    }

                                                    placeholder="e.g. POL123456"

                                                    className={`w-2/3 px-4 py-2.5 bg-gray-50/50 border ${modalErrors.number ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all ${isRenewalModal ? 'opacity-80 cursor-not-allowed' : ''}`}

                                                />

                                                {modalErrors.number && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.number}</p>}

                                            </div>

                                            {isRenewalModal ? (
                                                <p className="text-[11px] text-gray-500 px-1">
                                                    Provider and policy number stay the same when renewing.
                                                </p>
                                            ) : null}

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">Issue Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        value={modalData.issueDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.issueDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.issueDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.issueDate}</p>}

                                                </div>

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        disabledDays={
                                                            medicalExpiryMinDate
                                                                ? { before: medicalExpiryMinDate }
                                                                : undefined
                                                        }

                                                        value={modalData.expiryDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.expiryDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">

                                                <div className="flex items-center justify-between mb-4">

                                                    <label className="text-sm font-medium text-gray-700">
                                                        Medical Insurance Document <span className="text-red-500">*</span>
                                                    </label>

                                                    <div className="w-2/3">

                                                        {modalData.attachment ? (

                                                            <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-xl">

                                                                <span className="text-xs font-semibold text-blue-700 truncate max-w-[150px]">Document Attached</span>

                                                                <button type="button" onClick={() => setModalData({ ...modalData, attachment: null, publicId: null })} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>

                                                            </div>

                                                        ) : (

                                                            <>

                                                                <button

                                                                    type="button"

                                                                    onClick={() => fileInputRef.current?.click()}

                                                                    className={`w-full flex items-center border ${modalErrors.attachment ? 'border-red-300' : 'border-gray-100'} bg-gray-50/50 rounded-xl overflow-hidden group`}

                                                                >

                                                                    <span className={`bg-white px-4 py-2.5 ${modalErrors.attachment ? 'text-red-500' : 'text-blue-500'} text-sm font-semibold border-r border-gray-100 hover:bg-gray-50 transition-colors`}>Choose File</span>

                                                                    <span className="px-4 text-xs text-gray-400 truncate flex-1 text-left">No file chosen</span>

                                                                    <input
                                                                        ref={fileInputRef}
                                                                        type="file"
                                                                        className="hidden"
                                                                        onChange={handleFileChange}
                                                                        accept=".pdf,application/pdf"
                                                                    />

                                                                </button>

                                                                {modalErrors.attachment && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase text-right">{modalErrors.attachment}</p>}

                                                                {!modalData.attachment && (
                                                                    <p className="text-[10px] text-gray-400 font-medium mt-1 text-right">
                                                                        PDF only, max 10 MB
                                                                    </p>
                                                                )}

                                                            </>

                                                        )}

                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'ownerDrivingLicense' && (

                                        <div className="space-y-4">

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">
                                                    License Number <span className="text-red-500">*</span>
                                                </label>

                                                <input

                                                    type="text"

                                                    required

                                                    readOnly={isRenewalModal}

                                                    maxLength={20}

                                                    value={modalData.number || ''}

                                                    onChange={(e) =>
                                                        setModalData({
                                                            ...modalData,
                                                            number: normalizeDrivingLicenseNumber(e.target.value),
                                                        })
                                                    }

                                                    placeholder="e.g. AB12345"

                                                    className={`w-2/3 px-4 py-2.5 bg-gray-50/50 border ${modalErrors.number ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all ${isRenewalModal ? 'opacity-80 cursor-not-allowed' : ''}`}

                                                />

                                                {modalErrors.number && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.number}</p>}

                                            </div>

                                            {isRenewalModal ? (
                                                <p className="text-[11px] text-gray-500 px-1">
                                                    License number and issuing country stay the same when renewing.
                                                </p>
                                            ) : null}

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">Issue Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        value={modalData.issueDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.issueDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.issueDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.issueDate}</p>}

                                                </div>

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        disabledDays={
                                                            drivingLicenseExpiryMinDate
                                                                ? { before: drivingLicenseExpiryMinDate }
                                                                : undefined
                                                        }

                                                        value={modalData.expiryDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.expiryDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">
                                                    Issuing Country <span className="text-red-500">*</span>
                                                </label>

                                                <div className="w-2/3">

                                                    <select

                                                        required

                                                        disabled={isRenewalModal}

                                                        value={modalData.issuingCountry || ''}

                                                        onChange={(e) => setModalData({ ...modalData, issuingCountry: e.target.value })}

                                                        className={`w-full px-4 py-2.5 bg-gray-50/50 border ${modalErrors.issuingCountry ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all ${isRenewalModal ? 'opacity-80 cursor-not-allowed' : ''}`}

                                                    >

                                                        <option value="">Select Issuing Country</option>

                                                        {Country.getAllCountries().map((c) => (

                                                            <option key={c.isoCode} value={c.name}>{c.name}</option>

                                                        ))}

                                                    </select>

                                                    {modalErrors.issuingCountry && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.issuingCountry}</p>}

                                                </div>

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">

                                                <div className="flex items-center justify-between mb-4">

                                                    <label className="text-sm font-medium text-gray-700">
                                                        Driving License Document <span className="text-red-500">*</span>
                                                    </label>

                                                    <div className="w-2/3">

                                                        {modalData.attachment ? (

                                                            <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-xl">

                                                                <span className="text-xs font-semibold text-blue-700 truncate max-w-[150px]">Document Attached</span>

                                                                <button type="button" onClick={() => setModalData({ ...modalData, attachment: null, publicId: null })} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>

                                                            </div>

                                                        ) : (

                                                            <>

                                                                <button

                                                                    type="button"

                                                                    onClick={() => fileInputRef.current?.click()}

                                                                    className={`w-full flex items-center border ${modalErrors.attachment ? 'border-red-300' : 'border-gray-100'} bg-gray-50/50 rounded-xl overflow-hidden group`}

                                                                >

                                                                    <span className={`bg-white px-4 py-2.5 ${modalErrors.attachment ? 'text-red-500' : 'text-blue-500'} text-sm font-semibold border-r border-gray-100 hover:bg-gray-50 transition-colors`}>Choose File</span>

                                                                    <span className="px-4 text-xs text-gray-400 truncate flex-1 text-left">No file chosen</span>

                                                                    <input
                                                                        ref={fileInputRef}
                                                                        type="file"
                                                                        className="hidden"
                                                                        onChange={handleFileChange}
                                                                        accept=".pdf,application/pdf"
                                                                    />

                                                                </button>

                                                                {modalErrors.attachment && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase text-right">{modalErrors.attachment}</p>}

                                                                {!modalData.attachment && (
                                                                    <p className="text-[10px] text-gray-400 font-medium mt-1 text-right">
                                                                        PDF only, max 10 MB
                                                                    </p>
                                                                )}

                                                            </>

                                                        )}

                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'ownerEmiratesId' && (

                                        <div className="space-y-4">

                                            {ownerEmiratesIdNeedsHrApprovalOnSave && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                    This company profile is active. Your Emirates ID changes will be submitted for HR
                                                    approval before they apply.
                                                </div>
                                            )}

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">
                                                    Emirates ID Number <span className="text-red-500">*</span>
                                                </label>

                                                <input

                                                    type="text"

                                                    required

                                                    inputMode="numeric"

                                                    maxLength={15}

                                                    value={modalData.number || ''}

                                                    onChange={(e) =>
                                                        setModalData({
                                                            ...modalData,
                                                            number: normalizeEmiratesIdNumber(e.target.value),
                                                        })
                                                    }

                                                    placeholder="784-XXXX-XXXXXXX-X"

                                                    className={`w-2/3 px-4 py-2.5 bg-gray-50/50 border ${modalErrors.number ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                />

                                                {modalErrors.number && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.number}</p>}

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">

                                                <label className="text-sm font-medium text-gray-700">Issue Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        disabledDays={{ after: new Date() }}

                                                        value={modalData.issueDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.issueDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.issueDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.issueDate}</p>}

                                                </div>

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between relative">

                                                <label className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        disabledDays={
                                                            emiratesIdExpiryMinDate
                                                                ? { before: emiratesIdExpiryMinDate }
                                                                : { before: modalData.issueDate || new Date() }
                                                        }

                                                        value={modalData.expiryDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[41px] px-4 py-2.5 bg-gray-50/50 border ${modalErrors.expiryDate ? 'border-red-400 ring-2 ring-red-50' : 'border-gray-100'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase absolute right-5 bottom-0">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>

                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">

                                                <div className="flex items-center justify-between mb-4">

                                                    <label className="text-sm font-medium text-gray-700">
                                                        Emirates ID Document <span className="text-red-500">*</span>
                                                    </label>

                                                    <div className="w-2/3">

                                                        {modalData.attachment ? (

                                                            <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-xl">

                                                                <span className="text-xs font-semibold text-blue-700 truncate max-w-[150px]">Document Attached</span>

                                                                <button type="button" onClick={() => setModalData({ ...modalData, attachment: null, publicId: null })} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>

                                                            </div>

                                                        ) : (

                                                            <>

                                                                <button

                                                                    type="button"

                                                                    onClick={() => fileInputRef.current?.click()}

                                                                    className={`w-full flex items-center border ${modalErrors.attachment ? 'border-red-300' : 'border-gray-100'} bg-gray-50/50 rounded-xl overflow-hidden group`}

                                                                >

                                                                    <span className={`bg-white px-4 py-2.5 ${modalErrors.attachment ? 'text-red-500' : 'text-blue-500'} text-sm font-semibold border-r border-gray-100 hover:bg-gray-50 transition-colors`}>Choose File</span>

                                                                    <span className="px-4 text-xs text-gray-400 truncate flex-1 text-left">No file chosen</span>

                                                                    <input
                                                                        ref={fileInputRef}
                                                                        type="file"
                                                                        className="hidden"
                                                                        onChange={handleFileChange}
                                                                        accept=".pdf,application/pdf"
                                                                    />

                                                                </button>

                                                                {modalErrors.attachment && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase text-right">{modalErrors.attachment}</p>}

                                                                {!modalData.attachment && (
                                                                    <p className="text-[10px] text-gray-400 font-medium mt-1 text-right">
                                                                        PDF only, max 10 MB
                                                                    </p>
                                                                )}

                                                            </>

                                                        )}

                                                    </div>

                                                </div>

                                                <div className="text-center w-full">

                                                    <p className="text-[10px] text-gray-400 font-medium tracking-tight">
                                                        Upload Emirates ID in PDF format only (Max 10MB)
                                                    </p>

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'ownerDetails' && (

                                        <div className="space-y-6">

                                            {ownerDetailsNeedsHrApprovalOnSave && (
                                                <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                                    This company profile is active. Saving will send your changes for HR approval before they are applied.
                                                </p>
                                            )}

                                            {/* Owner Name */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Full Name <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.name}

                                                        onChange={(e) => setModalData({ ...modalData, name: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.name ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder="Enter owner full name"

                                                    />

                                                    {modalErrors.name && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.name}</p>}

                                                </div>

                                            </div>



                                            {/* Email */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Email Address
                                                    {isCompanyActivationComplete ? (
                                                        <span className="text-red-500"> *</span>
                                                    ) : (
                                                        <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>
                                                    )}

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="email"

                                                        value={modalData.email || ''}

                                                        onChange={(e) => setModalData({ ...modalData, email: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.email ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder="office@owner.com"

                                                    />

                                                    {modalErrors.email && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.email}</p>}

                                                </div>

                                            </div>



                                            {/* Contact Number */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Contact Number <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <PhoneInputField

                                                        defaultCountry="AE"

                                                        required

                                                        value={modalData.phone || ''}

                                                        error={modalErrors.phone}

                                                        onChange={(value, meta) => {
                                                            const phoneValue = value || '';
                                                            setModalData((prev) => ({
                                                                ...prev,
                                                                phone: phoneValue,
                                                            }));
                                                            const valid =
                                                                Boolean(phoneValue) &&
                                                                meta?.isValid === true;
                                                            setOwnerDetailsPhoneValid(valid);
                                                            if (valid) {
                                                                setModalErrors((prev) => {
                                                                    if (!prev.phone) return prev;
                                                                    const next = { ...prev };
                                                                    delete next.phone;
                                                                    return next;
                                                                });
                                                            }
                                                        }}

                                                        placeholder="Contact Number"

                                                        disabled={false}

                                                    />

                                                </div>

                                            </div>



                                            {/* Nationality */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Nationality <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <select

                                                        value={modalData.nationality || ''}

                                                        onChange={(e) => setModalData({ ...modalData, nationality: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.nationality ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                    >

                                                        <option value="">Select Nationality</option>

                                                        {Country.getAllCountries().map(c => (

                                                            <option key={c.isoCode} value={c.name}>{c.name}</option>

                                                        ))}

                                                    </select>

                                                    {modalErrors.nationality && (
                                                        <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                            {modalErrors.nationality}
                                                        </p>
                                                    )}

                                                </div>

                                            </div>



                                            {/* Share Percentage */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-wide">

                                                    Share % <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3 relative">

                                                    <input

                                                        type="number"

                                                        required

                                                        min="0.01"

                                                        max="100"

                                                        step="0.01"

                                                        value={modalData.sharePercentage}

                                                        onChange={(e) => setModalData({ ...modalData, sharePercentage: e.target.value })}

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.percentage ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder="e.g. 50"

                                                    />
                                                    {(company?.owners || []).length > 1 ? (
                                                        <p className="text-[10px] text-gray-400 font-medium mt-1">
                                                            Owners listed below will adjust automatically to total 100%.
                                                        </p>
                                                    ) : null}

                                                    {modalErrors.percentage && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.percentage}</p>}

                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {['ownerPassport', 'ownerVisa'].includes(modalType) && (

                                        <div className="space-y-6">

                                            {modalType === 'ownerPassport' && ownerPassportNeedsHrApprovalOnSave && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                    This company profile is active. Your passport changes will be submitted for HR
                                                    approval before they apply.
                                                </div>
                                            )}

                                            {/* Document Number */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">

                                                    {modalType === 'ownerPassport' ? 'Passport Number' : (modalType === 'ownerVisa' ? 'Visa Number' : 'Doc Number')} <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.number || ''}

                                                        onChange={(e) =>
                                                            setModalData({
                                                                ...modalData,
                                                                number:
                                                                    modalType === 'ownerPassport'
                                                                        ? normalizePassportNumber(e.target.value)
                                                                        : modalType === 'ownerVisa'
                                                                          ? normalizeVisaNumber(e.target.value)
                                                                          : e.target.value,
                                                            })
                                                        }

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.number ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                        placeholder={
                                                            modalType === 'ownerPassport'
                                                                ? 'e.g. AB1234567'
                                                                : modalType === 'ownerVisa'
                                                                  ? 'Enter visa number'
                                                                  : 'Enter document number'
                                                        }

                                                    />

                                                    {modalErrors.number && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.number}</p>}

                                                </div>

                                            </div>





                                            {modalType === 'ownerPassport' && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Passport Nationality <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <select

                                                            required

                                                            value={modalData.nationality || ''}

                                                            onChange={(e) => setModalData({ ...modalData, nationality: e.target.value })}

                                                            className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.nationality ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                        >

                                                            <option value="">Select Nationality</option>

                                                            {Country.getAllCountries().map(c => (

                                                                <option key={c.isoCode} value={c.name}>{c.name}</option>

                                                            ))}

                                                        </select>

                                                        {modalErrors.nationality && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.nationality}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {['ownerPassport', 'ownerVisa'].includes(modalType) && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Issue Date <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <DatePicker

                                                            required

                                                            disabledDays={{ after: new Date() }}

                                                            value={modalData.issueDate || ''}

                                                            onChange={(date) => setModalData({ ...modalData, issueDate: date })}

                                                            placeholder="dd/mm/yyyy"

                                                            className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                        />

                                                        {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.issueDate}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {/* Expiry Date */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-medium text-gray-500">Expiry Date <span className="text-red-500">*</span></label>

                                                <div className="w-2/3">

                                                    <DatePicker

                                                        required

                                                        disabledDays={
                                                            modalType === 'ownerPassport'
                                                                ? { before: passportExpiryMinDate }
                                                                : modalType === 'ownerVisa' && visaExpiryMinDate
                                                                  ? { before: visaExpiryMinDate }
                                                                  : { before: modalData.issueDate || new Date() }
                                                        }

                                                        value={modalData.expiryDate || ''}

                                                        onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                        placeholder="dd/mm/yyyy"

                                                        className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                    />

                                                    {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                </div>

                                            </div>



                                            {modalType === 'ownerPassport' && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Country of Issue <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <select

                                                            required

                                                            value={modalData.countryOfIssue || ''}

                                                            onChange={(e) => setModalData({ ...modalData, countryOfIssue: e.target.value })}

                                                            className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.countryOfIssue ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                        >

                                                            <option value="">Select Country</option>

                                                            {Country.getAllCountries().map(c => (

                                                                <option key={c.isoCode} value={c.name}>{c.name}</option>

                                                            ))}

                                                        </select>

                                                        {modalErrors.countryOfIssue && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.countryOfIssue}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {modalType === 'ownerVisa' &&
                                                (modalData.visaDocKey === 'employmentVisa' || modalData.visaDocKey === 'spouseVisa') && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Visa Sponsor <span className="text-red-500">*</span></label>

                                                    <div className="w-2/3">

                                                        <input

                                                            type="text"

                                                            required

                                                            value={modalData.sponsor || ''}

                                                            onChange={(e) =>
                                                                setModalData({
                                                                    ...modalData,
                                                                    sponsor: e.target.value.replace(/[^A-Za-z\s]/g, ''),
                                                                })
                                                            }

                                                            className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.sponsor ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700`}

                                                            placeholder="Enter visa sponsor"

                                                        />

                                                        {modalErrors.sponsor && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.sponsor}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {/* Attachment */}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">
                                                    {modalType === 'ownerPassport'
                                                        ? 'Passport Copy'
                                                        : modalType === 'ownerVisa'
                                                          ? 'Visa Document'
                                                          : 'Attachment'}
                                                </label>

                                                <div className="w-2/3">

                                                    {modalData.attachment ? (

                                                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">

                                                            <div className="flex items-center gap-2 overflow-hidden">

                                                                <FileText size={16} className="text-blue-500 shrink-0" />

                                                                <span className="text-sm font-semibold text-blue-700 truncate">Document Attached</span>

                                                            </div>

                                                            <button

                                                                type="button"

                                                                onClick={() => setModalData({ ...modalData, attachment: null })}

                                                                className="p-1 hover:bg-blue-100 rounded-lg text-blue-500 transition-all"

                                                            >

                                                                <X size={16} />

                                                            </button>

                                                        </div>

                                                    ) : (

                                                        <>

                                                            <button

                                                                type="button"

                                                                onClick={() => fileInputRef.current?.click()}

                                                                className={`w-full border-2 border-dashed ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/20'} rounded-xl p-8 flex flex-col items-center justify-center gap-2 transition-all group`}

                                                            >

                                                                <Upload className={`${modalErrors.attachment ? 'text-red-400' : 'text-gray-300 group-hover:text-blue-500'} transition-all`} />

                                                                <span className={`text-sm font-semibold ${modalErrors.attachment ? 'text-red-500' : 'text-gray-400 group-hover:text-blue-600'}`}>Click to upload document</span>

                                                                <input

                                                                    ref={fileInputRef}

                                                                    type="file"

                                                                    className="hidden"

                                                                    onChange={handleFileChange}

                                                                    accept={
                                                                        modalType === 'ownerPassport' || modalType === 'ownerVisa'
                                                                            ? '.pdf,application/pdf'
                                                                            : '.pdf,.jpg,.jpeg,.png'
                                                                    }

                                                                />

                                                            </button>

                                                            {modalErrors.attachment && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight text-center">{modalErrors.attachment}</p>}
                                                            {(modalType === 'ownerPassport' || modalType === 'ownerVisa') && !modalData.attachment && (
                                                                <p className="text-[10px] text-gray-400 font-medium mt-2 text-center">
                                                                    PDF only, max 10 MB
                                                                </p>
                                                            )}

                                                        </>

                                                    )}

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {['companyDocument', 'addNewCategory', 'addEjari', 'addInsurance'].includes(modalType) && (

                                        <div className="space-y-6">

                                            {isEjariForm && ejariNeedsHrApprovalOnSave && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                    This company profile is active. Your changes will be submitted for HR
                                                    approval before they apply.
                                                </div>
                                            )}

                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">

                                                    {modalData.context === 'ejari' ? 'Ejari Type' :

                                                        modalData.context === 'insurance' ? 'Insurance Type' :

                                                            modalData.context === 'moa' ? 'MOA Version' :

                                                            'Document Type'} <span className="text-red-500">*</span>

                                                </label>

                                                <div className="w-2/3">

                                                    {isLiveCompanyDocModal ? (
                                                        <select
                                                            required
                                                            value={modalData.type || ''}
                                                            disabled={isRenewalModal && modalData.hasExpiry !== false}
                                                            onChange={(e) => setModalData({ ...modalData, type: e.target.value })}
                                                            className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.type ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}
                                                        >
                                                            <option value="" disabled>Select document type</option>
                                                            {liveDocumentTypeOptions.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                    <input

                                                        type="text"

                                                        required

                                                        value={modalData.type || ''}

                                                        onChange={(e) => setModalData({
                                                            ...modalData,
                                                            type: modalData.context === 'moa'
                                                                ? normalizeMoaVersion(e.target.value)
                                                                : e.target.value,
                                                        })}

                                                        maxLength={modalData.context === 'moa' ? 30 : undefined}

                                                        placeholder={

                                                            modalData.context === 'ejari' ? 'e.g. Office Rental, Warehouse Lease...' :

                                                                modalData.context === 'insurance' ? 'e.g. Health Insurance, Property Insurance...' :

                                                                    modalData.context === 'moa' ? 'e.g. Version 1.0, Amended 2024...' :

                                                                    'e.g. VAT Certificate, Rental Agreement...'

                                                        }

                                                        className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.type ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                    />
                                                    )}

                                                    {modalErrors.type && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.type}</p>}

                                                </div>

                                            </div>

                                            {isMoaForm && (
                                                <>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">
                                                            Note <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>
                                                        </label>
                                                        <div className="w-2/3">
                                                            <textarea
                                                                value={modalData.description || ''}
                                                                onChange={(e) => setModalData({
                                                                    ...modalData,
                                                                    description: e.target.value,
                                                                })}
                                                                onBlur={(e) => setModalData({
                                                                    ...modalData,
                                                                    description: normalizeMoaNote(e.target.value),
                                                                })}
                                                                placeholder="Add any notes here..."
                                                                maxLength={2000}
                                                                className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.description ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 min-h-[100px]`}
                                                            />
                                                            {modalErrors.description && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                            Issue Date <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="w-2/3">
                                                            <DatePicker
                                                                maxDate={new Date()}
                                                                placeholder="dd/mm/yyyy"
                                                                value={modalData.issueDate || modalData.startDate || ''}
                                                                onChange={(date) =>
                                                                    setModalData({ ...modalData, issueDate: date, startDate: date })
                                                                }
                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                            />
                                                            {modalErrors.issueDate && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.issueDate}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {!(modalData.context === 'ejari' || modalData.context === 'insurance' || modalData.context === 'moa') && (
                                                <div className="flex items-center gap-6">
                                                    <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                        Has Expiry Date? <span className="text-red-500">*</span>
                                                    </label>
                                                    <div className="w-2/3 flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalData({ ...modalData, hasExpiry: true })}
                                                            disabled={isRenewalModal && isLiveCompanyDocModal}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${modalData.hasExpiry !== false ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalData({ ...modalData, hasExpiry: false, expiryDate: '' })}
                                                            disabled={isRenewalModal && isLiveCompanyDocModal}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${modalData.hasExpiry === false ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                                        >
                                                            No
                                                        </button>
                                                        </div>
                                                    {modalErrors.hasExpiry && (
                                                        <p className="text-[11px] text-red-500 font-bold uppercase tracking-tight">{modalErrors.hasExpiry}</p>
                                                    )}
                                                    </div>
                                                </div>
                                            )}

                                            {isLiveCompanyDocModal && (
                                                <>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                            Add Value? <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="w-2/3 flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalData({ ...modalData, hasValue: true })}
                                                                className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                                    modalData.hasValue !== false
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'bg-white text-gray-600 border-gray-300'
                                                                }`}
                                                            >
                                                                Yes
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalData({ ...modalData, hasValue: false, value: '' })}
                                                                className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                                    modalData.hasValue === false
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'bg-white text-gray-600 border-gray-300'
                                                                }`}
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                        {modalErrors.hasValue && (
                                                            <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.hasValue}</p>
                                                        )}
                                                    </div>
                                                    {modalData.hasValue !== false && (
                                                        <div className="flex items-center gap-6">
                                                            <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                                Value (AED) <span className="text-red-500">*</span>
                                                            </label>
                                                            <div className="w-2/3">
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    step="0.01"
                                                                    value={modalData.value || ''}
                                                                    onChange={(e) => setModalData({ ...modalData, value: e.target.value })}
                                                                    onKeyPress={(e) => {
                                                                        if (!/[0-9.]/.test(e.key)) e.preventDefault();
                                                                    }}
                                                                    placeholder="Enter amount in AED"
                                                                    className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.value ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}
                                                                />
                                                                {modalErrors.value && (
                                                                    <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                        {modalErrors.value}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">
                                                            Note <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>
                                                        </label>
                                                        <div className="w-2/3">
                                                            <textarea
                                                                value={modalData.description || ''}
                                                                onChange={(e) => setModalData({
                                                                    ...modalData,
                                                                    description: e.target.value,
                                                                })}
                                                                onBlur={(e) => setModalData({
                                                                    ...modalData,
                                                                    description: normalizeLiveDocumentNote(e.target.value),
                                                                })}
                                                                placeholder="Add any notes here..."
                                                                maxLength={500}
                                                                className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.description ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 min-h-[100px]`}
                                                            />
                                                            {modalErrors.description && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}



                                            {isEjariForm && modalType !== 'addNewCategory' && (
                                                <>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                            Add Value? <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="w-2/3 flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalData({ ...modalData, hasValue: true })}
                                                                className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                                    modalData.hasValue !== false
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'bg-white text-gray-600 border-gray-300'
                                                                }`}
                                                            >
                                                                Yes
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalData({ ...modalData, hasValue: false, value: '' })}
                                                                className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                                    modalData.hasValue === false
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'bg-white text-gray-600 border-gray-300'
                                                                }`}
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {modalData.hasValue !== false && (
                                                        <div className="flex items-center gap-6">
                                                            <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                                Add Value (AED) <span className="text-red-500">*</span>
                                                            </label>
                                                            <div className="w-2/3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={modalData.value || ''}
                                                                    onChange={(e) => setModalData({ ...modalData, value: e.target.value })}
                                                                    onKeyPress={(e) => {
                                                                        if (!/[0-9.]/.test(e.key)) e.preventDefault();
                                                                    }}
                                                                    placeholder="Enter amount in AED"
                                                                    className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.value ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}
                                                                />
                                                                {modalErrors.value && (
                                                                    <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                        {modalErrors.value}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">
                                                            Note <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>
                                                        </label>
                                                        <div className="w-2/3">
                                                            <textarea
                                                                value={modalData.description || ''}
                                                                onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                                                                placeholder="Add any notes here..."
                                                                maxLength={500}
                                                                className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.description ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 min-h-[100px]`}
                                                            />
                                                            {modalErrors.description && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                            Issue Date <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>
                                                        </label>
                                                        <div className="w-2/3">
                                                            <DatePicker
                                                                maxDate={new Date()}
                                                                placeholder="dd/mm/yyyy"
                                                                value={modalData.startDate || modalData.issueDate || ''}
                                                                onChange={(date) =>
                                                                    setModalData({ ...modalData, startDate: date, issueDate: date })
                                                                }
                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                            />
                                                            {modalErrors.issueDate && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.issueDate}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                            Expiry Date <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="w-2/3">
                                                            <DatePicker
                                                                required
                                                                placeholder="dd/mm/yyyy"
                                                                disabledDays={{
                                                                    before: modalData.startDate
                                                                        ? (() => {
                                                                              const issue = new Date(modalData.startDate);
                                                                              issue.setHours(0, 0, 0, 0);
                                                                              const minFuture = new Date(ejariExpiryMinDate);
                                                                              return issue > minFuture ? issue : minFuture;
                                                                          })()
                                                                        : ejariExpiryMinDate,
                                                                }}
                                                                value={modalData.expiryDate || ''}
                                                                onChange={(date) => setModalData({ ...modalData, expiryDate: date })}
                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                            />
                                                            {modalErrors.expiryDate && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.expiryDate}
                                                                </p>
                                                            )}
                                                            {!modalErrors.expiryDate &&
                                                                modalData.expiryDate &&
                                                                getExpiryVisualState(modalData.expiryDate).tag && (
                                                                    <p
                                                                        className={`text-[11px] font-semibold mt-1 ${getExpiryVisualState(modalData.expiryDate).className}`}
                                                                    >
                                                                        Warning: {getExpiryVisualState(modalData.expiryDate).tag}
                                                                    </p>
                                                                )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {isInsuranceForm && !isEjariForm && modalType !== 'addNewCategory' && (
                                                <>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Provider</label>
                                                        <div className="w-2/3">
                                                            <input
                                                                type="text"
                                                                value={modalData.provider || ''}
                                                                onChange={(e) => setModalData({ ...modalData, provider: e.target.value })}
                                                                placeholder="e.g. AXA, Oman Insurance..."
                                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                            Add Value? <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="w-2/3 flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalData({ ...modalData, hasValue: true })}
                                                                className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                                    modalData.hasValue !== false
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'bg-white text-gray-600 border-gray-300'
                                                                }`}
                                                            >
                                                                Yes
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalData({ ...modalData, hasValue: false, value: '' })}
                                                                className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                                    modalData.hasValue === false
                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                        : 'bg-white text-gray-600 border-gray-300'
                                                                }`}
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {modalData.hasValue !== false && (
                                                        <div className="flex items-center gap-6">
                                                            <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Add Value (AED)</label>
                                                            <div className="w-2/3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={modalData.value || ''}
                                                                    onChange={(e) => setModalData({ ...modalData, value: e.target.value })}
                                                                    onKeyPress={(e) => {
                                                                        if (!/[0-9.]/.test(e.key)) e.preventDefault();
                                                                    }}
                                                                    placeholder="Enter amount in AED"
                                                                    className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.value ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}
                                                                />
                                                                {modalErrors.value && (
                                                                    <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                        {modalErrors.value}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">Note</label>
                                                        <div className="w-2/3">
                                                            <textarea
                                                                value={modalData.description || ''}
                                                                onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                                                                placeholder="Add any notes here..."
                                                                maxLength={500}
                                                                className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.description ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 min-h-[100px]`}
                                                            />
                                                            {modalErrors.description && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                            Issue Date <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="w-2/3">
                                                            <DatePicker
                                                                maxDate={new Date()}
                                                                placeholder="dd/mm/yyyy"
                                                                value={modalData.startDate || modalData.issueDate || ''}
                                                                onChange={(date) =>
                                                                    setModalData({ ...modalData, startDate: date, issueDate: date })
                                                                }
                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                            />
                                                            {modalErrors.issueDate && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.issueDate}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">
                                                            Expiry Date <span className="text-red-500">*</span>
                                                        </label>
                                                        <div className="w-2/3">
                                                            <DatePicker
                                                                required
                                                                placeholder="dd/mm/yyyy"
                                                                disabledDays={{ before: modalData.startDate || new Date() }}
                                                                value={modalData.expiryDate || ''}
                                                                onChange={(date) => setModalData({ ...modalData, expiryDate: date })}
                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}
                                                            />
                                                            {modalErrors.expiryDate && (
                                                                <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                                    {modalErrors.expiryDate}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}





                                            {/* Date Fields - generic documents only (not Ejari / Insurance) */}

                                            {!isEjariOrInsuranceComplianceForm && !isMoaForm && (

                                                <div className="flex items-center gap-6">

                                                    <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">

                                                        Issue Date <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>

                                                    </label>

                                                    <div className="w-2/3">

                                                        <DatePicker

                                                            maxDate={new Date()} // Cannot be in the future

                                                            placeholder="dd/mm/yyyy"

                                                            value={modalData.issueDate || ''}

                                                            onChange={(date) => setModalData({ ...modalData, issueDate: date, startDate: date })}

                                                            className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.issueDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                        />

                                                        {modalErrors.issueDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.issueDate}</p>}

                                                    </div>

                                                </div>

                                            )}



                                            {/* Expiry Date for other documents (not Ejari/Insurance/MOA/No-Expiry) */}

                                            {!isEjariOrInsuranceComplianceForm &&

                                                !modalData.type?.toLowerCase().includes('without expiry') &&

                                                modalData.context !== 'document_without_expiry' &&

                                                modalData.context !== 'moa' &&
                                                modalData.hasExpiry !== false && (

                                                    <div className="flex items-center gap-6">

                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">

                                                            Expiry Date <span className="text-red-500">*</span>

                                                        </label>

                                                        <div className="w-2/3">

                                                            <DatePicker

                                                                required

                                                                placeholder="dd/mm/yyyy"

                                                                disabledDays={{ before: modalData.issueDate || modalData.startDate || undefined }}

                                                                value={modalData.expiryDate || ''}

                                                                onChange={(date) => setModalData({ ...modalData, expiryDate: date })}

                                                                className={`w-full h-[46px] px-4 py-3 bg-gray-50 border ${modalErrors.expiryDate ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600`}

                                                            />

                                                            {modalErrors.expiryDate && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.expiryDate}</p>}

                                                        </div>

                                                    </div>

                                                )}



                                            <div className="flex items-center gap-6">

                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">
                                                    Attachment{' '}
                                                    {isEjariForm || isMoaForm || isLiveCompanyDocModal ? <span className="text-red-500">*</span> : null}
                                                </label>

                                                <div className="w-2/3">

                                                    {modalData.attachment ? (

                                                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">

                                                            <div className="flex items-center gap-2 overflow-hidden">

                                                                <FileText size={16} className="text-blue-500 shrink-0" />

                                                                <span className="text-sm font-semibold text-blue-700 truncate">
                                                                    {modalData.fileName || 'Document Attached'}
                                                                </span>

                                                            </div>

                                                            {canAlterCompanyDocumentAttachment ? (
                                                            <button

                                                                type="button"

                                                                onClick={() =>
                                                                    setModalData({
                                                                        ...modalData,
                                                                        attachment: null,
                                                                        publicId: null,
                                                                        fileName: '',
                                                                    })
                                                                }

                                                                className="p-1 hover:bg-blue-100 rounded-lg text-blue-500 transition-all"

                                                                title="Remove attachment"

                                                            >

                                                                <X size={16} />

                                                            </button>
                                                            ) : null}

                                                        </div>

                                                    ) : (

                                                        <button

                                                            type="button"

                                                            onClick={() => fileInputRef.current?.click()}

                                                            className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50/20 transition-all group ${modalErrors.attachment ? 'border-red-300 bg-red-50/10' : 'border-gray-200'}`}

                                                        >

                                                            <Upload className="text-gray-300 group-hover:text-blue-500 transition-all" />

                                                            <span className="text-sm font-semibold text-gray-400 group-hover:text-blue-600">
                                                                {isEjariForm
                                                                    ? 'Upload PDF (max 5MB)'
                                                                    : isMoaForm || isLiveCompanyDocModal
                                                                      ? 'Upload PDF (max 10MB)'
                                                                      : 'Click to upload document'}
                                                            </span>

                                                            <input

                                                                ref={fileInputRef}

                                                                type="file"

                                                                className="hidden"

                                                                onChange={handleFileChange}

                                                                accept={isEjariForm || isMoaForm || isLiveCompanyDocModal ? '.pdf,application/pdf' : '.pdf,.jpg,.jpeg,.png'}

                                                            />

                                                        </button>

                                                    )}

                                                    {modalErrors.attachment && (
                                                        <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">
                                                            {modalErrors.attachment}
                                                        </p>
                                                    )}

                                                </div>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'addCustomResponsibility' && (

                                        <div className="space-y-6">

                                            <div className="flex flex-col gap-2">

                                                <label className="text-sm font-bold text-gray-500 uppercase">Category Name</label>

                                                <input

                                                    type="text"

                                                    required

                                                    value={modalData.category || ''}

                                                    onChange={(e) => setModalData({ ...modalData, category: e.target.value })}

                                                    placeholder="e.g. IT Manager, Safety Officer..."

                                                    className={`w-full px-4 py-3 bg-gray-50 border ${modalErrors.category ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700`}

                                                />

                                                {modalErrors.category && <p className="text-[11px] text-red-500 font-bold mt-1 uppercase tracking-tight">{modalErrors.category}</p>}

                                            </div>

                                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">

                                                <p className="text-xs text-blue-700 font-medium leading-relaxed">

                                                    After defining the category, you will be prompted to assign an employee to it.

                                                </p>

                                            </div>

                                            <div className="flex justify-end">

                                                <button

                                                    type="button"

                                                    onClick={() => {

                                                        if (!modalData.category) {

                                                            setModalErrors({ category: "Category name is required" });

                                                            toast({ title: "Required", description: "Please enter a category name", variant: "destructive" });

                                                            return;

                                                        }

                                                        setModalErrors({});

                                                        setSelectedCategory(modalData.category);

                                                        setModalType('assignEmployee');

                                                        setModalData({});

                                                    }}

                                                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 transition-all"

                                                >

                                                    Next: Assign Employee <ArrowRight size={18} />

                                                </button>

                                            </div>

                                        </div>

                                    )}



                                    {modalType === 'assignEmployee' && (

                                        <div className="space-y-6">

                                            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">

                                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm capitalize">
                                                    {selectedCategory?.charAt(0)}
                                                </div>

                                                <div className="flex flex-col">

                                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Assigning for</span>

                                                    <span className="text-sm font-bold text-blue-700 capitalize">{selectedCategory?.replace(/([A-Z])/g, ' $1').trim()}</span>

                                                </div>

                                            </div>



                                            <div className="flex flex-col gap-2">

                                                <label className="text-sm font-bold text-gray-500">Search & Select Employee</label>

                                                <div className="relative">

                                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                                                    <input

                                                        type="text"

                                                        placeholder="Search by name or ID..."

                                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"

                                                        onChange={(e) => {

                                                            const query = e.target.value.toLowerCase();

                                                            const filtered = allEmployees.filter(emp =>

                                                                `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(query) ||

                                                                emp.employeeId?.toLowerCase().includes(query)

                                                            );

                                                            setModalData({ ...modalData, filteredEmployees: filtered });

                                                        }}

                                                    />

                                                </div>

                                            </div>



                                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">

                                                {(modalData.filteredEmployees || allEmployees).length === 0 ? (

                                                    <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">

                                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-300 mx-auto mb-3 shadow-sm">

                                                            <Search size={24} />

                                                        </div>

                                                        <p className="text-sm font-bold text-gray-500">No Eligible Employees Found</p>

                                                        <p className="text-xs text-gray-400 mt-1">Try searching by name or ID, or ensure employees are assigned to this company.</p>

                                                    </div>

                                                ) : (

                                                    (modalData.filteredEmployees || allEmployees).map((emp) => {

                                                        const isAlreadyAssigned = (responsibilities || []).some(r => r.empObjectId === emp._id && r.category === selectedCategory);

                                                        const isSystemUser = allUsers.some(u => u.employeeId === emp.employeeId);

                                                        const hasCompanyEmail = !!emp.companyEmail;

                                                        const isEligible = isSystemUser && hasCompanyEmail;



                                                        return (

                                                            <button

                                                                key={emp._id}

                                                                type="button"

                                                                disabled={isAlreadyAssigned || isSubmitting || !isEligible}

                                                                onClick={async () => {

                                                                    if (isAlreadyAssigned || !isEligible) return;

                                                                    const newResp = {

                                                                        category: selectedCategory,

                                                                        employeeId: emp.employeeId,

                                                                        employeeName: `${emp.firstName} ${emp.lastName}`,

                                                                        designation: emp.designation?.name || emp.designation || 'N/A',

                                                                        empObjectId: emp._id

                                                                    };

                                                                    const updatedResps = [...responsibilities, newResp];

                                                                    setResponsibilities(updatedResps);

                                                                    handleModalClose();



                                                                    try {

                                                                        setIsSubmitting(true);

                                                                        await axiosInstance.patch(`/Company/${companyId}`, { responsibilities: updatedResps });

                                                                        toast({ title: "Success", description: `${emp.firstName} assigned to ${selectedCategory}` });

                                                                        fetchCompany();

                                                                    } catch (err) {

                                                                        console.error('Error assigning responsibility:', err);

                                                                        toast({ title: "Error", description: err.response?.data?.message || "Failed to save responsibility", variant: "destructive" });

                                                                    } finally {

                                                                        setIsSubmitting(false);

                                                                    }

                                                                }}

                                                                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all group border ${isAlreadyAssigned || !isEligible

                                                                    ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'

                                                                    : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200 shadow-sm'}`}

                                                            >

                                                                <div className="flex items-center gap-3">

                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm text-sm ${isAlreadyAssigned || !isEligible ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>

                                                                        {emp.firstName?.charAt(0)}

                                                                    </div>

                                                                    <div className="flex flex-col text-left">

                                                                        <div className="flex items-center gap-2">

                                                                            <span className={`text-sm font-bold ${isAlreadyAssigned || !isEligible ? 'text-gray-400' : 'text-gray-700'}`}>{emp.firstName} {emp.lastName}</span>

                                                                            {!hasCompanyEmail && !isAlreadyAssigned && (

                                                                                <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase">No Co. Email</span>

                                                                            )}

                                                                            {!isSystemUser && !isAlreadyAssigned && (

                                                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase">Not a User</span>

                                                                            )}

                                                                        </div>

                                                                        <span className="text-[11px] text-gray-400 font-medium">{emp.designation?.name || emp.designation || 'N/A'} • {emp.companyName}</span>

                                                                    </div>

                                                                </div>

                                                                {isAlreadyAssigned ? (

                                                                    <span className="text-[10px] font-bold text-orange-400 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 uppercase tracking-wider">Already Assigned</span>

                                                                ) : !isEligible ? (

                                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 uppercase tracking-wider">Ineligible</span>

                                                                ) : (

                                                                    <span className="text-xs font-bold text-gray-300 group-hover:text-blue-500">Select</span>

                                                                )}

                                                            </button>

                                                        );

                                                    })

                                                )}

                                            </div>

                                        </div>

                                    )}





                                </form>

                            </div>
                            )}



                            {modalType === 'ownerVisaTypeSelection' && (
                                <div className="px-8 pb-8 space-y-4 overflow-y-auto flex-1">
                                    <p className="text-sm text-gray-500">
                                        Select a visa type for{' '}
                                        <span className="font-semibold text-gray-700">
                                            {ownersForDisplay[activeOwnerTabIndex]?.name || 'this owner'}
                                        </span>
                                        .
                                    </p>
                                    <div className="space-y-2">
                                        {missingOwnerVisaTypesForActiveOwner.map((opt) => (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                onClick={() => handleModalOpen('ownerVisa', null, opt.key)}
                                                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all group"
                                            >
                                                <div className="flex flex-col text-left">
                                                    <span className="text-sm font-bold text-gray-700">{opt.label}</span>
                                                    {opt.key === 'employmentVisa' && (
                                                        <span className="text-[11px] text-gray-400 font-medium">
                                                            Requires sponsor; visa number must be unique
                                                        </span>
                                                    )}
                                                    {opt.key === 'spouseVisa' && (
                                                        <span className="text-[11px] text-gray-400 font-medium">
                                                            Requires sponsor
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold text-gray-300 group-hover:text-blue-500">
                                                    Add
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {modalType === 'selectEmployeeForOwner' && (
                                <div className="px-8 pb-8 space-y-6 overflow-y-auto flex-1">
                                    <div className="flex flex-col gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search owners..."
                                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                onChange={(e) => {
                                                    const query = e.target.value.toLowerCase();
                                                    const filtered = (modalData.allOwners || []).filter(o =>
                                                        o.name?.toLowerCase().includes(query) ||
                                                        o.fromCompany?.toLowerCase().includes(query)
                                                    );
                                                    setModalData({ ...modalData, filteredOwners: filtered });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {(modalData.filteredOwners || []).length === 0 ? (
                                            <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                <p className="text-sm font-bold text-gray-500">No Existing Owners Found</p>
                                            </div>
                                        ) : (
                                            (modalData.filteredOwners || []).map((owner, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentOwners = modalData.owners || [];
                                                        const profileId = resolveOwnerProfileId(owner);
                                                        const alreadySelected = currentOwners.some(
                                                            (o) => resolveOwnerProfileId(o) === profileId,
                                                        );
                                                        if (alreadySelected) {
                                                            toast({
                                                                title: 'Duplicate owner',
                                                                description: 'This owner is already in the list.',
                                                                variant: 'destructive',
                                                            });
                                                            return;
                                                        }

                                                        const newCount = currentOwners.length + 1;
                                                        const equalShare = (100 / newCount).toFixed(2);

                                                        const newOwner = {
                                                            ...owner,
                                                            ownerProfileId: profileId,
                                                            sharePercentage: equalShare,
                                                            isNew: false,
                                                            isExisting: true,
                                                        };
                                                        delete newOwner._id;
                                                        delete newOwner.fromCompany;

                                                        const updatedOwners = currentOwners.map(o => ({
                                                            ...o,
                                                            sharePercentage: equalShare
                                                        }));

                                                        setModalData({
                                                            ...modalData,
                                                            owners: [...updatedOwners, newOwner],
                                                            filteredOwners: null
                                                        });
                                                        setModalType('tradeLicense');
                                                    }}
                                                    className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-sm text-sm">
                                                            {owner.name?.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col text-left">
                                                            <span className="text-sm font-bold text-gray-700">{owner.name}</span>
                                                            <span className="text-[11px] text-blue-500 font-semibold">ID: {resolveOwnerProfileId(owner)}</span>
                                                            <span className="text-[11px] text-gray-400 font-medium">From: {owner.fromCompany}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-300 group-hover:text-blue-500">Pick</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer */}

                            {modalType === 'selectEmployeeForOwner' ? (
                                <div className="px-8 py-6 border-t border-gray-100 flex items-center justify-start gap-4">
                                    <button
                                        type="button"
                                        onClick={handleTradeLicenseOwnerPickerBack}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all"
                                    >
                                        <ChevronLeft size={18} />
                                        Back to Trade License
                                    </button>
                                </div>
                            ) : modalType === 'ownerVisaTypeSelection' ? (
                                <div className="px-8 py-6 border-t border-gray-100 flex items-center justify-end">
                                    <button
                                        type="button"
                                        onClick={handleModalClose}
                                        className="px-6 py-2.5 text-sm font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : modalType !== 'assignEmployee' && (

                                <div className={`px-8 py-6 border-t border-gray-100 flex items-center ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense'].includes(modalType) ? 'justify-end' : 'justify-end'} gap-4`}>

                                    <button

                                        onClick={handleModalClose}

                                        className={`px-6 py-2.5 text-sm font-semibold ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense'].includes(modalType) ? 'text-red-500 hover:text-red-600' : 'text-red-500 hover:text-red-600 hover:bg-red-50'} rounded-xl transition-all`}

                                        type="button"

                                    >

                                        Cancel

                                    </button>

                                    <button

                                        form="documentForm"

                                        type="submit"

                                        disabled={
                                            isSubmitting ||
                                            ownerDetailsSaveBlocked ||
                                            ownerPassportSaveBlocked ||
                                            ownerEmiratesIdSaveBlocked ||
                                            ownerVisaSaveBlocked ||
                                            ownerLabourCardSaveBlocked ||
                                            ownerMedicalSaveBlocked ||
                                            ownerDrivingLicenseSaveBlocked
                                        }

                                        className={`px-12 py-2.5 ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense'].includes(modalType) ? 'bg-[#5174FF] hover:bg-[#4063FF] rounded-xl' : 'bg-blue-600 hover:bg-blue-700 rounded-xl'} text-white text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center gap-2`}

                                    >

                                        {isSubmitting
                                            ? 'Updating...'
                                            : (modalType === 'basicDetails' && basicDetailsNeedsHrApprovalOnSave) ||
                                                  (isMoaForm && moaNeedsHrApprovalOnSave) ||
                                                  (modalType === 'tradeLicense' && tradeLicenseNeedsHrApprovalOnSave) ||
                                                  (modalType === 'establishmentCard' && establishmentNeedsHrApprovalOnSave) ||
                                                  (modalType === 'ownerPassport' && ownerPassportNeedsHrApprovalOnSave) ||
                                                  (modalType === 'ownerEmiratesId' && ownerEmiratesIdNeedsHrApprovalOnSave)
                                                ? 'Send for Approval'
                                                : modalType === 'ownerPassport' && isRenewalModal
                                                  ? 'Renew'
                                                  : modalType === 'ownerEmiratesId' && isRenewalModal
                                                    ? 'Renew'
                                                    : modalType === 'ownerVisa' && isRenewalModal
                                                      ? 'Renew'
                                                      : modalType === 'ownerLabourCard' && isRenewalModal
                                                        ? 'Renew'
                                                      : modalType === 'ownerMedical' && isRenewalModal
                                                        ? 'Renew'
                                                      : modalType === 'ownerDrivingLicense' && isRenewalModal
                                                        ? 'Renew'
                                                    : modalType.startsWith('owner') || modalType === 'addNewCategory'
                                                    ? 'Save'
                                                    : modalType === 'tradeLicense' && isRenewalModal
                                                      ? 'Renew'
                                                      : modalType === 'establishmentCard' && isRenewalModal
                                                        ? 'Renew'
                                                        : isEjariForm && isRenewalModal
                                                          ? 'Renew'
                                                          : 'Update'}

                                    </button>

                                </div>

                            )}

                        </div>

                    </div >

                )

                }



                {activationSubmitModalOpen && showActivationSubmitModalUi && (
                    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {viewerIsDesignatedFlowchartHr ? 'Activate company' : activationSubmitLabel}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {viewerIsDesignatedFlowchartHr
                                            ? 'As designated Flowchart HR, confirming activates this company immediately (no separate approval queue).'
                                            : isInactiveFirstActivationSubmit
                                              ? 'Your company profile is complete. Submit to send it to HR for activation review.'
                                              : 'Select requested changes and submit for approval.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActivationSubmitModalOpen(false)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                {!viewerIsDesignatedFlowchartHr && (
                                    <>
                                        {pendingCompanyDisplayGroups.length > 0 ? (
                                            <div className="space-y-2">
                                                <p className="text-xs text-gray-500 leading-snug">
                                                    Check a row to include it in this submission to HR. Unchecked rows
                                                    stay in your pending queue until you submit them later. Use View to
                                                    compare current versus edited fields.
                                                </p>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm font-semibold text-gray-700">
                                                        Requested Changes
                                                    </div>
                                                    <label className="inline-flex items-center gap-2 text-xs text-gray-600 shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={activationSubmitAllRowsSelected}
                                                            onChange={toggleActivationSubmitSelectAll}
                                                        />
                                                        Select all
                                                    </label>
                                                </div>
                                                <div className="space-y-3 max-h-[min(62vh,560px)] overflow-y-auto pr-1">
                                                    {pendingCompanyDisplayGroups.map((group) => {
                                                        const groupFullySelected =
                                                            group.ids.length > 0 &&
                                                            group.ids.every((id) =>
                                                                activationSubmitSelectedEntryIds.includes(String(id)),
                                                            );
                                                        const entry = group.representativeEntry;
                                                        return (
                                                            <div
                                                                key={group.key}
                                                                className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                                                            >
                                                                <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                                    <label className="inline-flex items-center gap-2 flex-1 min-w-0">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={groupFullySelected}
                                                                            onChange={() =>
                                                                                toggleActivationSubmitGroupSelection(
                                                                                    group.ids,
                                                                                )
                                                                            }
                                                                        />
                                                                        <span
                                                                            className="text-sm text-gray-800 truncate"
                                                                            title={group.displayLabel}
                                                                        >
                                                                            {group.displayLabel}
                                                                        </span>
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleViewCompanyRequestedChange(entry.card);
                                                                            setViewingCompanyChange(entry);
                                                                        }}
                                                                        className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                                    >
                                                                        Full compare
                                                                    </button>
                                                                </div>
                                                                <div className="px-3 pb-3 pt-1 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {renderPendingChangeSnapshotBlock(entry, {
                                                                        title: 'Current card',
                                                                        variant: 'gray',
                                                                    })}
                                                                    {renderPendingChangeSnapshotBlock(entry, {
                                                                        title: 'Edited card',
                                                                        variant: 'blue',
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : isInactiveFirstActivationSubmit ? (
                                            <p className="text-xs text-gray-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                                                All required activation sections are complete. Click{' '}
                                                <span className="font-semibold">{activationSubmitLabel}</span> below to
                                                send this company to HR.
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                                                No queued change rows yet. Complete and save edits on company cards until they
                                                appear here, then describe anything else HR should know below.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActivationSubmitModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitForActivation}
                                    disabled={
                                        activationSubmitting ||
                                        (!viewerIsDesignatedFlowchartHr &&
                                            pendingCompanyDisplayGroups.length === 0 &&
                                            !isInactiveFirstActivationSubmit)
                                    }
                                    title={
                                        !viewerIsDesignatedFlowchartHr &&
                                        pendingCompanyDisplayGroups.length === 0 &&
                                        !isInactiveFirstActivationSubmit
                                            ? 'Save company edits first so they appear in the queue'
                                            : undefined
                                    }
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {activationSubmitting
                                        ? 'Submitting...'
                                        : viewerIsDesignatedFlowchartHr
                                          ? 'Activate now'
                                          : activationSubmitLabel}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activationReviewModalOpen && (
                    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[92vh] flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Activation Request Review</h3>
                                    <p className="text-sm text-gray-500">
                                        Review submitted company cards and approve or send corrections to HR.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActivationReviewModalOpen(false);
                                        setActivationSelectedChangeIds([]);
                                        setActivationRowNotesByGroupKey({});
                                    }}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0">
                                {!isDirectHrAction && (
                                    <div className="space-y-3 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4">
                                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                            Submitted Request Details
                                        </div>
                                        {(!activationHrSubmission?.reason?.trim() &&
                                            !activationHrSubmission?.description?.trim() &&
                                            !activationHrSubmission?.type?.trim()) ? (
                                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                                                <p className="text-sm text-blue-800 font-medium italic">
                                                    First-time company activation — review each section on the profile and use OK to activate.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-1">
                                                    <div className="text-sm font-semibold text-gray-700">Activation Type</div>
                                                    <div className="text-sm text-gray-800 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                                                        {activationHrSubmission?.type?.trim() || 'New Activation'}
                                                    </div>
                                                </div>
                                                {activationHrSubmission?.reason?.trim() ? (
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-semibold text-gray-700">Reason</div>
                                                        <div className="text-sm text-gray-800 bg-white border border-gray-100 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                                                            {activationHrSubmission.reason}
                                                        </div>
                                                    </div>
                                                ) : null}
                                                {activationHrSubmission?.description?.trim() ? (
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-semibold text-gray-700">Description</div>
                                                        <div className="text-sm text-gray-800 bg-white border border-gray-100 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                                                            {activationHrSubmission.description}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                        {activationHrSubmission?.attachment?.trim() ? (
                                            <div className="space-y-1">
                                                <div className="text-sm font-semibold text-gray-700">Attachment</div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openCompanyAttachmentPreview(activationHrSubmission.attachment, {
                                                            name: 'Activation attachment',
                                                        })
                                                    }
                                                    className="text-sm text-blue-700 font-semibold hover:underline break-all text-left"
                                                >
                                                    View attachment
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                {activationReviewPendingChanges.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold text-gray-700">Requested Changes</div>
                                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        activationReviewPendingChanges.length > 0 &&
                                                        activationReviewPendingChanges.every((c) =>
                                                            activationSelectedChangeIds.includes(c._id),
                                                        )
                                                    }
                                                    onChange={() => {
                                                        const allSelected =
                                                            activationReviewPendingChanges.length > 0 &&
                                                            activationReviewPendingChanges.every((c) =>
                                                                activationSelectedChangeIds.includes(c._id),
                                                            );
                                                        if (allSelected) {
                                                            setActivationSelectedChangeIds([]);
                                                        } else {
                                                            setActivationSelectedChangeIds(
                                                                activationReviewPendingChanges.map((c) => c._id),
                                                            );
                                                        }
                                                    }}
                                                />
                                                Select all
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Each card shows current versus edited values. Check every row to fully approve on OK. Unchecked rows need instructions below — the submitter sees them on hold and in email.
                                        </p>
                                        <div className="space-y-3 max-h-[min(52vh,480px)] overflow-y-auto pr-1">
                                            {activationReviewDisplayGroups.map((group) => {
                                                const groupFullySelected =
                                                    group.ids.length > 0 &&
                                                    group.ids.every((id) => activationSelectedChangeIds.includes(id));
                                                const entry = group.representativeEntry;
                                                return (
                                                    <div
                                                        key={group.key}
                                                        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                                                    >
                                                        <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                            <label className="inline-flex items-center gap-2 flex-1 min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={groupFullySelected}
                                                                    onChange={() => toggleCompanyChangeGroupSelection(group.ids)}
                                                                />
                                                                <span
                                                                    className="text-sm text-gray-800 truncate"
                                                                    title={group.displayLabel}
                                                                >
                                                                    {group.displayLabel}
                                                                </span>
                                                                <span
                                                                    className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full shrink-0"
                                                                    title="Submitted for HR approval"
                                                                >
                                                                    !
                                                                </span>
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleViewCompanyRequestedChange(entry.card);
                                                                    setViewingCompanyChange(entry);
                                                                }}
                                                                className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                            >
                                                                Full compare
                                                            </button>
                                                        </div>
                                                        <div className="px-3 pb-3 pt-1 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {renderPendingChangeSnapshotBlock(entry, {
                                                                title: 'Current card',
                                                                variant: 'gray',
                                                            })}
                                                            {renderPendingChangeSnapshotBlock(entry, {
                                                                title: 'Edited card',
                                                                variant: 'blue',
                                                            })}
                                                        </div>
                                                        {!groupFullySelected ? (
                                                            <div className="px-3 pb-2.5 pt-1 border-t border-gray-100 bg-slate-50/70">
                                                                <label className="text-xs font-semibold text-gray-600 block mb-1">
                                                                    Instructions for unchecked item <span className="text-red-500">*</span>
                                                                </label>
                                                                <textarea
                                                                    value={activationRowNotesByGroupKey[group.key] || ''}
                                                                    onChange={(e) =>
                                                                        setActivationRowNotesByGroupKey((prev) => ({
                                                                            ...prev,
                                                                            [group.key]: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder="What should be fixed for this section (mandatory for unchecked rows)"
                                                                    rows={2}
                                                                    className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y min-h-[56px]"
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {activationReviewPendingChanges.length === 0 && activationStatusValue === 'submitted' && (
                                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                                        Full company profile submitted for first activation. Review the company cards on this page, then use OK to activate.
                                    </div>
                                )}

                                {activationReviewPendingChanges.length > 0 && (
                                    <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                                        <span className="font-semibold">OK</span> with all rows checked fully approves and applies every card.
                                        With any row unchecked, checked cards are applied now and unchecked cards return to the submitter (dashboard task + email with approved / need-correction counts).
                                    </p>
                                )}
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActivationReviewModalOpen(false);
                                        setActivationSelectedChangeIds([]);
                                        setActivationRowNotesByGroupKey({});
                                        setActivationRejectReason('');
                                    }}
                                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
                                    disabled={activationDecisionLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleActivationOk}
                                    disabled={activationDecisionLoading}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {activationDecisionLoading ? 'Processing…' : 'OK'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {viewingCompanyChange && (() => {
                    const coPrevRows = buildCompanyChangeReviewRows(viewingCompanyChange, 'previous');
                    const coPropRows = buildCompanyChangeReviewRows(viewingCompanyChange, 'proposed');
                    return (
                        <div className="fixed inset-0 z-[130] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <h3 className="text-2xl font-bold text-gray-900">
                                        {pendingOwnerDisplayLabel(viewingCompanyChange) || 'Company Change'}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setViewingCompanyChange(null)}
                                        className="text-sm text-gray-500 hover:text-gray-700"
                                    >
                                        Close
                                    </button>
                                </div>
                                <div className="px-6 py-5 max-h-[78vh] overflow-y-auto space-y-5">
                                    <div>
                                        <div className="text-sm font-semibold uppercase text-gray-600 mb-2">Current Card</div>
                                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                                            {coPrevRows.length > 0 ? (
                                                coPrevRows.map((row, idx) => (
                                                    <div key={`prev-${idx}`} className="grid grid-cols-12 border-b border-gray-100 last:border-b-0">
                                                        <div className="col-span-4 px-3 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50">{row.label}</div>
                                                        <div className="col-span-8 px-3 py-2.5 text-sm text-gray-800 flex items-center justify-between gap-2">
                                                            <span className="truncate">{row.value}</span>
                                                            {row.isAttachment || row.url || row.attachmentRef ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openCompanyAttachmentPreview(
                                                                            row.attachmentRef || row.url,
                                                                            { name: row.label },
                                                                        )
                                                                    }
                                                                    className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                                >
                                                                    View
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-3 py-3 text-sm text-gray-500">No current data available.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-sm font-semibold uppercase text-blue-700 mb-2">Edited Card</div>
                                        <div className="rounded-xl border border-blue-200 overflow-hidden bg-blue-50/30">
                                            {coPropRows.length > 0 ? (
                                                coPropRows.map((row, idx) => (
                                                    <div key={`next-${idx}`} className="grid grid-cols-12 border-b border-blue-100 last:border-b-0">
                                                        <div className="col-span-4 px-3 py-2.5 text-sm font-semibold text-blue-700">{row.label}</div>
                                                        <div className="col-span-8 px-3 py-2.5 text-sm text-gray-800 flex items-center justify-between gap-2">
                                                            <span className="truncate">{row.value}</span>
                                                            {row.isAttachment || row.url || row.attachmentRef ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openCompanyAttachmentPreview(
                                                                            row.attachmentRef || row.url,
                                                                            { name: row.label },
                                                                        )
                                                                    }
                                                                    className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                                >
                                                                    View
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-3 py-3 text-sm text-gray-500">No edited data available.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <AlertDialog
                    open={companyBulkDialog.open}
                    onOpenChange={(open) =>
                        setCompanyBulkDialog((prev) => (open ? prev : { open: false, mode: null, leaveDuration: '1' }))
                    }
                >
                    <AlertDialogContent className="bg-white rounded-2xl border-gray-100 shadow-2xl p-6">
                        <AlertDialogHeader className="mb-2">
                            <AlertDialogTitle className="text-lg font-bold text-gray-900">
                                {companyBulkDialog.mode === 'return' && 'Confirm Bulk Return'}
                                {companyBulkDialog.mode === 'transfer' && 'Confirm Bulk Transfer'}
                                {companyBulkDialog.mode === 'endOfServices' && 'Confirm End Of Services'}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-gray-600">
                                {companyBulkDialog.mode === 'return' && `Process bulk return for ${selectedCompanyAssetIds.length} selected asset(s)?`}
                                {companyBulkDialog.mode === 'transfer' && `Submit transfer request for ${selectedCompanyAssetIds.length} selected asset(s)?`}
                                {companyBulkDialog.mode === 'endOfServices' && `Submit End Of Services for ${selectedCompanyAssetIds.length} selected asset(s)?`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        {companyBulkDialog.mode === 'transfer' && (
                            <div className="mb-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Leave Duration (1-30 days)</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={companyBulkDialog.leaveDuration}
                                    onChange={(e) =>
                                        setCompanyBulkDialog((prev) => ({ ...prev, leaveDuration: e.target.value }))
                                    }
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel
                                className="rounded-xl"
                                disabled={companyBulkSubmitting}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={companyBulkSubmitting}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleCompanyBulkDialogConfirm();
                                }}
                            >
                                {companyBulkSubmitting ? 'Processing...' : 'Confirm'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>



                <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>

                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8">

                        <AlertDialogHeader className="mb-4">

                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Are you absolutely sure?</AlertDialogTitle>

                            <AlertDialogDescription className="text-gray-500 font-medium">

                                This will remove the assigned responsibility for this employee. This action cannot be undone.

                            </AlertDialogDescription>

                        </AlertDialogHeader>

                        <AlertDialogFooter className="gap-3">

                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={handleRemoveConfirm}

                                className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-100 px-8"

                            >

                                Remove Responsibility

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>



                <AlertDialog open={notRenewData !== null} onOpenChange={(open) => !open && setNotRenewData(null)}>

                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8 max-w-lg">

                        <AlertDialogHeader className="mb-4">

                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Request document not renew</AlertDialogTitle>

                            <AlertDialogDescription className="text-gray-500 font-medium">

                                Designated HR will review this request. The current {notRenewData?.label || 'document'} remains on the profile until HR approves.

                            </AlertDialogDescription>

                        </AlertDialogHeader>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">Reason (required)</label>
                                <textarea
                                    value={notRenewReason}
                                    onChange={(e) => setNotRenewReason(e.target.value)}
                                    rows={4}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Explain why this document will not be renewed."
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">Supporting attachment (optional)</label>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => setNotRenewFile(e.target.files?.[0] || null)}
                                    className="text-sm w-full"
                                />
                            </div>
                        </div>

                        <AlertDialogFooter className="gap-3">

                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={(e) => {
                                    e.preventDefault();
                                    handleNotRenewSubmit();
                                }}

                                disabled={notRenewSubmitting}

                                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-lg shadow-amber-100 px-8"

                            >

                                {notRenewSubmitting ? 'Submitting...' : 'Submit for HR approval'}

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>

                <AlertDialog
                    open={hrRejectRequestId !== null}
                    onOpenChange={(open) => {
                        if (!open && !hrRespondSubmitting) {
                            setHrRejectRequestId(null);
                            setHrRejectComment('');
                        }
                    }}
                >
                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8 max-w-lg">
                        <AlertDialogHeader className="mb-4">
                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Reject not renew request</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-500 font-medium">
                                A clear rejection reason is required so the requester understands why the document was not approved for non-renewal.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <textarea
                            value={hrRejectComment}
                            onChange={(e) => setHrRejectComment(e.target.value)}
                            rows={4}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                            placeholder="Rejection reason (min. 3 characters)"
                        />
                        <AlertDialogFooter className="gap-3">
                            <AlertDialogCancel
                                className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6"
                                disabled={hrRespondSubmitting}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-8"
                                disabled={hrRespondSubmitting || hrRejectComment.trim().length < 3}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleHrRejectNotRenew();
                                }}
                            >
                                {hrRespondSubmitting ? 'Sending...' : 'Confirm reject'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>



                <AlertDialog open={ownerToDelete !== null} onOpenChange={(open) => !open && setOwnerToDelete(null)}>

                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8">

                        <AlertDialogHeader className="mb-4">

                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Confirm Owner Removal</AlertDialogTitle>

                            <AlertDialogDescription className="text-gray-500 font-medium whitespace-pre-line">

                                Are you sure you want to remove this owner?

                                {"\n\n"}

                                Their details and associated documents will also be removed from the profile view. This action cannot be undone.

                            </AlertDialogDescription>

                        </AlertDialogHeader>

                        <AlertDialogFooter className="gap-3">

                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={confirmRemoveOwner}

                                className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-100 px-8"

                            >

                                Remove Owner

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>



                <AlertDialog open={documentToDelete !== null} onOpenChange={(open) => !open && setDocumentToDelete(null)}>

                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8">

                        <AlertDialogHeader className="mb-4">

                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Confirm Deletion</AlertDialogTitle>

                            <AlertDialogDescription className="text-gray-500 font-medium">

                                Are you sure you want to delete this document? This action cannot be undone.

                            </AlertDialogDescription>

                        </AlertDialogHeader>

                        <AlertDialogFooter className="gap-3">

                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>

                            <AlertDialogAction

                                onClick={(e) => {
                                    e.preventDefault();
                                    void confirmDeleteDocument();
                                }}

                                className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-100 px-8"

                            >

                                Delete Document

                            </AlertDialogAction>

                        </AlertDialogFooter>

                    </AlertDialogContent>

                </AlertDialog>

                <ConfirmAlertDialog
                    open={Boolean(confirmDialog?.open)}
                    onOpenChange={(open) => !open && closeConfirmDialog()}
                    title={confirmDialog?.title}
                    description={confirmDialog?.description}
                    confirmLabel={confirmDialog?.confirmLabel}
                    cancelLabel={confirmDialog?.cancelLabel}
                    destructive={confirmDialog?.destructive}
                    loading={confirmDialogLoading}
                    onConfirm={runConfirmDialogAction}
                />

                <ActivationHoldReviewModal
                    isOpen={activationHoldReviewModalOpen}
                    onClose={() => setActivationHoldReviewModalOpen(false)}
                    company={company}
                    onEditHeldEntry={handleHeldActivationEdit}
                    onSubmitForActivation={() => openActivationSubmitModal()}
                    onDiscardHeldEntry={async (entryId) => {
                        if (!company?._id || !entryId) return;
                        const res = await axiosInstance.delete(
                            `/Company/${company._id}/pending-activation-entry/${encodeURIComponent(String(entryId))}`,
                        );
                        if (res?.data?.company) setCompany(res.data.company);
                        if (res?.data?.activationProgress) {
                            setActivationProgressFromApi(res.data.activationProgress);
                        }
                        await fetchCompany();
                        const remainingHold =
                            res?.data?.company?.activationHold?.unapprovedEntryIds ??
                            company?.activationHold?.unapprovedEntryIds;
                        if (!Array.isArray(remainingHold) || remainingHold.length === 0) {
                            setActivationHoldReviewModalOpen(false);
                        }
                        toast({
                            title: 'Update removed',
                            description:
                                res?.data?.message ||
                                `This pending change was removed from the activation queue. Use ${activationSubmitLabel} only when you are ready.`,
                        });
                    }}
                />

                {showCertificateModal && (
                    <CertificateModal
                        isOpen={showCertificateModal}
                        onClose={() => {
                            setShowCertificateModal(false);
                            setEditingCertificateData(null);
                            setEditingCertificateIndex(null);
                        }}
                        onSuccess={() => {
                            fetchCompany();
                            setActiveTab('others');
                            setDocStatusTab('certificate');
                        }}
                        targetType="company"
                        targetId={companyId}
                        targetName={company?.name || ''}
                        companyRecord={{
                            companyId: company?.companyId || '',
                            name: company?.name || '',
                        }}
                        companyEmployees={allEmployees}
                        isEdit={!!editingCertificateData}
                        editData={editingCertificateData}
                        editIndex={editingCertificateIndex}
                    />
                )}

            </div >

        </div >

        </PermissionGuard>

    );

}

export default function CompanyProfilePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <CompanyProfilePageContent />
        </Suspense>
    );
}