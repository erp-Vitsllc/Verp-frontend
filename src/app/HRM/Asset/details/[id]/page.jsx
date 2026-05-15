'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useListReturnBack } from '@/hooks/useListReturnBack';
import Link from 'next/link';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
// import { hasPermission as hasModulePermission } from '@/utils/permissions'; // Asset group permission not complete
import {
    ArrowLeft,
    Package,
    ShieldCheck,
    AlertCircle,
    AlertTriangle,
    FileText,
    PencilLine,
    Download,
    ExternalLink,
    Smartphone,
    UserPlus,
    Printer,
    History,
    Camera,
    Image as ImageIcon,
    X,
    ArrowRightLeft,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    DollarSign,
    Loader2,
    CheckCircle2,
    Paperclip,
    Plus,
    RotateCw,
    Undo2,
    User,
    ArrowUpRight,
    ArrowDownLeft,
    Wrench,
    Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isAccessoryHiddenFromLiveAssetView } from '@/utils/accessoryAssetViewFilter';
// AccessoriesModal import removed - no longer needed
import TransferAccessoryModal from '../../components/TransferAccessoryModal';
import AssignAssetModal from '../../components/AssignAssetModal';
import TransferAssetModal from '../../components/TransferAssetModal';
import HandoverFormModal from '../../components/HandoverFormModal';
import HandoverFormView from '../../components/HandoverFormView';
import AddLossDamageModal from '@/app/HRM/Fine/components/AddLossDamageModal';
import SendToServiceModal from '../../components/SendToServiceModal';
import MarkAsLiveModal from '../../components/MarkAsLiveModal';
import AddAssetTypeModal from '../../components/AddAssetTypeModal';
import EndOfLifeModal from '../../components/EndOfLifeModal';
import VehicleAssetHistoryTab from '../../Vehicle/components/VehicleAssetHistoryTab';
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

/** Populated actionRequiredBy, else flowchart assetController from API (getAssetItemDetail). */
const getAssetApproverDisplayName = (asset) => {
    if (!asset) return '';
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

// Helper for initials
const getInitials = (name) => {
    if (!name) return 'AS';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
};

const calculateAge = (date) => {
    if (!date) return '0 Days';
    const start = new Date(date);
    const end = new Date();

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
        months--;
        const lastMonth = new Date(end.getFullYear(), end.getMonth(), 0);
        days += lastMonth.getDate();
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
    if (days > 0 || (years === 0 && months === 0)) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);

    return parts.join(' ');
};

const calculateWarrantyStatus = (purchaseDate, years) => {
    if (!purchaseDate || !years) return 'No Warranty info';
    const expiryDate = new Date(purchaseDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + parseInt(years));
    const today = new Date();

    let diffMs = expiryDate - today;
    if (diffMs < 0) return 'Warranty Expired';

    const diffDate = new Date(diffMs);
    const y = diffDate.getUTCFullYear() - 1970;
    const m = diffDate.getUTCMonth();

    return `${y} Year ${m} Month Warranty`;
};

const getFineIdFromHistoryEntry = (entry) => {
    const raw = entry?.details?.fineId;
    if (raw == null) return '';
    const val = String(raw).trim();
    return val;
};

