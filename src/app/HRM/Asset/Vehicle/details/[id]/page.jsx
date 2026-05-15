'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useListReturnBack } from '@/hooks/useListReturnBack';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AccessoriesModal from '../../../components/AccessoriesModal';
import AssignAssetModal from '../../../components/AssignAssetModal';
import HandoverFormModal from '../../../components/HandoverFormModal';
import HandoverFormView from '../../../components/HandoverFormView';
import VehicleGeneralDocumentModal from '../../components/VehicleGeneralDocumentModal';
import EditVehicleBasicDetailsModal from '../../components/EditVehicleBasicDetailsModal';


import VehicleRegistrationModal from '../../components/VehicleRegistrationModal';
import VehicleInsuranceModal from '../../components/VehicleInsuranceModal';
import VehicleWarrantyModal from '../../components/VehicleWarrantyModal';
import VehiclePermitModal from '../../components/VehiclePermitModal';
import VehiclePetrolModal from '../../components/VehiclePetrolModal';
import VehicleTollModal from '../../components/VehicleTollModal';
import VehicleMortgageModal from '../../components/VehicleMortgageModal';
import VehicleAssetHistoryTab from '../../components/VehicleAssetHistoryTab';
import VehicleAssetProfileHeader from '../../components/VehicleAssetProfileHeader';
import VehicleActivationSubmitModal, { sectionGroups } from '../../components/VehicleActivationSubmitModal';
import VehicleProfileActivationReviewModal from '../../components/VehicleProfileActivationReviewModal';
import VehicleExpirySummaryCard from '../../components/VehicleExpirySummaryCard';
import VehicleServiceModal from '../../components/VehicleServiceModal';
import { VEHICLE_SERVICE_TYPES } from '../../components/vehicleServiceUtils';
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

function fleetServiceTypeKey(service) {
    if (!service) return '';
    const st = String(service.serviceType || '').trim();
    if (st) return st;
    const r = parseServiceRemark(service.remark);
    return String(r?.serviceType || '').trim();
}

function fleetLatestServiceForType(services, type) {
    const list = (services || []).filter((s) => fleetServiceTypeKey(s) === type);
    if (!list.length) return null;
    return [...list].sort((a, b) => {
        const ta = new Date(a?.date || a?.createdAt || 0).getTime();
        const tb = new Date(b?.date || b?.createdAt || 0).getTime();
        return tb - ta;
    })[0];
}

/** Newest-first list for a service type (index 0 = live, rest = history / old docs). */
function fleetServicesForTypeSortedDesc(services, type) {
    const list = (services || []).filter((s) => fleetServiceTypeKey(s) === type);
    return [...list].sort((a, b) => {
        const ta = new Date(a?.date || a?.createdAt || 0).getTime();
        const tb = new Date(b?.date || b?.createdAt || 0).getTime();
        return tb - ta;
    });
}

function fleetServiceWorkflowLabel(srv) {
    const st = String(srv?.workflowSnapshot?.stage || '').trim();
    if (st) return st.replace(/_/g, ' ');
    const r = parseServiceRemark(srv?.remark);
    const w = String(r?.workflowStage || r?.stage || '').trim();
    return w ? w.replace(/_/g, ' ') : '';
}

