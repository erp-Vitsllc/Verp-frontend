'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import { Package, Search, Plus, Filter, MoreVertical, LayoutGrid, List as ListIcon, Shield, Laptop, Truck, Armchair, Briefcase } from 'lucide-react';
import AddAssetTypeModal from './components/AddAssetTypeModal';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

// Helper to get icon based on name (just for visual flair)
const getIconForType = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('laptop') || lower.includes('computer') || lower.includes('it')) return Laptop;
    if (lower.includes('vehicle') || lower.includes('car')) return Truck;
    if (lower.includes('furniture') || lower.includes('chair') || lower.includes('desk')) return Armchair;
    return Package; // Default
};

export default function AssetPage() {
    const [mounted, setMounted] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
    const [assetTypes, setAssetTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');

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
                                    {assetTypes.length} Asset Types | 0 Items
                                </p>
                            </div>

                            {/* Right Side - Actions Bar */}
                            <div className="flex items-center gap-4">
                                {/* Filter Icon */}
                                <button
                                    onClick={() => console.log('Filter clicked')}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors bg-white shadow-sm border border-gray-800/20"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                                    </svg>
                                </button>

                                {/* Search */}
                                <div className="relative flex-1 max-w-md w-64">
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <path d="m21 21-4.35-4.35"></path>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                    />
                                </div>

                                <button
                                    onClick={() => setIsAddTypeModalOpen(true)}
                                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
                                >
                                    <Plus size={18} />
                                    <span>Add Asset Type</span>
                                </button>
                            </div>
                        </div>

                        {/* Stats Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Total Asset Types', value: assetTypes.length, color: 'blue' },
                                { label: 'Total Items', value: '0', color: 'green' }, // TODO: Implement items count
                                { label: 'Assigned', value: '0', color: 'orange' },
                                { label: 'In Stock', value: '0', color: 'purple' }
                            ].map((stat, i) => (
                                <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                    <p className={`text-2xl font-bold text-${stat.color}-600 mt-2`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-4">
                            <h2 className="text-lg font-semibold text-gray-800">Asset Types</h2>
                        </div>

                        {/* Asset Types Grid */}
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse"></div>
                                ))}
                            </div>
                        ) : assetTypes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {assetTypes.filter(type =>
                                    !searchQuery ||
                                    type.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    type.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    type.assetId.toLowerCase().includes(searchQuery.toLowerCase())
                                ).map((type) => {
                                    const Icon = getIconForType(type.type);
                                    return (
                                        <div key={type._id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="text-gray-400 hover:text-blue-600">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                            <div className="flex flex-col items-center text-center">
                                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600 group-hover:scale-110 transition-transform">
                                                    <Icon size={32} />
                                                </div>
                                                <div className="mb-1">
                                                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{type.category}</span>
                                                </div>
                                                <h3 className="text-lg font-semibold text-gray-900">{type.type}</h3>
                                                <p className="text-xs text-gray-400 mb-2">{type.assetId}</p>

                                                <div className="mt-4 pt-4 border-t border-gray-50 w-full flex justify-between items-center text-xs text-gray-500">
                                                    <span>{type.total} Items</span>
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                        {type.unassigned} Available
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Empty State */
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[300px] flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                                    <Package size={32} className="text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">No Asset Types Found</h3>
                                <p className="text-gray-500 mt-2 max-w-sm">
                                    Start by defining categories for your company assets (e.g., Electronics, Vehicles).
                                </p>
                                <button
                                    onClick={() => setIsAddTypeModalOpen(true)}
                                    className="mt-6 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                                >
                                    Create Asset Type
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <AddAssetTypeModal
                    isOpen={isAddTypeModalOpen}
                    onClose={() => setIsAddTypeModalOpen(false)}
                    onSuccess={fetchAssetTypes}
                />
            </div>
        </PermissionGuard>
    );
}