export default function AssetDetailsPage() {
    const router = useRouter();
    const handleListReturnBack = useListReturnBack();
    const params = useParams();
    const searchParams = useSearchParams();
    const assetId = params.id;
    const { toast } = useToast();

    const authAction = searchParams.get('authAction'); // 'eol' or 'damage'
    const reporteeAction = searchParams.get('reporteeAction'); // 'eol' or 'damage'
    const tabParam = searchParams.get('tab'); // Tab parameter from URL
    const bulkCreationParam = searchParams.get('bulkCreation');
    const bulkCreationIdsParam = searchParams.get('bulkAssetIds');


    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    // Remove the accessories modal state and component
    const [showAccessoriesModal, setShowAccessoriesModal] = useState(false);
    const [showAddAccessoryForm, setShowAddAccessoryForm] = useState(false);
    const [newAccessory, setNewAccessory] = useState({ name: '', amount: '', description: '' });
    const [editingAccessory, setEditingAccessory] = useState(null); // For editing existing accessories
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [responseComment, setResponseComment] = useState('');
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseAction, setResponseAction] = useState(null);
    const [isAssetController, setIsAssetController] = useState(false);
    const [isHR, setIsHR] = useState(false);
    const formRef = useRef();

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [showMarkAsLiveModal, setShowMarkAsLiveModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showServiceExtendDialog, setShowServiceExtendDialog] = useState(false);
    const [serviceExtensionDays, setServiceExtensionDays] = useState(1);
    const [serviceExtensionReason, setServiceExtensionReason] = useState('');
    const [isExtendingService, setIsExtendingService] = useState(false);
    const [showEndOfLifeModal, setShowEndOfLifeModal] = useState(false);
    const [assetActionType, setAssetActionType] = useState('End of Life');
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [approvalComment, setApprovalComment] = useState('');
    const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
    const [finalizeComment, setFinalizeComment] = useState('');
    const [isProcessingFinalize, setIsProcessingFinalize] = useState(false);
    const [isProcessingApproval, setIsProcessingApproval] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '' });
    const [confirmAction, setConfirmAction] = useState(null);
    const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [isDownloadingHistory, setIsDownloadingHistory] = useState(false);
    const [assetHistory, setAssetHistory] = useState([]);
    const [expandedHistory, setExpandedHistory] = useState({});
    const [activeTab, setActiveTab] = useState('document');
    // Bulk selection for approval/rejection of pending actions marked as bulk.
    // Asset Controller can remove individual assets from the processing set.
    const [bulkSelectedAssetIds, setBulkSelectedAssetIds] = useState([]);

    const [currentUser, setCurrentUser] = useState(null);
    const [authUser, setAuthUser] = useState(null);
    const [transferModal, setTransferModal] = useState({ isOpen: false, accessory: null });
    const [damageInitialData, setDamageInitialData] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
    const [imageDeleteConfirm, setImageDeleteConfirm] = useState({ isOpen: false, imageId: null });
    const [imageUploadModal, setImageUploadModal] = useState({ isOpen: false, file: null, base64: null, caption: '', date: new Date().toISOString().split('T')[0] });
    // Accessory reject dialog — replaces the native browser prompt()
    const [accRejectDialog, setAccRejectDialog] = useState({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', loading: false });
    const [accAcceptDialog, setAccAcceptDialog] = useState({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', attachment: null, loading: false });
    const [unattachConfirm, setUnattachConfirm] = useState({ isOpen: false, accessory: null, reason: '', loading: false });
    const [accessoryDeleteConfirm, setAccessoryDeleteConfirm] = useState({ isOpen: false, accessory: null, loading: false });
    const [bulkCreationModalOpen, setBulkCreationModalOpen] = useState(false);
    const [bulkCreationAssets, setBulkCreationAssets] = useState([]);
    const [bulkCreationLoading, setBulkCreationLoading] = useState(false);
    const [bulkCreationActionLoading, setBulkCreationActionLoading] = useState(false);
    const [bulkCreationFilter, setBulkCreationFilter] = useState('');
    const [bulkCreationSelectedIds, setBulkCreationSelectedIds] = useState([]);

    // Return Asset Modal State (similar to SalaryTab)
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [isReturning, setIsReturning] = useState(false);
    const [returnMode, setReturnMode] = useState('individual'); // 'individual' | 'bulk'
    const [returnableAssets, setReturnableAssets] = useState([]);
    const [returnableLoading, setReturnableLoading] = useState(false);
    const [returnBulkSelectedIds, setReturnBulkSelectedIds] = useState([]);
    const [bulkReturnReviewOpen, setBulkReturnReviewOpen] = useState(false);
    const [bulkReturnReviewAssets, setBulkReturnReviewAssets] = useState([]);
    const [bulkReturnReviewLoading, setBulkReturnReviewLoading] = useState(false);
    /** Per-asset AC outcome for bulk Leave / End of Life (leave | eos | reject). Return bulk uses return|reject via same modal pattern. */
    const [bulkTransferReviewOpen, setBulkTransferReviewOpen] = useState(false);
    const [bulkTransferReviewAssets, setBulkTransferReviewAssets] = useState([]);
    const [bulkTransferReviewLoading, setBulkTransferReviewLoading] = useState(false);
    const [bulkDispositionById, setBulkDispositionById] = useState({});

    // Delete Asset Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const userIsAdmin =
        !!(currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT' ||
            authUser?.isAdmin || authUser?.role === 'Admin' || authUser?.role === 'ROOT');

    // Asset hrm_asset group permission not complete — module checks disabled; flowchart/API roles only.
    // const hasAssetModuleWritePerm =
    //     typeof window !== 'undefined' &&
    //     (hasModulePermission('hrm_asset', 'isEdit') ||
    //         hasModulePermission('hrm_asset', 'isCreate') ||
    //         hasModulePermission('hrm_asset', 'isDelete'));
    const hasAssetModuleWritePerm = false;

    // const hasAssetModuleAnyPerm =
    //     typeof window !== 'undefined' &&
    //     (hasModulePermission('hrm_asset', 'isView') ||
    //         hasModulePermission('hrm_asset', 'isEdit') ||
    //         hasModulePermission('hrm_asset', 'isCreate') ||
    //         hasModulePermission('hrm_asset', 'isDelete'));
    const hasAssetModuleAnyPerm = false;

    /** Flowchart / API role OR equivalent HRM Asset permission group (edit/create/delete). */
    const effectiveIsAssetController = useMemo(
        () => isAssetController || hasAssetModuleWritePerm,
        [isAssetController, hasAssetModuleWritePerm]
    );

    /** Flowchart / company-assets HR check OR Company → Assets permission group. */
    const effectiveIsHR = useMemo(() => {
        if (isHR) return true;
        // Asset / company-assets group permission not complete — company module checks disabled.
        // if (typeof window === 'undefined') return false;
        // return (
        //     hasModulePermission('hrm_company_view_assets', 'isView') ||
        //     hasModulePermission('hrm_company_view_assets', 'isEdit') ||
        //     hasModulePermission('hrm_company_view_assets', 'isCreate') ||
        //     hasModulePermission('hrm_company_view_assets', 'isDelete')
        // );
        return false;
    }, [isHR]);

    /** Print / pool tools when asset has no assignee: admin, flowchart AC, asset-linked AC id, or HRM Asset permission group. */
    const canUseUnassignedAssetPoolTools = useMemo(() => {
        if (userIsAdmin) return true;
        if (effectiveIsAssetController) return true;
        if (hasAssetModuleAnyPerm) return true;
        const eid = currentUserEmployeeId?.toString();
        const acId = asset?.assetControllerId?.toString?.();
        if (eid && acId && eid === acId) return true;
        return eid === 'flowchart_assetcontroller';
    }, [userIsAdmin, effectiveIsAssetController, hasAssetModuleAnyPerm, currentUserEmployeeId, asset?.assetControllerId]);

    /** Edit accessory name/description (and admin-only amount): Admin, Asset Controller role, or this asset's controller id. */
    const canEditAccessoryAttached = useMemo(() => {
        if (userIsAdmin) return true;
        if (effectiveIsAssetController) return true;
        const eid = currentUserEmployeeId?.toString();
        const acId = asset?.assetControllerId?.toString?.();
        if (eid && acId && eid === acId) return true;
        return eid === 'flowchart_assetcontroller';
    }, [userIsAdmin, effectiveIsAssetController, currentUserEmployeeId, asset?.assetControllerId]);

    /** Pending accessory additions — assignee, designated approver, or anyone who counts as Asset Controller for edits (API also filters). */
    const canSeePendingAccessoryAdds = useMemo(() => {
        if (canEditAccessoryAttached) return true;
        const eid = currentUserEmployeeId?.toString();
        if (!eid) return false;
        const assigneeRef = asset?.assignedTo?._id ?? asset?.assignedTo;
        if (assigneeRef && eid === assigneeRef.toString()) return true;
        const ar = asset?.actionRequiredBy?._id ?? asset?.actionRequiredBy;
        if (ar && eid === ar.toString()) return true;
        return false;
    }, [canEditAccessoryAttached, currentUserEmployeeId, asset?.assignedTo, asset?.actionRequiredBy]);

    /** Lost / End of Life accessories stay in data for catalog/history but are hidden here (treated as unattached on the asset). */
    const accessoriesVisibleOnAssetPage = useMemo(() => {
        return (asset?.accessories || []).filter((a) => {
            if (isAccessoryHiddenFromLiveAssetView(a)) return false;
            const pendingAdd =
                String(a?.status || '').trim() === 'Pending' &&
                String(a?.pendingAction || '').trim() === 'Add';
            if (pendingAdd && !canSeePendingAccessoryAdds) return false;
            return true;
        });
    }, [asset?.accessories, canSeePendingAccessoryAdds]);

    /** Creator must not edit while status is Submitted for Approval (AC/Admin still can). */
    const creatorCannotEditSubmittedAsset = useMemo(() => {
        if (!asset || !currentUserId) return false;
        if (userIsAdmin) return false;
        const st = String(asset.status || '').trim().toLowerCase();
        if (st !== 'submitted for approval') return false;
        const isCreator =
            asset?.createdBy?._id?.toString() === currentUserId ||
            asset?.createdBy?.toString() === currentUserId;
        return !!isCreator;
    }, [asset, currentUserId, userIsAdmin]);

    useEffect(() => {
        if (creatorCannotEditSubmittedAsset && showEditModal) {
            setShowEditModal(false);
        }
    }, [creatorCannotEditSubmittedAsset, showEditModal]);

    const handleDeleteAsset = async () => {
        setIsDeleting(true);
        try {
            await axiosInstance.delete(`/AssetItem/${assetId}`);
            toast({ title: "Success", description: "Asset deleted successfully." });
            router.push('/HRM/Asset'); // Redirect to asset list
        } catch (err) {
            console.error("Error deleting asset:", err);
            toast({ variant: "destructive", title: "Error", description: err.response?.data?.message || "Failed to delete asset." });
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleReturnAsset = async () => {
        try {
            const statusLower = String(asset?.status || '').toLowerCase().trim();
            const endpoint =
                statusLower === 'service' || statusLower === 'on service'
                    ? `/AssetItem/${assetId}/on-service-action`
                    : `/AssetItem/${assetId}/return`;
            const response = await axiosInstance.put(
                endpoint,
                endpoint.includes('/on-service-action') ? { action: 'Return' } : undefined
            );
            toast({
                title: "Success",
                description: response?.data?.message || "Return request processed."
            });
            setReturnConfirmOpen(false);
            fetchAssetDetails();
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Error",
                description: err?.response?.data?.message || "Failed to return asset."
            });
        }
    };

    const handleExtendService = async () => {
        const d = parseInt(String(serviceExtensionDays || '').trim(), 10);
        if (!Number.isInteger(d) || d < 1 || d > 30) {
            toast({
                variant: 'destructive',
                title: 'Invalid duration',
                description: 'Enter extension days between 1 and 30.'
            });
            return;
        }
        const reason = String(serviceExtensionReason || '').trim();
        if (!reason) {
            toast({
                variant: 'destructive',
                title: 'Reason required',
                description: 'Please enter extension reason.'
            });
            return;
        }
        setIsExtendingService(true);
        try {
            const response = await axiosInstance.put(`/AssetItem/${assetId}/on-service-action`, {
                action: 'Extend',
                extensionDays: d,
                extensionReason: reason
            });
            toast({
                title: 'Success',
                description: response?.data?.message || `Service duration extended by ${d} day(s).`
            });
            setShowServiceExtendDialog(false);
            fetchAssetDetails();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err?.response?.data?.message || 'Failed to extend service duration.'
            });
        } finally {
            setIsExtendingService(false);
        }
    };

    const canUseBulkReturnUi = useMemo(() => {
        if (!asset?._id || asset.status !== 'Assigned') return false;
        const assigneeRef = asset?.assignedTo?._id ?? asset?.assignedTo;
        const isAssignee =
            !!assigneeRef && currentUserEmployeeId?.toString() === assigneeRef.toString();
        return isAssignee && !userIsAdmin && !isAssetController;
    }, [asset, currentUserEmployeeId, userIsAdmin, isAssetController]);

    useEffect(() => {
        if (!showReturnModal || !asset?._id) return;
        if (!canUseBulkReturnUi) {
            setReturnableAssets([]);
            setReturnBulkSelectedIds(asset._id ? [asset._id] : []);
            setReturnMode('individual');
            return;
        }
        setReturnableLoading(true);
        axiosInstance
            .get('/AssetItem/assigned/me-for-return')
            .then((r) => {
                const items = r.data?.items || [];
                setReturnableAssets(items);
                const cur = asset._id?.toString();
                setReturnBulkSelectedIds(cur ? [cur] : []);
                setReturnMode('individual');
            })
            .catch(() => {
                setReturnableAssets([]);
                setReturnBulkSelectedIds(asset._id ? [asset._id] : []);
            })
            .finally(() => setReturnableLoading(false));
    }, [showReturnModal, asset?._id, canUseBulkReturnUi]);

    const toggleReturnBulkAsset = (otherId) => {
        if (!otherId || !asset?._id) return;
        const cur = asset._id.toString();
        if (String(otherId) === cur) return;
        setReturnBulkSelectedIds((prev) => {
            const s = new Set((prev || []).map(String));
            const o = String(otherId);
            if (s.has(o)) s.delete(o);
            else s.add(o);
            s.add(cur);
            const order = returnableAssets.map((a) => a._id?.toString()).filter(Boolean);
            const ordered = [];
            for (const id of order) {
                if (s.has(id)) ordered.push(id);
            }
            if (s.has(cur) && !ordered.includes(cur)) ordered.unshift(cur);
            return ordered;
        });
    };

    const checkAllBulkReturnSelection = () => {
        const bulkIds = (asset?.pendingActionDetails?.bulkAssetIds || []).map(String);
        setBulkSelectedAssetIds(bulkIds);
    };

    const uncheckAllBulkReturnSelection = () => {
        setBulkSelectedAssetIds([]);
    };

    const openBulkReturnReview = async () => {
        const ids = asset?.pendingActionDetails?.bulkAssetIds || [];
        if (!ids.length) return;
        setBulkReturnReviewOpen(true);
        setBulkReturnReviewLoading(true);
        try {
            const res = await axiosInstance.get(
                `/AssetItem/bulk/details?ids=${encodeURIComponent(ids.map(String).join(','))}`
            );
            setBulkReturnReviewAssets(res.data?.items || []);
        } catch {
            setBulkReturnReviewAssets([]);
        } finally {
            setBulkReturnReviewLoading(false);
        }
    };

    const openBulkTransferDispositionReview = async () => {
        const ids = asset?.pendingActionDetails?.bulkAssetIds || [];
        if (!ids.length) return;
        const pending = asset?.pendingAction;
        setBulkTransferReviewOpen(true);
        setBulkTransferReviewLoading(true);
        const initial = {};
        for (const id of ids) {
            const idStr = String(id);
            if (!bulkSelectedAssetIds.includes(idStr)) {
                initial[idStr] = 'reject';
                continue;
            }
            if (pending === 'Leave') initial[idStr] = 'leave';
            else if (pending === 'End of Life') initial[idStr] = 'eos';
            else if (pending === 'Return Asset') initial[idStr] = 'return';
            else initial[idStr] = 'reject';
        }
        setBulkDispositionById(initial);
        try {
            const res = await axiosInstance.get(
                `/AssetItem/bulk/details?ids=${encodeURIComponent(ids.map(String).join(','))}`
            );
            setBulkTransferReviewAssets(res.data?.items || []);
        } catch {
            setBulkTransferReviewAssets([]);
        } finally {
            setBulkTransferReviewLoading(false);
        }
    };

    const toggleBulkTransferDispositionCheckbox = (rid) => {
        const idStr = String(rid);
        const pendingKind = asset?.pendingAction;
        const approveVal = pendingKind === 'End of Life' ? 'eos' : 'leave';
        setBulkDispositionById((p) => {
            const cur = p[idStr] || 'reject';
            const isApproved = cur === approveVal;
            return { ...p, [idStr]: isApproved ? 'reject' : approveVal };
        });
    };

    const checkAllBulkTransferDispositions = () => {
        const pendingKind = asset?.pendingAction;
        const approveVal = pendingKind === 'End of Life' ? 'eos' : 'leave';
        const ids = (asset?.pendingActionDetails?.bulkAssetIds || []).map(String);
        setBulkDispositionById((p) => {
            const next = { ...p };
            for (const id of ids) next[id] = approveVal;
            return next;
        });
    };

    const uncheckAllBulkTransferDispositions = () => {
        const ids = (asset?.pendingActionDetails?.bulkAssetIds || []).map(String);
        setBulkDispositionById((p) => {
            const next = { ...p };
            for (const id of ids) next[id] = 'reject';
            return next;
        });
    };

    const buildBulkDispositionPayload = () => {
        const bulkIds = (asset?.pendingActionDetails?.bulkAssetIds || []).map(String);
        const pending = asset?.pendingAction;
        const m = {};
        for (const id of bulkIds) {
            const idStr = String(id);
            const fromModal = bulkDispositionById[idStr];
            if (fromModal && ['leave', 'eos', 'eol', 'return', 'reject'].includes(fromModal)) {
                m[idStr] = fromModal;
                continue;
            }
            if (!bulkSelectedAssetIds.includes(idStr)) {
                m[idStr] = 'reject';
                continue;
            }
            if (pending === 'Leave') m[idStr] = 'leave';
            else if (pending === 'End of Life') m[idStr] = 'eos';
            else if (pending === 'Return Asset') m[idStr] = 'return';
            else m[idStr] = 'reject';
        }
        return m;
    };

    // Enhanced Return Asset function (similar to SalaryTab)
    const submitReturnAsset = async () => {
        if (!asset) return;

        setIsReturning(true);
        try {
            const payload = {};
            if (canUseBulkReturnUi && returnMode === 'bulk' && returnBulkSelectedIds.length > 0) {
                payload.bulkAssetIds = returnBulkSelectedIds.map(String);
            }
            const statusLower = String(asset?.status || '').toLowerCase().trim();
            const response =
                statusLower === 'service' || statusLower === 'on service'
                    ? await axiosInstance.put(`/AssetItem/${asset._id}/on-service-action`, { action: 'Return' })
                    : await axiosInstance.put(`/AssetItem/${asset._id}/return`, payload);
            toast({
                title: "Success",
                description: response?.data?.message || "Return request processed."
            });
            setShowReturnModal(false);
            fetchAssetDetails();
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
    const handleAssetCreationResponse = async (action) => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/approve-creation`, { action });
            toast({
                title: action === 'Approve' ? 'Asset Approved' : 'Returned to Draft',
                description:
                    action === 'Approve'
                        ? 'The asset is now active and unassigned.'
                        : 'The creator can edit this asset and resubmit for approval.'
            });
            fetchAssetDetails();
            fetchAssetHistory();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Failed to process request.' });
        }
    };

    const handleSubmitDraftForApproval = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/submit-creation`);
            toast({
                title: 'Submitted',
                description: 'Asset Controller has been notified for approval.'
            });
            fetchAssetDetails();
            fetchAssetHistory();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to submit for approval.'
            });
        }
    };

    const bulkCreationIdsFromQuery = useMemo(() => {
        if (!bulkCreationIdsParam) return [];
        return Array.from(
            new Set(
                String(bulkCreationIdsParam)
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
            )
        );
    }, [bulkCreationIdsParam]);

    const fetchBulkCreationAssets = async () => {
        if (bulkCreationIdsFromQuery.length === 0) return;
        setBulkCreationLoading(true);
        try {
            const response = await axiosInstance.get(`/AssetItem/bulk/details?ids=${encodeURIComponent(bulkCreationIdsFromQuery.join(','))}`);
            const items = Array.isArray(response?.data?.items) ? response.data.items : [];
            setBulkCreationAssets(items);
            setBulkCreationSelectedIds(items.map((it) => it._id?.toString()).filter(Boolean));
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err?.response?.data?.message || 'Failed to load bulk assets.'
            });
        } finally {
            setBulkCreationLoading(false);
        }
    };

    useEffect(() => {
        const isBulkCreationFlow = bulkCreationParam === '1' && bulkCreationIdsFromQuery.length > 0;
        if (!isBulkCreationFlow) return;
        fetchBulkCreationAssets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bulkCreationParam, bulkCreationIdsFromQuery.length]);

    const handleBulkCreationResponse = async (action) => {
        if (!bulkCreationSelectedIds.length) {
            toast({ variant: 'destructive', title: 'No assets selected', description: 'Select at least one asset to continue.' });
            return;
        }
        setBulkCreationActionLoading(true);
        try {
            const response = await axiosInstance.put('/AssetItem/bulk/approve-creation', {
                assetIds: bulkCreationSelectedIds,
                action
            });
            toast({
                title:
                    action === 'Approve'
                        ? 'Bulk Approved'
                        : action === 'Reject'
                            ? 'Returned to Draft'
                            : 'Bulk Updated',
                description: response?.data?.message || `Bulk ${action.toLowerCase()} completed.`
            });
            setBulkCreationModalOpen(false);
            fetchAssetDetails();
            fetchAssetHistory();
            router.replace(`/HRM/Asset/details/${assetId}`);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err?.response?.data?.message || 'Failed to process bulk request.' });
        } finally {
            setBulkCreationActionLoading(false);
        }
    };

    const handleActionRequest = async ({ reason, attachment, fineData = null, customActionType = null, accessoryId = null, includeFineDataForLossDamage = false }) => {
        try {
            const actionType = customActionType || assetActionType;
            const targetAccId = accessoryId;

            // For Loss and Damage, don't send fineData in initial request (only description and attachment)
            const requestPayload = {
                actionType,
                reason,
                attachment
            };

            // Include fineData for non-L&D actions, and for direct authority L&D path.
            if ((actionType !== 'Loss and Damage' || includeFineDataForLossDamage) && fineData) {
                requestPayload.fineData = fineData;
            }

            if (targetAccId) {
                // Accessory action
                const response = await axiosInstance.put(
                    `/AssetItem/${assetId}/accessories/${targetAccId}/request-action`,
                    requestPayload
                );
                toast({
                    title: actionType === 'Loss and Damage' && includeFineDataForLossDamage ? 'Processed' : 'Request Sent',
                    description: response?.data?.message || `${actionType} request for accessory sent to Asset Controller for approval.`
                });

            } else {
                // Main asset action
                const response = await axiosInstance.put(`/AssetItem/${assetId}/request-action`, requestPayload);
                toast({ title: 'Request Sent', description: `Request for ${actionType} sent to Asset Controller.` });
                if (response?.data?.message) {
                    toast({ title: 'Success', description: response.data.message });
                }

            }
            setShowEndOfLifeModal(false);
            fetchAssetDetails();
            fetchAssetHistory();
        } catch (err) {
            console.error('Error requesting action:', err);
            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Failed to send request.' });
            throw err;
        }
    };

    const handleApproveAction = async (approve) => {
        setIsProcessingApproval(true);
        try {
            const isBulkTransfer = asset?.pendingActionDetails?.isBulk === true;
            const bulkDisposition =
                isBulkTransfer && approve ? buildBulkDispositionPayload() : undefined;
            const bulkAssetIdsToProcess = isBulkTransfer ? bulkSelectedAssetIds : undefined;
            const pendingAccessory = asset.accessories?.find(acc => acc.pendingAction);
            if (pendingAccessory) {
                // Respond to accessory action
                const response = await axiosInstance.put(`/AssetItem/${assetId}/accessories/${pendingAccessory._id}/respond-action`, {
                    approve,
                    comment: approvalComment
                });

                // Check if approval requires fine data (Loss and Damage without fineData)
                if (approve && response.data?.requiresFineData && response.data?.accessory && response.data?.asset) {
                    const accessoryData = response.data.accessory;
                    const assetData = response.data.asset;
                    // Open Loss and Damage modal with existing data
                    setDamageInitialData({
                        assetId: assetData.assetId,
                        assetName: assetData.name,
                        assetObjectId: assetData._id,
                        isAssetFlow: true,
                        isApprovalFlow: true,
                        isAccessoryFlow: true, // Flag for accessory
                        accessoryId: accessoryData.accessoryId,
                        accessoryName: accessoryData.name,
                        accessoryObjectId: accessoryData._id,
                        employeeId: assetData.assignedTo?.employeeId || '',
                        employeeName: assetData.assignedTo
                            ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                            : '',
                        assignedToType: assetData.assignedToType || (assetData.assignedCompany ? 'Company' : 'Employee'),
                        company: assetData.assignedCompany?._id || assetData.assignedCompany || null,
                        description: accessoryData.pendingActionDetails?.reason || '',
                        attachment: accessoryData.pendingActionDetails?.attachment || null,
                        fineAmount: accessoryData.amount ? String(accessoryData.amount) : '',
                        responsibleFor: assetData.assignedToType === 'Company' ? 'Company' : 'Employee'
                    });
                    setApprovalComment('');
                    setShowDamageModal(true);
                    setIsProcessingApproval(false);
                    return; // Don't refresh yet, wait for modal submission
                }
            } else {
                // Original asset action
                const response = await axiosInstance.put(`/AssetItem/${assetId}/approve-action`, {
                    approve,
                    comment: approvalComment,
                    ...(isBulkTransfer
                        ? { bulkDisposition, ...(bulkDisposition ? {} : { bulkAssetIdsToProcess }) }
                        : {})
                });

                // Check if approval requires fine data (Loss and Damage without fineData)
                if (approve && response.data?.requiresFineData && response.data?.asset) {
                    const assetData = response.data.asset;
                    // Open Loss and Damage modal with existing data
                    setDamageInitialData({
                        assetId: assetData.assetId,
                        assetName: assetData.name,
                        assetObjectId: assetData._id,
                        isAssetFlow: true,
                        isApprovalFlow: true, // Flag to indicate this is from approval
                        employeeId: assetData.assignedTo?.employeeId || '',
                        employeeName: assetData.assignedTo
                            ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                            : '',
                        assignedToType: assetData.assignedToType || (assetData.assignedCompany ? 'Company' : 'Employee'),
                        company: assetData.assignedCompany?._id || assetData.assignedCompany || null,
                        responsibleFor:
                            assetData.assignedToType === 'Company' || assetData.assignedCompany ? 'Company' : 'Employee',
                        description: assetData.pendingActionDetails?.reason || '',
                        attachment: assetData.pendingActionDetails?.attachment || null,
                        fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                    });
                    setApprovalComment('');
                    setShowDamageModal(true);
                    setIsProcessingApproval(false);
                    return; // Don't refresh yet, wait for modal submission
                }
            }
            toast({
                title: approve ? "Approved" : "Rejected",
                description: approve
                    ? (pendingAccessory ? `Action for "${pendingAccessory.name}" approved.` : "Asset status updated. Fine created if applicable.")
                    : "Request rejected. Item returned to previous status."
            });
            setShowRejectDialog(false);
            setApprovalComment('');
            fetchAssetDetails();
            fetchAssetHistory();
            // Clear query params
            router.replace(`/HRM/Asset/details/${assetId}`);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || "Failed to process approval." });
        } finally {
            setIsProcessingApproval(false);
        }
    };

    // Sync bulk selection with what backend stored in pendingActionDetails.
    useEffect(() => {
        const isBulk = asset?.pendingActionDetails?.isBulk === true;
        const bulkIds = Array.isArray(asset?.pendingActionDetails?.bulkAssetIds)
            ? asset.pendingActionDetails.bulkAssetIds.map(String)
            : [];

        if (isBulk && bulkIds.length > 0) {
            setBulkSelectedAssetIds(Array.from(new Set(bulkIds)));
        } else {
            setBulkSelectedAssetIds([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asset?._id, asset?.pendingActionDetails?.isBulk, asset?.pendingActionDetails?.bulkAssetIds?.length]);

    const toggleBulkAssetSelection = (bulkAssetId) => {
        if (!bulkAssetId) return;
        const idStr = bulkAssetId.toString();

        setBulkSelectedAssetIds((prev) => {
            const set = new Set((prev || []).map(String));
            if (set.has(idStr)) set.delete(idStr);
            else set.add(idStr);

            const original = (asset?.pendingActionDetails?.bulkAssetIds || []).map(String);
            return [...new Set(original.filter(Boolean))].filter((x) => set.has(x));
        });
    };

    const handleFinalizeAction = async (approve) => {
        setIsProcessingFinalize(true);
        try {
            const pendingAccessory = asset.accessories?.find(acc => acc.pendingAction);
            if (pendingAccessory) {
                // Finalize accessory action
                await axiosInstance.put(`/AssetItem/${assetId}/accessories/${pendingAccessory._id}/finalize-action`, {
                    approve,
                    comment: finalizeComment
                });
            } else {
                // Original asset action
                await axiosInstance.put(`/AssetItem/${assetId}/finalize-action`, {
                    approve,
                    comment: finalizeComment
                });
            }
            toast({
                title: approve ? "Finalized" : "Declined",
                description: approve ? "Item status updated to final state." : "Update declined."
            });
            setShowFinalizeDialog(false);
            setFinalizeComment('');
            fetchAssetDetails();
            fetchAssetHistory();
            router.replace(`/HRM/Asset/details/${assetId}`);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || "Failed to process finalization." });
        } finally {
            setIsProcessingFinalize(false);
        }
    };

    useEffect(() => {
        if (authAction && asset) {
            // For Loss and Damage without fineData, open the Loss and Damage form modal directly
            if (asset.pendingAction === 'Loss and Damage' && !asset.pendingActionDetails?.fineData) {
                const assetData = asset;
                setDamageInitialData({
                    assetId: assetData.assetId,
                    assetName: assetData.name,
                    assetObjectId: assetData._id,
                    isAssetFlow: true,
                    isApprovalFlow: true,
                    employeeId: assetData.assignedTo?.employeeId || '',
                    employeeName: assetData.assignedTo
                        ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                        : '',
                    assignedToType: assetData.assignedToType || (assetData.assignedCompany ? 'Company' : 'Employee'),
                    company: assetData.assignedCompany?._id || assetData.assignedCompany || null,
                    responsibleFor:
                        assetData.assignedToType === 'Company' || assetData.assignedCompany ? 'Company' : 'Employee',
                    description: assetData.pendingActionDetails?.reason || '',
                    attachment: assetData.pendingActionDetails?.attachment || null,
                    fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                });
                setShowDamageModal(true);
            } else if (authAction === 'accessory') {
                // Keep deep link behavior for accessory approval pages.
                setActiveTab('accessories');
            }
        }
    }, [authAction, asset]);

    // Handle tab parameter from URL (e.g., ?tab=accessories)
    useEffect(() => {
        if (tabParam && ['document', 'history', 'accessories', 'images', 'edit'].includes(tabParam)) {
            // Use a small timeout to ensure it runs after other state updates
            setTimeout(() => {
                setActiveTab(tabParam);
            }, 100);

            // Clear the tab parameter from URL after setting it (but keep other params like authAction)
            const newSearchParams = new URLSearchParams(searchParams.toString());
            newSearchParams.delete('tab');
            const newQuery = newSearchParams.toString();
            const newUrl = newQuery ? `/HRM/Asset/details/${assetId}?${newQuery}` : `/HRM/Asset/details/${assetId}`;
            router.replace(newUrl, { scroll: false });
        }
    }, [tabParam, assetId, router, searchParams]);

    useEffect(() => {
        if (reporteeAction && asset && !showFinalizeDialog) {
            setShowFinalizeDialog(true);
        }
    }, [reporteeAction, asset]);

    const handleDeleteImage = async () => {
        const st = String(asset?.status ?? '').trim().toLowerCase();
        if (st === 'draft' || st === 'rejected') return;
        const { imageId } = imageDeleteConfirm;
        try {
            await axiosInstance.delete(`/AssetItem/${assetId}/images/${imageId}`);
            toast({ title: 'Deleted', description: 'Image removed.' });
            setImageDeleteConfirm({ isOpen: false, imageId: null });
            fetchAssetDetails();
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete image.' });
        }
    };

    const handleUploadImage = async () => {
        const st = String(asset?.status ?? '').trim().toLowerCase();
        if (st === 'draft' || st === 'rejected') return;
        const { base64, file, caption, date } = imageUploadModal;
        try {
            await axiosInstance.post(`/AssetItem/${assetId}/images`, {
                imageData: base64,
                imageName: file.name,
                imageMime: file.type,
                caption,
                date: date || new Date().toISOString()
            });
            toast({ title: 'Success', description: 'Image uploaded.' });
            setImageUploadModal({ isOpen: false, file: null, base64: null, caption: '', date: '' });
            fetchAssetDetails();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload image.' });
        }
    };



    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (!localStorage.getItem('token')) {
                const path = window.location.pathname || '/HRM/Asset';
                window.location.replace(`/login?redirectTo=${encodeURIComponent(path)}`);
                return;
            }
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setAuthUser(user);
            // Try employeeObjectId first (EmployeeBasic linkage), fallback to _id (User record)
            const currentId = user.employeeObjectId || user._id;
            const userId = user._id || user.id;
            setCurrentUserEmployeeId(currentId);
            setCurrentUserId(userId);

            // Fetch full user profile and then check for controller to ensure company context
            const fetchUserDataAndCheckController = async () => {
                try {
                    const [userRes, companyRes] = await Promise.all([
                        axiosInstance.get('/Employee/me'),
                        axiosInstance.get('/company', { params: { scope: 'responsibilities' } })
                    ]);

                    const companies = companyRes.data?.companies || [];

                    if (userRes && userRes.data) {
                        setCurrentUser(userRes.data);
                        const actualId = userRes.data._id || userRes.data.id;
                        if (actualId) {
                            setCurrentUserEmployeeId(actualId);
                        }

                        // Check flowchart responsibilities
                        const checkResponsibility = (cat) => companies.some(company =>
                            company.responsibilities?.some(r => {
                                if ((r.category || '').toLowerCase().replace(/\s+/g, '') !== cat.toLowerCase().replace(/\s+/g, '') || r.status !== 'Active') return false;

                                // Resilient ID matching (case-insensitive and space-agnostic)
                                if (r.employeeId && userRes.data.employeeId) {
                                    const normalize = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
                                    if (normalize(r.employeeId) === normalize(userRes.data.employeeId)) return true;
                                }

                                const rEmpObjId = r.employeeObjectId?._id?.toString() || r.employeeObjectId?.toString();
                                const userEmpObjId = actualId?.toString() || userRes.data._id?.toString();
                                return rEmpObjId && userEmpObjId && rEmpObjId === userEmpObjId;
                            })
                        );

                        let hrFound =
                            checkResponsibility('hr') ||
                            checkResponsibility('assigneduser') ||
                            checkResponsibility('admincontroller');
                        let assetControllerFound = checkResponsibility('assetcontroller');

                        // Align with backend: authorize via Flowchart (same as isUserInFlowchart). Company "responsibilities"
                        // can be out of sync with Flowchart, which breaks Approve/Reject for real controllers.
                        if (userRes.data?.employeeId) {
                            try {
                                const ctrlRes = await axiosInstance.get(
                                    `/AssetItem/unassigned/controller/${encodeURIComponent(userRes.data.employeeId)}`,
                                    { skipToast: true }
                                ).catch(() => null);
                                if (ctrlRes?.status === 200) assetControllerFound = true;
                            } catch {
                                /* non-controller returns 403 — expected */
                            }
                        }

                        setIsAssetController(!!assetControllerFound);

                        // Fallback: Also check via API endpoint (same as SalaryTab)
                        if (!hrFound && userRes.data.employeeId) {
                            try {
                                const hrCheckRes = await axiosInstance.get(`/AssetItem/company-assets/hr/${userRes.data.employeeId}`);
                                if (hrCheckRes.status === 200 && hrCheckRes.data.isHR) {
                                    hrFound = true;
                                }
                            } catch (hrErr) {
                                console.log('HR check via API failed (non-critical):', hrErr);
                            }
                        }

                        setIsHR(!!hrFound);
                    }
                } catch (err) {
                    console.error("Failed to fetch user profile or companies:", err);
                }
            };
            fetchUserDataAndCheckController();
        }
    }, []);

    const fetchAssetHistory = async () => {
        try {
            const response = await axiosInstance.get(`/AssetItem/${assetId}/history`);
            setAssetHistory(response.data);
            // Default first item to expanded
            if (response.data?.length > 0) {
                setExpandedHistory({ 0: true });
            }
        } catch (error) {
            console.error('Error fetching asset history:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch history." });
        }
    };

    const downloadHistoryPdf = async (historyId) => {
        try {
            setIsDownloadingHistory(true);
            const response = await axiosInstance.get(`/AssetItem/history-handover-pdf/${historyId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `HandoverForm-${asset?.assetId}-History.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast({ title: "Success", description: "Historical handover form downloaded." });
        } catch (error) {
            console.error('Failed to download historical PDF:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to download historical form." });
        } finally {
            setIsDownloadingHistory(false);
        }
    };

    const [responseFile, setResponseFile] = useState(null);
    const [showFileModal, setShowFileModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                setResponseFile(reader.result);
            };
        }
    };

    const checkSignature = () => {
        if (!currentUser?.signature) {
            toast({
                variant: "destructive",
                title: "Digital Signature Required",
                description: "You must set your digital signature in your profile before accepting an asset."
            });
            return false;
        }
        return true;
    };

    const handleResponse = () => {
        setConfirmDialog({
            isOpen: true,
            type: 'response',
            title: 'Confirm Response',
            description: `Are you sure you want to ${responseAction === 'AcceptWithComments' || responseAction === 'Accept' ? 'accept' : 'reject'} this asset assignment?`
        });
    };

    const finalizeResponse = async (forcedAction = null) => {
        try {
            const action = forcedAction || responseAction;
            await axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                action,
                comments: responseComment,
                file: responseFile
            });
            toast({
                title: "Success",
                description: `Asset assignment ${action === 'Accept' || action === 'AcceptWithComments' ? 'accepted' : 'rejected'} successfully.`
            });
            setShowResponseModal(false);
            setResponseComment('');
            setResponseFile(null);
            fetchAssetDetails();
        } catch (error) {
            console.error('Error responding to assignment:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to submit response"
            });
        } finally {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
    };

    const finalizeDirectAccept = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                action: 'Accept',
                comments: ''
            });
            toast({ title: "Success", description: "Asset accepted successfully." });
            fetchAssetDetails();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to accept asset." });
        } finally {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
    };

    const executeConfirmAction = () => {
        if (confirmDialog.type === 'response') finalizeResponse();
        else if (confirmDialog.type === 'direct_accept') finalizeDirectAccept();
    };

    const openResponseModal = (action) => {
        if (action === 'AcceptWithComments' && !checkSignature()) return; // Check for AcceptWithComments too
        setResponseAction(action);
        setShowResponseModal(true);
    };

    const handleAddAccessory = async () => {
        const _assetStatusGuard = String(asset?.status ?? '').trim().toLowerCase();
        if (_assetStatusGuard === 'draft' || _assetStatusGuard === 'rejected') return;
        const nameTrimmed = String(newAccessory.name || '').trim();
        if (!nameTrimmed) {
            toast({ variant: 'destructive', title: 'Error', description: 'Name is required.' });
            return;
        }
        // Add flow: amount is required (0 is valid). Edit flow: amount optional — keep existing when blank.
        if (!editingAccessory) {
            const amountStr = String(newAccessory.amount ?? '').trim();
            if (amountStr === '') {
                toast({ variant: 'destructive', title: 'Error', description: 'Name and amount are required.' });
                return;
            }
        }
        if (editingAccessory && !canEditAccessoryAttached) {
            toast({
                variant: 'destructive',
                title: 'Access denied',
                description: 'Only Asset Controller or Admin can edit accessories.'
            });
            return;
        }

        try {
            const accessoriesPayloadFrom = (list) =>
                (list || []).map((acc) => ({
                    ...(acc._id != null && acc._id !== '' ? { _id: acc._id } : {}),
                    ...(acc.accessoryId != null && acc.accessoryId !== '' ? { accessoryId: acc.accessoryId } : {}),
                    name: acc.name,
                    amount: acc.amount != null && acc.amount !== '' ? Number(acc.amount) : 0,
                    description: acc.description != null ? String(acc.description) : '',
                    ...(acc.status != null && acc.status !== '' ? { status: acc.status } : {}),
                    ...(acc.pendingAction != null && acc.pendingAction !== ''
                        ? { pendingAction: acc.pendingAction }
                        : {}),
                    ...(acc.pendingActionDetails != null ? { pendingActionDetails: acc.pendingActionDetails } : {}),
                    ...(acc.attachment ? { attachment: acc.attachment } : {})
                }));

            let updatedAccessories;

            if (editingAccessory) {
                // Edit existing accessory — name required; amount optional (admin: blank keeps prior value)
                const amountStr = String(newAccessory.amount ?? '').trim();
                const priorAmount = Number(editingAccessory.amount) || 0;
                const nextAmount = userIsAdmin
                    ? (amountStr === '' ? priorAmount : Number(newAccessory.amount) || 0)
                    : priorAmount;
                const eid = editingAccessory._id?.toString?.() || editingAccessory._id;
                updatedAccessories = accessoriesPayloadFrom(asset.accessories).map((acc) => {
                    const aid = acc._id?.toString?.() || acc._id;
                    if (aid && eid && aid === eid) {
                        return {
                            ...acc,
                            name: nameTrimmed,
                            amount: nextAmount,
                            description: newAccessory.description != null ? String(newAccessory.description) : ''
                        };
                    }
                    return acc;
                });
            } else {
                updatedAccessories = [
                    ...accessoriesPayloadFrom(asset.accessories),
                    {
                        name: nameTrimmed,
                        amount: Number(newAccessory.amount) || 0,
                        description: newAccessory.description != null ? String(newAccessory.description) : ''
                    }
                ];
            }

            const response = await axiosInstance.put(`/AssetType/${asset._id}`, {
                accessories: updatedAccessories
            });

            toast({ title: 'Success', description: editingAccessory ? 'Accessory updated successfully.' : 'Accessory added successfully.' });
            setNewAccessory({ name: '', amount: '', description: '' });
            setEditingAccessory(null);
            setShowAddAccessoryForm(false);
            fetchAssetDetails();
        } catch (error) {
            console.error('Failed to save accessory:', error);
            toast({ variant: 'destructive', title: 'Error', description: error.response?.data?.message || 'Failed to save accessory.' });
        }
    };

    const handleEditAccessory = (accessory) => {
        const _assetStatusGuard = String(asset?.status ?? '').trim().toLowerCase();
        if (_assetStatusGuard === 'draft' || _assetStatusGuard === 'rejected') return;
        if (!canEditAccessoryAttached) {
            toast({
                variant: 'destructive',
                title: 'Access denied',
                description: 'Only Asset Controller or Admin can edit accessories.'
            });
            return;
        }
        setEditingAccessory(accessory);
        setNewAccessory({
            name: accessory.name || '',
            amount: accessory.amount != null ? String(accessory.amount) : '',
            description: accessory.description || ''
        });
        setShowAddAccessoryForm(true);
    };

    const handleUnattachAccessory = (accessory) => {
        if (!asset?._id || !accessory?._id) return;
        const _assetStatusGuard = String(asset?.status ?? '').trim().toLowerCase();
        if (_assetStatusGuard === 'draft' || _assetStatusGuard === 'rejected') return;
        setUnattachConfirm({ isOpen: true, accessory, reason: '', loading: false });
    };

    const executeDeleteAccessory = async () => {
        const target = accessoryDeleteConfirm.accessory;
        if (!userIsAdmin || !asset?._id || !target?._id) return;
        const _assetStatusGuard = String(asset?.status ?? '').trim().toLowerCase();
        if (_assetStatusGuard === 'draft' || _assetStatusGuard === 'rejected') return;
        setAccessoryDeleteConfirm((p) => ({ ...p, loading: true }));
        try {
            const updatedAccessories = (asset.accessories || []).filter(
                (a) => a._id?.toString() !== target._id?.toString()
            );
            await axiosInstance.put(`/AssetType/${asset._id}`, {
                accessories: updatedAccessories
            });
            toast({
                title: 'Accessory removed',
                description: `"${target.name || target.accessoryId || 'Accessory'}" was permanently removed from this asset.`
            });
            setAccessoryDeleteConfirm({ isOpen: false, accessory: null, loading: false });
            fetchAssetDetails();
            fetchAssetHistory();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error?.response?.data?.message || 'Failed to remove accessory.'
            });
            setAccessoryDeleteConfirm((p) => ({ ...p, loading: false }));
        }
    };

    const submitUnattachRequest = async () => {
        const acc = unattachConfirm.accessory;
        if (!asset?._id || !acc?._id) return;
        const _assetStatusGuard = String(asset?.status ?? '').trim().toLowerCase();
        if (_assetStatusGuard === 'draft' || _assetStatusGuard === 'rejected') return;
        setUnattachConfirm((p) => ({ ...p, loading: true }));
        try {
            await axiosInstance.put(`/AssetItem/${asset._id}/accessories/${acc._id}/request-action`, {
                actionType: 'Unattach',
                reason: unattachConfirm.reason?.trim() || 'Request to unattach accessory from asset.'
            });
            toast({
                title: 'Request sent',
                description: 'Unattach approval request was sent to the Asset Controller.'
            });
            setUnattachConfirm({ isOpen: false, accessory: null, reason: '', loading: false });
            fetchAssetDetails();
            fetchAssetHistory();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error?.response?.data?.message || 'Failed to send unattach request.'
            });
            setUnattachConfirm((p) => ({ ...p, loading: false }));
        }
    };

    const fetchAssetDetails = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/AssetItem/detail/${assetId}`);
            setAsset(response.data);
            // Auto-switch removed to keep document/form visible per user request
            if (response.data.status === 'Service') {
                // setActiveTab('edit');
            }
        } catch (error) {
            console.error('Error fetching asset details:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch asset details"
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/employee');
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
        }
    };

    useEffect(() => {
        if (!assetId) return;
        if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
            window.location.replace(
                `/login?redirectTo=${encodeURIComponent(window.location.pathname || '/HRM/Asset')}`
            );
            return;
        }
        fetchAssetDetails();
        fetchAssetHistory();
        fetchEmployees();
    }, [assetId]);

    // Calculate warranty progress
    const warrantyProgress = useMemo(() => {
        if (!asset?.purchaseDate || !asset?.warrantyYears) return 0;
        const purchaseDate = new Date(asset.purchaseDate);
        const expiryDate = new Date(purchaseDate);
        expiryDate.setFullYear(purchaseDate.getFullYear() + asset.warrantyYears);

        const today = new Date();
        const totalDuration = expiryDate.getTime() - purchaseDate.getTime();
        const elapsed = today.getTime() - purchaseDate.getTime();

        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        return Math.round(100 - progress); // Show remaining percentage
    }, [asset]);

    const userHistoryCount = useMemo(() => {
        if (!assetHistory) return 0;
        // Count unique users who were ever assigned this asset
        const recipients = new Set();
        assetHistory.forEach(h => {
            if (h.assignedTo?._id) recipients.add(h.assignedTo._id.toString());
            // If assignedTo is just a string (ID) in older records
            else if (typeof h.assignedTo === 'string') recipients.add(h.assignedTo);
        });
        return recipients.size || 0;
    }, [assetHistory]);

    const serviceHistoryCount = useMemo(() => {
        if (!assetHistory) return 0;
        // Count each time the asset was sent to service OR received from service
        // Usually 1 Send action = 1 service session.
        return assetHistory.filter(h =>
            h.action?.toLowerCase().includes('service') ||
            h.action?.toLowerCase().includes('maintenance') ||
            h.action?.toLowerCase().includes('repair')
        ).length;
    }, [assetHistory]);

    const assetAge = useMemo(() => {
        if (asset?.assignedTo && assetHistory?.length > 0) {
            // Find when this asset was assigned to this specific user
            const assignmentEvent = [...assetHistory].find(h => h.action === 'Assigned' && (h.assignedTo?._id === asset.assignedTo._id || h.assignedTo === asset.assignedTo._id));
            if (assignmentEvent) return calculateAge(assignmentEvent.date);
        }
        return calculateAge(asset?.purchaseDate || asset?.createdAt);
    }, [asset, assetHistory]);
    const warrantyRemaining = useMemo(() => calculateWarrantyStatus(asset?.purchaseDate, asset?.warrantyYears), [asset?.purchaseDate, asset?.warrantyYears]);

    const assignedSince = useMemo(() => {
        if (!asset?.assignedTo || !assetHistory?.length > 0) return 'N/A';
        const assignmentEvent = [...assetHistory].find(h => h.action === 'Assigned' && (h.assignedTo?._id === asset.assignedTo._id || h.assignedTo === asset.assignedTo._id));
        if (!assignmentEvent) return 'N/A';
        return calculateAge(assignmentEvent.date);
    }, [asset, assetHistory]);

    const temporaryAssignmentEndsInfo = useMemo(() => {
        if (!asset || asset.assignmentType !== 'Temporary' || !asset.temporaryEndDate) return null;
        const end = new Date(asset.temporaryEndDate);
        if (Number.isNaN(end.getTime())) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endStart = new Date(end);
        endStart.setHours(0, 0, 0, 0);

        const diffMs = endStart.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const endTxt = endStart.toLocaleDateString();

        let label = '';
        if (daysLeft > 0) label = `Ends in ${daysLeft} day(s)`;
        else if (daysLeft === 0) label = 'Ends today';
        else label = 'Expired (auto-unassign will run soon)';

        return { endTxt, daysLeft, label };
    }, [asset]);

    const isActiveCompanyAllocationUi = useMemo(() => {
        if (!asset) return false;
        const st = asset.status || '';
        if (['Unassigned', 'Draft', 'Rejected', 'End of Life'].includes(st)) return false;
        return String(asset.assignedToType || '').toLowerCase() === 'company' && !!asset.assignedCompany;
    }, [asset]);

    // Show Document tab + live handover form for employee assignee OR company allocation (not only assignedTo).
    const hasHandoverDocumentContext = useMemo(() => {
        if (!asset) return false;
        if (asset.assignedTo) return true;
        if (String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany) return true;
        if (asset.status === 'Service') return true;
        if (asset.status === 'Unassigned') return true;
        return false;
    }, [asset]);

    // Find the latest handover document from asset history for unassigned assets
    const latestHandoverDocument = useMemo(() => {
        if (!assetHistory || assetHistory.length === 0) return null;

        // Find the most recent "Assigned" or "Accepted" action that has details snapshot
        // Sort by date descending to get the latest first
        const sortedHistory = [...assetHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

        const latestHandover = sortedHistory.find(h =>
            (h.action === 'Assigned' || h.action === 'Accepted') &&
            h.details &&
            (h.details.assignedTo ||
                h.details.assignedCompany ||
                String(h.details.assignedToType || '').toLowerCase() === 'company')
        );

        return latestHandover || null;
    }, [assetHistory]);

    if (loading) {
        return (
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500 font-semibold">Loading asset details...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!asset) {
        return (
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8">
                        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-100">
                            <AlertCircle className="mx-auto text-gray-300 mb-4" size={56} />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Asset Not Found</h2>
                            <p className="text-gray-500 mb-8 max-w-md mx-auto">The asset you are looking for does not exist or has been removed from the management system.</p>
                            <button
                                onClick={handleListReturnBack}
                                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto shadow-lg shadow-blue-200"
                            >
                                <ArrowLeft size={20} />
                                Return to List
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const statusItems = [
        { type: 'value', text: `Valued at AED ${asset.assetValue || 0}`, color: 'bg-emerald-400' },
        { type: 'accessories', text: `${accessoriesVisibleOnAssetPage.length || 0} Accessories Attached`, color: 'bg-emerald-400' },
        { type: 'warranty', text: asset.warrantyYears > 0 ? 'Warranty Coverage Active' : 'No Warranty Coverage', color: 'bg-emerald-400' }
    ];

    const assetStatusLower = String(asset?.status ?? '').trim().toLowerCase();
    const isAssetDraftStatus = assetStatusLower === 'draft';
    const isRejectedStatus = assetStatusLower === 'rejected';
    const isAssetCreatorUser =
        !!currentUserId &&
        (asset?.createdBy?._id?.toString() === currentUserId || asset?.createdBy?.toString() === currentUserId);
    const isAccessoryTabLocked =
        (isAssetDraftStatus && !isAssetCreatorUser) || (isRejectedStatus && !isAssetCreatorUser);

    return (
        <div className="flex h-screen w-full max-w-full overflow-hidden" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                <Navbar />
                <div className="flex-1 overflow-y-auto p-8 scroll-smooth">

                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleListReturnBack}
                                className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 transition-all font-bold flex items-center gap-2"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Proactive Action Banner — for managers to approve or reportees to acknowledge */}
                            {(() => {
                                if (!asset) return null;

                                const isCreatorForBanner =
                                    asset?.createdBy?._id?.toString() === currentUserId ||
                                    asset?.createdBy?.toString() === currentUserId;
                                const isSaveOnlyDraftBanner =
                                    asset?.status === 'Draft' && !asset?.actionRequiredBy;

                                const isReturnedForResubmitBanner =
                                    asset?.status === 'Draft' &&
                                    !asset?.actionRequiredBy &&
                                    !!asset?.creationReturnedToDraftAt;

                                if (isReturnedForResubmitBanner && isCreatorForBanner) {
                                    return (
                                        <div className="flex items-center gap-4 px-6 py-3 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm">
                                            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
                                                <AlertCircle size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Not approved</p>
                                                <p className="text-[13px] font-bold text-rose-950 leading-snug">
                                                    This asset was returned to draft. Update details if needed, then submit again for Asset Controller review.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSubmitDraftForApproval}
                                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                            >
                                                Resubmit for approval
                                            </button>
                                        </div>
                                    );
                                }

                                if (isSaveOnlyDraftBanner && isCreatorForBanner) {
                                    return (
                                        <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                                            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700">
                                                <Plus size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Draft</p>
                                                <p className="text-[13px] font-bold text-slate-900 leading-snug">
                                                    This asset is saved as a draft. No approval request has been sent yet. Submit when you are ready.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSubmitDraftForApproval}
                                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                            >
                                                Submit for approval
                                            </button>
                                        </div>
                                    );
                                }

                                if (asset?.status === 'Rejected' && isCreatorForBanner) {
                                    return (
                                        <div className="flex items-center gap-4 px-6 py-3 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm">
                                            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
                                                <AlertCircle size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Creation rejected</p>
                                                <p className="text-[13px] font-bold text-rose-950 leading-snug">
                                                    This asset was not approved. Update details if needed, then submit again for Asset Controller review.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSubmitDraftForApproval}
                                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                            >
                                                Resubmit for approval
                                            </button>
                                        </div>
                                    );
                                }

                                // Creation approval: backend allows Draft or Pending (see approve-creation). Do not treat
                                // assignment acknowledgment (Pending + assignee acceptance) as creation approval.
                                const isAssignmentAcknowledgmentCase =
                                    asset?.acceptanceStatus === 'Pending' &&
                                    !asset?.pendingAction &&
                                    (asset?.status === 'Pending' || asset?.status === 'Assigned') &&
                                    // Employee assignments use `assignedTo`, company allocations use `assignedCompany`.
                                    (asset?.assignedTo || asset?.assignedCompany);

                                // Submitted for approval / legacy draft with approver / pending creation — not save-only Draft (no AC yet).
                                const isSaveOnlyDraft = asset?.status === 'Draft' && !asset?.actionRequiredBy;
                                const isAwaitingCreationApprovalUi =
                                    asset?.status === 'Submitted for Approval' ||
                                    (!isSaveOnlyDraft &&
                                        asset?.status === 'Draft' &&
                                        asset?.actionRequiredBy) ||
                                    (asset?.actionRequiredBy != null &&
                                        asset?.status === 'Pending' &&
                                        !isAssignmentAcknowledgmentCase &&
                                        !asset?.pendingAction);

                                if (isAwaitingCreationApprovalUi) {
                                    const approverName = getAssetApproverDisplayName(asset);

                                    const isCreatorForApproval =
                                        asset?.createdBy?._id?.toString() === currentUserId ||
                                        asset?.createdBy?.toString() === currentUserId;
                                    const isActionRequired =
                                        !isCreatorForApproval &&
                                        (asset.canApproveAssetCreation === true ||
                                            asset.canApproveAssetCreation === 'true');

                                    if (isActionRequired) {
                                        return (
                                            <div className="flex items-center gap-4 px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm" style={{ animation: 'pulse 2s infinite' }}>
                                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                                    <Plus size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Asset Creation Approval</p>
                                                    <p className="text-[13px] font-bold text-amber-900 leading-none">
                                                        {asset?.status === 'Submitted for Approval'
                                                            ? `This asset was submitted for approval. Awaiting decision${approverName ? ` — ${approverName}` : ''}.`
                                                            : asset?.status === 'Draft'
                                                            ? `This asset is in Draft. Approval required${approverName ? ` — ${approverName}` : ''}.`
                                                            : `This asset is awaiting creation approval. Approval required by ${approverName || 'Asset Controller'}.`}
                                                        {bulkCreationParam === '1' && bulkCreationIdsFromQuery.length > 1 && (
                                                            <span className="block text-[11px] font-semibold text-amber-700 mt-1">
                                                                Bulk creation request with {bulkCreationIdsFromQuery.length} assets.
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    {bulkCreationParam === '1' && bulkCreationIdsFromQuery.length > 1 && (
                                                        <button
                                                            onClick={() => setBulkCreationModalOpen(true)}
                                                            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-100"
                                                        >
                                                            View All Assets
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            if (bulkCreationParam === '1' && bulkCreationSelectedIds.length > 1) {
                                                                handleBulkCreationResponse('Approve');
                                                            } else {
                                                                handleAssetCreationResponse('Approve');
                                                            }
                                                        }}
                                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100"
                                                    >
                                                        {bulkCreationParam === '1' && bulkCreationSelectedIds.length > 1 ? 'Approve Selected' : 'Approve'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (bulkCreationParam === '1' && bulkCreationSelectedIds.length > 1) {
                                                                handleBulkCreationResponse('Reject');
                                                            } else {
                                                                handleAssetCreationResponse('Reject');
                                                            }
                                                        }}
                                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-red-100"
                                                    >
                                                        {bulkCreationParam === '1' && bulkCreationSelectedIds.length > 1 ? 'Reject Selected' : 'Reject'}
                                                    </button>
                                                </div>

                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex items-center gap-4 px-6 py-4 bg-amber-50/50 border border-amber-100 rounded-3xl backdrop-blur-sm">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
                                                <RotateCw size={18} className="animate-spin-slow" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Pending Approval</p>
                                                <p className="text-[13px] font-bold text-amber-900 leading-none">
                                                    Awaiting creation approval{approverName ? ` — ${approverName}` : ''}...
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }

                                if (!currentUserEmployeeId) return null;

                                // Assignment Acknowledgment Banner - Only show for actual assignments, not for other workflows
                                const isActionRequiredByMe = (asset.actionRequiredBy?._id?.toString() || asset.actionRequiredBy?.toString()) === currentUserEmployeeId?.toString();
                                const isAssignmentPending = asset.acceptanceStatus === 'Pending' &&
                                    !asset.pendingAction &&
                                    (asset.status === 'Pending' || asset.status === 'Assigned');

                                // Delegate banner: if assigned employee has NO ERP login access, their primaryReportee can acknowledge
                                const primaryReporteeId =
                                    asset?.assignedTo?.primaryReportee?._id?.toString?.() ||
                                    asset?.assignedTo?.primaryReportee?.toString?.() ||
                                    null;
                                const isPrimaryReporteeAssignmentDelegate = isAssignmentPending &&
                                    asset?.assignedToType === 'Employee' &&
                                    asset?.assignedTo &&
                                    asset?.assignedTo?.enablePortalAccess === false &&
                                    !!primaryReporteeId &&
                                    primaryReporteeId === currentUserEmployeeId?.toString();

                                // For company-assigned assets, only the targeted action owner can approve
                                const isCompanyAsset = asset.assignedToType === 'Company' && asset.assignedCompany;
                                const isCompanyApprover = isCompanyAsset && isActionRequiredByMe && isAssignmentPending;

                                // Company assignment acknowledgment must be visible ONLY to HR.
                                // Do NOT allow asset controllers to see this banner based solely on actionRequiredBy === current user.
                                const shouldShowAssignmentAck =
                                    isCompanyAsset
                                        ? isCompanyApprover
                                        : (isActionRequiredByMe && isAssignmentPending) || isPrimaryReporteeAssignmentDelegate;

                                if (shouldShowAssignmentAck) {
                                    return (
                                        <div className="flex items-center gap-4 px-6 py-3 bg-blue-50 border border-blue-200 rounded-2xl shadow-sm" style={{ animation: 'pulse 2s infinite' }}>
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                                <UserPlus size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Assignment Acknowledgment</p>
                                                <p className="text-[13px] font-bold text-blue-900 leading-none">
                                                    {asset.assignedToType === 'Company' ? `Acknowledgment required for ${asset.assignedCompany?.name || 'Company allocation'}.` : 'Please accept or respond to this asset assignment.'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4">
                                                <button
                                                    onClick={() => { if (!checkSignature()) return; finalizeDirectAccept(); }}
                                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => openResponseModal('Reject')}
                                                    className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-rose-100"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => openResponseModal('AcceptWithComments')}
                                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-blue-100"
                                                >
                                                    Respond
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                // Asset Action Approval Banner (Loss & Damage, End of Life, Leave) - ONLY for assets, not accessories
                                const isAssetActionPending = asset.pendingAction &&
                                    asset.actionRequiredBy?._id?.toString() === currentUserEmployeeId?.toString() &&
                                    // Completely exclude if ANY accessory has pending action
                                    !asset.accessories?.some(acc => acc.pendingAction);

                                // Check if this is a bulk transfer
                                const isBulkTransfer = asset.pendingActionDetails?.isBulk === true;
                                const bulkAssetIds = asset.pendingActionDetails?.bulkAssetIds || [];

                                if (isAssetActionPending) {
                                    const isBulkMulti = isBulkTransfer && bulkAssetIds.length > 1;
                                    const isCompactBulkLeaveEolOrReturn =
                                        isBulkMulti &&
                                        (asset?.pendingAction === 'Leave' ||
                                            asset?.pendingAction === 'End of Life' ||
                                            asset?.pendingAction === 'Return Asset');

                                    if (isCompactBulkLeaveEolOrReturn) {
                                        const openReviewModal =
                                            asset.pendingAction === 'Return Asset'
                                                ? openBulkReturnReview
                                                : openBulkTransferDispositionReview;
                                        return (
                                            <div
                                                className="flex flex-wrap items-center gap-4 px-6 py-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm"
                                                style={{ animation: 'pulse 2s infinite' }}
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                                                    <AlertCircle size={20} />
                                                </div>
                                                <div className="flex-1 min-w-[200px]">
                                                    <p className="text-[13px] font-bold text-rose-900 leading-snug">
                                                        {asset.pendingAction === 'Return Asset'
                                                            ? 'Approve the return — review each asset in the next step.'
                                                            : 'Approve the transfer — review each asset in the next step.'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            void openReviewModal();
                                                        }}
                                                        disabled={isProcessingApproval}
                                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowRejectDialog(true)}
                                                        disabled={isProcessingApproval}
                                                        className="px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-rose-100"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col gap-4 px-6 py-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm" style={{ animation: 'pulse 2s infinite' }}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                                                    <AlertCircle size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none mb-1">
                                                        Asset Action Approval{' '}
                                                        {isBulkTransfer
                                                            ? asset.pendingAction === 'Return Asset'
                                                                ? '(Bulk return)'
                                                                : '(Bulk transfer)'
                                                            : ''}
                                                    </p>
                                                    <p className="text-[13px] font-bold text-red-900 leading-none">
                                                        {asset.pendingAction} request requires your approval.
                                                        {isBulkTransfer && bulkAssetIds.length > 0 && (
                                                            <span className="block text-[11px] font-semibold text-red-700 mt-1">
                                                                {asset.pendingAction === 'Return Asset'
                                                                    ? `This bulk return includes ${bulkAssetIds.length} asset${bulkAssetIds.length > 1 ? 's' : ''}.`
                                                                    : `This is part of a bulk transfer affecting ${bulkAssetIds.length} asset${bulkAssetIds.length > 1 ? 's' : ''}.`}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* View supporting data / open fine modal (Loss & Damage) */}
                                                    {asset?.pendingAction === 'Loss and Damage' && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const assetData = asset;
                                                                    setDamageInitialData({
                                                                        assetId: assetData.assetId,
                                                                        assetName: assetData.name,
                                                                        assetObjectId: assetData._id,
                                                                        isAssetFlow: true,
                                                                        isApprovalFlow: true, // opens modal in approval mode
                                                                        employeeId: assetData.assignedTo?.employeeId || '',
                                                                        employeeName: assetData.assignedTo
                                                                            ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                                                                            : '',
                                                                        assignedToType: assetData.assignedToType || (assetData.assignedCompany ? 'Company' : 'Employee'),
                                                                        company: assetData.assignedCompany?._id || assetData.assignedCompany || null,
                                                                        responsibleFor:
                                                                            assetData.assignedToType === 'Company' || assetData.assignedCompany
                                                                                ? 'Company'
                                                                                : 'Employee',
                                                                        description: assetData.pendingActionDetails?.reason || '',
                                                                        attachment: assetData.pendingActionDetails?.attachment || null,
                                                                        fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                                                    });
                                                                    setShowDamageModal(true);
                                                                }}
                                                                disabled={isProcessingApproval}
                                                                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-100"
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                onClick={() => setShowRejectDialog(true)}
                                                                disabled={isProcessingApproval}
                                                                className="px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-rose-100"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {asset?.pendingAction !== 'Loss and Damage' && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    handleApproveAction(true);
                                                                }}
                                                                disabled={isProcessingApproval}
                                                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-100"
                                                            >
                                                                {isBulkTransfer && bulkAssetIds.length > 1
                                                                    ? (bulkSelectedAssetIds.length !== bulkAssetIds.length ? 'Approve Selected' : 'Approve All')
                                                                    : 'Approve'}
                                                            </button>
                                                            <button
                                                                onClick={() => setShowRejectDialog(true)}
                                                                disabled={isProcessingApproval}
                                                                className="px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-rose-100"
                                                            >
                                                                {isBulkTransfer && bulkAssetIds.length > 1
                                                                    ? (bulkSelectedAssetIds.length !== bulkAssetIds.length ? 'Reject Selected' : 'Reject All')
                                                                    : 'Reject'}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bulk Transfer Assets List */}
                                            {isBulkTransfer && bulkAssetIds.length > 0 && (
                                                <div className="mt-2 pt-3 border-t border-red-200">
                                                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2">
                                                        {asset.pendingAction === 'Return Asset'
                                                            ? `Assets in this bulk return (${bulkAssetIds.length}):`
                                                            : `Assets in this bulk transfer (${bulkAssetIds.length}):`}
                                                    </p>
                                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                                        {bulkAssetIds.map((bulkAssetId, idx) => {
                                                            const isCurrentAsset = bulkAssetId === asset._id?.toString();
                                                            const bulkAssetIdStr = bulkAssetId?.toString();
                                                            const isSelected = bulkSelectedAssetIds.includes(bulkAssetIdStr);
                                                            const detailHref = `/HRM/Asset/details/${bulkAssetIdStr}?tab=document`;
                                                            return (
                                                                <div
                                                                    key={bulkAssetId || idx}
                                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold ${isCurrentAsset
                                                                        ? 'bg-red-100 border border-red-300 text-red-800'
                                                                        : isSelected
                                                                          ? 'bg-white border border-red-200 text-red-700'
                                                                          : 'bg-slate-50 border border-slate-100 text-slate-400 opacity-60'
                                                                        }`}
                                                                >
                                                                    <span
                                                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-red-500' : 'bg-slate-300'}`}
                                                                    />
                                                                    <span className="flex-1 min-w-0 truncate">
                                                                        {isCurrentAsset ? (
                                                                            <span className="font-black">{asset.assetId} (Current Asset)</span>
                                                                        ) : (
                                                                            <span className="font-mono text-[10px]">{bulkAssetIdStr}</span>
                                                                        )}
                                                                    </span>
                                                                    <Link
                                                                        href={detailHref}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        View asset
                                                                        <ExternalLink size={12} className="opacity-80" />
                                                                    </Link>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleBulkAssetSelection(bulkAssetIdStr);
                                                                        }}
                                                                        className={`p-1 rounded-lg border transition-all shrink-0 ${
                                                                            isSelected
                                                                                ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                                        }`}
                                                                        aria-label={
                                                                            isSelected
                                                                                ? 'Remove from bulk selection'
                                                                                : 'Add to bulk selection'
                                                                        }
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                return null;
                            })()}
                        </div>
                    </div>

                    {/* Row 1: Asset Profile & History Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Left Card: Asset Profile Card */}
                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col relative group" style={{ minHeight: '280px' }}>
                            <div className="p-6 flex flex-col h-full">
                                <div className="flex flex-row gap-5 flex-1">
                                    {/* Image Section */}
                                    <div className="w-28 h-28 rounded-xl bg-sky-50 border border-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm group-hover:border-blue-100 transition-all">
                                        {asset.assetPhoto ? (
                                            <img
                                                src={asset.assetPhoto}
                                                alt={asset.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="text-blue-300 font-black text-3xl">
                                                {asset.name?.substring(0, 1).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Main Info */}
                                    <div className="flex-1">
                                        <h1 className="text-lg font-black text-slate-800 leading-tight mb-2 tracking-tight">
                                            {asset.name}
                                        </h1>

                                        {/* Status Badges */}
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${asset.status === 'Assigned' ? 'bg-[#5CD1FF] text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {asset.status || 'Available'}
                                            </span>
                                            <span className="px-3 py-1 rounded-full bg-[#5CD1FF] text-white text-[9px] font-black uppercase tracking-widest">
                                                {assetAge}
                                            </span>
                                        </div>

                                        <div className="space-y-0.5 mt-2">
                                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                                                {asset.categoryId?.name || 'GENERIC CATEGORY'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                                {asset.description || 'No description provided'}
                                            </p>
                                            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3">


                                                <span className="text-[12px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 shadow-sm">
                                                    Total: {new Intl.NumberFormat().format((asset.assetValue || 0) + accessoriesVisibleOnAssetPage.reduce((sum, acc) => sum + (Number(acc.amount) || 0), 0))} AED
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {warrantyRemaining}
                                            </p>
                                            {((asset.assignedTo || isActiveCompanyAllocationUi) && (asset.status === 'Assigned' || asset.status === 'Service' || asset.acceptanceStatus === 'Approved')) && (
                                                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                    <User size={12} className="text-blue-500" />
                                                    <span>Assigned To:</span>
                                                    <span className="text-blue-600 font-black">
                                                        {isActiveCompanyAllocationUi ? asset.assignedCompany?.name : `${asset.assignedTo?.firstName || ""} ${asset.assignedTo?.lastName || ""}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Asset ID Badge */}
                                        <div className="absolute top-8 right-8 lg:static lg:mt-6">
                                            <p className="text-[14px] font-black text-red-500 tracking-[0.2em] uppercase bg-red-50/50 px-3 py-1 rounded-lg">
                                                {asset.assetId}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Assignee Panel */}
                                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 mt-auto">
                                    <div>
                                        <p className="text-[12px] font-black text-slate-800 uppercase tracking-tighter">
                                            {isActiveCompanyAllocationUi
                                                ? (asset.assignedCompany?.name || 'Company Assigned')
                                                : (asset.assignedTo && (asset.status === 'Assigned' || asset.acceptanceStatus === 'Approved')
                                                    ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}`
                                                    : 'UNASSIGNED')}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                            {(isActiveCompanyAllocationUi || (asset.assignedTo && (asset.status === 'Assigned' || asset.acceptanceStatus === 'Approved')))
                                                ? `Since ${isActiveCompanyAllocationUi && asset.assignedDate ? calculateAge(asset.assignedDate) : assignedSince}`
                                                : 'Available for assignment'}
                                        </p>

                                        {temporaryAssignmentEndsInfo && (asset.status === 'Assigned' || asset.acceptanceStatus === 'Accepted' || asset.acceptanceStatus === 'Approved') && (
                                            <div className="mt-2 p-3 bg-amber-50/80 border border-amber-100 rounded-xl">
                                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                                                    Your assignment ends on {temporaryAssignmentEndsInfo.endTxt}
                                                </p>
                                                <p className="text-[10px] font-bold text-amber-800/80 mt-1">
                                                    {temporaryAssignmentEndsInfo.label}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {(asset.status === 'Pending' || asset.status === 'Draft' || asset.acceptanceStatus === 'Pending') && (
                                        <div className="px-4 py-1.5 bg-rose-50 rounded-2xl border border-rose-100 shadow-sm animate-pulse">
                                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                                {asset.status === 'Draft' && !asset?.actionRequiredBy
                                                    ? 'WAITING FOR SUBMISSION'
                                                    : <>WAITING: {getAssetApproverDisplayName(asset)
                                                        || (asset.status === 'Draft' ? 'Approval' : 'Acknowledgment')}</>}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Card: History & Actions */}
                        <div className="rounded-2xl overflow-hidden shadow-sm text-white flex flex-col" style={{ backgroundColor: '#29b6f6', minHeight: '280px' }}>
                            <div className="h-full flex flex-row p-6 gap-6">

                                {/* Left: Info */}
                                <div className="flex flex-col justify-center gap-6" style={{ width: '38%' }}>
                                    <h3 className="text-2xl font-black text-white leading-tight">Asset History</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-semibold text-white">Assigned Users</span>
                                            <span className="text-[13px] font-bold text-white">= {userHistoryCount}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-semibold text-white">Service History</span>
                                            <span className="text-[13px] font-bold text-white">= {serviceHistoryCount}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Buttons */}
                                <div className="flex-1 flex flex-col gap-3 content-center">
                                    {/* Approval button for company-assigned assets (actionRequiredBy owner only) */}
                                    {(() => {
                                        if (!asset || !currentUserEmployeeId) return null;
                                        if (isRejectedStatus) return null;

                                        const isCompanyAsset = asset.assignedToType === 'Company' && asset.assignedCompany;
                                        if (!isCompanyAsset) return null;

                                        const actionRequiredById = asset.actionRequiredBy?._id?.toString() || asset.actionRequiredBy?.toString();
                                        const loggedInEmployeeId = currentUserEmployeeId?.toString();

                                        // Show button if:
                                        // 1. Asset is assigned to company
                                        // 2. actionRequiredBy matches logged-in user
                                        // 3. Either status is Pending OR acceptanceStatus is Pending OR there's a pendingAction
                                        const isPendingAssignment = asset.acceptanceStatus === 'Pending' && !asset.pendingAction;
                                        const isPendingAction = asset.pendingAction && (asset.pendingAction === 'End of Life' || asset.pendingAction === 'Loss and Damage');
                                        const isPendingStatus = asset.status === 'Pending';

                                        // Debug logging (remove in production)
                                        console.log('[HR Approval Button Debug]', {
                                            isHR,
                                            effectiveIsHR,
                                            isCompanyAsset,
                                            actionRequiredById,
                                            loggedInEmployeeId,
                                            matches: actionRequiredById === loggedInEmployeeId,
                                            isPendingStatus,
                                            isPendingAssignment,
                                            isPendingAction,
                                            assetStatus: asset.status,
                                            acceptanceStatus: asset.acceptanceStatus,
                                            pendingAction: asset.pendingAction
                                        });

                                        const shouldShowApprovalButton = actionRequiredById &&
                                            loggedInEmployeeId &&
                                            actionRequiredById === loggedInEmployeeId &&
                                            (isPendingStatus || isPendingAssignment || isPendingAction);

                                        if (!shouldShowApprovalButton) return null;

                                        // Check if it's an assignment approval or action approval
                                        const isAssignmentApproval = asset.acceptanceStatus === 'Pending' && !asset.pendingAction;
                                        const isActionApproval = asset.pendingAction && (asset.pendingAction === 'End of Life' || asset.pendingAction === 'Loss and Damage');

                                        return (
                                            <button
                                                onClick={() => {
                                                    if (isAssignmentApproval) {
                                                        // For assignment approvals, open response modal
                                                        if (!checkSignature()) return;
                                                        finalizeDirectAccept();
                                                    } else if (isActionApproval) {
                                                        // For Loss and Damage without fineData, open the Loss and Damage form modal directly
                                                        if (asset.pendingAction === 'Loss and Damage' && !asset.pendingActionDetails?.fineData) {
                                                            const assetData = asset;
                                                            setDamageInitialData({
                                                                assetId: assetData.assetId,
                                                                assetName: assetData.name,
                                                                assetObjectId: assetData._id,
                                                                isAssetFlow: true,
                                                                isApprovalFlow: true,
                                                                employeeId: assetData.assignedTo?.employeeId || '',
                                                                employeeName: assetData.assignedTo
                                                                    ? `${assetData.assignedTo.firstName || ''} ${assetData.assignedTo.lastName || ''}`.trim()
                                                                    : '',
                                                                assignedToType: assetData.assignedToType || (assetData.assignedCompany ? 'Company' : 'Employee'),
                                                                company: assetData.assignedCompany?._id || assetData.assignedCompany || null,
                                                                responsibleFor:
                                                                    assetData.assignedToType === 'Company' || assetData.assignedCompany
                                                                        ? 'Company'
                                                                        : 'Employee',
                                                                description: assetData.pendingActionDetails?.reason || '',
                                                                attachment: assetData.pendingActionDetails?.attachment || null,
                                                                fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                                            });
                                                            setShowDamageModal(true);
                                                        } else {
                                                            // For other action approvals, navigate to approval dialog
                                                            router.push(`/HRM/Asset/details/${assetId}?authAction=true`);
                                                        }
                                                    }
                                                }}
                                                className="w-full px-4 py-3 bg-amber-500 text-white rounded-xl text-[12px] font-black hover:bg-amber-600 transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2 uppercase tracking-widest"
                                            >
                                                <CheckCircle2 size={16} />
                                                {isAssignmentApproval ? 'ACCEPT ASSIGNMENT' : 'REVIEW APPROVAL'}
                                            </button>
                                        );
                                    })()}

                                    <div className="grid grid-cols-2 gap-3 content-center">
                                        {[
                                            { label: 'Edit Asset', onClick: () => setShowEditModal(true) },
                                            {
                                                label: asset.status === 'Assigned' ? 'Reassign' : 'Assign',
                                                onClick: () => setShowAssignModal(true),
                                                disabled: asset.status === 'Service'
                                            },
                                            {
                                                label: 'Loss and Damage', onClick: () => {
                                                    const targetEmployee = asset?.assignedTo || asset?.assetController;
                                                    const normEmp = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
                                                    const isAssetControllerUser =
                                                        !!userIsAdmin ||
                                                        effectiveIsAssetController ||
                                                        (currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString()) ||
                                                        (currentUserEmployeeId?.toString() === 'flowchart_assetcontroller') ||
                                                        (!!asset?.assetController?.employeeId && !!currentUser?.employeeId && normEmp(asset.assetController.employeeId) === normEmp(currentUser.employeeId));
                                                    setDamageInitialData({
                                                        assetId: asset?.assetId,
                                                        assetName: asset?.name,
                                                        assetObjectId: asset?._id,
                                                        isAssetFlow: true,
                                                        // Asset Controller/Admin opens full fine form directly.
                                                        // Others get request form first.
                                                        isInitialRequest: !isAssetControllerUser,
                                                        isDirectAuthorityRequest: !!isAssetControllerUser,
                                                        employeeId: targetEmployee?.employeeId || '',
                                                        employeeName: targetEmployee
                                                            ? `${targetEmployee.firstName || ''} ${targetEmployee.lastName || ''}`.trim()
                                                            : '',
                                                        assignedToType: asset?.assignedToType || (asset?.assignedCompany ? 'Company' : 'Employee'),
                                                        company: asset?.assignedCompany?._id || asset?.assignedCompany || null,
                                                        responsibleFor:
                                                            asset?.assignedToType === 'Company' || asset?.assignedCompany ? 'Company' : 'Employee',
                                                        fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                                    });
                                                    setShowDamageModal(true);
                                                }
                                            },
                                            {
                                                label: 'End of life', onClick: () => {
                                                    setAssetActionType('End of Life');
                                                    setShowEndOfLifeModal(true);
                                                }
                                            },
                                            {
                                                label: (asset.status === 'Service' || asset.status === 'On Service') ? 'Live' : 'Service', onClick: () => {
                                                    if (asset.status === 'Service' || asset.status === 'On Service') {
                                                        setShowMarkAsLiveModal(true);
                                                    } else {
                                                        setShowServiceModal(true);
                                                    }
                                                }
                                            },
                                            {
                                                label: 'Extend Service',
                                                onClick: () => {
                                                    setServiceExtensionDays(1);
                                                    setServiceExtensionReason('');
                                                    setShowServiceExtendDialog(true);
                                                }
                                            },
                                            { label: 'Transfer Asset', onClick: () => setShowTransferModal(true) },
                                            { label: 'Return Asset', onClick: () => setShowReturnModal(true) }
                                        ].filter((action) => {

                                            // Only show Transfer Asset button when status is "Assigned"
                                            if (action.label === 'Transfer Asset') {
                                                return asset?.status === 'Assigned';
                                            }
                                            if (action.label === 'Extend Service') {
                                                const s = String(asset?.status || '').toLowerCase().trim();
                                                return s === 'service' || s === 'on service';
                                            }
                                            return true;
                                        }).map((action, i) => {
                                            const isAdmin = userIsAdmin;
                                            // Use the already-resolved controller flag (flowchart/API based).
                                            // `asset.assetControllerId` can be missing/mismatched for some statuses (e.g. Lost).
                                            const isAssetControllerById = currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
                                                currentUserEmployeeId?.toString() === `flowchart_assetcontroller`;
                                            const isAuthorized = isAdmin || isAssetControllerById || effectiveIsAssetController;

                                            const assignedToRef = asset?.assignedTo?._id ?? asset?.assignedTo;
                                            const isAssignedUser =
                                                !!assignedToRef &&
                                                currentUserEmployeeId?.toString() === assignedToRef.toString();

                                            // Assigner (asset.assignedBy) full permission
                                            const assignedByRef = asset?.assignedBy?._id ?? asset?.assignedBy;
                                            const isAssignerUser =
                                                !!assignedByRef &&
                                                currentUserEmployeeId?.toString() === assignedByRef.toString();

                                            // Delegate: if assignee has NO companyEmail, enable their primaryReportee
                                            const assigneeCompanyEmail = asset?.assignedTo?.companyEmail;
                                            const assigneeHasCompanyEmail = !!(assigneeCompanyEmail && String(assigneeCompanyEmail).trim().length > 0);
                                            const primaryReporteeRef = asset?.assignedTo?.primaryReportee?._id ?? asset?.assignedTo?.primaryReportee;
                                            const isPrimaryReporteeDelegate = !assigneeHasCompanyEmail &&
                                                !!primaryReporteeRef &&
                                                currentUserEmployeeId?.toString() === primaryReporteeRef.toString();

                                            // Check if current user is the creator
                                            const isCreator = asset?.createdBy?._id?.toString() === currentUserId ||
                                                asset?.createdBy?.toString() === currentUserId;

                                            const isOutOfService = asset.status === 'Out of Service';
                                            const isLost = asset.status === 'Lost';
                                            const statusRaw = String(asset?.status ?? '').trim();
                                            const isUnassignedStatus = statusRaw === 'Unassigned';
                                            const statusLower = statusRaw.toLowerCase();
                                            // Normalize — backend must use this exact label; avoid strict-equality misses
                                            const isSubmittedForApprovalState = statusLower === 'submitted for approval';
                                            const isDraft = statusLower === 'draft';
                                            const isSaveOnlyDraft = isDraft && !asset?.actionRequiredBy;
                                            const isPending = statusLower === 'pending';
                                            const isAlreadyPending =
                                                isPending ||
                                                isSubmittedForApprovalState ||
                                                (isDraft && asset.actionRequiredBy);

                                            // Creation-approval queue (excludes save-only Draft)
                                            const isAwaitingCreationApproval =
                                                isSubmittedForApprovalState ||
                                                (isDraft && asset.actionRequiredBy != null) ||
                                                (isPending &&
                                                    asset.actionRequiredBy != null &&
                                                    asset.actionRequiredBy !== undefined);

                                            // Loss & Damage and End of Life: only block if ALREADY pending
                                            const isActionBtn = action.label === 'Loss and Damage' || action.label === 'End of life';
                                            const isLossDamageBtn = action.label === 'Loss and Damage';
                                            const isEditBtn = action.label === 'Edit Asset';
                                            const isDeleteBtn = action.label === 'Delete Asset';
                                            const isAccessoriesBtn = action.label === 'Accessories';
                                            const isReturnAssetBtn = action.label === 'Return Asset';


                                            // NEW PERMISSION LOGIC:
                                            // If asset is assigned: Assigned user + Asset Controller + Admin can do all operations
                                            // If asset is unassigned: Only Asset Controller + Admin can do all operations
                                            // SPECIAL CASE FOR EDIT BUTTON:
                                            // - If awaiting creation approval (Draft/Pending with actionRequiredBy): Creator + Asset Controller + Admin can edit
                                            // - If NOT awaiting approval: Only Asset Controller + Admin can edit (creator disabled)
                                            const isCompanyAsset = asset?.assignedToType === 'Company' && asset?.assignedCompany;
                                            // Company allocations don't use `assignedTo` (employee object), so treat them as "assigned" for permissions.
                                            const isUnassigned = !(asset?.assignedTo || isCompanyAsset);
                                            const canHRActOnCompany = isCompanyAsset && effectiveIsHR;

                                            let hasPermission = false;
                                            if (isEditBtn) {
                                                // Strict edit rule:
                                                // - Submitted for approval: AC/Admin only — creator never (even if user is also AC for other assets)
                                                // - Save-only Draft: creator only
                                                // - Other Draft (legacy): creator or AC/Admin
                                                // - Else: AC/Admin
                                                if (isSubmittedForApprovalState) {
                                                    hasPermission = isAuthorized && !(isCompanyAsset && effectiveIsHR);
                                                    if (isCreator) hasPermission = false;
                                                } else if (isSaveOnlyDraft) {
                                                    hasPermission = isCreator;
                                                } else if (isDraft) {
                                                    hasPermission = isCreator || isAuthorized;
                                                } else if (statusLower === 'rejected') {
                                                    hasPermission = isCreator || isAuthorized;
                                                } else {
                                                    hasPermission = isAuthorized && !(isCompanyAsset && effectiveIsHR);
                                                }
                                            } else if (isDeleteBtn) {
                                                // Delete Asset button permission (same as Edit)
                                                if (isSubmittedForApprovalState) {
                                                    hasPermission = isAuthorized;
                                                } else if (statusLower === 'rejected') {
                                                    hasPermission = isCreator || isAuthorized;
                                                } else if (isSaveOnlyDraft) {
                                                    hasPermission = isCreator || isAuthorized;
                                                } else if (isAwaitingCreationApproval) {
                                                    // Awaiting creation approval: Creator + Asset Controller + Admin can delete
                                                    hasPermission = isCreator || isAuthorized || isAssignedUser || canHRActOnCompany;
                                                } else {
                                                    // Not awaiting approval: Asset Controller/Admin OR the assigned user can delete
                                                    hasPermission = isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate || canHRActOnCompany;
                                                }
                                            } else if (isReturnAssetBtn) {
                                                // Return: assignee + AC + admin; unassigned pool → AC + admin only
                                                hasPermission = isUnassigned
                                                    ? (isAuthorized || isAssignerUser || canHRActOnCompany)
                                                    : (isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate || canHRActOnCompany);
                                            } else if (isActionBtn && isAwaitingCreationApproval) {
                                                // Before creation approval, only Asset Controller + Admin can initiate actions
                                                hasPermission = isAuthorized;
                                                // Creator cannot start Loss & Damage while asset is still awaiting creation approval
                                                if (isSubmittedForApprovalState && isCreator && isLossDamageBtn) {
                                                    hasPermission = false;
                                                }
                                            } else {

                                                // Other buttons: Use standard permission logic
                                                if (isUnassigned) {
                                                    // Unassigned: Only Asset Controller + Admin
                                                    hasPermission = isAuthorized;
                                                } else {
                                                    // Assigned: Assigned user + Asset Controller + Admin
                                                    hasPermission = isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate || canHRActOnCompany;
                                                }
                                            }

                                            // Draft / rejected (creation): only Edit + Delete for eligible users; block other actions.
                                            if (isDraft && !isEditBtn && !isDeleteBtn) {
                                                hasPermission = false;
                                            }
                                            if (statusLower === 'rejected' && !isEditBtn && !isDeleteBtn) {
                                                hasPermission = false;
                                            }

                                            // Pool assets (status Unassigned): Edit, Assign, L&D, EOL, Service/Live — AC + Admin only
                                            const isAssignOrReassignBtn = action.label === 'Assign' || action.label === 'Reassign';
                                            const isServiceOrLiveBtn = action.label === 'Service' || action.label === 'Live';
                                            if (
                                                isUnassignedStatus &&
                                                !isDraft &&
                                                !isSubmittedForApprovalState &&
                                                statusLower !== 'rejected' &&
                                                (isEditBtn || isAssignOrReassignBtn || isActionBtn || isServiceOrLiveBtn)
                                            ) {
                                                hasPermission = isAuthorized;
                                            }

                                            const isDisabled = action.disabled
                                                || isOutOfService
                                                || asset.status === 'On Leave' // Block all actions if asset is On Leave
                                                // For Lost assets, allow only "Return Asset"; block everything else.
                                                || (isLost && !isReturnAssetBtn)
                                                // Nothing to "return" when the asset is already in the unassigned pool.
                                                || (isReturnAssetBtn && isUnassignedStatus)
                                                || !hasPermission // NEW: Use the new permission logic
                                                // Draft: only Edit / Delete (creator or AC per rules above)
                                                || (isAssetDraftStatus && !isEditBtn && !isDeleteBtn)
                                                || (isRejectedStatus && !(isCreator && (isEditBtn || isDeleteBtn)))
                                                // While awaiting AC approval on a submitted asset, creator must not use Edit (belt-and-suspenders)
                                                || (isEditBtn && isCreator && isSubmittedForApprovalState)
                                                || (isLossDamageBtn && isCreator && isSubmittedForApprovalState)
                                                || (isAlreadyPending && !isActionBtn && !isEditBtn)  // block non-action buttons during pending
                                                || (isAlreadyPending && isActionBtn && !(isLossDamageBtn && isAwaitingCreationApproval && hasPermission));  // allow pre-approval Loss & Damage only for AC/Admin

                                            // Show a special "Pending" label for L&D/EOL when already pending
                                            const btnLabel = (isAlreadyPending && isActionBtn)
                                                ? `${action.label} (Pending...)`
                                                : action.label;
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isDisabled) action.onClick();
                                                    }}
                                                    disabled={isDisabled}
                                                    className={`text-slate-600 px-3 py-2.5 rounded-xl text-[11px] font-bold text-center leading-tight transition-all
                                                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:shadow-md active:scale-95'}`}
                                                    style={{ backgroundColor: isDisabled ? '#f1f5f9' : (action.label === 'Delete Asset' ? '#fee2e2' : '#dde5c8') }}
                                                >
                                                    {isDeleteBtn && isDeleting ? 'Deleting...' : btnLabel}
                                                </button>

                                            );
                                        })}
                                    </div>
                                </div>

                            </div>
                        </div>


                    </div>

                    {/* Row 2: Handover Document / Assignment Actions */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                        {/* Handover or Quick Actions Card - Expanded to Full Width */}
                        <div className="lg:col-span-12 flex flex-col">
                            {
                                true ? (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full font-sans">
                                        <div className="px-8 py-4 border-b border-slate-50 bg-slate-50/50">
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                {/* Tab Navigation */}
                                                <div className="flex items-center gap-1 p-1 bg-slate-100/50 rounded-2xl border border-slate-100">
                                                    {[
                                                        ...(hasHandoverDocumentContext ? [{ id: 'document', label: 'Document', icon: FileText }] : []),
                                                        { id: 'accessories', label: 'Accessories', icon: Package },
                                                        { id: 'history', label: 'History', icon: History },
                                                        { id: 'images', label: 'Images', icon: ImageIcon },
                                                        ...(asset.status !== 'Returned' ? [{ id: 'edit', label: 'Service History', icon: PencilLine }] : [])
                                                    ].map((tab) => (
                                                        <button
                                                            key={tab.id}
                                                            onClick={() => {
                                                                if (tab.id === 'history' && activeTab !== 'history') fetchAssetHistory();
                                                                setActiveTab(tab.id);
                                                            }}
                                                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${activeTab === tab.id
                                                                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                                                                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                                                                }`}
                                                        >
                                                            <tab.icon size={14} />
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Acceptance Buttons moved to top regular banner */}

                                                    <button
                                                        disabled={!asset.assignedTo && !canUseUnassignedAssetPoolTools}
                                                        onClick={() => setShowHandoverModal(true)}
                                                        className={`px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition-all flex items-center gap-2 ${(!asset.assignedTo && !canUseUnassignedAssetPoolTools) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        <Printer size={16} /> Print
                                                    </button>

                                                    {/* Return/Reassign: assignee, original assigner, asset controller, or admin */}
                                                    {(() => {
                                                        const isAdm = userIsAdmin;
                                                        const isAcQuick = currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
                                                            currentUserEmployeeId?.toString() === 'flowchart_assetcontroller';
                                                        const isAssignerQuick = asset.assignedBy?._id?.toString() === currentUserEmployeeId?.toString();
                                                        const atRef = asset?.assignedTo?._id ?? asset?.assignedTo;
                                                        const isAssigneeQuick = atRef && currentUserEmployeeId?.toString() === atRef.toString();
                                                        const showReturnStrip = isAdm || isAcQuick || effectiveIsAssetController || isAssignerQuick || isAssigneeQuick;
                                                        if (!showReturnStrip) return null;
                                                        return (
                                                            <>
                                                                {asset.status === 'Returned' && (
                                                                    <button
                                                                        onClick={() => setShowAssignModal(true)}
                                                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                                                                    >
                                                                        Reassign
                                                                    </button>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Negotiation History & Handover Form */}
                                        <div className="flex-1 p-8 bg-slate-100/30 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                            {activeTab === 'history' ? (
                                                <VehicleAssetHistoryTab
                                                    assetHistory={assetHistory}
                                                    onViewFile={(url) => {
                                                        setSelectedFile(url);
                                                        setShowFileModal(true);
                                                    }}
                                                    eyebrow="Asset record"
                                                    copyMode="asset"
                                                    onHandoverPdfDownload={downloadHistoryPdf}
                                                />
                                            ) : activeTab === 'accessories' ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col uppercase tracking-widest font-black">
                                                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <Package size={16} className="text-blue-600" /> Attached Accessories
                                                        </h3>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                disabled={isAccessoryTabLocked || (!asset.assignedTo && !canUseUnassignedAssetPoolTools)}
                                                                onClick={() => {
                                                                    if (isAccessoryTabLocked) return;
                                                                    setShowAddAccessoryForm(true);
                                                                }}
                                                                className={`px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black hover:bg-emerald-600 hover:text-white transition-all shadow-sm ${(isAccessoryTabLocked || (!asset.assignedTo && !canUseUnassignedAssetPoolTools)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                Add Accessories
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isAccessoryTabLocked}
                                                                onClick={() => {
                                                                    if (isAccessoryTabLocked) return;
                                                                    setActiveTab('accessories');
                                                                }}
                                                                className={`px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black transition-all shadow-sm ${isAccessoryTabLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600 hover:text-white'}`}
                                                            >
                                                                View
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Add Accessory Form */}
                                                    {showAddAccessoryForm && (
                                                        <div className="border-b border-slate-100 bg-emerald-50/30 p-4">
                                                            <div className="space-y-3">
                                                                <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">
                                                                    {editingAccessory ? 'Edit Accessory' : 'Add New Accessory'}
                                                                </h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Accessory Name *"
                                                                        value={newAccessory.name}
                                                                        onChange={(e) => setNewAccessory({ ...newAccessory, name: e.target.value })}
                                                                        disabled={isAccessoryTabLocked}
                                                                        className={`px-3 py-2 border border-emerald-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isAccessoryTabLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        placeholder={editingAccessory ? 'Amount' : 'Amount *'}
                                                                        value={newAccessory.amount}
                                                                        onChange={(e) => setNewAccessory({ ...newAccessory, amount: e.target.value })}
                                                                        disabled={isAccessoryTabLocked || (!!editingAccessory && !userIsAdmin)}
                                                                        className={`px-3 py-2 border border-emerald-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${(isAccessoryTabLocked || (!!editingAccessory && !userIsAdmin)) ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Description"
                                                                        value={newAccessory.description}
                                                                        onChange={(e) => setNewAccessory({ ...newAccessory, description: e.target.value })}
                                                                        disabled={isAccessoryTabLocked}
                                                                        className={`px-3 py-2 border border-emerald-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isAccessoryTabLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        disabled={isAccessoryTabLocked}
                                                                        onClick={handleAddAccessory}
                                                                        className={`px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700 transition-all ${isAccessoryTabLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                    >
                                                                        {editingAccessory ? 'Update Accessory' : 'Add Accessory'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isAccessoryTabLocked}
                                                                        onClick={() => {
                                                                            if (isAccessoryTabLocked) return;
                                                                            setShowAddAccessoryForm(false);
                                                                            setNewAccessory({ name: '', amount: '', description: '' });
                                                                            setEditingAccessory(null);
                                                                        }}
                                                                        className={`px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black transition-all ${isAccessoryTabLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-300'}`}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="p-8">
                                                        {!accessoriesVisibleOnAssetPage.length ? (
                                                            <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                                                                <Package size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">No accessories found</span>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {accessoriesVisibleOnAssetPage.map((acc, index) => {
                                                                    const accStatusNorm = String(acc.status || '').trim().toLowerCase();
                                                                    const isAccessoryEligibleForActions =
                                                                        accStatusNorm === 'attached' || accStatusNorm === '';
                                                                    const hasPendingAction = typeof acc.pendingAction === 'string'
                                                                        ? acc.pendingAction.trim().length > 0
                                                                        : !!acc.pendingAction;
                                                                    const hasActiveApprover = !!(asset.actionRequiredBy?._id || asset.actionRequiredBy);
                                                                    const isPending = hasPendingAction && hasActiveApprover;
                                                                    const loggedInEmpId = currentUserEmployeeId?.toString();
                                                                    const sourceTransferApproverId = acc.pendingActionDetails?.sourceApproverId?.toString?.() || acc.pendingActionDetails?.sourceApproverId;
                                                                    const canApproveTransferAsSource = acc.pendingAction === 'Transfer' &&
                                                                        !!loggedInEmpId &&
                                                                        !!sourceTransferApproverId &&
                                                                        sourceTransferApproverId.toString() === loggedInEmpId;
                                                                    const authorityAddNeedsAssignee =
                                                                        acc.pendingAction === 'Add' &&
                                                                        String(acc.pendingActionDetails?.addApprovalKind || '') === 'Assignee';
                                                                    const assignedToRefId = asset?.assignedTo?._id?.toString?.() || asset?.assignedTo?.toString?.();
                                                                    const primaryReporteeRefId =
                                                                        asset?.assignedTo?.primaryReportee?._id?.toString?.() ||
                                                                        asset?.assignedTo?.primaryReportee?.toString?.();
                                                                    const canApproveAuthorityAddAsAssigneeOrDelegate =
                                                                        authorityAddNeedsAssignee &&
                                                                        !!loggedInEmpId &&
                                                                        ((assignedToRefId && assignedToRefId === loggedInEmpId) ||
                                                                            (primaryReporteeRefId && primaryReporteeRefId === loggedInEmpId));
                                                                    // Check if current user is the one who needs to approve this accessory action
                                                                    const canApproveAccessory =
                                                                        isPending &&
                                                                        (
                                                                            asset.actionRequiredBy?._id?.toString() === currentUserEmployeeId?.toString() ||
                                                                            canApproveTransferAsSource ||
                                                                            canApproveAuthorityAddAsAssigneeOrDelegate
                                                                        );

                                                                    return (
                                                                        <div
                                                                            key={index}
                                                                            className={`flex items-center justify-between p-6 rounded-2xl border shadow-sm transition-all group ${isPending
                                                                                ? 'bg-rose-500 border-rose-500 text-white shadow-xl shadow-rose-200'
                                                                                : 'bg-white border-slate-100 hover:shadow-md hover:border-blue-200 text-slate-800'
                                                                                }`}
                                                                        >
                                                                            <div className="flex items-center gap-6">
                                                                                <div className={`w-14 h-14 rounded-xl border flex items-center justify-center shadow-sm transition-all shrink-0 ${isPending ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50'
                                                                                    }`}>
                                                                                    <Package size={28} strokeWidth={1.5} />
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`text-[14px] font-black uppercase tracking-tight ${isPending ? 'text-white' : 'text-slate-800'}`} title={acc.name}>{acc.name}</span>
                                                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isPending ? 'bg-white/20 text-white' : (accStatusNorm === 'attached' || accStatusNorm === '' ? 'bg-emerald-50 text-emerald-600'
                                                                                            : accStatusNorm === 'transfered' ? 'bg-amber-50 text-amber-600'
                                                                                                : 'bg-rose-50 text-rose-600')
                                                                                            }`}>
                                                                                            {acc.status || 'Attached'}
                                                                                        </span>
                                                                                        {isPending && (
                                                                                            <div className="flex flex-col gap-1 items-start">
                                                                                                <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-white/20 text-white animate-pulse whitespace-nowrap">
                                                                                                    ⏳ {acc.pendingAction} Pending
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className={`text-[10px] font-mono font-bold uppercase mt-1 ${isPending ? 'text-white/70' : 'text-slate-400'}`}>{acc.accessoryId}</span>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-12">
                                                                                <div className="text-right">
                                                                                    <span className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isPending ? 'text-white/60' : 'text-slate-400'}`}>Value</span>
                                                                                    <span className={`text-[14px] font-black tracking-wider ${isPending ? 'text-white' : 'text-emerald-600'}`}>AED {new Intl.NumberFormat().format(acc.amount || 0)}</span>
                                                                                </div>

                                                                                {/* ── PENDING: show only Accept / Reject for the authorized approver ── */}
                                                                                {isPending ? (
                                                                                    (() => {
                                                                                        if (!canApproveAccessory) {
                                                                                            return (
                                                                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isPending ? 'text-white/80' : 'text-sky-400'}`}>
                                                                                                    Awaiting Approval
                                                                                                </span>
                                                                                            );
                                                                                        }

                                                                                        return (
                                                                                            <div className="flex items-center gap-2">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    disabled={isAccessoryTabLocked}
                                                                                                    onClick={() => {
                                                                                                        if (isAccessoryTabLocked) return;
                                                                                                        // For Loss and Damage, open the Loss and Damage form modal directly
                                                                                                        if (acc.pendingAction === 'Loss and Damage' && !acc.pendingActionDetails?.fineData) {
                                                                                                            // Open Loss and Damage modal with accessory data
                                                                                                            setDamageInitialData({
                                                                                                                assetId: asset.assetId,
                                                                                                                assetName: asset.name,
                                                                                                                assetObjectId: asset._id,
                                                                                                                isAssetFlow: true,
                                                                                                                isApprovalFlow: true,
                                                                                                                isAccessoryFlow: true, // Flag for accessory
                                                                                                                accessoryId: acc.accessoryId,
                                                                                                                accessoryName: acc.name,
                                                                                                                accessoryObjectId: acc._id,
                                                                                                                employeeId: asset.assignedTo?.employeeId || '',
                                                                                                                employeeName: asset.assignedTo
                                                                                                                    ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                                                                                                                    : '',
                                                                                                                assignedToType: asset.assignedToType || (asset.assignedCompany ? 'Company' : 'Employee'),
                                                                                                                company: asset.assignedCompany?._id || asset.assignedCompany || null,
                                                                                                                description: acc.pendingActionDetails?.reason || '',
                                                                                                                attachment: acc.pendingActionDetails?.attachment || null,
                                                                                                                fineAmount: acc.amount ? String(acc.amount) : '',
                                                                                                                responsibleFor: asset.assignedToType === 'Company' ? 'Company' : 'Employee'
                                                                                                            });
                                                                                                            setShowDamageModal(true);
                                                                                                        } else {
                                                                                                            // For other actions, show the accept dialog
                                                                                                            setAccAcceptDialog({
                                                                                                                isOpen: true,
                                                                                                                accId: acc._id,
                                                                                                                accName: acc.name,
                                                                                                                pendingAction: acc.pendingAction,
                                                                                                                reason: '',
                                                                                                                attachment: null,
                                                                                                                loading: false
                                                                                                            });
                                                                                                        }
                                                                                                    }}
                                                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-emerald-600 text-[10px] font-black hover:bg-emerald-50 transition-all uppercase tracking-tighter shadow-sm ${isAccessoryTabLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                >
                                                                                                    ✓ Accept
                                                                                                </button>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    disabled={isAccessoryTabLocked}
                                                                                                    onClick={() => {
                                                                                                        if (isAccessoryTabLocked) return;
                                                                                                        setAccRejectDialog({
                                                                                                            isOpen: true,
                                                                                                            accId: acc._id,
                                                                                                            accName: acc.name,
                                                                                                            pendingAction: acc.pendingAction,
                                                                                                            reason: '',
                                                                                                            loading: false
                                                                                                        });
                                                                                                    }}
                                                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-rose-600 text-[10px] font-black hover:bg-rose-50 transition-all uppercase tracking-tighter shadow-sm ${isAccessoryTabLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                >
                                                                                                    ✕ Reject
                                                                                                </button>
                                                                                            </div>
                                                                                        );
                                                                                    })()
                                                                                ) : isAccessoryEligibleForActions && !isAccessoryTabLocked && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        {/* ── NORMAL ACTION BUTTONS ── */}
                                                                                        {(() => {
                                                                                            const isAdmin = userIsAdmin;
                                                                                            const isAcLineMatch =
                                                                                                currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
                                                                                                currentUserEmployeeId?.toString() === `flowchart_assetcontroller`;
                                                                                            const isCompanyAsset = asset?.assignedToType === 'Company' && asset?.assignedCompany;
                                                                                            const assignedToId = asset?.assignedTo?._id?.toString?.() || asset?.assignedTo?.toString?.();
                                                                                            const isAssignedUser = !!assignedToId && !!currentUserEmployeeId && assignedToId === currentUserEmployeeId?.toString();
                                                                                            const assignedByEmpId = asset?.assignedBy?._id?.toString?.() || asset?.assignedBy?.toString?.();
                                                                                            const isAssignerUser =
                                                                                                !!assignedByEmpId &&
                                                                                                !!currentUserEmployeeId &&
                                                                                                assignedByEmpId === currentUserEmployeeId?.toString();
                                                                                            const isDelegatedPrimaryReportee =
                                                                                                !!primaryReporteeRefId &&
                                                                                                !!currentUserEmployeeId &&
                                                                                                primaryReporteeRefId === currentUserEmployeeId?.toString();
                                                                                            /* Matches backend getActorPermissionFlagsForAsset (assigner + assignee + delegate reportee + AC/Admin + company HR). */
                                                                                            const isAuthorized =
                                                                                                isAdmin ||
                                                                                                isAcLineMatch ||
                                                                                                effectiveIsAssetController ||
                                                                                                isAssignedUser ||
                                                                                                isAssignerUser ||
                                                                                                isDelegatedPrimaryReportee ||
                                                                                                (isCompanyAsset && effectiveIsHR);
                                                                                            const isUnattachAuthorized =
                                                                                                isAdmin || isAcLineMatch || effectiveIsAssetController || isAssignedUser;
                                                                                            const isAccessRestricted = !isAuthorized;
                                                                                            const isDisabled = isAccessRestricted || isAccessoryTabLocked;
                                                                                            const isUnattachDisabled = !isUnattachAuthorized || isAccessoryTabLocked;
                                                                                            const editAccessoryDisabled = isAccessoryTabLocked || !canEditAccessoryAttached;
                                                                                            return (
                                                                                                <>
                                                                                                    {/* Edit Accessory — Admin / Asset Controller only */}
                                                                                                    <button
                                                                                                        disabled={editAccessoryDisabled}
                                                                                                        onClick={() => handleEditAccessory(acc)}
                                                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 text-[9px] font-black hover:bg-amber-600 hover:text-white transition-all uppercase tracking-tighter shadow-sm border border-amber-100/50 ${editAccessoryDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                        title={canEditAccessoryAttached ? 'Edit Accessory' : 'Only Asset Controller or Admin can edit accessories'}
                                                                                                    >
                                                                                                        <Package size={12} /> Edit
                                                                                                    </button>
                                                                                                    {/* Transfer → request-action */}
                                                                                                    <button
                                                                                                        disabled={isDisabled}
                                                                                                        onClick={() => setTransferModal({ isOpen: true, accessory: acc })}
                                                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[9px] font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-tighter shadow-sm border border-blue-100/50 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                    >
                                                                                                        <ArrowRightLeft size={12} /> Transfer
                                                                                                    </button>
                                                                                                    {/* Loss & Damage → request-action */}
                                                                                                    <button
                                                                                                        disabled={isDisabled}
                                                                                                        onClick={() => {
                                                                                                            const targetEmployee = asset?.assignedTo || asset?.assetController;
                                                                                                            const isAuthority =
                                                                                                                isAdmin ||
                                                                                                                isAcLineMatch ||
                                                                                                                effectiveIsAssetController;
                                                                                                            setDamageInitialData({
                                                                                                                assetId: asset.assetId,
                                                                                                                assetName: asset.name,
                                                                                                                assetObjectId: asset._id,
                                                                                                                isAssetFlow: true,
                                                                                                                isInitialRequest: !isAuthority, // Non-authority flow requests AC approval
                                                                                                                isDirectAuthorityRequest: isAuthority, // AC/Admin direct L&D -> fine
                                                                                                                isAccessoryFlow: true, // Flag for accessory
                                                                                                                accessoryId: acc.accessoryId,
                                                                                                                accessoryName: acc.name,
                                                                                                                accessoryObjectId: acc._id,
                                                                                                                employeeId: targetEmployee?.employeeId || '',
                                                                                                                employeeName: targetEmployee
                                                                                                                    ? `${targetEmployee.firstName || ''} ${targetEmployee.lastName || ''}`.trim()
                                                                                                                    : '',
                                                                                                                fineAmount: acc.amount ? String(acc.amount) : ''
                                                                                                            });
                                                                                                            setShowDamageModal(true);
                                                                                                        }}
                                                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-[9px] font-black hover:bg-red-50 hover:text-red-500 transition-all uppercase tracking-tighter shadow-sm border border-slate-100 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                        title="Mark as Loss and Damage"
                                                                                                    >
                                                                                                        <AlertCircle size={12} /> Loss and Damage
                                                                                                    </button>
                                                                                                    {/* Unattach from this asset (assigned user / AC / admin only) */}
                                                                                                    <button
                                                                                                        disabled={isUnattachDisabled}
                                                                                                        onClick={() => handleUnattachAccessory(acc)}
                                                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 text-[9px] font-black hover:bg-orange-600 hover:text-white transition-all uppercase tracking-tighter shadow-sm border border-orange-100/50 ${isUnattachDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                                                        title="Request unattach (requires Asset Controller approval)"
                                                                                                    >
                                                                                                        <ArrowDownLeft size={12} /> Unattach
                                                                                                    </button>
                                                                                                </>
                                                                                            );
                                                                                        })()}
                                                                                    </div>
                                                                                )}

                                                                                {userIsAdmin && !isAccessoryTabLocked && acc._id && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            if (isAccessoryTabLocked) return;
                                                                                            setAccessoryDeleteConfirm({ isOpen: true, accessory: acc, loading: false });
                                                                                        }}
                                                                                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter shadow-sm border transition-all ${isPending
                                                                                            ? 'border-white/40 bg-white/15 text-white hover:bg-white hover:text-rose-600'
                                                                                            : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white'
                                                                                            }`}
                                                                                        title="Delete accessory permanently (admin only)"
                                                                                    >
                                                                                        <Trash2 size={14} strokeWidth={2.25} />
                                                                                        Delete
                                                                                    </button>
                                                                                )}

                                                                                {acc.attachment && (
                                                                                    <a
                                                                                        href={acc.attachment}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-blue-600 bg-slate-50 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all"
                                                                                    >
                                                                                        <ExternalLink size={18} />
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : activeTab === 'images' ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col">
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <Camera size={16} className="text-blue-600" />
                                                            Asset Images
                                                            <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                                                                {(asset.images?.length || 0) + (asset.assetPhoto ? 1 : 0)}
                                                            </span>
                                                        </h3>
                                                        {/* Upload button */}
                                                        {(() => {
                                                            const isAdmin = userIsAdmin;
                                                            const isAcLineMatch =
                                                                currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
                                                                currentUserEmployeeId?.toString() === `flowchart_assetcontroller`;
                                                            const isCompanyAsset = asset?.assignedToType === 'Company' && asset?.assignedCompany;
                                                            const isAuthorized =
                                                                isAdmin ||
                                                                isAcLineMatch ||
                                                                effectiveIsAssetController ||
                                                                (isCompanyAsset && effectiveIsHR);
                                                            const isUnassigned = !(asset?.assignedTo || isCompanyAsset);
                                                            const isAccessRestricted = isUnassigned && !isAuthorized;
                                                            const isDisabled = isAccessRestricted || isAccessoryTabLocked;

                                                            return (
                                                                <label className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer transition-all shadow-sm ${isAccessRestricted || isAccessoryTabLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                                    Add Image
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        disabled={isDisabled}
                                                                        onChange={(e) => {
                                                                            if (isAccessRestricted || isAccessoryTabLocked) return;
                                                                            const file = e.target.files?.[0];
                                                                            if (!file) return;
                                                                            const reader = new FileReader();
                                                                            reader.onloadend = () => {
                                                                                const base64 = reader.result.split(',')[1];
                                                                                setImageUploadModal({
                                                                                    isOpen: true,
                                                                                    file,
                                                                                    base64,
                                                                                    caption: '',
                                                                                    date: new Date().toISOString().split('T')[0]
                                                                                });
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                            e.target.value = '';
                                                                        }}
                                                                    />
                                                                </label>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Gallery grid */}
                                                    <div className="p-5 flex-1">
                                                        {(() => {
                                                            const allImages = [
                                                                ...(asset.assetPhoto ? [{ _id: '__main__', url: asset.assetPhoto, caption: 'Main photo', date: asset.createdAt }] : []),
                                                                ...(asset.images || [])
                                                            ];
                                                            if (allImages.length === 0) {
                                                                return (
                                                                    <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                                                                        <Camera size={56} strokeWidth={1} className="mb-4 opacity-30" />
                                                                        <span className="text-[12px] font-bold uppercase tracking-widest">No images yet</span>
                                                                        <p className="text-[10px] text-slate-400 mt-1 font-normal">Click "Add Image" to upload the first photo</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                                    {allImages.map((img) => (
                                                                        <div key={img._id} className="group relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 aspect-square">
                                                                            <img
                                                                                src={img.url}
                                                                                alt={img.caption || 'Asset image'}
                                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                                                                                onClick={() => window.open(img.url, '_blank')}
                                                                            />
                                                                            {/* Overlay */}
                                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                                            {/* Info bar */}
                                                                            <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                {img.caption && (
                                                                                    <p className="text-white text-[10px] font-semibold truncate leading-tight">{img.caption}</p>
                                                                                )}
                                                                                <p className="text-white/70 text-[9px] font-normal">
                                                                                    {img.date ? new Date(img.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                                                                </p>
                                                                            </div>
                                                                            {/* Delete (not for main) */}
                                                                            {img._id !== '__main__' && (
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={isAccessoryTabLocked}
                                                                                    onClick={() => {
                                                                                        if (isAccessoryTabLocked) return;
                                                                                        setImageDeleteConfirm({ isOpen: true, imageId: img._id });
                                                                                    }}
                                                                                    className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center transition-opacity shadow-md ${isAccessoryTabLocked ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                                                                                >
                                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : activeTab === 'edit' ? (
                                                /* Manage Asset Panel */
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col">
                                                    <div className="p-5 border-b border-slate-100">
                                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                            <PencilLine size={16} className="text-blue-600" />
                                                            <span>Service History</span>
                                                        </h3>
                                                        <p className="text-[11px] text-slate-400 mt-1 font-normal tracking-normal">Current status: <span className="font-bold text-slate-600">{asset.status}</span></p>
                                                    </div>
                                                    <div className="p-6">
                                                        {(() => {
                                                            const serviceHistoryItems = assetHistory?.filter(h =>
                                                                ['Service', 'Maintenance', 'Repair', 'Live', 'Service Send', 'Service Receive'].includes(h.action)
                                                            ) || [];

                                                            if (serviceHistoryItems.length === 0) {
                                                                return (
                                                                    <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                                                                        <PencilLine size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">No Service History</span>
                                                                    </div>
                                                                );
                                                            }

                                                            // Group Service sessions
                                                            const sorted = [...serviceHistoryItems].sort((a, b) => new Date(a.date) - new Date(b.date));
                                                            const sessions = [];
                                                            let currentSession = null;

                                                            sorted.forEach(item => {
                                                                const isSend = ['Service', 'Service Send', 'Maintenance', 'Repair'].includes(item.action);
                                                                const isReceive = ['Live', 'Service Receive'].includes(item.action);

                                                                if (isSend) {
                                                                    if (currentSession) sessions.push(currentSession);
                                                                    currentSession = { id: item._id, send: item, receive: null };
                                                                } else if (isReceive) {
                                                                    if (currentSession) {
                                                                        currentSession.receive = item;
                                                                        sessions.push(currentSession);
                                                                        currentSession = null;
                                                                    } else {
                                                                        sessions.push({ id: item._id, send: null, receive: item });
                                                                    }
                                                                }
                                                            });
                                                            if (currentSession) sessions.push(currentSession);

                                                            return (
                                                                <div className="space-y-6">
                                                                    {sessions.reverse().map((session, sIdx) => (
                                                                        <div key={session.id || sIdx} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                                                                            <div className="flex flex-col">
                                                                                {/* SESSION HEADER - Status Indicator */}
                                                                                <div className={`h-1.5 w-full ${session.receive ? 'bg-emerald-500' : 'bg-blue-500'}`} />

                                                                                <div className="p-6 space-y-6">
                                                                                    {/* TIMELINE VIEW */}
                                                                                    <div className="flex items-start gap-6 relative">
                                                                                        {/* Vertical Connector Line */}
                                                                                        {session.receive && (
                                                                                            <div className="absolute left-[20px] top-[40px] bottom-[40px] w-0.5 border-l-2 border-dashed border-slate-200 z-0" />
                                                                                        )}

                                                                                        <div className="flex-1 space-y-8">
                                                                                            {/* SEND EVENT */}
                                                                                            {session.send && (
                                                                                                <div className="flex gap-4 relative z-10">
                                                                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-sm">
                                                                                                        <ArrowUpRight size={18} />
                                                                                                    </div>
                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <div className="flex justify-between items-center mb-1">
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                                                                                                    {session.send.action === 'Service Send' ? 'Service Dispatched' : session.send.action}
                                                                                                                </span>
                                                                                                                <span className="text-xs font-black text-slate-800">
                                                                                                                    {new Date(session.send.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                                                                                By {session.send.performedBy?.firstName || 'Staff'}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        {session.send.comments && (
                                                                                                            <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                                                                                                                {session.send.comments}
                                                                                                            </p>
                                                                                                        )}
                                                                                                        {/* Documents in Send */}
                                                                                                        <div className="flex flex-wrap gap-2 mt-3">
                                                                                                            {(session.send.file || session.send.details?.invoice || session.send.details?.attachment) && (
                                                                                                                <button
                                                                                                                    onClick={() => { setSelectedFile(session.send.file || session.send.details?.invoice || session.send.details?.attachment); setShowFileModal(true); }}
                                                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                                                                                                                >
                                                                                                                    <FileText size={12} /> View Send Document
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* RECEIVE EVENT */}
                                                                                            {session.receive && (
                                                                                                <div className="flex gap-4 relative z-10">
                                                                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-sm">
                                                                                                        <ArrowDownLeft size={18} />
                                                                                                    </div>
                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <div className="flex justify-between items-center mb-1">
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                                                                                    {session.receive.action === 'Service Receive' ? 'Service Completed' : 'Returned Live'}
                                                                                                                </span>
                                                                                                                <span className="text-xs font-black text-slate-800">
                                                                                                                    {new Date(session.receive.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                                                                                Collected By {session.receive.performedBy?.firstName || 'Staff'}
                                                                                                            </span>
                                                                                                        </div>

                                                                                                        <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-50/50 space-y-3">
                                                                                                            {session.receive.comments && (
                                                                                                                <div className="space-y-1">
                                                                                                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Service Report</span>
                                                                                                                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{session.receive.comments}</p>
                                                                                                                </div>
                                                                                                            )}

                                                                                                            <div className="grid grid-cols-2 gap-4">
                                                                                                                {session.receive.details?.amount > 0 && (
                                                                                                                    <div className="space-y-0.5">
                                                                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cost</span>
                                                                                                                        <p className="text-xs font-black text-emerald-700">QAR {session.receive.details.amount.toLocaleString()}</p>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {session.receive.details?.serviceDuration && (
                                                                                                                    <div className="space-y-0.5">
                                                                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Duration</span>
                                                                                                                        <p className="text-xs font-black text-slate-700">{session.receive.details.serviceDuration}</p>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        </div>

                                                                                                        {/* Documents in Receive */}
                                                                                                        <div className="flex flex-wrap gap-2 mt-4">
                                                                                                            {(session.receive.file || session.receive.details?.attachment) && (
                                                                                                                <button
                                                                                                                    onClick={() => { setSelectedFile(session.receive.file || session.receive.details?.attachment); setShowFileModal(true); }}
                                                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm"
                                                                                                                >
                                                                                                                    <FileText size={12} /> Combined Service Report
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Handover Form View - Default */
                                                <div className="flex justify-center p-4">
                                                    {(asset.assignedTo ||
                                                        (String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany) ||
                                                        asset.status === 'Service') ? (
                                                        <HandoverFormView asset={asset} isPrint={false} />
                                                    ) : (asset.status === 'Draft' ||
                                                        (!asset.assignedTo &&
                                                            !(String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany))) &&
                                                      latestHandoverDocument ? (
                                                        /* Show latest handover document for Draft or unassigned assets */
                                                        <div className="w-full flex flex-col items-center">
                                                            <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                                                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest text-center">
                                                                    📄 Latest Handover Document ({new Date(latestHandoverDocument.date).toLocaleDateString()})
                                                                </p>
                                                            </div>
                                                            <HandoverFormView
                                                                asset={latestHandoverDocument.details}
                                                                isPrint={false}
                                                                overrideDate={latestHandoverDocument.date}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-slate-50 border border-slate-100 rounded-xl">
                                                            <FileText size={48} className="mb-4 opacity-20" />
                                                            <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-500">Document Unavailable</h3>
                                                            <p className="text-[11px] font-medium mt-2">No handover document found in asset history.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col h-full font-sans uppercase tracking-widest">
                                        <div className="p-16 flex-1 flex flex-col items-center justify-center text-center">
                                            <div className="w-32 h-32 rounded-[48px] bg-slate-50 flex items-center justify-center text-slate-200 mb-10 border border-slate-100 animate-pulse">
                                                <UserPlus size={64} strokeWidth={1} />
                                            </div>
                                            <button
                                                onClick={() => setShowAssignModal(true)}
                                                className="px-16 py-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-[24px] text-[12px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-blue-200 hover:scale-[1.05] transition-all active:scale-95"
                                            >
                                                Assign to Employee
                                            </button>
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                    </div>

                    {/* File Preview Modal */}
                    {showFileModal && selectedFile && (
                        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <FileText size={16} className="text-blue-600" /> Attachment Preview
                                    </h3>
                                    <button
                                        onClick={() => setShowFileModal(false)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 transition-colors"
                                    >
                                        x
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto p-8 bg-slate-100 flex items-center justify-center">
                                    {selectedFile.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i) || selectedFile.startsWith('data:image') ? (
                                        <img
                                            src={selectedFile}
                                            alt="Attachment"
                                            className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                                        />
                                    ) : selectedFile.match(/\.pdf(\?.*)?$/i) ? (
                                        <iframe
                                            src={selectedFile}
                                            className="w-full h-full min-h-[500px] border-none rounded-lg"
                                            title="PDF Preview"
                                        />
                                    ) : (
                                        <div className="text-center">
                                            <div className="w-20 h-20 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                                                <FileText size={40} />
                                            </div>
                                            <p className="text-sm text-slate-500 font-bold mb-4">File preview not available.</p>
                                            <a
                                                href={selectedFile}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                                            >
                                                Download / View Externally <ArrowRight size={12} />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History Detail Modal - Shows Snapshot */}
                    {showHistoryDetailModal && selectedHistoryItem && (
                        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300">
                                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                                            <History size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest leading-none">
                                                Historical Snapshot
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">
                                                Action: <span className="text-blue-600 font-bold">{selectedHistoryItem.action}</span> • {new Date(selectedHistoryItem.date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowHistoryDetailModal(false)}
                                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto bg-slate-100/50 p-4 md:p-12 flex flex-col items-center">
                                    {selectedHistoryItem.details ? (
                                        <div className="w-full h-auto flex flex-col items-center py-6">
                                            <div className="shadow-2xl rounded-sm overflow-hidden bg-white max-w-full">
                                                <div className="scale-[0.8] md:scale-100 origin-top transform-gpu">
                                                    <HandoverFormView
                                                        asset={selectedHistoryItem.details}
                                                        isPrint={false}
                                                        overrideDate={selectedHistoryItem.date}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-24 text-center text-slate-400 uppercase tracking-widest font-black">
                                            <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                                            Snapshot data not available for this record.
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-4">
                                    <button
                                        onClick={() => setShowHistoryDetailModal(false)}
                                        className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-sans"
                                    >
                                        Close Preview
                                    </button>
                                    <button
                                        disabled={isDownloadingHistory}
                                        onClick={() => downloadHistoryPdf(selectedHistoryItem._id)}
                                        className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center gap-2 font-sans disabled:opacity-50"
                                    >
                                        <div className={isDownloadingHistory ? 'animate-spin' : ''}>
                                            <Printer size={16} />
                                        </div>
                                        {isDownloadingHistory ? 'Generating...' : 'Download Formal PDF'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Finalize Action Dialog (Reportee) */}
                    <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
                        <AlertDialogContent className="max-w-md rounded-3xl p-8 border-none shadow-2xl">
                            <AlertDialogHeader>
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                                    <ShieldCheck size={32} className="text-blue-600" />
                                </div>
                                <AlertDialogTitle className="text-2xl font-black text-slate-800 tracking-tight">
                                    Final Acknowledgement
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-500 font-medium pt-2">
                                    Management has approved marking this asset ({asset?.name}) as <strong>{reporteeAction === 'eol' ? 'End of Life' : 'Loss and Damage'}</strong>.
                                    Please provide any final comments and acknowledge to finalize the "Out of Service" status.
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="my-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Final Comments</label>
                                    <textarea
                                        value={finalizeComment}
                                        onChange={(e) => setFinalizeComment(e.target.value)}
                                        placeholder="Add your final remarks here..."
                                        className="w-full min-h-[100px] p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none text-[13px] font-medium"
                                    />
                                </div>
                            </div>

                            <AlertDialogFooter className="flex gap-3 sm:gap-0">
                                <AlertDialogCancel
                                    onClick={() => handleFinalizeAction(false)}
                                    disabled={isProcessingFinalize}
                                    className="flex-1 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 py-6"
                                >
                                    Decline / Query
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleFinalizeAction(true)}
                                    disabled={isProcessingFinalize}
                                    className="flex-[2] bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 py-6"
                                >
                                    {isProcessingFinalize ? (
                                        <Loader2 className="animate-spin mr-2" size={18} />
                                    ) : null}
                                    Acknowledge & Finalize
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>


                    <AssignAssetModal
                        isOpen={showAssignModal}
                        onClose={() => setShowAssignModal(false)}
                        asset={asset}
                        onUpdate={fetchAssetDetails}
                    />

                    <TransferAssetModal
                        isOpen={showTransferModal}
                        onClose={() => setShowTransferModal(false)}
                        asset={asset}
                        onUpdate={fetchAssetDetails}
                    />

                    <HandoverFormModal
                        isOpen={showHandoverModal}
                        onClose={() => setShowHandoverModal(false)}
                        asset={asset}
                    />

                    {/* Response Modal */}
                    {
                        showResponseModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200 relative">
                                    <button
                                        onClick={() => setShowResponseModal(false)}
                                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                    <h2 className="text-xl font-bold mb-4">
                                        {responseAction === 'AcceptWithComments'
                                            ? (asset.negotiationHistory && asset.negotiationHistory.length > 0 ? "Reply / Accept with Comments" : "Accept with Comments")
                                            : 'Reject / Cancel Assignment'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mb-4">
                                        {responseAction === 'AcceptWithComments'
                                            ? 'Please add any comments regarding the acceptance of this asset.'
                                            : 'Please provide a reason for rejecting this asset assignment.'}
                                    </p>
                                    <textarea
                                        className="mb-4 w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm"
                                        placeholder="Enter comments here..."
                                        value={responseComment}
                                        onChange={(e) => setResponseComment(e.target.value)}
                                    />
                                    {responseAction === 'AcceptWithComments' && (
                                        <div className="mb-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                                                Attachment (Optional)
                                            </label>
                                            <input
                                                type="file"
                                                onChange={handleFileUpload}
                                                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            />
                                        </div>
                                    )}
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            onClick={() => setShowResponseModal(false)}
                                            className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleResponse}
                                            className={`px-6 py-2 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 ${responseAction === 'AcceptWithComments'
                                                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                                : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                                }`}
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* History Modal */}
                    {
                        showHistoryModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between mb-6 border-b pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                                <History size={24} />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900">Asset History</h2>
                                                <p className="text-sm text-gray-500">Timeline of assignments and actions</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowHistoryModal(false)}
                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            <ArrowLeft size={24} className="rotate-180" />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 font-sans">
                                        {!assetHistory || assetHistory.length === 0 ? (
                                            <div className="text-center py-10 text-gray-400">
                                                <History size={48} className="mx-auto mb-3 opacity-20" />
                                                <p className="text-sm font-bold uppercase tracking-wider">No history records found.</p>
                                            </div>
                                        ) : (
                                            assetHistory.map((entry, index) => {
                                                const isExpanded = expandedHistory[`modal_${index}`];
                                                const isComment = entry.action === 'Comment' || entry.action === 'AcceptWithComments';

                                                return (
                                                    <div key={index} className="flex gap-4 group">
                                                        <div className="flex flex-col items-center">
                                                            <div className={`w-3 h-3 rounded-full mt-3 shadow-sm transition-colors ${entry.action === 'Assigned' ? 'bg-blue-500 shadow-blue-200' :
                                                                entry.action === 'Accepted' ? 'bg-emerald-500 shadow-emerald-200' :
                                                                    entry.action === 'Rejected' ? 'bg-red-500 shadow-red-200' :
                                                                        entry.action === 'End of Life' ? 'bg-rose-600 shadow-rose-300' :
                                                                            entry.action === 'Created' ? 'bg-indigo-500 shadow-indigo-200' :
                                                                                'bg-gray-400'
                                                                }`} />
                                                            {index !== assetHistory.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1 group-hover:bg-gray-200 transition-colors" />}
                                                        </div>
                                                        <div className="flex-1 pb-4">
                                                            <div className="bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden font-sans">
                                                                <div
                                                                    onClick={() => setExpandedHistory(prev => ({ ...prev, [`modal_${index}`]: !isExpanded }))}
                                                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
                                                                >
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded w-fit ${entry.action === 'Assigned' ? 'bg-blue-100 text-blue-700' :
                                                                                entry.action === 'Accepted' ? 'bg-emerald-100 text-emerald-700' :
                                                                                    entry.action === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                                                        entry.action === 'End of Life' ? 'bg-rose-100 text-rose-700' :
                                                                                            entry.action === 'Created' ? 'bg-indigo-100 text-indigo-700' :
                                                                                                'bg-gray-100 text-gray-600'
                                                                                }`}>
                                                                                {entry.action}
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                                                                                {entry.action === 'Assigned' && entry.assignedToType === 'Company' ? `Allocated to ${entry.assignedCompany?.name || 'Company'}` :
                                                                                    entry.action === 'Assigned' && entry.assignedTo ? `Assigned to ${entry.assignedTo.firstName}` :
                                                                                        entry.action === 'Returned' ? 'Returned' :
                                                                                            entry.action === 'Created' ? 'Asset Created' :
                                                                                                entry.action === 'Accepted' && entry.details?.approvalAction === 'Approve' ? 'Creation Approved' :
                                                                                                    entry.action === 'Rejected' && entry.details?.approvalAction === 'Reject' ? 'Creation Rejected' :
                                                                                                        entry.action === 'End of Life' ? 'Marked as End of Life' : 'Update'}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[9px] text-gray-400 font-medium capitalize">
                                                                            {new Date(entry.date).toLocaleString()}
                                                                            {entry.action === 'Created' && (
                                                                                <span className="ml-2 text-indigo-600 font-black lowercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                                                    (Age: {calculateAge(entry.date)})
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        {entry.performedBy && (
                                                                            <div className="hidden sm:flex items-center gap-2 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
                                                                                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-bold">
                                                                                    {getInitials(entry.performedBy.firstName || 'U')}
                                                                                </div>
                                                                                <span className="text-[9px] font-bold text-gray-700 pr-1">
                                                                                    {entry.performedBy.firstName}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                                                    </div>
                                                                </div>

                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                        <div className="h-px bg-slate-200/50 mb-3" />
                                                                        <div className="text-[10px] text-gray-600 space-y-1">
                                                                            {entry.assignedTo && entry.action === 'Assigned' && (
                                                                                <p className="flex items-center gap-1">
                                                                                    To: <span className="font-bold text-gray-900">{entry.assignedTo.firstName} {entry.assignedTo.lastName}</span>
                                                                                </p>
                                                                            )}

                                                                            {entry.comments && (
                                                                                <div className="mt-2 bg-white/50 p-2 rounded border border-gray-100/50 italic text-gray-500">
                                                                                    &quot;{entry.comments}&quot;
                                                                                </div>
                                                                            )}

                                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                                {entry.file && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedFile(entry.file);
                                                                                            setShowFileModal(true);
                                                                                        }}
                                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors border border-slate-200"
                                                                                    >
                                                                                        <FileText size={12} /> Attachment
                                                                                    </button>
                                                                                )}
                                                                                {entry.details && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedHistoryItem(entry);
                                                                                            setShowHistoryDetailModal(true);
                                                                                        }}
                                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                                                                    >
                                                                                        <FileText size={12} /> Handover Details
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="mt-4 pt-4 border-t flex justify-end">
                                        <button
                                            onClick={() => setShowHistoryModal(false)}
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-xs font-bold uppercase tracking-wide"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Send to Service Modal */}
                    {
                        showServiceModal && (
                            <SendToServiceModal
                                isOpen={showServiceModal}
                                assetName={asset?.name}
                                onClose={() => setShowServiceModal(false)}
                                onConfirm={async ({ serviceDuration, description, attachment, invoice }) => {
                                    try {
                                        await axiosInstance.put(`/AssetItem/${assetId}/status`, {
                                            status: 'Service',
                                            serviceDuration,
                                            description,
                                            attachment,
                                            invoice,
                                        });
                                        toast({ title: 'Success', description: 'Asset sent to service.' });
                                        setShowServiceModal(false);
                                        fetchAssetDetails();
                                        fetchAssetHistory();
                                    } catch (err) {
                                        toast({ variant: 'destructive', title: 'Error', description: err?.response?.data?.message || 'Failed to send to service.' });
                                    }
                                }}
                            />
                        )
                    }

                    {/* Mark as Live Modal */}
                    {
                        showMarkAsLiveModal && (
                            <MarkAsLiveModal
                                isOpen={showMarkAsLiveModal}
                                assetName={asset?.name}
                                onClose={() => setShowMarkAsLiveModal(false)}
                                onConfirm={async ({ serviceReport, amount, attachment }) => {
                                    try {
                                        await axiosInstance.put(`/AssetItem/${asset._id}/status`, {
                                            status: 'Live',
                                            serviceReport,
                                            amount,
                                            attachment
                                        });
                                        toast({ title: 'Success', description: 'Asset is now Live.' });
                                        setShowMarkAsLiveModal(false);
                                        fetchAssetDetails();
                                        fetchAssetHistory();
                                    } catch (err) {
                                        toast({ variant: 'destructive', title: 'Error', description: err?.response?.data?.message || 'Failed to complete service.' });
                                    }
                                }}
                            />
                        )
                    }

                    {/* Loss & Damage Modal */}
                    {
                        showDamageModal && (
                            <AddLossDamageModal
                                isOpen={showDamageModal}
                                onClose={() => setShowDamageModal(false)}
                                onBack={() => setShowDamageModal(false)}
                                isAssetFlow={damageInitialData?.isAssetFlow !== false}
                                isInitialRequest={damageInitialData?.isInitialRequest === true}
                                isApprovalFlow={damageInitialData?.isApprovalFlow === true}
                                onAssetRequest={async (fineData) => {
                                    try {
                                        // Check if this is from approval flow (Asset Controller filling modal after approval)
                                        if (damageInitialData?.isApprovalFlow) {
                                            // Check if this is for an accessory
                                            if (damageInitialData?.isAccessoryFlow && damageInitialData?.accessoryObjectId) {
                                                // Call respond-action for accessory with fineData
                                                await axiosInstance.put(`/AssetItem/${assetId}/accessories/${damageInitialData.accessoryObjectId}/respond-action`, {
                                                    approve: true,
                                                    comment: approvalComment || '',
                                                    fineData: fineData
                                                });
                                                toast({
                                                    title: "Approved",
                                                    description: "Accessory Loss and Damage approved. Fine created with status Pending HR."
                                                });
                                            } else {
                                                // Call approve-action for main asset with fineData
                                                await axiosInstance.put(`/AssetItem/${assetId}/approve-action`, {
                                                    approve: true,
                                                    comment: approvalComment || '',
                                                    fineData: fineData
                                                });
                                                toast({
                                                    title: "Approved",
                                                    description: "Loss and Damage approved. Fine created with status Pending HR."
                                                });
                                            }
                                            setShowDamageModal(false);
                                            setApprovalComment('');
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                            router.replace(`/HRM/Asset/details/${assetId}`);
                                        } else if (damageInitialData?.isDirectAuthorityRequest) {
                                            // AC/Admin direct Loss & Damage: request + approve in one submit.
                                            // IMPORTANT: use accessory routes when L&D is for an accessory — main-asset approve-action sets asset.status = Lost.
                                            const attachmentData = fineData?.attachment?.data
                                                ? `data:${fineData.attachment.mimeType || 'application/pdf'};base64,${fineData.attachment.data}`
                                                : null;
                                            const accOid = damageInitialData?.accessoryObjectId;
                                            if (damageInitialData?.isAccessoryFlow && accOid) {
                                                await axiosInstance.put(
                                                    `/AssetItem/${assetId}/accessories/${accOid}/request-action`,
                                                    {
                                                        actionType: 'Loss and Damage',
                                                        reason: fineData?.description || '',
                                                        attachment: attachmentData
                                                    }
                                                );
                                                await axiosInstance.put(
                                                    `/AssetItem/${assetId}/accessories/${accOid}/respond-action`,
                                                    {
                                                        approve: true,
                                                        comment: approvalComment || '',
                                                        fineData
                                                    }
                                                );
                                                toast({
                                                    title: "Processed",
                                                    description: "Accessory loss and damage processed. Fine moved to Pending HR."
                                                });
                                            } else {
                                                await axiosInstance.put(`/AssetItem/${assetId}/request-action`, {
                                                    actionType: 'Loss and Damage',
                                                    reason: fineData?.description || '',
                                                    attachment: attachmentData
                                                });
                                                await axiosInstance.put(`/AssetItem/${assetId}/approve-action`, {
                                                    approve: true,
                                                    comment: approvalComment || '',
                                                    fineData
                                                });
                                                toast({
                                                    title: "Processed",
                                                    description: "Loss and Damage processed directly. Fine moved to Pending HR."
                                                });
                                            }
                                            setShowDamageModal(false);
                                            setApprovalComment('');
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                            router.replace(`/HRM/Asset/details/${assetId}`);
                                        } else if (damageInitialData?.isInitialRequest) {
                                            // Initial request flow (user requesting) - only send description and attachment
                                            // fineData will be { description, attachment } from modal
                                            const description = typeof fineData === 'string' ? fineData : (fineData?.description || '');
                                            const attachmentData = fineData?.attachment?.data
                                                ? `data:${fineData.attachment.mimeType || 'application/pdf'};base64,${fineData.attachment.data}`
                                                : null;

                                            await handleActionRequest({
                                                reason: description,
                                                attachment: attachmentData,
                                                fineData: null, // Don't send fineData in initial request for Loss and Damage
                                                customActionType: 'Loss and Damage',
                                                accessoryId: damageInitialData?.isAccessoryFlow ? damageInitialData?.accessoryObjectId : null
                                            });
                                            setShowDamageModal(false);
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                        } else {
                                            // Legacy flow - send full fineData
                                            await handleActionRequest({
                                                reason: fineData.description,
                                                attachment: fineData.attachment?.data ? `data:${fineData.attachment.mimeType || 'application/pdf'};base64,${fineData.attachment.data}` : null,
                                                fineData: null, // Don't send fineData in initial request for Loss and Damage
                                                customActionType: 'Loss and Damage',
                                                accessoryId: fineData.accessoryId || damageInitialData?.accessoryObjectId
                                            });
                                            setShowDamageModal(false);
                                        }
                                    } catch (err) {
                                        console.error("Failed to process L&D:", err);
                                        toast({
                                            variant: 'destructive',
                                            title: 'Error',
                                            description: err.response?.data?.message || 'Failed to process request.'
                                        });
                                        // Re-throw so AddLossDamageModal does NOT show success toast on failed backend validation.
                                        throw err;
                                    }
                                }}
                                initialData={damageInitialData || {
                                    assetId: asset?.assetId,
                                    assetName: asset?.name,
                                    employeeId: asset?.assignedTo?.employeeId || '',
                                    employeeName: asset?.assignedTo
                                        ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                                        : '',
                                    fineAmount: asset?.assetValue ? String(asset.assetValue) : ''
                                }}
                                employees={employees || []}
                            />
                        )
                    }

                    {/* Confirmation Dialog */}
                    <AlertDialog
                        open={confirmDialog.isOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                setConfirmDialog({ isOpen: false, title: '', description: '' });
                                setConfirmAction(null);
                            }
                        }}
                    >
                        <AlertDialogContent className="bg-white rounded-[24px]">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-bold">{confirmDialog.title}</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm text-gray-500">
                                    {confirmDialog.description}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        if (confirmAction) {
                                            setConfirmDialog({ isOpen: false, title: '', description: '' });
                                            await confirmAction();
                                            setConfirmAction(null);
                                        } else {
                                            executeConfirmAction();
                                        }
                                    }}
                                    className={
                                        confirmDialog.title === 'Unassign Asset'
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-rose-100'
                                            : 'bg-slate-800 hover:bg-slate-900 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl'
                                    }
                                >
                                    Confirm
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* History Detail Modal (Historical Form View) */}
                    {
                        showHistoryDetailModal && selectedHistoryItem?.details && (
                            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                                <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300">
                                    {/* Header */}
                                    <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                                                <History size={20} />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-gray-900">Historical Record</h2>
                                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                                    Snapshot from {new Date(selectedHistoryItem.date).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => downloadHistoryPdf(selectedHistoryItem._id)}
                                                disabled={isDownloadingHistory}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50"
                                            >
                                                {isDownloadingHistory ? <RotateCw size={12} className="animate-spin" /> : <Download size={12} />}
                                                Download PDF
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowHistoryDetailModal(false);
                                                    setSelectedHistoryItem(null);
                                                }}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Form Preview Area */}
                                    <div className="flex-1 overflow-y-auto p-12 bg-gray-100/50 scrollbar-hide flex flex-col items-center">
                                        {/* Metadata Summary */}
                                        <div className="w-full max-w-[210mm] mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status at time</p>
                                                <p className="text-[11px] font-bold text-blue-600">{selectedHistoryItem.details.status}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Assignment Type</p>
                                                <p className="text-[11px] font-bold text-gray-900">{selectedHistoryItem.details.assignmentType || 'N/A'}</p>
                                            </div>
                                            {selectedHistoryItem.details.assignedDays && (
                                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Duration</p>
                                                    <p className="text-[11px] font-bold text-gray-900">{selectedHistoryItem.details.assignedDays} Days</p>
                                                </div>
                                            )}
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Action Performed</p>
                                                <p className="text-[11px] font-bold text-emerald-600">{selectedHistoryItem.action}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Performed By</p>
                                                <p className="text-[9px] font-bold text-gray-900 truncate">
                                                    {selectedHistoryItem.performedBy?.firstName} {selectedHistoryItem.performedBy?.lastName}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="inline-block shadow-2xl">
                                            <HandoverFormView
                                                asset={selectedHistoryItem.details}
                                                employee={selectedHistoryItem.details.assignedTo}
                                                isPrint={false}
                                                overrideDate={selectedHistoryItem.date}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Accessory Transfer Modal */}
                    {transferModal.isOpen && (
                        <TransferAccessoryModal
                            isOpen={transferModal.isOpen}
                            onClose={() => setTransferModal({ isOpen: false, accessory: null })}
                            accessory={transferModal.accessory}
                            sourceAsset={asset}
                            onTransfer={() => {
                                toast({ title: "Success", description: "Accessory transfered" });
                                fetchAssetDetails();
                                setTransferModal({ isOpen: false, accessory: null });
                            }}
                        />
                    )}

                    {/* Asset Return Confirmation */}
                    <AlertDialog
                        open={returnConfirmOpen}
                        onOpenChange={setReturnConfirmOpen}
                    >
                        <AlertDialogContent className="bg-white rounded-[24px]">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-bold">Return Asset</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm text-gray-500">
                                    Are you sure you want to return this asset? This will move it back to internal inventory.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleReturnAsset}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-rose-100"
                                >
                                    Confirm Return
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog
                        open={showServiceExtendDialog}
                        onOpenChange={setShowServiceExtendDialog}
                    >
                        <AlertDialogContent className="bg-white rounded-[24px]">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-bold">Extend Service Duration</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm text-gray-500">
                                    Add extra service days for this asset.
                                </AlertDialogDescription>
                                <div className="mt-3">
                                    <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Extension Days (1-30)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={serviceExtensionDays}
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value, 10);
                                            if (!Number.isNaN(v)) setServiceExtensionDays(Math.min(30, Math.max(1, v)));
                                        }}
                                        className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                                    />
                                    <label className="mt-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider block">Reason (required)</label>
                                    <textarea
                                        rows={3}
                                        value={serviceExtensionReason}
                                        onChange={(e) => setServiceExtensionReason(e.target.value)}
                                        className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                                        placeholder="Enter extension reason"
                                    />
                                </div>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleExtendService();
                                    }}
                                    disabled={isExtendingService}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-indigo-100"
                                >
                                    {isExtendingService ? 'Processing...' : 'Confirm Extend'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Image Delete Confirmation */}
                    <AlertDialog
                        open={imageDeleteConfirm.isOpen}
                        onOpenChange={(open) => !open && setImageDeleteConfirm({ isOpen: false, imageId: null })}
                    >
                        <AlertDialogContent className="bg-white rounded-[24px]">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-bold text-red-600">Delete Image</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm text-gray-500">
                                    Are you sure you want to remove this image? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteImage}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-red-100"
                                >
                                    Delete Forever
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Image Upload Modal */}
                    {imageUploadModal.isOpen && (
                        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 uppercase tracking-widest font-black">
                            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-8 border-b border-gray-50">
                                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                                            <Camera size={20} />
                                        </div>
                                        Upload Image
                                    </h3>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="w-full aspect-video rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shadow-inner flex items-center justify-center">
                                        <img
                                            src={`data:${imageUploadModal.file?.type};base64,${imageUploadModal.base64}`}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block ml-1">Caption</label>
                                        <input
                                            type="text"
                                            placeholder="Enter image caption..."
                                            value={imageUploadModal.caption}
                                            onChange={(e) => setImageUploadModal({ ...imageUploadModal, caption: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block ml-1">Date</label>
                                        <input
                                            type="date"
                                            value={imageUploadModal.date}
                                            onChange={(e) => setImageUploadModal({ ...imageUploadModal, date: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="p-8 pt-4 flex gap-3">
                                    <button
                                        onClick={() => setImageUploadModal({ isOpen: false, file: null, base64: null, caption: '', date: '' })}
                                        className="flex-1 py-3.5 px-6 border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all active:scale-[0.98]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUploadImage}
                                        className="flex-1 py-3.5 px-6 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-[0.98]"
                                    >
                                        Upload Image
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showEndOfLifeModal && (
                        <EndOfLifeModal
                            isOpen={showEndOfLifeModal}
                            onClose={() => setShowEndOfLifeModal(false)}
                            assetName={asset?.name}
                            type={assetActionType}
                            onConfirm={handleActionRequest}
                        />
                    )}

                    {/* Reject Dialog */}
                    <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                        <AlertDialogContent className="bg-white rounded-[32px] border-none shadow-2xl overflow-hidden max-w-sm p-0">
                            <AlertDialogTitle className="sr-only">Reject Asset Action</AlertDialogTitle>
                            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
                            <button
                                onClick={() => setShowRejectDialog(false)}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100/50 text-slate-400 hover:text-slate-900 transition-all z-10"
                            >
                                <X size={18} />
                            </button>
                            <div className="p-8 pt-10 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 mb-4 mx-auto shadow-sm">
                                    <X size={24} strokeWidth={3} />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                                    Reject Request?
                                </h3>
                                <AlertDialogDescription className="text-slate-500 text-sm font-medium leading-relaxed px-2 mb-6">
                                    You are about to reject the <span className="text-rose-600 font-bold">{asset?.pendingAction}</span> request. The asset will return to its previous state.
                                </AlertDialogDescription>

                                <div className="space-y-4">
                                    <div className="text-left">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1 mb-2">Reason for Rejection</label>
                                        <textarea
                                            value={approvalComment}
                                            onChange={(e) => setApprovalComment(e.target.value)}
                                            placeholder="Explain why this request is being rejected..."
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium min-h-[100px]"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handleApproveAction(false)}
                                            disabled={isProcessingApproval || !approvalComment.trim()}
                                            className="w-full py-4 bg-rose-600 text-white rounded-[20px] font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isProcessingApproval && <Loader2 className="animate-spin" size={16} />}
                                            {isProcessingApproval ? 'Processing...' : 'Confirm Reject'}
                                        </button>
                                        <button
                                            onClick={() => setShowRejectDialog(false)}
                                            className="w-full py-3 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-all"
                                        >
                                            Keep Pending
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Finalize Action Dialog (Assigned User) */}
                    <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
                        <AlertDialogContent className="bg-white rounded-[32px] border-none shadow-2xl overflow-hidden max-w-sm p-0">
                            <AlertDialogTitle className="sr-only">Finalize Asset Action</AlertDialogTitle>
                            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
                            <button
                                onClick={() => setShowFinalizeDialog(false)}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                            >
                                <X size={18} />
                            </button>
                            <div className="p-6 pt-8 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 mx-auto shadow-sm">
                                    <ShieldCheck size={24} />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                                    Finalize {asset?.pendingAction}?
                                </h3>
                                <AlertDialogDescription className="text-slate-500 text-sm font-medium leading-relaxed px-2 mb-6">
                                    By acknowledging this, you confirm the current state of the asset. Status will become <span className="text-emerald-600 font-bold underline">Out of Service</span>.
                                </AlertDialogDescription>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleFinalizeAction(true)}
                                        disabled={isProcessingFinalize}
                                        className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                                    >
                                        {isProcessingFinalize ? 'Processing...' : 'Acknowledge & Confirm'}
                                    </button>
                                    <button
                                        onClick={() => handleFinalizeAction(false)}
                                        disabled={isProcessingFinalize}
                                        className="w-full py-3 bg-white text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 border border-slate-100 transition-all font-black"
                                    >
                                        Cancel / Reject
                                    </button>
                                </div>
                            </div>
                        </AlertDialogContent>
                    </AlertDialog>

                    {showEditModal && !creatorCannotEditSubmittedAsset && (
                        <AddAssetTypeModal
                            isOpen={showEditModal}
                            onClose={() => setShowEditModal(false)}
                            onSuccess={fetchAssetDetails}
                            mode="asset"
                            initialData={asset}
                            canEditAssetValue={userIsAdmin}
                        />
                    )}

                    {/* ── Request unattach (approval workflow) ── */}
                    <AlertDialog
                        open={accessoryDeleteConfirm.isOpen}
                        onOpenChange={(open) =>
                            !open && setAccessoryDeleteConfirm({ isOpen: false, accessory: null, loading: false })
                        }
                    >
                        <AlertDialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
                            <AlertDialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-rose-50/50">
                                <AlertDialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <Trash2 size={18} className="text-rose-600" />
                                    Delete accessory
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500 mt-1">
                                    This permanently removes the accessory from this asset. This action is available to administrators only.
                                    {accessoryDeleteConfirm.accessory?.name && (
                                        <span className="block mt-2 text-slate-700 font-semibold">
                                            Accessory: {accessoryDeleteConfirm.accessory.name}
                                        </span>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="px-6 py-6 flex gap-3">
                                <AlertDialogCancel className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest">
                                    Cancel
                                </AlertDialogCancel>
                                <button
                                    type="button"
                                    disabled={accessoryDeleteConfirm.loading}
                                    onClick={() => executeDeleteAccessory()}
                                    className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-6 text-white font-bold uppercase text-[10px] tracking-widest hover:bg-rose-700 disabled:opacity-50"
                                >
                                    {accessoryDeleteConfirm.loading ? 'Removing…' : 'Delete'}
                                </button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog open={unattachConfirm.isOpen} onOpenChange={(open) => !open && setUnattachConfirm({ isOpen: false, accessory: null, reason: '', loading: false })}>
                        <AlertDialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
                            <AlertDialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-orange-50/50">
                                <AlertDialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm">
                                        <ArrowDownLeft size={16} />
                                    </span>
                                    Request unattach
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500 mt-1">
                                    This sends an approval request to the Asset Controller. The accessory stays on the asset until they approve; if rejected, nothing changes.
                                    {unattachConfirm.accessory?.name && (
                                        <>
                                            {' '}
                                            Accessory: <strong className="text-slate-700">{unattachConfirm.accessory.name}</strong>
                                        </>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="px-6 py-5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                    Reason (optional)
                                </label>
                                <textarea
                                    className="w-full min-h-[88px] px-4 py-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none placeholder:text-slate-300"
                                    placeholder="Why should this accessory be detached?"
                                    value={unattachConfirm.reason}
                                    onChange={(e) => setUnattachConfirm((p) => ({ ...p, reason: e.target.value }))}
                                />
                            </div>
                            <AlertDialogFooter className="px-6 pb-6 flex gap-3">
                                <AlertDialogCancel
                                    onClick={() => setUnattachConfirm({ isOpen: false, accessory: null, reason: '', loading: false })}
                                    className="flex-1 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={unattachConfirm.loading}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        submitUnattachRequest();
                                    }}
                                    className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {unattachConfirm.loading ? 'Sending…' : 'Send request'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* ── Accessory Reject Reason Dialog ── */}
                    <AlertDialog open={accRejectDialog.isOpen} onOpenChange={(open) => !open && setAccRejectDialog(p => ({ ...p, isOpen: false, reason: '' }))}>
                        <AlertDialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
                            <AlertDialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-rose-50/50">
                                <AlertDialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-sm">✕</span>
                                    Reject {accRejectDialog.pendingAction}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500 mt-1">
                                    You are rejecting the <strong className="text-slate-700">{accRejectDialog.pendingAction}</strong> request for accessory{' '}
                                    <strong className="text-slate-700">{accRejectDialog.accName}</strong>. Please provide a reason.
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="px-6 py-5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                    Rejection Reason
                                </label>
                                <textarea
                                    className="w-full min-h-[100px] px-4 py-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 resize-none transition-all placeholder:text-slate-300"
                                    placeholder="Enter the reason for rejection..."
                                    value={accRejectDialog.reason}
                                    onChange={(e) => setAccRejectDialog(p => ({ ...p, reason: e.target.value }))}
                                />
                            </div>

                            <AlertDialogFooter className="px-6 pb-6 flex gap-3">
                                <AlertDialogCancel
                                    onClick={() => setAccRejectDialog(p => ({ ...p, isOpen: false, reason: '' }))}
                                    className="flex-1 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={accRejectDialog.loading}
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        setAccRejectDialog(p => ({ ...p, loading: true }));
                                        try {
                                            await axiosInstance.put(
                                                `/AssetItem/${assetId}/accessories/${accRejectDialog.accId}/respond-action`,
                                                { approve: false, comment: accRejectDialog.reason }
                                            );
                                            toast({ title: 'Rejected', description: `${accRejectDialog.pendingAction} request for "${accRejectDialog.accName}" has been rejected.` });
                                            setAccRejectDialog({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', loading: false });
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                        } catch (err) {
                                            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Failed to reject.' });
                                            setAccRejectDialog(p => ({ ...p, loading: false }));
                                        }
                                    }}
                                    className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {accRejectDialog.loading ? 'Rejecting...' : 'Confirm Reject'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* ── Accessory Accept Dialog ── */}
                    <AlertDialog open={accAcceptDialog.isOpen} onOpenChange={(open) => !open && setAccAcceptDialog(p => ({ ...p, isOpen: false, reason: '', attachment: null }))}>
                        <AlertDialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
                            <AlertDialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-emerald-50/50">
                                <AlertDialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm">✓</span>
                                    Approve {accAcceptDialog.pendingAction}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500 mt-1">
                                    Confirm <strong className="text-slate-700">{accAcceptDialog.pendingAction}</strong> for accessory{' '}
                                    <strong className="text-slate-700">{accAcceptDialog.accName}</strong>. Attachment is optional.
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="px-6 py-5 space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                        Description / Comment (Optional)
                                    </label>
                                    <textarea
                                        className="w-full min-h-[100px] px-4 py-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 resize-none transition-all placeholder:text-slate-300"
                                        placeholder="Add any internal notes..."
                                        value={accAcceptDialog.reason}
                                        onChange={(e) => setAccAcceptDialog(p => ({ ...p, reason: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                        Internal Attachment
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setAccAcceptDialog(prev => ({ ...prev, attachment: reader.result }));
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="hidden"
                                            id="acc-accept-file-popup"
                                        />
                                        <label
                                            htmlFor="acc-accept-file-popup"
                                            className={`w-full h-12 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer transition-all ${accAcceptDialog.attachment ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-emerald-400 hover:bg-emerald-50'}`}
                                        >
                                            <Paperclip size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {accAcceptDialog.attachment ? 'File Attached ✔' : 'Upload Attachment'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <AlertDialogFooter className="px-6 pb-6 flex gap-3">
                                <AlertDialogCancel
                                    onClick={() => setAccAcceptDialog(p => ({ ...p, isOpen: false, reason: '', attachment: null }))}
                                    className="flex-1 rounded-xl border border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all font-sans"
                                >
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={accAcceptDialog.loading}
                                    onClick={async (e) => {
                                        e.preventDefault();

                                        // For Loss and Damage without fineData, open the Loss and Damage form modal
                                        if (accAcceptDialog.pendingAction === 'Loss and Damage') {
                                            const accessory = asset.accessories?.find(a => a._id?.toString() === accAcceptDialog.accId?.toString() || a.accessoryId === accAcceptDialog.accId);
                                            if (accessory && !accessory.pendingActionDetails?.fineData) {
                                                setAccAcceptDialog({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', attachment: null, loading: false });
                                                // Open Loss and Damage modal with accessory data
                                                setDamageInitialData({
                                                    assetId: asset.assetId,
                                                    assetName: asset.name,
                                                    assetObjectId: asset._id,
                                                    isAssetFlow: true,
                                                    isApprovalFlow: true,
                                                    isAccessoryFlow: true, // Flag for accessory
                                                    accessoryId: accessory.accessoryId,
                                                    accessoryName: accessory.name,
                                                    accessoryObjectId: accessory._id,
                                                    employeeId: asset.assignedTo?.employeeId || '',
                                                    employeeName: asset.assignedTo
                                                        ? `${asset.assignedTo.firstName || ''} ${asset.assignedTo.lastName || ''}`.trim()
                                                        : '',
                                                    assignedToType: asset.assignedToType || (asset.assignedCompany ? 'Company' : 'Employee'),
                                                    company: asset.assignedCompany?._id || asset.assignedCompany || null,
                                                    description: accessory.pendingActionDetails?.reason || accAcceptDialog.reason || '',
                                                    attachment: accessory.pendingActionDetails?.attachment || accAcceptDialog.attachment || null,
                                                    fineAmount: accessory.amount ? String(accessory.amount) : '',
                                                    responsibleFor: asset.assignedToType === 'Company' ? 'Company' : 'Employee' // Auto-set based on assignment
                                                });
                                                setShowDamageModal(true);
                                                return;
                                            }
                                        }

                                        // For other actions, proceed with normal approval
                                        setAccAcceptDialog(p => ({ ...p, loading: true }));
                                        try {
                                            await axiosInstance.put(
                                                `/AssetItem/${assetId}/accessories/${accAcceptDialog.accId}/respond-action`,
                                                {
                                                    approve: true,
                                                    comment: accAcceptDialog.reason,
                                                    attachment: accAcceptDialog.attachment
                                                }
                                            );
                                            toast({ title: 'Success', description: `${accAcceptDialog.pendingAction} has been approved.` });
                                            setAccAcceptDialog({ isOpen: false, accId: null, accName: '', pendingAction: '', reason: '', attachment: null, loading: false });
                                            fetchAssetDetails();
                                            fetchAssetHistory();
                                        } catch (err) {
                                            toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.message || 'Failed to approve.' });
                                            setAccAcceptDialog(p => ({ ...p, loading: false }));
                                        }
                                    }}
                                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {accAcceptDialog.loading ? 'Processing...' : 'Confirm Approve'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

                {/* Bulk Creation Approval Modal */}
                {bulkCreationModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden border border-slate-100 flex flex-col">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Bulk Asset Creation Approval</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                        Selected: {bulkCreationSelectedIds.length} / {bulkCreationAssets.length}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setBulkCreationModalOpen(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-4 border-b border-slate-100">
                                <input
                                    value={bulkCreationFilter}
                                    onChange={(e) => setBulkCreationFilter(e.target.value)}
                                    placeholder="Filter by asset ID, name, status, or accessory..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {bulkCreationLoading ? (
                                    <p className="text-sm text-slate-500 text-center py-10">Loading assets...</p>
                                ) : (
                                    bulkCreationAssets
                                        .filter((row) => {
                                            const needle = bulkCreationFilter.toLowerCase().trim();
                                            if (!needle) return true;
                                            const hay = [
                                                row.assetId,
                                                row.name,
                                                row.status,
                                                ...(Array.isArray(row.accessories) ? row.accessories.map((a) => `${a.name || ''} ${a.accessoryId || ''}`) : [])
                                            ].join(' ').toLowerCase();
                                            return hay.includes(needle);
                                        })
                                        .map((row) => {
                                            const rid = row._id?.toString();
                                            const selected = bulkCreationSelectedIds.includes(rid);
                                            return (
                                                <div key={rid} className={`rounded-xl border p-4 ${selected ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <label className="flex items-center gap-3 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setBulkCreationSelectedIds((prev) => {
                                                                        const set = new Set(prev);
                                                                        if (checked) set.add(rid);
                                                                        else set.delete(rid);
                                                                        return Array.from(set);
                                                                    });
                                                                }}
                                                            />
                                                            <div>
                                                                <p className="text-sm font-black text-slate-800">{row.name || '-'}</p>
                                                                <p className="text-[11px] font-mono text-slate-500">{row.assetId}</p>
                                                            </div>
                                                        </label>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-black uppercase">{row.status || '-'}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setBulkCreationSelectedIds((prev) => prev.filter((id) => id !== rid))}
                                                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                                                title="Remove from selection"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {Array.isArray(row.accessories) && row.accessories.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Accessories</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {row.accessories.map((acc, idx) => (
                                                                    <span key={`${rid}-acc-${idx}`} className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 font-bold">
                                                                        {acc.name || 'Accessory'} {acc.accessoryId ? `(${acc.accessoryId})` : ''}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                )}
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 justify-end">
                                <button
                                    onClick={() => setBulkCreationSelectedIds(bulkCreationAssets.map((it) => it._id?.toString()).filter(Boolean))}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest bg-white hover:bg-slate-50"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={() => handleBulkCreationResponse('Reject')}
                                    disabled={bulkCreationActionLoading}
                                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                                >
                                    {bulkCreationActionLoading ? 'Processing...' : 'Reject Selected'}
                                </button>
                                <button
                                    onClick={() => handleBulkCreationResponse('Approve')}
                                    disabled={bulkCreationActionLoading}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                                >
                                    {bulkCreationActionLoading ? 'Processing...' : 'Approve Selected'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bulk Leave / End of Life — checkbox review (matches inbox “Review bulk request” pattern) */}
                {bulkTransferReviewOpen && asset && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col">
                            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
                                <div className="min-w-0">
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Review bulk request</h3>
                                    <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide mt-1">
                                        {asset.pendingAction === 'End of Life' ? 'Asset end of life' : 'Asset leave'}
                                    </p>
                                    {bulkTransferReviewAssets.length > 0 && (
                                        <p className="text-sm text-slate-600 mt-2 break-words">
                                            {`${asset.pendingAction === 'End of Life' ? 'Bulk end of life' : 'Bulk leave'} (${bulkTransferReviewAssets.length} assets): ${bulkTransferReviewAssets.map((r) => `${r.assetId} — ${r.name || ''}`.trim()).join('; ')}`}
                                        </p>
                                    )}
                                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-900">
                                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                        <span>
                                            Checked assets will be <strong>approved</strong>{' '}
                                            {asset.pendingAction === 'End of Life'
                                                ? <>for <strong>end of services (store)</strong>.</>
                                                : <>for <strong>on-leave</strong> handling.</>}{' '}
                                            Unchecked assets <strong>reject</strong> this request — the assignee{' '}
                                            <strong>stays assigned</strong> for those items.
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setBulkTransferReviewOpen(false)}
                                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 shrink-0"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {bulkTransferReviewLoading ? (
                                    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-12">
                                        <Loader2 className="animate-spin" size={20} />
                                        Loading assets…
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                                            <button
                                                type="button"
                                                onClick={checkAllBulkTransferDispositions}
                                                className="text-amber-700 hover:underline"
                                            >
                                                Check all
                                            </button>
                                            <button
                                                type="button"
                                                onClick={uncheckAllBulkTransferDispositions}
                                                className="text-slate-500 hover:underline"
                                            >
                                                Uncheck all
                                            </button>
                                        </div>
                                        <ul className="space-y-2">
                                            {bulkTransferReviewAssets.map((row) => {
                                                const rid = row._id?.toString();
                                                const pendingKind = asset.pendingAction;
                                                const approveVal = pendingKind === 'End of Life' ? 'eos' : 'leave';
                                                const val = bulkDispositionById[rid] || 'reject';
                                                const isChecked = val === approveVal;
                                                const detailHref = `/HRM/Asset/details/${rid}?tab=document`;
                                                return (
                                                    <li
                                                        key={rid}
                                                        className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <input
                                                                type="checkbox"
                                                                className="mt-1 w-4 h-4 rounded border-slate-300 text-amber-600 shrink-0 cursor-pointer"
                                                                checked={isChecked}
                                                                onChange={() => toggleBulkTransferDispositionCheckbox(rid)}
                                                                id={`bulk-transfer-ack-${rid}`}
                                                                aria-label={`Approve ${row.name || 'asset'}`}
                                                            />
                                                            <div className="min-w-0 flex-1 space-y-1">
                                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                                        <Package size={16} className="text-slate-400 shrink-0" />
                                                                        <span className="font-bold text-slate-900">{row.name || '—'}</span>
                                                                        <span className="text-[10px] font-mono text-slate-400">{row.assetId}</span>
                                                                    </div>
                                                                    <Link
                                                                        href={detailHref}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        View asset
                                                                        <ExternalLink size={12} className="opacity-80" />
                                                                    </Link>
                                                                </div>
                                                                {row.pendingAction && (
                                                                    <p className="text-[10px] font-semibold text-rose-600">
                                                                        Pending: {row.pendingAction}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </>
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80">
                                <button
                                    type="button"
                                    onClick={() => setBulkTransferReviewOpen(false)}
                                    disabled={isProcessingApproval}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-[11px] font-black uppercase text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setBulkTransferReviewOpen(false);
                                        await handleApproveAction(true);
                                    }}
                                    disabled={isProcessingApproval}
                                    className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-2"
                                >
                                    {isProcessingApproval ? <Loader2 className="animate-spin" size={16} /> : null}
                                    Confirm selection
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bulk return — same “Review bulk request” pattern as leave / end of life */}
                {bulkReturnReviewOpen && asset && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col">
                            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
                                <div className="min-w-0">
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Review bulk request</h3>
                                    <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide mt-1">Asset return</p>
                                    {bulkReturnReviewAssets.length > 0 && (
                                        <p className="text-sm text-slate-600 mt-2 break-words">
                                            {`Bulk return (${bulkReturnReviewAssets.length} assets): ${bulkReturnReviewAssets.map((r) => `${r.assetId} — ${r.name || ''}`.trim()).join('; ')}`}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setBulkReturnReviewOpen(false)}
                                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 shrink-0"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {bulkReturnReviewLoading ? (
                                    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-12">
                                        <Loader2 className="animate-spin" size={20} />
                                        Loading assets…
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                                            <button
                                                type="button"
                                                onClick={checkAllBulkReturnSelection}
                                                className="text-amber-700 hover:underline"
                                            >
                                                Check all
                                            </button>
                                            <button
                                                type="button"
                                                onClick={uncheckAllBulkReturnSelection}
                                                className="text-slate-500 hover:underline"
                                            >
                                                Uncheck all
                                            </button>
                                        </div>
                                        <ul className="space-y-2">
                                            {bulkReturnReviewAssets.map((row) => {
                                                const rid = row._id?.toString();
                                                const isSelected = bulkSelectedAssetIds.includes(rid);
                                                const detailHref = `/HRM/Asset/details/${rid}?tab=document`;
                                                return (
                                                    <li
                                                        key={rid}
                                                        className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <input
                                                                type="checkbox"
                                                                className="mt-1 w-4 h-4 rounded border-slate-300 text-amber-600 shrink-0 cursor-pointer"
                                                                checked={isSelected}
                                                                onChange={() => toggleBulkAssetSelection(rid)}
                                                                id={`bulk-return-ack-${rid}`}
                                                                aria-label={`Include ${row.name || 'asset'} in approved return`}
                                                            />
                                                            <div className="min-w-0 flex-1 space-y-1">
                                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                                        <Package size={16} className="text-slate-400 shrink-0" />
                                                                        <span className="font-bold text-slate-900">{row.name || '—'}</span>
                                                                        <span className="text-[10px] font-mono text-slate-400">{row.assetId}</span>
                                                                    </div>
                                                                    <Link
                                                                        href={detailHref}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        View asset
                                                                        <ExternalLink size={12} className="opacity-80" />
                                                                    </Link>
                                                                </div>
                                                                {row.pendingAction && (
                                                                    <p className="text-[10px] font-semibold text-rose-600">
                                                                        Pending: {row.pendingAction}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </>
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80">
                                <button
                                    type="button"
                                    onClick={() => setBulkReturnReviewOpen(false)}
                                    disabled={isProcessingApproval}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-[11px] font-black uppercase text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setBulkReturnReviewOpen(false);
                                        await handleApproveAction(true);
                                    }}
                                    disabled={isProcessingApproval}
                                    className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-2"
                                >
                                    {isProcessingApproval ? <Loader2 className="animate-spin" size={16} /> : null}
                                    Confirm selection
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Return Asset Modal (similar to SalaryTab) */}
                {showReturnModal && asset && (
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
                                            Asset: {asset.assetId} - {asset.name}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowReturnModal(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                                {canUseBulkReturnUi && returnableAssets.length > 1 && (
                                    <div className="flex rounded-2xl border border-slate-200 bg-slate-50/80 p-1 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setReturnMode('individual')}
                                            className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                                returnMode === 'individual'
                                                    ? 'bg-white text-amber-700 shadow-sm border border-amber-100'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            Individual
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReturnMode('bulk')}
                                            className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                                returnMode === 'bulk'
                                                    ? 'bg-white text-amber-700 shadow-sm border border-amber-100'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            Bulk return
                                        </button>
                                    </div>
                                )}

                                {/* Asset Info Summary */}
                                <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-[24px] border border-slate-100">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Asset Type</label>
                                        <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                            {asset.typeId?.name || asset.typeId || '-'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Category</label>
                                        <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                            {asset.categoryId?.name || asset.categoryId || '-'}
                                        </div>
                                    </div>
                                </div>

                                {canUseBulkReturnUi && returnMode === 'bulk' && (
                                    <div className="rounded-[24px] border border-amber-100 bg-amber-50/40 p-5 space-y-3">
                                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                                            Include more assets assigned to you
                                        </p>
                                        {returnableLoading ? (
                                            <p className="text-sm text-slate-500 py-4 text-center">Loading your assets…</p>
                                        ) : (
                                            <ul className="space-y-2 max-h-48 overflow-y-auto">
                                                {returnableAssets.map((row) => {
                                                    const rid = row._id?.toString();
                                                    const isCurrent = rid === asset._id?.toString();
                                                    const checked = returnBulkSelectedIds.includes(rid);
                                                    return (
                                                        <li
                                                            key={rid}
                                                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                                                                isCurrent ? 'border-amber-300 bg-white' : 'border-slate-200 bg-white'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-slate-300"
                                                                checked={checked}
                                                                disabled={isCurrent}
                                                                onChange={() => !isCurrent && toggleReturnBulkAsset(rid)}
                                                            />
                                                            <span className="flex-1 font-bold text-slate-800">
                                                                {row.assetId} — {row.name || ''}
                                                                {isCurrent ? (
                                                                    <span className="ml-2 text-[10px] font-black uppercase text-amber-600">(this asset)</span>
                                                                ) : null}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                        <p className="text-[11px] text-slate-600">
                                            Selected {returnBulkSelectedIds.length} asset{returnBulkSelectedIds.length !== 1 ? 's' : ''}. One request will be sent to the Asset Controller.
                                        </p>
                                    </div>
                                )}

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
                                                {asset.assignedBy?.firstName
                                                    ? `${asset.assignedBy.firstName} ${asset.assignedBy.lastName} (Original Issuer)`
                                                    : "Asset Store / Admin"}
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                {canUseBulkReturnUi && returnMode === 'bulk' && returnBulkSelectedIds.length > 1
                                                    ? 'Selected assets will be returned to the store after Asset Controller approval.'
                                                    : 'Asset will be returned to the store or original issuer.'}
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
                                            {canUseBulkReturnUi && returnMode === 'bulk' && returnBulkSelectedIds.length > 1
                                                ? `Submit bulk return (${returnBulkSelectedIds.length})`
                                                : 'Confirm Return'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Dialog */}
                <AlertDialog
                    open={showDeleteModal}
                    onOpenChange={(open) => !open && setShowDeleteModal(false)}
                >
                    <AlertDialogContent className="bg-white rounded-[24px]">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-bold">Delete Asset</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-gray-500">
                                Are you sure you want to delete <span className="font-bold text-gray-900">"{asset?.name || asset?.assetId}"</span>? This action is permanent and cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="rounded-xl border-gray-100 font-bold uppercase text-[10px] tracking-widest cursor-pointer">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleDeleteAsset();
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-red-100 cursor-pointer"
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </div>
    );
}