/** Row list for this vehicle’s latest record of a service type (Basic-details style label/value). */
function fleetServiceDetailRowsForCard(srv, formatDateFn) {
    if (!srv) return [];
    const remark = parseServiceRemark(srv.remark);
    const rows = [];
    const d = srv.date || srv.createdAt;
    if (d) rows.push({ label: 'Service date', value: formatDateFn(d) });
    const wf = fleetServiceWorkflowLabel(srv);
    rows.push({ label: 'Workflow', value: wf || 'Recorded' });
    if (srv.currentKm != null && String(srv.currentKm).trim() !== '')
        rows.push({ label: 'KM at service', value: String(srv.currentKm) });
    if (srv.value != null && Number(srv.value) > 0)
        rows.push({
            label: 'Amount',
            value: `AED ${Number(srv.value).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`,
        });
    if (srv.description && String(srv.description).trim())
        rows.push({ label: 'Description', value: String(srv.description).trim() });
    if (remark?.vendorName) rows.push({ label: 'Vendor', value: String(remark.vendorName).trim() });
    if (remark?.oilServiceTypeText)
        rows.push({ label: 'Oil service type', value: String(remark.oilServiceTypeText).trim() });
    if (remark?.nextChangeKm != null && String(remark.nextChangeKm).trim() !== '')
        rows.push({ label: 'Next change (KM)', value: String(remark.nextChangeKm) });
    if (remark?.nextChangeMonth) rows.push({ label: 'Next change (month)', value: String(remark.nextChangeMonth) });
    return rows;
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

/** Mirrors warranty-required + section filtering used for activation approve payload (must stay in sync with page logic). */
function computeVehicleActivationApprovedSectionsPayload(asset) {
    if (!asset) return [];
    const docs = Array.isArray(asset.documents) ? asset.documents : [];
    const warrantyDoc = docs.find((d) => (d.type || '').toLowerCase() === 'warranty') || null;
    const warrantyAttachments = docs.filter((d) => (d.type || '').toLowerCase() === 'warranty attachment');
    let warrantyMeta = { km: '', warrantyBy: '', warrantyCovered: [] };
    if (warrantyDoc?.description) {
        try {
            const parsed = JSON.parse(warrantyDoc.description);
            warrantyMeta = {
                km: parsed?.km != null ? String(parsed.km) : '',
                warrantyBy: parsed?.warrantyBy || '',
                warrantyCovered: Array.isArray(parsed?.warrantyCovered) ? parsed.warrantyCovered : [],
            };
        } catch {
            warrantyMeta = { km: '', warrantyBy: '', warrantyCovered: [] };
        }
    }
    const warrantyKmEffective =
        warrantyMeta?.km ?? asset?.warrantyKm ?? asset?.warrantyKM ?? asset?.kmWarranty ?? '';
    const hasWarrantyKmValue = !(
        warrantyKmEffective === null ||
        warrantyKmEffective === undefined ||
        String(warrantyKmEffective).trim() === ''
    );
    const warrantyByEffective =
        warrantyMeta?.warrantyBy || asset?.warrantyBy || asset?.warrantyProvider || '';
    const warrantyStartEffective =
        warrantyDoc?.issueDate || asset?.warrantyStartDate || asset?.warrantyIssueDate || '';
    const warrantyEndEffective =
        warrantyDoc?.expiryDate ||
        asset?.warrantyExpiryDate ||
        asset?.warrantyEndDate ||
        asset?.warrantyDate ||
        '';
    const hasWarrantyDocumentData = Boolean(
        warrantyStartEffective ||
            warrantyEndEffective ||
            warrantyDoc?.attachment ||
            hasWarrantyKmValue ||
            (warrantyByEffective && String(warrantyByEffective).trim()) ||
            (warrantyAttachments && warrantyAttachments.length > 0),
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
    const warrantyRequiredForCompletion =
        typeof warrantyEnabledFromAsset === 'boolean' ? warrantyEnabledFromAsset : hasWarrantyDocumentData;

    const groups = sectionGroups(warrantyRequiredForCompletion);
    const raw = Array.isArray(asset?.vehicleProfileActivationSections) ? asset.vehicleProfileActivationSections : [];
    const allowed = new Set(groups.map((g) => g.id));
    return [...new Set(raw.map((s) => String(s || '').trim()).filter((s) => allowed.has(s)))];
}

const normFlowchartCategoryKey = (c) => String(c || '').toLowerCase().trim();

/** Same priority as backend getDepartmentHOD('admincontroller'): Settings "Admin" row first. */
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

export default function VehicleDetailsPage() {
    const router = useRouter();
    const handleListReturnBack = useListReturnBack();
    const params = useParams();
    const searchParams = useSearchParams();
    const assetId = params.id;
    const { toast } = useToast();
    const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const isAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT';
    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [showAccessoriesModal, setShowAccessoriesModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [showVehicleActivationModal, setShowVehicleActivationModal] = useState(false);
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
    const [fines, setFines] = useState([]);
    const [loadingFines, setLoadingFines] = useState(false);
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseAction, setResponseAction] = useState(null);
    const [responseComment, setResponseComment] = useState('');
    const [responseFile, setResponseFile] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showFileModal, setShowFileModal] = useState(false);
    const [hasAssetController, setHasAssetController] = useState(true);
    const [isFlowchartAdminController, setIsFlowchartAdminController] = useState(false);
    const [vehicleProfileActivationFlowchartAdminName, setVehicleProfileActivationFlowchartAdminName] = useState('');
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
    const [handoverInnerTab, setHandoverInnerTab] = useState('document');
    const [showVehicleFineModal, setShowVehicleFineModal] = useState(false);
    const [showPetrolModal, setShowPetrolModal] = useState(false);
    const [showTollModal, setShowTollModal] = useState(false);
    const [showMortgageModal, setShowMortgageModal] = useState(false);
    const [mortgageRemoving, setMortgageRemoving] = useState(false);
    const [vehicleServiceModalOpen, setVehicleServiceModalOpen] = useState(false);
    const [vehicleServicePresetType, setVehicleServicePresetType] = useState('');

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

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'service') setActiveTab('service');
    }, [searchParams]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setCurrentUserEmployeeId(user.employeeObjectId || user._id);
            setCurrentUserId(user._id || user.id);

            const fetchUserDataAndCheckController = async () => {
                try {
                    const [userRes, companyRes, flowRes] = await Promise.all([
                        axiosInstance.get('/Employee/me'),
                        axiosInstance.get('/company', { params: { scope: 'responsibilities' } }),
                        axiosInstance.get('/Flowchart').catch((e) => {
                            console.error('Vehicle page: Flowchart fetch failed:', e);
                            return { data: [] };
                        }),
                    ]);

                    if (userRes && userRes.data) {
                        setCurrentUser(userRes.data);
                        const actualId = userRes.data._id || userRes.data.id;
                        if (actualId) setCurrentUserEmployeeId(actualId);

                        const companies = companyRes.data.companies || [];

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
                    console.error("Failed to fetch user profile or companies:", err);
                    setHasAssetController(false);
                    setIsFlowchartAdminController(false);
                    setVehicleProfileActivationFlowchartAdminName('');
                }
            };
            fetchUserDataAndCheckController();
        }
    }, []);

    const fetchAssetDetails = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/AssetItem/detail/${assetId}`);
            setAsset(response.data);
        } catch (error) {
            console.error('Error fetching asset details:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch vehicle details"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAssetCreationResponse = async (action) => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/approve-creation`, { action });
            toast({
                title: action === 'Approve' ? 'Asset Approved' : 'Asset Rejected',
                description: action === 'Approve' ? 'The asset is now active and unassigned.' : 'The asset creation has been rejected.'
            });
            fetchAssetDetails();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to process request.'
            });
        }
    };

    const handleSubmitDraftForApproval = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/submit-creation`);
            toast({
                title: 'Submitted',
                description: 'The Asset Controller has been notified (email, dashboard, and inbox).'
            });
            fetchAssetDetails();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to submit for approval.'
            });
        }
    };

    const fetchAssetHistory = async () => {
        try {
            const response = await axiosInstance.get(`/AssetItem/${assetId}/history`);
            setAssetHistory(response.data);
        } catch (error) {
            console.error('Error fetching asset history:', error);
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
            console.error('Error fetching fines:', error);
        } finally {
            setLoadingFines(false);
        }
    };

    const refreshData = useCallback(() => {
        if (!assetId) return;
        fetchAssetDetails();
        if (activeTab === 'history' || activeTab === 'handover') fetchAssetHistory();
        if (activeTab === 'fine') fetchFines();
    }, [assetId, activeTab, asset?.assetId]);

    useEffect(() => {
        if (assetId) {
            refreshData();
        }
    }, [assetId, activeTab, refreshData]);

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

    const handleDeleteDoc = async () => {
        if (!docToDelete) return;
        setDeleteLoading(true);
        try {
            await axiosInstance.delete(`/AssetItem/${assetId}/document/${docToDelete._id}`);
            toast({ title: 'Deleted', description: `${docToDelete.type} document deleted successfully` });
            setDocToDelete(null);
            fetchAssetDetails();
        } catch (error) {
            console.error('Error deleting document:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete document' });
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleNotRenewDoc = async () => {
        if (!docToNotRenew || !docToNotRenew._id) return;
        setNotRenewLoading(true);
        try {
            let meta = {};
            const raw = docToNotRenew.description;
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

            await axiosInstance.put(`/AssetItem/${assetId}/document/${docToNotRenew._id}`, {
                description: JSON.stringify(meta),
            });

            toast({ title: 'Updated', description: `${docToNotRenew.type} moved to Old Documents (Not Renewed).` });
            // Optimistically update local asset so the doc disappears from Live immediately.
            setAsset((prev) => {
                if (!prev) return prev;
                const list = Array.isArray(prev.documents) ? prev.documents : [];
                const nextDocs = list.map((d) => {
                    if (String(d?._id || '') !== String(docToNotRenew._id || '')) return d;
                    return { ...d, description: JSON.stringify(meta) };
                });
                return { ...prev, documents: nextDocs };
            });
            setDocToNotRenew(null);
            fetchAssetDetails();
        } catch (error) {
            console.error('Error marking document not renewed:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to mark document as not renewed',
            });
        } finally {
            setNotRenewLoading(false);
        }
    };

    const handleRemoveMortgage = async () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Remove Mortgage?',
            description: 'Are you sure you want to remove mortgage details for this vehicle?',
            onConfirm: async () => {
                try {
                    setMortgageRemoving(true);
                    await axiosInstance.put(`/AssetType/${assetId}`, {
                        mortgageBankName: '',
                        mortgageVehicleName: '',
                        mortgageAmount: 0,
                        downPayment: 0,
                        interestRate: 0,
                        loanTenureMonths: 0,
                        mortgageStartDate: null,
                        mortgageEndDate: null,
                        monthlyPayment: 0,
                        balancePayment: 0,
                        processCharge: 0,
                        mortgageBankDocument: null,
                        mortgageSecurityCheckAttachment: null,
                        mortgageScheduleListAttachment: null,
                        mortgageExtraAttachments: [],
                        mortgageBank: '',
                    });
                    toast({ title: 'Removed', description: 'Mortgage details removed successfully.' });
                    if (activeTab === 'mortgage') setActiveTab('basic');
                    fetchAssetDetails();
                } catch (error) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: error?.response?.data?.message || 'Failed to remove mortgage details.',
                    });
                } finally {
                    setMortgageRemoving(false);
                }
            }
        });
    };

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

    const handleResponse = async () => {
        try {
            await axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                action: responseAction,
                comments: responseComment,
                file: responseFile
            });
            toast({
                title: "Success",
                description: `Vehicle assignment ${responseAction === 'Accept' || responseAction === 'AcceptWithComments' ? 'accepted' : 'rejected'} successfully.`
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
        }
    };

    const openResponseModal = (action) => {
        if ((action === 'AcceptWithComments' || action === 'Accept') && !checkSignature()) return;
        setResponseAction(action);
        setShowResponseModal(true);
    };

    const latestHandoverDocument = useMemo(() => {
        if (!assetHistory || assetHistory.length === 0) return null;

        const sortedHistory = [...assetHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestHandover = sortedHistory.find(
            (h) =>
                (h.action === 'Assigned' || h.action === 'Returned' || h.action === 'Unassigned') &&
                h.details &&
                h.details.assetId
        );

        return latestHandover || null;
    }, [assetHistory]);



    const assignedEmployeeForFine = useMemo(() => {
        const assignee = asset?.assignedTo;
        if (assignee && typeof assignee === 'object' && assignee.employeeId) {
            return assignee;
        }
        return null;
    }, [asset]);

    const isCreatorUser = useMemo(() => {
        if (!asset || !currentUserId) return false;
        const cb = asset.createdBy?._id?.toString() || asset.createdBy?.toString();
        return cb === currentUserId;
    }, [asset, currentUserId]);

    const creatorCannotEditSubmittedAsset = useMemo(() => {
        if (!asset || !currentUserId) return false;
        if (currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'ROOT') return false;
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

    const vehicleDocumentLifecycleBuckets = useMemo(() => {
        const docs = asset?.documents || [];
        const normType = (t) => String(t || '').toLowerCase().trim();

        const bucketize = (list) => {
            const basic = [];
            const registration = [];
            const insurance = [];
            const warranty = [];
            const permit = [];
            const petrol = [];
            for (const d of list) {
                const t = normType(d.type);
                if (t === 'registration' || t === 'registration attachment') registration.push(d);
                else if (t === 'insurance') insurance.push(d);
                else if (t === 'warranty') warranty.push(d);
                else if (t === 'permit') permit.push(d);
                else if (t === 'petrol' || t === 'petrol attachment') petrol.push(d);
                else if (t === 'insurance attachment') {
                    if (!String(d?.description || '').toLowerCase().includes('invoice')) {
                        basic.push(d);
                    }
                } else basic.push(d);
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
            basic.sort((a, b) => {
                const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                return tb - ta;
            });
            return { basic, registration, insurance, warranty, permit, petrol };
        };

        const renewalTrackedTypes = new Set([
            'warranty',
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

        return {
            live: bucketize(live),
            old: bucketize(old),
        };
    }, [asset]);

    const vehicleActivationApprovedSectionsPayload = useMemo(
        () => computeVehicleActivationApprovedSectionsPayload(asset),
        [asset],
    );

    if (loading) {
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
                            <button
                                onClick={handleListReturnBack}
                                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto font-sans"
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
            { label: 'Brand', value: a.typeId?.name || a.type },
            { label: 'Model', value: a.name },
            { label: 'Plate Number', value: `${a.plateEmirate || ''} ${a.plateNumber || ''}`.trim() },
            { label: 'Model Year', value: a.modelYear },
            { label: 'Asset Value', value: a.assetValue ? `AED ${Number(a.assetValue).toLocaleString()}` : null },
            { label: 'Current KM', value: `${Number(a.currentKilometer || 0).toLocaleString()} KM` },
        ];
        const disp = String(a.vehicleDispositionStatus || 'active').toLowerCase();
        const dispositionLabel =
            disp === 'sold' ? 'Sold' : disp === 'total loss' ? 'Total loss' : 'Active';
        const extras = [{ label: 'Status', value: dispositionLabel }];
        if (disp === 'sold') {
            const sv = formatMoneyAed(a.soldValue);
            if (sv) extras.push({ label: 'Sold value', value: sv });
        }
        if (disp === 'total loss') {
            const tv = formatMoneyAed(a.totalLossValue);
            if (tv) extras.push({ label: 'Total loss value', value: tv });
        }
        const loanLabel = disp === 'total loss' ? 'Bank loan balance' : 'Current loan amount';
        const loanVal = formatMoneyAed(a.currentLoanAmount);
        if (loanVal) extras.push({ label: loanLabel, value: loanVal });
        const bal = formatMoneyAed(a.balanceInHand);
        if (bal) extras.push({ label: 'Balance in hand', value: bal });
        if (a.registrationExpiryDate) {
            extras.push({ label: 'Registration expiry', value: formatDate(a.registrationExpiryDate) });
        }
        if (disp === 'total loss' && a.accidentReportAttachment) {
            extras.push({
                label: 'Accident report',
                value: (
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedFile(a.accidentReportAttachment);
                            setShowFileModal(true);
                        }}
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

    const normDocType = (t) => String(t || '').toLowerCase().trim();

    const registrationAttachmentsForDoc = (mainDoc, list) => {
        if (!mainDoc || normDocType(mainDoc.type) !== 'registration') return [];
        return (list || []).filter((d) => {
            if (normDocType(d.type) !== 'registration attachment') return false;
            const sameIssue = String(d.issueDate || '') === String(mainDoc.issueDate || '');
            const sameExpiry = String(d.expiryDate || '') === String(mainDoc.expiryDate || '');
            return sameIssue && sameExpiry;
        });
    };

    const isInsuranceInvoiceAttachmentLabel = (doc) =>
        String(doc?.description || doc?.name || '').toLowerCase().includes('invoice');

    const insuranceAttachmentsForDoc = (mainDoc, list) => {
        if (!mainDoc || normDocType(mainDoc.type) !== 'insurance') return [];
        return (list || []).filter((d) => {
            if (normDocType(d.type) !== 'insurance attachment') return false;
            if (isInsuranceInvoiceAttachmentLabel(d)) return false;
            const sameIssue = String(d.issueDate || '') === String(mainDoc.issueDate || '');
            const sameExpiry = String(d.expiryDate || '') === String(mainDoc.expiryDate || '');
            return sameIssue && sameExpiry;
        });
    };

    const warrantyAttachmentsForDoc = (mainDoc, list) => {
        if (!mainDoc || normDocType(mainDoc.type) !== 'warranty') return [];
        return (list || []).filter((d) => {
            if (normDocType(d.type) !== 'warranty attachment') return false;
            const sameIssue = String(d.issueDate || '') === String(mainDoc.issueDate || '');
            const sameExpiry = String(d.expiryDate || '') === String(mainDoc.expiryDate || '');
            return sameIssue && sameExpiry;
        });
    };

    const permitAttachmentsForDoc = (mainDoc, list) => {
        if (!mainDoc || normDocType(mainDoc.type) !== 'permit') return [];
        return (list || []).filter((d) => {
            if (normDocType(d.type) !== 'permit attachment') return false;
            const sameIssue = String(d.issueDate || '') === String(mainDoc.issueDate || '');
            return sameIssue;
        });
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

    const registrationDoc = asset?.documents?.find(d => (d.type || '').toLowerCase() === 'registration') || null;
    const registrationAttachments = (asset?.documents || []).filter(
        (d) => (d.type || '').toLowerCase() === 'registration attachment'
    );
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

    const insuranceDoc = asset?.documents?.find(d => (d.type || '').toLowerCase() === 'insurance') || null;
    const insuranceAttachments = (asset?.documents || []).filter(
        (d) =>
            (d.type || '').toLowerCase() === 'insurance attachment' &&
            !isInsuranceInvoiceAttachmentLabel(d)
    );
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

    const warrantyDoc = asset?.documents?.find(d => (d.type || '').toLowerCase() === 'warranty') || null;
    const warrantyAttachments = (asset?.documents || []).filter(
        (d) => (d.type || '').toLowerCase() === 'warranty attachment'
    );
    let warrantyMeta = { km: '', warrantyBy: '', warrantyCovered: [] };
    if (warrantyDoc?.description) {
        try {
            const parsed = JSON.parse(warrantyDoc.description);
            warrantyMeta = {
                km: parsed?.km != null ? String(parsed.km) : '',
                warrantyBy: parsed?.warrantyBy || '',
                warrantyCovered: Array.isArray(parsed?.warrantyCovered) ? parsed.warrantyCovered : [],
            };
        } catch {
            warrantyMeta = { km: '', warrantyBy: '', warrantyCovered: [] };
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
    const warrantyKmEffective =
        warrantyMeta?.km ??
        asset?.warrantyKm ??
        asset?.warrantyKM ??
        asset?.kmWarranty ??
        '';
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
        warrantyDoc?.attachment ||
        hasWarrantyKmValue ||
        (warrantyByEffective && String(warrantyByEffective).trim()) ||
        (warrantyAttachments && warrantyAttachments.length > 0)
    );
    // Show Warranty details card only after Warranty modal/document data exists.
    const hasWarrantyCardData = Boolean(
        warrantyDoc?._id ||
        warrantyDoc?.issueDate ||
        warrantyDoc?.expiryDate ||
        warrantyDoc?.attachment ||
        (warrantyMeta?.km != null && String(warrantyMeta.km).trim() !== '') ||
        (warrantyMeta?.warrantyBy && String(warrantyMeta.warrantyBy).trim()) ||
        (Array.isArray(warrantyMeta?.warrantyCovered) && warrantyMeta.warrantyCovered.length > 0) ||
        (warrantyAttachments && warrantyAttachments.length > 0)
    );
    const warrantyRequiredForCompletion = (() => {
        if (typeof warrantyEnabledFromAsset === 'boolean') return warrantyEnabledFromAsset;
        return hasWarrantyDocumentData;
    })();

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
                : 'none';

    const canReviewVehicleProfileActivation =
        !!asset &&
        vehicleActPhase === 'pending_review' &&
        isFlowchartAdminController;

    const isVehicleProfileActivationSubmitter =
        !!asset?.vehicleProfileActivationSubmittedBy &&
        !!currentUserEmployeeId &&
        String(asset.vehicleProfileActivationSubmittedBy) === String(currentUserEmployeeId);

    const holdNote = String(asset?.vehicleProfileActivationHold?.comment || '').trim();

    const openQuickApproveVehicleProfileActivation = () => {
        if (!vehicleActivationApprovedSectionsPayload.length) {
            toast({
                variant: 'destructive',
                title: 'Nothing to approve',
                description: 'No sections were included in this request.',
            });
            return;
        }
        const assigneeLabel = vehicleProfileActivationFlowchartAdminName || 'the flowchart Administrator';
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
    let tollMeta = { vendor: '', tagNo: '', pinNo: '', accountNo: '', limit: '' };
    if (tollDoc?.description) {
        try {
            const parsed = JSON.parse(tollDoc.description);
            tollMeta = {
                vendor: parsed?.vendor || '',
                tagNo: parsed?.tagNo || '',
                pinNo: parsed?.pinNo || '',
                accountNo: parsed?.accountNo || '',
                limit: parsed?.limit || '',
            };
        } catch {
            tollMeta = { vendor: '', tagNo: '', pinNo: '', accountNo: '', limit: '' };
        }
    }

    const hasTollCardData = Boolean(
        tollDoc?.attachment ||
        tollMeta?.vendor ||
        tollMeta?.tagNo ||
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
        const type = (asset.typeId?.name || asset.type || '').toLowerCase();
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
                                <button
                                    type="button"
                                    onClick={handleListReturnBack}
                                    className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 transition-all font-bold flex items-center gap-2"
                                >
                                    <ArrowLeft size={20} />
                                    <span className="text-sm">Back</span>
                                </button>
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

                            if (isSaveOnlyDraft && isCreatorForBanner) {
                                return (
                                    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                                            <Plus size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Draft</p>
                                            <p className="text-[13px] font-bold text-slate-900 leading-snug">
                                                Saved as draft — not sent to Asset Controller yet. Use <strong>Submit for approval</strong> when
                                                ready (notifies AC: email, dashboard, inbox).
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSubmitDraftForApproval()}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                        >
                                            Submit for approval
                                        </button>
                                    </div>
                                );
                            }

                            if (asset?.status === 'Rejected' && isCreatorForBanner) {
                                return (
                                    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Creation rejected</p>
                                            <p className="text-[13px] font-bold text-rose-950 leading-snug">
                                                Update the vehicle if needed, then submit again for Asset Controller review.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSubmitDraftForApproval()}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shrink-0"
                                        >
                                            Resubmit for approval
                                        </button>
                                    </div>
                                );
                            }

                            if (!isAwaitingCreationApprovalUi) return null;

                            const approverName = getAssetApproverDisplayName(asset);
                            const isCreatorForApproval =
                                asset?.createdBy?._id?.toString() === currentUserId ||
                                asset?.createdBy?.toString() === currentUserId;
                            const showActions =
                                !isCreatorForApproval &&
                                (asset.canApproveAssetCreation === true ||
                                    asset.canApproveAssetCreation === 'true');

                            if (showActions) {
                                return (
                                    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                            <Plus size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Asset Creation Approval</p>
                                            <p className="text-[13px] font-bold text-amber-900 leading-snug">
                                                {asset?.status === 'Submitted for Approval'
                                                    ? `Submitted for approval — awaiting Asset Controller${approverName ? ` (${approverName})` : ''}.`
                                                    : asset?.status === 'Draft'
                                                        ? `Draft pending review${approverName ? ` — ${approverName}` : ''}.`
                                                        : `Awaiting creation approval${approverName ? ` — ${approverName}` : ''}.`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleAssetCreationResponse('Approve')}
                                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAssetCreationResponse('Reject')}
                                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                            >
                                                Reject
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
                                            Awaiting Asset Controller{approverName ? ` — ${approverName}` : ''}…
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                        {asset && vehicleActPhase === 'pending_review' && (
                            <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">
                                        Vehicle profile review
                                    </p>
                                    <p className="text-[13px] font-bold text-emerald-950 leading-snug">
                                        Profile submitted for <strong>Administrator</strong> review (flowchart).
                                        {vehicleProfileActivationFlowchartAdminName ? (
                                            <>
                                                {' '}
                                                <strong>{vehicleProfileActivationFlowchartAdminName}</strong> is assigned
                                                — only they see the dashboard task until it is actioned.
                                            </>
                                        ) : (
                                            <>
                                                {' '}
                                                Only the flowchart <strong>Administrator</strong> sees the dashboard task
                                                until it is actioned.
                                            </>
                                        )}
                                        {canReviewVehicleProfileActivation ? (
                                            <span className="block mt-1.5 text-[12px] font-semibold text-emerald-900">
                                                Use <strong>Review request</strong> for the checklist (hold / reject), or{' '}
                                                <strong>Accept all</strong> when every section is acceptable as-is.
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                {canReviewVehicleProfileActivation ? (
                                    <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => setShowVehicleActivationReviewModal(true)}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                                        >
                                            Review request
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openQuickApproveVehicleProfileActivation}
                                            className="px-5 py-2.5 border-2 border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm"
                                        >
                                            Accept all
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        title={
                                            vehicleProfileActivationFlowchartAdminName
                                                ? `Waiting for ${vehicleProfileActivationFlowchartAdminName} (flowchart Administrator).`
                                                : 'Only the flowchart Administrator can complete this review from their task list.'
                                        }
                                        className="px-5 py-2.5 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-[10px] font-black uppercase tracking-widest shrink-0 cursor-default opacity-90 max-w-[220px] sm:max-w-none text-center leading-tight"
                                    >
                                        {vehicleProfileActivationFlowchartAdminName
                                            ? `Awaiting ${vehicleProfileActivationFlowchartAdminName}`
                                            : 'Awaiting Administrator review'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>


                    <div className="mt-10 flex flex-col gap-10">
                        <div className="grid w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                            <div className="min-w-0">
                                <VehicleAssetProfileHeader
                                    className="h-full"
                                    asset={asset}
                                    registrationExpirySrc={registrationDoc?.expiryDate || asset.registrationExpiryDate}
                                    insuranceExpirySrc={insuranceDoc?.expiryDate || asset.insuranceExpiryDate}
                                    warrantyExpirySrc={warrantyEndEffective}
                                    insuranceProviderLabel={insuranceMeta.policy}
                                    warrantyKmLabel={warrantyKmEffective}
                                    warrantyRequired={warrantyRequiredForCompletion}
                                    permitHint={permitHint}
                                    onSuccess={fetchAssetDetails}
                                    vehicleActPhase={vehicleActPhase}
                                    holdNote={holdNote}
                                    vehicleActivationFlowchartAdminName={vehicleProfileActivationFlowchartAdminName}
                                    canRequestActivationAfterHold={isVehicleProfileActivationSubmitter}
                                    onActivationRequest={() => setShowVehicleActivationModal(true)}
                                />
                            </div>
                            <div className="min-w-0">
                                <VehicleExpirySummaryCard
                                    className="min-h-[200px] sm:min-h-[220px]"
                                    registrationExpirySrc={registrationDoc?.expiryDate || asset.registrationExpiryDate}
                                    insuranceExpirySrc={insuranceDoc?.expiryDate || asset.insuranceExpiryDate}
                                    warrantyExpirySrc={warrantyDoc?.expiryDate}
                                    serviceExpirySrc={asset?.nextServiceDate}
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
                                    {[
                                        { id: 'basic', label: 'Basic Details' },
                                        { id: 'permit', label: 'Permit' },
                                        { id: 'fine', label: 'Fine' },
                                        { id: 'service', label: 'Service' },
                                        { id: 'handover', label: 'Handover' },
                                        { id: 'history', label: 'History' },
                                        { id: 'document', label: 'Document' },
                                    ].map((tab) => (
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
                                {(activeTab === 'basic' || activeTab === 'handover') && asset.assignedTo && (
                                    <button
                                        type="button"
                                        onClick={() => setShowHandoverModal(true)}
                                        className="px-4 py-2 bg-[#13c5c0] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-[#0fb2ad] transition-all flex items-center gap-2"
                                    >
                                        <Printer size={14} /> Print
                                    </button>
                                )}


                                {/* Acceptance Buttons */}
                                {(currentUserEmployeeId && asset.actionRequiredBy === currentUserEmployeeId && asset.acceptanceStatus === 'Pending') && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => openResponseModal('Reject')}
                                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-red-600 transition-all"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!checkSignature()) return;
                                                setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Accept Vehicle Assignment?',
                                                    description: 'Are you sure you want to accept this vehicle assignment? This will acknowledge that you have received the vehicle.',
                                                    onConfirm: () => {
                                                        axiosInstance.put(`/AssetItem/${assetId}/respond`, {
                                                            action: 'Accept',
                                                            comments: ''
                                                        }).then(() => {
                                                            toast({ title: "Success", description: "Vehicle accepted successfully." });
                                                            fetchAssetDetails();
                                                        }).catch(e => {
                                                            toast({ variant: "destructive", title: "Error", description: "Failed to accept vehicle." });
                                                        });
                                                    }
                                                });
                                            }}
                                            className="px-4 py-2 bg-[#13c5c0] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-[#0fb2ad] transition-all"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => openResponseModal('AcceptWithComments')}
                                            className="px-4 py-2 bg-[#13c5c0] text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-[#0fb2ad] transition-all"
                                        >
                                            Accept with Comment
                                        </button>
                                    </div>
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
                                                       <div className="flex items-center gap-2">
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
                                                           {isAdmin && (
                                                               <button
                                                                   type="button"
                                                                   onClick={handleDeleteVehicle}
                                                                   className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                   title="Delete Vehicle"
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
                                                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                          <h3 className="text-base font-bold text-slate-800">Insurance Details</h3>
                                                          <div className="flex items-center gap-2">
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                                                                  title="Renew"
                                                                  onClick={() => { clearDocTabModalContext(); setIsInsuranceRenew(true); setShowInsuranceModal(true); }}
                                                              >
                                                                  <RefreshCw size={18} />
                                                              </button>
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                                  onClick={() => { clearDocTabModalContext(); setIsInsuranceRenew(false); setShowInsuranceModal(true); }}
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              {isAdmin && (
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
                                                                  className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 || insuranceDoc?.attachment || insuranceAttachments.length > 0 ? 'border-b border-slate-100' : ''}`}
                                                              >
                                                                  <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                  <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">{row.value}</span>
                                                              </div>
                                                          ))}

                                                          {(insuranceDoc?.attachment || insuranceAttachments.length > 0) && (
                                                              <div className="mt-4 pt-4 border-t border-slate-50">
                                                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Insurance Documents</h4>
                                                                  <div className="space-y-2">
                                                                      {insuranceDoc?.attachment && (
                                                                          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                                                                      <FileText size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">Insurance Certificate</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Primary Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => { setSelectedFile(insuranceDoc.attachment); setShowFileModal(true); }}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      )}
                                                                      {insuranceAttachments.map((att, idx) => (
                                                                          <div key={att._id || idx} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                                                                      <FileText size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">{att.description || 'Insurance Attachment'}</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Additional Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => { setSelectedFile(att.attachment); setShowFileModal(true); }}
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
                                                          <h3 className="text-base font-bold text-slate-800">Petrol Details</h3>
                                                          <div className="flex items-center gap-2">
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                                  onClick={() => { setShowPetrolModal(true); }}
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              {isAdmin && (
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
                                                              { label: 'Vendor', value: petrolMeta.vendor },
                                                              { label: 'Tag Number', value: petrolMeta.tagNo },
                                                              { label: 'Limit', value: petrolMeta.limit },
                                                              { label: 'Installation Date', value: formatDate(petrolDoc?.issueDate) },
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
                                                                                  onClick={() => { setSelectedFile(petrolDoc.attachment); setShowFileModal(true); }}
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
                                                                                  onClick={() => { setSelectedFile(att.attachment); setShowFileModal(true); }}
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
                                          </div>

                                          {/* Right Column */}
                                          <div className="flex-1 space-y-3 w-full">
                                              {hasRegistrationCardData && (
                                                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                          <h3 className="text-base font-bold text-slate-800">Registration Details</h3>
                                                          <div className="flex items-center gap-2">
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
                                                              {isAdmin && (
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
                                                                                  onClick={() => { setSelectedFile(registrationDoc.attachment); setShowFileModal(true); }}
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
                                                                                  onClick={() => { setSelectedFile(att.attachment); setShowFileModal(true); }}
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

                                              {hasWarrantyCardData && (
                                                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0">
                                                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                          <h3 className="text-base font-bold text-slate-800">Warranty Details</h3>
                                                          <div className="flex items-center gap-2">
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                                                                  title="Renew"
                                                                  onClick={() => { clearDocTabModalContext(); setIsWarrantyRenew(true); setShowWarrantyModal(true); }}
                                                              >
                                                                  <RefreshCw size={18} />
                                                              </button>
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                                  onClick={() => { clearDocTabModalContext(); setIsWarrantyRenew(false); setShowWarrantyModal(true); }}
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              {isAdmin && (
                                                                  <button
                                                                      type="button"
                                                                      onClick={() => { setDocToDelete(warrantyDoc); }}
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
                                                              { label: 'Warranty By', value: warrantyByEffective },
                                                              { label: 'Covered', value: Array.isArray(warrantyMeta.warrantyCovered) ? warrantyMeta.warrantyCovered.join(', ') : warrantyMeta.warrantyCovered },
                                                              {
                                                                  label: 'Odometer (KM)',
                                                                  value: hasWarrantyKmValue ? `${Number(warrantyKmEffective).toLocaleString()} KM` : '-'
                                                              },
                                                              { label: 'Start Date', value: warrantyStartEffective ? formatDate(warrantyStartEffective) : null },
                                                              { label: 'End Date', value: warrantyEndEffective ? formatDate(warrantyEndEffective) : null },
                                                          ].filter(r => r.value).map((row, idx, arr) => (
                                                              <div
                                                                  key={row.label}
                                                                  className={`flex items-center justify-between py-3 ${idx !== arr.length - 1 || warrantyDoc?.attachment || warrantyAttachments.length > 0 ? 'border-b border-slate-100' : ''}`}
                                                              >
                                                                  <span className="text-[13px] text-slate-500">{row.label}</span>
                                                                  <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">{row.value}</span>
                                                              </div>
                                                          ))}

                                                          {(warrantyDoc?.attachment || warrantyAttachments.length > 0) && (
                                                              <div className="mt-4 pt-4 border-t border-slate-50">
                                                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Warranty Documents</h4>
                                                                  <div className="space-y-2">
                                                                      {warrantyDoc?.attachment && (
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
                                                                                  onClick={() => { setSelectedFile(warrantyDoc.attachment); setShowFileModal(true); }}
                                                                                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px] shrink-0 ml-4"
                                                                              >
                                                                                  <Eye size={12} /> View
                                                                              </button>
                                                                          </div>
                                                                      )}
                                                                      {warrantyAttachments.map((att, idx) => (
                                                                          <div key={att._id || idx} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/50 border border-slate-100">
                                                                              <div className="flex items-center gap-3 min-w-0">
                                                                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-teal-600 shadow-sm shrink-0">
                                                                                      <FileText size={16} />
                                                                                  </div>
                                                                                  <div className="min-w-0">
                                                                                      <p className="text-[12px] font-bold text-slate-700 truncate">{att.description || 'Warranty Attachment'}</p>
                                                                                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Additional Document</p>
                                                                                  </div>
                                                                              </div>
                                                                              <button
                                                                                  onClick={() => { setSelectedFile(att.attachment); setShowFileModal(true); }}
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
                                                          <h3 className="text-base font-bold text-slate-800">Toll Details</h3>
                                                          <div className="flex items-center gap-2">
                                                              <button
                                                                  type="button"
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                                  onClick={() => { setShowTollModal(true); }}
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              {isAdmin && (
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
                                                              { label: 'Vendor', value: tollMeta.vendor },
                                                              { label: 'Tag Number', value: tollMeta.tagNo },
                                                              { label: 'Account Number', value: tollMeta.accountNo },
                                                              { label: 'Limit', value: tollMeta.limit },
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
                                                                                  onClick={() => { setSelectedFile(tollDoc.attachment); setShowFileModal(true); }}
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
                                                                                  onClick={() => { setSelectedFile(att.attachment); setShowFileModal(true); }}
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
                                                              <button
                                                                  type="button"
                                                                  onClick={() => setShowMortgageModal(true)}
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                                                                  title="Renew"
                                                              >
                                                                  <RefreshCw size={18} />
                                                              </button>
                                                              <button
                                                                  type="button"
                                                                  onClick={() => setShowMortgageModal(true)}
                                                                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                  title="Edit"
                                                              >
                                                                  <PencilLine size={18} />
                                                              </button>
                                                              {isAdmin && (
                                                                  <button
                                                                      type="button"
                                                                      onClick={handleRemoveMortgage}
                                                                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                      title="Remove Mortgage"
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
                                                                                  onClick={() => { setSelectedFile(row.file); setShowFileModal(true); }}
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
                                              {warrantyRequiredForCompletion && !hasWarrantyCardData && (
                                                  <button
                                                      type="button"
                                                      onClick={() => { clearDocTabModalContext(); setIsWarrantyRenew(false); setShowWarrantyModal(true); }}
                                                      className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2"
                                                  >
                                                      Warranty
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
                                                            {isAdmin && (
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
                                                                                    onClick={() => { setSelectedFile(doc.attachment); setShowFileModal(true); }}
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
                                                                                    onClick={() => { setSelectedFile(att.attachment); setShowFileModal(true); }}
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
                                        <button
                                            type="button"
                                            onClick={() => setShowVehicleFineModal(true)}
                                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                        >
                                            <Plus size={14} />
                                            Add Fine
                                        </button>
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
                                const byLatestDesc = (a, b) => {
                                    const ta = new Date(a.latest?.date || a.latest?.createdAt || 0).getTime();
                                    const tb = new Date(b.latest?.date || b.latest?.createdAt || 0).getTime();
                                    return tb - ta;
                                };
                                const withData = VEHICLE_SERVICE_TYPES.map((type) => ({
                                    type,
                                    latest: fleetLatestServiceForType(asset.services, type),
                                }))
                                    .filter((x) => x.latest != null)
                                    .sort(byLatestDesc);
                                const withoutData = VEHICLE_SERVICE_TYPES.filter(
                                    (type) => !fleetLatestServiceForType(asset.services, type),
                                );
                                return (
                                <div className="w-full max-w-none space-y-6">
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

                                    {withData.length > 0 ? (
                                    <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                                        {withData.map(({ type, latest }) => {
                                            const detailRows = fleetServiceDetailRowsForCard(latest, formatDate);
                                            const openRequestModal = () => {
                                                setVehicleServicePresetType(type);
                                                setVehicleServiceModalOpen(true);
                                            };
                                            return (
                                                <div
                                                    key={type}
                                                    className="min-w-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden px-2 py-0 flex flex-col"
                                                >
                                                    <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                                                        <h3 className="text-base font-bold text-slate-800">{type}</h3>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                title={`New ${type} request`}
                                                                onClick={openRequestModal}
                                                                className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                            >
                                                                <PlusCircle size={18} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="px-5 pb-4 flex-1 flex flex-col">
                                                        <div>
                                                            {detailRows.map((row, idx, arr) => (
                                                                <div
                                                                    key={row.label}
                                                                    className={`flex items-center justify-between py-3 ${
                                                                        idx !== arr.length - 1 ? 'border-b border-slate-100' : ''
                                                                    }`}
                                                                >
                                                                    <span className="text-[13px] text-slate-500">
                                                                        {row.label}
                                                                    </span>
                                                                    <span className="text-[13px] font-semibold text-slate-700 max-w-[60%] text-right break-words">
                                                                        {row.value}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    ) : null}

                                    {withoutData.length > 0 ? (
                                        <div className="flex flex-wrap items-stretch gap-2 md:gap-3">
                                            {withoutData.map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => {
                                                        setVehicleServicePresetType(type);
                                                        setVehicleServiceModalOpen(true);
                                                    }}
                                                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
                                                >
                                                    <PlusCircle size={16} className="shrink-0" />
                                                    Request {type}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                </div>
                                );
                            })()}

                            {activeTab === 'handover' && (
                                <div className="max-w-6xl mx-auto px-2 space-y-5">
                                    <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-100/60 rounded-2xl border border-slate-100">
                                        {[
                                            { id: 'document', label: 'Document' },
                                            { id: 'accessories', label: 'Accessories' },
                                            { id: 'images', label: 'Images' },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setHandoverInnerTab(t.id)}
                                                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${handoverInnerTab === t.id
                                                    ? 'bg-white text-blue-600 border border-slate-200 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {handoverInnerTab === 'document' && (
                                        <div className="flex justify-center p-4 bg-slate-100/30 rounded-2xl border border-slate-100 min-h-[400px]">
                                            {(asset.assignedTo ||
                                                (String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany) ||
                                                asset.status === 'Service') ? (
                                                <HandoverFormView asset={asset} isPrint={false} />
                                            ) : (asset.status === 'Draft' ||
                                                (!asset.assignedTo &&
                                                    !(String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany))) &&
                                                latestHandoverDocument ? (
                                                <div className="w-full flex flex-col items-center">
                                                    <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest text-center">
                                                            Latest Handover Document ({new Date(latestHandoverDocument.date).toLocaleDateString()})
                                                        </p>
                                                    </div>
                                                    <HandoverFormView
                                                        asset={latestHandoverDocument.details}
                                                        isPrint={false}
                                                        overrideDate={latestHandoverDocument.date}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-100 rounded-xl">
                                                    <FileText size={48} className="mb-4 opacity-20" />
                                                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-500">Document unavailable</h3>
                                                    <p className="text-[11px] font-medium mt-2 text-center max-w-sm">
                                                        No handover document found in asset history.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {handoverInnerTab === 'accessories' && (
                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Accessories</h4>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAccessoriesModal(true)}
                                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    Add Accessory
                                                </button>
                                            </div>
                                            <div className="p-5 space-y-3">
                                                {(asset.accessories || []).length === 0 ? (
                                                    <p className="text-sm text-slate-400">No accessories found.</p>
                                                ) : (
                                                    asset.accessories.map((acc, idx) => (
                                                        <div key={acc._id || idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/40">
                                                            <span className="text-sm font-semibold text-slate-700">{acc.name || 'Accessory'}</span>
                                                            <span className="text-xs text-slate-500">{acc.status || 'Attached'}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {handoverInnerTab === 'images' && (
                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-100">
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Images</h4>
                                            </div>
                                            <div className="p-5">
                                                {(() => {
                                                    const allImages = [
                                                        ...(asset.assetPhoto ? [{ _id: '__main__', url: asset.assetPhoto }] : []),
                                                        ...(asset.images || []),
                                                    ];
                                                    if (!allImages.length) return <p className="text-sm text-slate-400">No images uploaded.</p>;
                                                    return (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {allImages.map((img) => (
                                                                <img
                                                                    key={img._id}
                                                                    src={img.url}
                                                                    alt="Asset"
                                                                    className="w-full h-28 object-cover rounded-xl border border-slate-100 cursor-pointer"
                                                                    onClick={() => window.open(img.url, '_blank')}
                                                                />
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
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
                                            </div>
                                           
                                        </div>

                                        {(() => {
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

                                            const make = asset?.typeId?.name || asset?.type || '-';
                                            const model = asset?.modelYear || '-';
                                            const aid = asset?.assetId || '-';
                                            const plate = asset?.plateNumber || '-';

                                            const attachmentBtn = (url, label) =>
                                                url ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedFile(url); setShowFileModal(true); }}
                                                        className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <Download size={14} /> {label || 'View'}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                );

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
                                                                            <td className="px-6 py-4 text-sm">{attachmentBtn(r.att, r.label)}</td>
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
                                                                                        {documentInnerTab === 'live' && (
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
                                                                                        <button
                                                                                            type="button"
                                                                                            className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                            title="Delete"
                                                                                            onClick={() => setDocToDelete(r.doc)}
                                                                                        >
                                                                                            <XCircle size={16} />
                                                                                        </button>
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

                                                    {bucket.registration.length > 0 && (
                                                        <div>
                                                            {sectionTitle('Registration')}
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
                                                                        {bucket.registration.map((doc, idx) => (
                                                                            <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                                                                                    {normDocType(doc.type) === 'registration attachment' ? 'Supporting' : 'Registration card'}
                                                                                </td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                <td className="px-6 py-4 text-sm text-gray-600">{registrationProcessDate(doc)}</td>
                                                                                <td className="px-6 py-4 text-sm">{attachmentBtn(doc.attachment, 'View')}</td>
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
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                if (normDocType(doc.type) === 'registration') {
                                                                                                    setDocTabRegistrationOverride(null);
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
                                                                                        {documentInnerTab === 'live' && (
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
                                                                                        <button
                                                                                            type="button"
                                                                                            className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                            title="Delete"
                                                                                            onClick={() => setDocToDelete(doc)}
                                                                                        >
                                                                                            <XCircle size={16} />
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {bucket.insurance.length > 0 && (
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
                                                                        {bucket.insurance.map((doc, idx) => {
                                                                            const meta = parseVehicleDocDescription(doc);
                                                                            const policy = meta.policy != null && String(meta.policy).trim() !== '' ? String(meta.policy) : '-';
                                                                            const company = doc.issueAuthority ? String(doc.issueAuthority) : '-';
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.expiryDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{policy}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{company}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentBtn(doc.attachment, 'View')}</td>
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
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabInsuranceDoc(null);
                                                                                                    setIsInsuranceRenew(true);
                                                                                                    setShowInsuranceModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                            {documentInnerTab === 'live' && (
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
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
                                                                                            </button>
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

                                                    {bucket.warranty.length > 0 && (
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
                                                                        {bucket.warranty.map((doc, idx) => {
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
                                                                                    <td className="px-6 py-4 text-sm">{attachmentBtn(doc.attachment, 'View')}</td>
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
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDocTabWarrantyDoc(null);
                                                                                                    setIsWarrantyRenew(true);
                                                                                                    setShowWarrantyModal(true);
                                                                                                }}
                                                                                                className="text-teal-500 hover:text-teal-600 transition-colors"
                                                                                                title="Renew"
                                                                                            >
                                                                                                <RefreshCw size={16} />
                                                                                            </button>
                                                                                            {documentInnerTab === 'live' && (
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
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
                                                                                            </button>
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

                                                    {bucket.permit.length > 0 && (
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
                                                                        {bucket.permit.map((doc, idx) => {
                                                                            const meta = parseVehicleDocDescription(doc);
                                                                            const pType = meta.permitType ? String(meta.permitType) : '-';
                                                                            const endDisp = meta.unlimited && !doc.expiryDate ? 'Unlimited' : formatTableDate(doc.expiryDate);
                                                                            return (
                                                                                <tr key={doc._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">{pType}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{formatTableDate(doc.issueDate)}</td>
                                                                                    <td className="px-6 py-4 text-sm text-gray-600">{endDisp}</td>
                                                                                    <td className="px-6 py-4 text-sm">{attachmentBtn(doc.attachment, 'View')}</td>
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
                                                                                            {documentInnerTab === 'live' && (
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
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-rose-400 hover:text-rose-500 transition-colors"
                                                                                                title="Delete"
                                                                                                onClick={() => setDocToDelete(doc)}
                                                                                            >
                                                                                                <XCircle size={16} />
                                                                                            </button>
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
                                        })()}
                                    </div>
                                </div>
                            )}



                            {activeTab === 'history' && (
                                <VehicleAssetHistoryTab
                                    assetHistory={assetHistory}
                                    onViewFile={(fileUrl) => {
                                        setSelectedFile(fileUrl);
                                        setShowFileModal(true);
                                    }}
                                />
                            )}

                        </div>
                    </div>
                </div>
            </div>

            <AccessoriesModal
                isOpen={showAccessoriesModal}
                onClose={() => setShowAccessoriesModal(false)}
                asset={asset}
                onUpdate={refreshData}
            />

            <AssignAssetModal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                asset={asset}
                onUpdate={refreshData}
            />

            <HandoverFormModal
                isOpen={showHandoverModal}
                onClose={() => setShowHandoverModal(false)}
                asset={asset}
                employee={asset?.assignedTo}
            />

            <VehicleServiceModal
                isOpen={vehicleServiceModalOpen}
                onClose={() => {
                    setVehicleServiceModalOpen(false);
                    setVehicleServicePresetType('');
                }}
                onSuccess={() => {
                    setVehicleServiceModalOpen(false);
                    setVehicleServicePresetType('');
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
                warrantyRequired={warrantyRequiredForCompletion}
                requiredSectionIds={heldSections}
                onSuccess={refreshData}
            />

            <VehicleProfileActivationReviewModal
                isOpen={showVehicleActivationReviewModal}
                onClose={() => setShowVehicleActivationReviewModal(false)}
                asset={asset}
                assetMongoId={assetId}
                warrantyRequired={warrantyRequiredForCompletion}
                onSuccess={refreshData}
            />

            <EditVehicleBasicDetailsModal
                isOpen={editBasicDetailsModalOpen}
                assetMongoId={assetId}
                asset={asset}
                onClose={() => setEditBasicDetailsModalOpen(false)}
                onSuccess={() => {
                    fetchAssetDetails();
                    setEditBasicDetailsModalOpen(false);
                }}
            />



            <VehicleRegistrationModal
                isOpen={showRegistrationModal}
                onClose={() => { setShowRegistrationModal(false); setIsRegistrationRenew(false); setDocTabRegistrationOverride(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={docTabRegistrationOverride?.existingDoc ?? registrationDoc}
                existingAttachmentRows={docTabRegistrationOverride?.existingAttachmentRows ?? registrationAttachments}
                isRenew={isRegistrationRenew}
            />

            <VehicleInsuranceModal
                isOpen={showInsuranceModal}
                onClose={() => { setShowInsuranceModal(false); setIsInsuranceRenew(false); setDocTabInsuranceDoc(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={docTabInsuranceDoc ?? insuranceDoc}
                existingAttachmentRows={insuranceAttachmentsForDoc(docTabInsuranceDoc ?? insuranceDoc, vehicleDocumentLifecycleBuckets.live.insurance)}
                isRenew={isInsuranceRenew}
            />

            <VehicleWarrantyModal
                isOpen={showWarrantyModal}
                onClose={() => { setShowWarrantyModal(false); setIsWarrantyRenew(false); setDocTabWarrantyDoc(null); }}
                onSuccess={refreshData}
                assetId={assetId}
                existingDoc={docTabWarrantyDoc ?? warrantyDoc}
                existingAttachmentRows={warrantyAttachmentsForDoc(docTabWarrantyDoc ?? warrantyDoc, warrantyAttachments)}
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

            {/* Response Modal */}
            {showResponseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                {responseAction === 'AcceptWithComments' ? 'Accept with Comments' : 'Reject Assignment'}
                            </h2>
                        </div>

                        <p className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-widest leading-relaxed">
                            {responseAction === 'AcceptWithComments'
                                ? 'Please add any remarks regarding the handover condition.'
                                : 'Please provide a clear reason for rejecting the transfer.'}
                        </p>

                        <div className="space-y-6">
                            <textarea
                                className="w-full p-6 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-blue-500 min-h-[120px] text-sm font-medium transition-all group-hover:border-slate-200"
                                placeholder="Write your comments here..."
                                value={responseComment}
                                onChange={(e) => setResponseComment(e.target.value)}
                            />

                            {responseAction === 'AcceptWithComments' && (
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-[0.2em]">
                                        Handover Document / Photo
                                    </label>
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all cursor-pointer"
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => setShowResponseModal(false)}
                                    className="px-8 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const actionText = responseAction === 'AcceptWithComments' ? 'Accept' : 'Reject';
                                        setConfirmDialog({
                                            isOpen: true,
                                            title: `${actionText} vehicle assignment?`,
                                            description: `Are you sure you want to ${actionText.toLowerCase()} this vehicle assignment with the provided comments?`,
                                            onConfirm: handleResponse
                                        });
                                    }}
                                    className={`px-10 py-4 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 ${responseAction === 'AcceptWithComments'
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                                        : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                                        }`}
                                >
                                    Confirm Action
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* File Preview Modal */}
            {showFileModal && selectedFile && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                        <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xs font-black text-slate-800 flex items-center gap-3 uppercase tracking-[0.2em]">
                                <FileText size={18} className="text-blue-600" />
                                Attachment Preview
                            </h3>
                            <button
                                onClick={() => setShowFileModal(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-12 bg-slate-50 flex items-center justify-center">
                            {selectedFile.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i) || selectedFile.startsWith('data:image') ? (
                                <img
                                    src={selectedFile}
                                    alt="Attachment"
                                    className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl"
                                />
                            ) : selectedFile.match(/\.pdf(\?.*)?$/i) ? (
                                <iframe
                                    src={selectedFile}
                                    className="w-full h-full min-h-[600px] border-none rounded-3xl bg-white shadow-xl"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="text-center p-20">
                                    <div className="w-24 h-24 bg-white border border-slate-100 shadow-sm rounded-3xl flex items-center justify-center mx-auto mb-8 text-slate-200">
                                        <FileText size={48} />
                                    </div>
                                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-10">File preview not available for this format.</p>
                                    <a
                                        href={selectedFile}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-12 py-5 bg-blue-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 inline-flex items-center gap-4"
                                    >
                                        Download Externally <Download size={16} />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
                <AlertDialogContent className="rounded-[32px] p-8 border-none shadow-2xl z-[200] max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900">
                            {confirmDialog.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-slate-500 leading-relaxed pt-2">
                            {confirmDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6 gap-3">
                        <AlertDialogCancel className="rounded-2xl border-none bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold uppercase text-[10px] tracking-widest h-12 px-6">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDialog.onConfirm}
                            className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-[0.2em] h-12 px-8 shadow-xl shadow-blue-100"
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
                            This will permanently remove the <strong>{docToDelete?.type}</strong> document from this vehicle. This action cannot be undone.
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

            {/* Not Renew Confirmation Dialog */}
            <AlertDialog open={!!docToNotRenew} onOpenChange={(open) => { if (!open) setDocToNotRenew(null); }}>
                <AlertDialogContent className="rounded-[32px] p-8 border-none shadow-2xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Not Renew {docToNotRenew?.type}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move the <strong>{docToNotRenew?.type}</strong> document to Old Documents and remove it from Live Documents.
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
        </div>
    );
}
