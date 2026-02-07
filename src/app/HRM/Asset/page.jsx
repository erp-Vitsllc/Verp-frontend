'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { isAdmin } from '@/utils/permissions';
import { Package, Search, Plus, Filter, MoreVertical, LayoutGrid, List as ListIcon, Shield, Laptop, Truck, Armchair, Briefcase, Download, Trash2, X, FileText, Eye } from 'lucide-react';
import AddAssetTypeModal from './components/AddAssetTypeModal';
import AccessoriesModal from './components/AccessoriesModal';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { UserPlus, Square, CheckSquare, User, Users } from 'lucide-react';
import AssignAssetModal from './components/AssignAssetModal';
import BulkAssignAssetModal from './components/BulkAssignAssetModal';

// Helper to get icon based on name (just for visual flair)
const getIconForType = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('laptop') || lower.includes('computer') || lower.includes('it')) return Laptop;
    if (lower.includes('vehicle') || lower.includes('car')) return Truck;
    if (lower.includes('furniture') || lower.includes('chair') || lower.includes('desk')) return Armchair;
    return Package; // Default
};

export default function AssetPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [activeTab, setActiveTab] = useState('asset');
    const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
    const [assetTypes, setAssetTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [currentInvoiceUrl, setCurrentInvoiceUrl] = useState('');

    // Accessories Modal State
    const [accessoriesModalOpen, setAccessoriesModalOpen] = useState(false);
    const [selectedAssetForAccessories, setSelectedAssetForAccessories] = useState(null);

    // Bulk Assignment State
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);
    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);

    // New Choice Modal States
    const [showAssignChoiceModal, setShowAssignChoiceModal] = useState(false);
    const [assignmentMode, setAssignmentMode] = useState(null); // 'individual' or 'bulk'
    const [isIndividualAssignModalOpen, setIsIndividualAssignModalOpen] = useState(false);
    const [selectedAssetForAssign, setSelectedAssetForAssign] = useState(null);

    useEffect(() => {
        setMounted(true);
        fetchAssetTypes();
    }, []);

    const fetchAssetTypes = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/AssetType');
            setAssetTypes(response.data);
        } catch (error) {
            console.error("Error fetching asset types", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDeleteAsset = async (id) => {
        if (!confirm('Are you sure you want to delete this asset?')) return;

        try {
            await axiosInstance.delete(`/AssetType/${id}`);
            toast({ title: 'Success', description: 'Asset deleted successfully' });
            fetchAssetTypes();
        } catch (error) {
            console.error('Delete failed:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete asset" });
        }
    };

    if (!mounted) return null;

    return (
        <PermissionGuard moduleId="hrm_asset" redirectTo="/dashboard">
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                        {/* Header and Actions in Single Row Matching Employee Page */}
                        <div className="flex items-center justify-between mb-6">
                            {/* Left Side - Header */}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Asset Management</h1>
                                <p className="text-gray-600">
                                    {assetTypes.length} Total Records
                                </p>
                            </div>

                            {/* Right Side - Actions Bar */}
                            <div className="flex items-center gap-4">
                                {/* Search */}
                                <div className="relative flex-1 max-w-md w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                    />
                                </div>

                                {activeTab === 'asset' && (
                                    <div className="flex items-center gap-2">
                                        {!selectionMode ? (
                                            <button
                                                onClick={() => setShowAssignChoiceModal(true)}
                                                className="bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
                                            >
                                                <UserPlus size={18} />
                                                <span>Assign</span>
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setSelectionMode(false);
                                                        setAssignmentMode(null);
                                                        setSelectedAssetIds([]);
                                                    }}
                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all active:scale-95"
                                                >
                                                    <X size={16} />
                                                    <span>Cancel</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (selectedAssetIds.length === 0) {
                                                            toast({ variant: "destructive", title: "Wait!", description: "Please select at least one asset first." });
                                                            return;
                                                        }
                                                        setIsBulkAssignModalOpen(true);
                                                    }}
                                                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95 ${selectedAssetIds.length > 0
                                                        ? 'bg-blue-600 hover:bg-blue-700 text-white animate-in zoom-in-95 duration-200'
                                                        : 'bg-blue-300 text-white cursor-not-allowed'}`}
                                                >
                                                    <UserPlus size={18} />
                                                    <span>Confirm Assign ({selectedAssetIds.length})</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {((activeTab === 'asset') || isAdmin()) && !selectionMode && (
                                    <button
                                        onClick={() => {
                                            setIsAddTypeModalOpen(true);
                                        }}
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        <Plus size={18} />
                                        <span>
                                            {activeTab === 'asset'
                                                ? 'Add Asset'
                                                : activeTab === 'category'
                                                    ? 'Add Category'
                                                    : 'Add Asset Type'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 mb-6">
                            <button
                                onClick={() => setActiveTab('asset')}
                                className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'asset'
                                    ? 'text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Assets
                                {activeTab === 'asset' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('type')}
                                className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'type'
                                    ? 'text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Asset Type
                                {activeTab === 'type' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('category')}
                                className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'category'
                                    ? 'text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Category
                                {activeTab === 'category' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {/* Asset Types Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    {activeTab === 'asset' ? (
                                        <>
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    {selectionMode && (
                                                        <th className="px-6 py-4 text-left">
                                                            <button
                                                                onClick={() => {
                                                                    const filteredAssets = assetTypes.filter(t => t.assetId?.startsWith('VEGA-ASSET-') && t.status === 'Unassigned');
                                                                    if (selectedAssetIds.length === filteredAssets.length) {
                                                                        setSelectedAssetIds([]);
                                                                    } else {
                                                                        setSelectedAssetIds(filteredAssets.map(a => a._id));
                                                                    }
                                                                }}
                                                                className="text-gray-400 hover:text-blue-500 transition-colors"
                                                            >
                                                                {selectedAssetIds.length > 0 && selectedAssetIds.length === assetTypes.filter(t => t.assetId?.startsWith('VEGA-ASSET-') && t.status === 'Unassigned').length ? (
                                                                    <CheckSquare size={18} className="text-blue-600" />
                                                                ) : (
                                                                    <Square size={18} className="text-gray-300" />
                                                                )}
                                                            </button>
                                                        </th>
                                                    )}
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">VALUE</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">PURCHASE DATE</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">WARRANTY</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ATTACHMENT</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">INVOICE NO</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">INVOICE</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ACCESSORIES</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"> </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {loading ? (
                                                    <tr><td colSpan={selectionMode ? "15" : "14"} className="px-6 py-8 text-center text-gray-500">Loading assets...</td></tr>
                                                ) : assetTypes.filter(t => t.assetId?.startsWith('VEGA-ASSET-') && (
                                                    !searchQuery ||
                                                    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    t.assetId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    t.type?.toLowerCase().includes(searchQuery.toLowerCase())
                                                )).length === 0 ? (
                                                    <tr><td colSpan={selectionMode ? "15" : "14"} className="px-6 py-8 text-center text-gray-500">No Assets Found.</td></tr>
                                                ) : (
                                                    assetTypes
                                                        .filter(t => t.assetId?.startsWith('VEGA-ASSET-'))
                                                        .filter(t =>
                                                            !searchQuery ||
                                                            t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                            t.assetId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                            t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                            t.type?.toLowerCase().includes(searchQuery.toLowerCase())
                                                        )
                                                        .map((item, index) => (
                                                            <tr
                                                                key={item._id}
                                                                className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedAssetIds.includes(item._id) ? 'bg-blue-50/20' : ''}`}
                                                                onClick={() => {
                                                                    if (selectionMode) {
                                                                        if (item.status === 'Unassigned') {
                                                                            if (assignmentMode === 'individual') {
                                                                                setSelectedAssetForAssign(item);
                                                                                setIsIndividualAssignModalOpen(true);
                                                                            } else {
                                                                                if (selectedAssetIds.includes(item._id)) {
                                                                                    setSelectedAssetIds(selectedAssetIds.filter(id => id !== item._id));
                                                                                } else {
                                                                                    setSelectedAssetIds([...selectedAssetIds, item._id]);
                                                                                }
                                                                            }
                                                                        }
                                                                    } else {
                                                                        router.push(`/HRM/Asset/details/${item._id}`);
                                                                    }
                                                                }}
                                                            >
                                                                {selectionMode && (
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        {item.status === 'Unassigned' ? (
                                                                            <div className="text-gray-400">
                                                                                {selectedAssetIds.includes(item._id) ? (
                                                                                    <CheckSquare size={18} className="text-blue-600" />
                                                                                ) : (
                                                                                    <Square size={18} className="text-gray-300" />
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-gray-200 opacity-50 cursor-not-allowed">
                                                                                <Square size={18} />
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                )}
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-blue-600 hover:underline">{item.assetId}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.type}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.category}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">{item.name || '-'}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(item.assetValue || 0)}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                                    {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('en-GB') : '-'}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                                    {item.warrantyYears ? `${item.warrantyYears} Years` : 'Nil'}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {item.warrantyAttachment ? (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setCurrentInvoiceUrl(item.warrantyAttachment);
                                                                                setInvoiceModalOpen(true);
                                                                            }}
                                                                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-xs font-semibold hover:bg-teal-100 transition-colors"
                                                                        >
                                                                            <Download size={12} />
                                                                            View
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400 font-medium">Nil</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.invoiceNumber || '-'}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {item.invoiceFile ? (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setCurrentInvoiceUrl(item.invoiceFile);
                                                                                setInvoiceModalOpen(true);
                                                                            }}
                                                                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors"
                                                                        >
                                                                            <Download size={12} />
                                                                            View
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">Not Uploaded</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedAssetForAccessories(item);
                                                                            setAccessoriesModalOpen(true);
                                                                        }}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors border border-blue-100"
                                                                        title="View Accessories"
                                                                    >
                                                                        <Eye size={12} />
                                                                        View
                                                                    </button>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.status === 'Assigned' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                                        {item.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {!item.assignedTo && item.status === 'Unassigned' && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedAssetIds([item._id]);
                                                                                    setIsBulkAssignModalOpen(true);
                                                                                }}
                                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                                                title="Assign this asset"
                                                                            >
                                                                                <UserPlus size={16} />
                                                                            </button>
                                                                        )}
                                                                        {isAdmin() && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteAsset(item._id);
                                                                                }}
                                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                                title="Delete asset"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                )}
                                            </tbody>
                                        </>
                                    ) : activeTab === 'category' ? (
                                        <>
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSET</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSIGN</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">UNASSIGN</th>
                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {(() => {
                                                    // Map out official categories first
                                                    const officialCats = assetTypes.filter(t => t.assetId?.startsWith('asset-cat-'));

                                                    // Accumulate types and asset stats for these categories
                                                    const categories = officialCats.reduce((acc, cat) => {
                                                        acc[cat.category] = {
                                                            name: cat.category,
                                                            categoryId: cat.assetId,
                                                            _id: cat._id,
                                                            typeNames: cat.type ? [cat.type] : [],
                                                            assetCount: 0,
                                                            assignedTotal: 0,
                                                            unassignedTotal: 0,
                                                            imagePreview: cat.imagePreview
                                                        };
                                                        return acc;
                                                    }, {});

                                                    // Fill data from the flat list
                                                    assetTypes.forEach(curr => {
                                                        const cat = categories[curr.category];
                                                        if (!cat) return;

                                                        if (curr.assetId?.startsWith('VEGA-ASSET-')) {
                                                            cat.assetCount += 1;
                                                            cat.assignedTotal += (curr.assigned || 0);
                                                            cat.unassignedTotal += (curr.unassigned || 0);

                                                            // Collect type names from assets in this category
                                                            if (curr.type && curr.type !== '-' && !cat.typeNames.includes(curr.type)) {
                                                                cat.typeNames.push(curr.type);
                                                            }
                                                        }
                                                    });

                                                    const categoryList = Object.values(categories).filter(c =>
                                                        !searchQuery ||
                                                        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                        (c.typeNames && c.typeNames.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
                                                    );

                                                    if (loading) return <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>;
                                                    if (categoryList.length === 0) return <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No Categories Found.</td></tr>;

                                                    return categoryList.map((cat, index) => (
                                                        <tr
                                                            key={cat._id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveTab('asset');
                                                                setSearchQuery(cat.name);
                                                            }}
                                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                        >
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">
                                                                        {cat.imagePreview ? (
                                                                            <img src={cat.imagePreview} alt={cat.name} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                                <Package size={16} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className="font-bold text-gray-900">{cat.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{cat.categoryId || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-600 font-normal">
                                                                {cat.typeNames.length > 0 ? cat.typeNames.join(', ') : '-'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{cat.assetCount}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{cat.assignedTotal}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{cat.unassignedTotal}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                                {isAdmin() && (
                                                                    <button disabled className="p-1.5 text-gray-300 cursor-not-allowed rounded-lg transition-all opacity-50">
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </>
                                    ) : (
                                        <>
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSETS</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSIGNED</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">UNASSIGNED</th>
                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {loading ? (
                                                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">Loading assets...</td></tr>
                                                ) : assetTypes.filter(t => t.assetId?.startsWith('asset-type-')).length === 0 ? (
                                                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No Asset Types Found.</td></tr>
                                                ) : (() => {
                                                    // Dynamic counters for asset types
                                                    const typeStats = assetTypes.filter(t => t.assetId?.startsWith('VEGA-ASSET-')).reduce((acc, curr) => {
                                                        if (!acc[curr.type]) acc[curr.type] = { count: 0, assigned: 0, unassigned: 0, categories: new Set() };
                                                        acc[curr.type].count++;
                                                        acc[curr.type].assigned += (curr.assigned || 0);
                                                        acc[curr.type].unassigned += (curr.unassigned || 0);
                                                        if (curr.category) acc[curr.type].categories.add(curr.category);
                                                        return acc;
                                                    }, {});

                                                    return assetTypes
                                                        .filter(t => t.assetId?.startsWith('asset-type-'))
                                                        .filter(type => !searchQuery || type.type.toLowerCase().includes(searchQuery.toLowerCase()) || (type.category && type.category.toLowerCase().includes(searchQuery.toLowerCase())) || type.assetId.toLowerCase().includes(searchQuery.toLowerCase()))
                                                        .map((type, index) => {
                                                            const Icon = getIconForType(type.type);
                                                            const stats = typeStats[type.type] || { count: 0, assigned: 0, unassigned: 0, categories: new Set() };

                                                            return (
                                                                <tr
                                                                    key={type._id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveTab('category');
                                                                        setSearchQuery(type.type);
                                                                    }}
                                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                                >
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">
                                                                                {type.imagePreview ? (
                                                                                    <img src={type.imagePreview} alt={type.type} className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                                        <Icon size={16} />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <span className="font-bold text-gray-900">{type.type}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{type.assetId}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{type.categoryCount || 0}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{stats.count}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{stats.assigned}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{stats.unassigned}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                        {isAdmin() && (
                                                                            <button disabled className="p-1.5 text-gray-300 cursor-not-allowed rounded-lg transition-all opacity-50">
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                })()}
                                            </tbody>
                                        </>
                                    )}
                                </table>
                            </div>

                            {/* Simple Pagination Footer (Placeholder) */}
                            {assetTypes.length > 0 && (
                                <div className="px-6 py-4 border-t border-gray-200">
                                    <p className="text-sm text-gray-500">
                                        Showing {assetTypes.length} entries
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <AddAssetTypeModal
                    isOpen={isAddTypeModalOpen}
                    onClose={() => setIsAddTypeModalOpen(false)}
                    onSuccess={fetchAssetTypes}
                    mode={activeTab}
                    preSelectedType={activeTab === 'category' ? searchQuery : ''}
                    preSelectedCategory={activeTab === 'asset' ? searchQuery : ''}
                />

                <AccessoriesModal
                    isOpen={accessoriesModalOpen}
                    onClose={() => setAccessoriesModalOpen(false)}
                    asset={selectedAssetForAccessories}
                    onUpdate={fetchAssetTypes}
                />

                {/* Invoice Viewer Modal */}
                {
                    invoiceModalOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <FileText size={20} className="text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 leading-none">Document Preview</h3>
                                            <p className="text-xs text-gray-500 mt-1">Viewing attached file</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <a
                                            href={currentInvoiceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all active:scale-95"
                                            title="Download Document"
                                            download
                                        >
                                            <Download size={18} />
                                            Download
                                        </a>
                                        <button
                                            onClick={() => setInvoiceModalOpen(false)}
                                            className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all active:scale-95"
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 bg-gray-50/50 relative overflow-hidden flex items-center justify-center">
                                    {currentInvoiceUrl ? (
                                        currentInvoiceUrl.toLowerCase().includes('pdf') || !currentInvoiceUrl.match(/\.(jpeg|jpg|png|gif|webp)/i) ? (
                                            <iframe
                                                src={`${currentInvoiceUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                                className="w-full h-full border-0 rounded-b-2xl shadow-inner bg-white"
                                                title="Document Preview"
                                            />
                                        ) : (
                                            <div className="w-full h-full p-8 flex items-center justify-center overflow-auto">
                                                <img
                                                    src={currentInvoiceUrl}
                                                    alt="Document"
                                                    className="max-w-full max-h-full object-contain rounded-lg shadow-xl ring-1 ring-black/5"
                                                />
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-gray-400 flex flex-col items-center gap-4 py-20">
                                            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                                                <FileText size={40} className="text-gray-300" />
                                            </div>
                                            <p className="font-medium text-gray-500">No document to display</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                <AssignAssetModal
                    isOpen={isIndividualAssignModalOpen}
                    onClose={() => {
                        setIsIndividualAssignModalOpen(false);
                        setSelectedAssetForAssign(null);
                    }}
                    asset={selectedAssetForAssign}
                    availableAssets={assetTypes.filter(a => a.status === 'Unassigned' && a.assetId?.startsWith('VEGA-ASSET-'))}
                    onUpdate={fetchAssetTypes}
                />

                <BulkAssignAssetModal
                    isOpen={isBulkAssignModalOpen}
                    onClose={() => {
                        setIsBulkAssignModalOpen(false);
                        setSelectedAssetIds([]);
                    }}
                    selectedAssets={assetTypes.filter(a => selectedAssetIds.includes(a._id))}
                    allAvailableAssets={assetTypes.filter(a => a.status === 'Unassigned' && a.assetId?.startsWith('VEGA-ASSET-'))}
                    onUpdate={fetchAssetTypes}
                />

                {/* Assignment Choice Modal */}
                {showAssignChoiceModal && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Assign Assets</h2>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Choose Assignment Method</p>
                                </div>
                                <button
                                    onClick={() => setShowAssignChoiceModal(false)}
                                    className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Individual Option */}
                                <button
                                    onClick={() => {
                                        setShowAssignChoiceModal(false);
                                        setIsIndividualAssignModalOpen(true);
                                    }}
                                    className="group flex flex-col items-center gap-6 p-8 rounded-[24px] border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    <div className="w-20 h-20 rounded-[28px] bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-blue-200 transition-all duration-300">
                                        <User size={36} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-2">Individual</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Assign a single asset directly</p>
                                    </div>
                                </button>

                                {/* Bulk Option */}
                                <button
                                    onClick={() => {
                                        setShowAssignChoiceModal(false);
                                        setIsBulkAssignModalOpen(true);
                                    }}
                                    className="group flex flex-col items-center gap-6 p-8 rounded-[24px] border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    <div className="w-20 h-20 rounded-[28px] bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-blue-200 transition-all duration-300">
                                        <Users size={36} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-2">Bulk</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Build a batch assignment list</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div >
        </PermissionGuard >
    );
}
